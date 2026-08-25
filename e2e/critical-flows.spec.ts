import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ids, installApiFixture } from './apiFixture';

test('signup to monitor detail preserves unknown coverage semantics', async ({ page }) => {
  await installApiFixture(page);
  await page.goto('/signup');
  await page.getByLabel('Work email').fill('owner@example.com');
  await page.getByLabel(/^Password/).fill('a-secure-password');
  await page.getByLabel('Confirm password').fill('a-secure-password');
  await page.getByLabel(/authorized to monitor/).check();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(
    page.getByRole('heading', { name: 'What are we keeping watch over?' }),
  ).toBeVisible();
  await page.getByLabel('Organization name').fill('Northstar Labs');
  await page.getByLabel('Project name').fill('Core API');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Monitoring overview' })).toBeVisible();
  await expect(page.getByText('Coverage is incomplete')).toBeVisible();
  await expect(page.getByText('75.0%')).toBeVisible();

  await page.getByRole('link', { name: 'Monitors' }).click();
  await expect(page.getByRole('heading', { name: 'No monitors yet' })).toBeVisible();
  await page.getByRole('link', { name: 'Create your first monitor' }).click();
  await page.getByLabel('Monitor name').fill('Public API health');
  await page.getByLabel('Target URL').fill('https://api.example.com/health');
  await page.getByRole('button', { name: 'Create monitor' }).click();
  await expect(page.getByRole('heading', { name: 'Public API health' })).toBeVisible();
  await expect(page.getByText('Monitoring state is unknown')).toBeVisible();
  await expect(page.getByText('Unknown is not healthy.')).toBeVisible();
});

test('incident acknowledgement, polling fallback, and session expiry recover safely', async ({
  page,
}) => {
  const state = await installApiFixture(page, {
    authenticated: true,
    hierarchy: true,
    monitorCreated: true,
    sseRefreshOnce: true,
  });
  await page.clock.install();
  await page.goto(`/app/${ids.org}/${ids.project}/${ids.environment}/overview`);
  await expect(page.getByText('Polling')).toBeVisible();
  expect(state.sseRefreshOnce).toBe(false);
  const before = state.dashboardRequests;
  await page.clock.fastForward(16_000);
  await expect.poll(() => state.dashboardRequests).toBeGreaterThan(before);

  await page.getByRole('link', { name: 'Incidents', exact: true }).click();
  await page.getByRole('link', { name: /Aug/ }).click();
  await page.getByRole('button', { name: 'Acknowledge' }).click();
  await page.getByLabel('Reason').fill('Investigating');
  await page.getByRole('dialog').getByRole('button', { name: 'Acknowledge', exact: true }).click();
  await expect(page.getByText('Acknowledged, still open')).toBeVisible();
  await page.getByRole('button', { name: 'Resolve manually' }).click();
  await page.getByLabel('Reason').fill('Resolved from controlled recovery');
  await page.getByRole('dialog').getByRole('button', { name: 'Resolve incident' }).click();
  await expect(page.getByText('INCIDENT · RESOLVED')).toBeVisible();

  state.expireSession = true;
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in to your console' })).toBeVisible();
});

test('viewer restrictions are clear and dashboard is accessible and responsive', async ({
  page,
}) => {
  await installApiFixture(page, {
    authenticated: true,
    hierarchy: true,
    monitorCreated: true,
    role: 'viewer',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/app/${ids.org}/${ids.project}/${ids.environment}/overview`);
  await expect(page.getByRole('heading', { name: 'Monitoring overview' })).toBeVisible();
  await expect(page.getByText('Unknown').first()).toBeVisible();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Monitors' }).click();
  await expect(page.getByRole('link', { name: 'New monitor' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Team & alerts' }).click();
  await expect(page.getByText('Read-only team access')).toBeVisible();

  await page.goto(`/app/${ids.org}/${ids.project}/${ids.environment}/overview`);
  await expect(page.getByRole('heading', { name: 'Monitoring overview' })).toBeVisible();
  const violations = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(violations.violations).toEqual([]);
});

test('account recovery, membership preferences, and invitations use the API', async ({ page }) => {
  const state = await installApiFixture(page);
  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill('owner@example.com');
  await page.getByRole('button', { name: 'Send reset instructions' }).click();
  await expect(page.getByText('Check your inbox')).toBeVisible();

  await page.goto('/reset-password?token=reset-token');
  await page.getByLabel('New password').fill('replacement-password');
  await page.getByLabel('Confirm password').fill('replacement-password');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByText('Password updated')).toBeVisible();

  await page.goto('/verify-email?token=verify-token');
  await page.getByRole('button', { name: 'Verify email' }).click();
  await expect(page.getByText('Your email is verified.')).toBeVisible();

  state.authenticated = true;
  state.hierarchy = true;
  await page.goto(`/app/${ids.org}/${ids.project}/${ids.environment}/team`);
  const notificationSwitch = page.getByLabel('Incident notifications for owner@example.com');
  await notificationSwitch.click();
  await expect.poll(() => state.notificationsEnabled).toBe(false);
  await expect(notificationSwitch).not.toBeChecked();
  await page.getByRole('textbox', { name: 'Email' }).fill('teammate@example.com');
  await page.getByRole('button', { name: 'Send invitation' }).click();
  await expect(page.getByText('Invitation sent to teammate@example.com')).toBeVisible();
  expect(state.invitationSent).toBe(true);
});

test('member can test, pause, edit, and delete a monitor', async ({ page }) => {
  const state = await installApiFixture(page, {
    authenticated: true,
    hierarchy: true,
    monitorCreated: true,
  });
  await page.goto(`/app/${ids.org}/${ids.project}/${ids.environment}/monitors`);
  await page.getByRole('button', { name: 'Actions for Public API health' }).click();
  await page.getByRole('menuitem', { name: 'Run manual test' }).click();
  await expect(page.getByText('Manual check queued. It does not affect uptime.')).toBeVisible();

  await page.getByRole('button', { name: 'Actions for Public API health' }).click();
  await page.getByRole('menuitem', { name: 'Pause' }).click();
  await expect.poll(() => state.monitorPaused).toBe(true);
  await expect(
    page.getByRole('row', { name: /Public API health/ }).getByText('Paused', { exact: true }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Actions for Public API health' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  await page.getByLabel('Monitor name').fill('Renamed API health');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Renamed API health' })).toBeVisible();

  await page.getByRole('link', { name: 'Monitors', exact: true }).click();
  await page.getByRole('button', { name: 'Actions for Renamed API health' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete monitor' }).click();
  await expect(page.getByRole('heading', { name: 'No monitors yet' })).toBeVisible();
  expect(state.monitorCreated).toBe(false);
});
