import { expect, test } from '@playwright/test';
import { Client } from 'pg';

test('actual Go API supports signup, hierarchy, monitor creation, reporting, and logout', async ({
  page,
}) => {
  const email = `frontend-${Date.now()}@example.com`;
  await page.goto('/signup');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel(/^Password/).fill('real-backend-password');
  await page.getByLabel('Confirm password').fill('real-backend-password');
  await page.getByLabel(/authorized to monitor/).check();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: 'What are we keeping watch over?' })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByLabel('Organization name').fill('Frontend Real Backend');
  await page.getByLabel('Organization slug').fill(`frontend-${Date.now()}`);
  await page.getByLabel('Project name').fill('Public API');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Monitoring overview' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('No data').first()).toBeVisible();

  await page.getByRole('link', { name: 'Monitors', exact: true }).click();
  await page.getByRole('link', { name: 'Create your first monitor' }).click();
  await page.getByLabel('Monitor name').fill('Example availability');
  await page.getByLabel('Target URL').fill('https://example.com/');
  await page.getByRole('button', { name: 'Create monitor' }).click();
  await expect(page.getByRole('heading', { name: 'Example availability' })).toBeVisible();
  await expect(page.getByText('Monitoring state is unknown')).toBeVisible();

  const database = new Client({ connectionString: process.env.WATCHTRACE_E2E_DATABASE_URL });
  await database.connect();
  const fixture = await database.query<{
    organization_id: string;
    environment_id: string;
    monitor_id: string;
  }>(
    `SELECT m.organization_id::text,m.environment_id::text,m.id::text monitor_id
     FROM monitors m WHERE m.name=$1 ORDER BY m.created_at DESC LIMIT 1`,
    ['Example availability'],
  );
  const tenant = fixture.rows[0];
  if (!tenant) throw new Error('Real-backend monitor fixture was not stored');
  const rule = await database.query<{ id: string }>(
    `INSERT INTO alert_rules(organization_id,environment_id,monitor_id)
     VALUES($1::uuid,$2::uuid,$3::uuid) RETURNING id::text`,
    [tenant.organization_id, tenant.environment_id, tenant.monitor_id],
  );
  const inserted = await database.query<{ id: string }>(
    `INSERT INTO incidents(organization_id,environment_id,monitor_id,alert_rule_id,status,started_at,opened_at)
     VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,'open',CURRENT_TIMESTAMP-INTERVAL '2 minutes',CURRENT_TIMESTAMP)
     RETURNING id::text`,
    [tenant.organization_id, tenant.environment_id, tenant.monitor_id, rule.rows[0].id],
  );
  const incidentId = inserted.rows[0].id;
  await database.query(
    `INSERT INTO incident_events(organization_id,environment_id,incident_id,event_key,event_type,occurred_at)
     VALUES($1::uuid,$2::uuid,$3::uuid,'controlled-failure-opened','opened',CURRENT_TIMESTAMP)`,
    [tenant.organization_id, tenant.environment_id, incidentId],
  );
  await database.end();

  await page.getByRole('link', { name: 'Incidents', exact: true }).click();
  await page.getByRole('link', { name: /Aug/ }).click();
  await page.getByRole('button', { name: 'Acknowledge' }).click();
  await page.getByLabel('Reason').fill('Controlled backend failure fixture');
  await page.getByRole('dialog').getByRole('button', { name: 'Acknowledge', exact: true }).click();
  await expect(page.getByText('Acknowledged, still open')).toBeVisible();

  await page.getByRole('button', { name: new RegExp(email) }).click();
  await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
