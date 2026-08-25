import type { Page, Route } from '@playwright/test';

export const ids = {
  user: '00000000-0000-4000-8000-000000000001',
  org: '00000000-0000-4000-8000-000000000002',
  project: '00000000-0000-4000-8000-000000000003',
  environment: '00000000-0000-4000-8000-000000000004',
  monitor: '00000000-0000-4000-8000-000000000005',
  incident: '00000000-0000-4000-8000-000000000006',
};

export interface ApiFixtureState {
  authenticated: boolean;
  hierarchy: boolean;
  role: 'owner' | 'viewer';
  monitorCreated: boolean;
  monitorPaused: boolean;
  monitorName: string;
  incidentAcknowledged: boolean;
  incidentResolved: boolean;
  notificationsEnabled: boolean;
  invitationSent: boolean;
  expireSession: boolean;
  dashboardRequests: number;
  sseRefreshOnce: boolean;
}

const user = { id: ids.user, email: 'owner@example.com', email_verified: true };
const actions = {
  owner: [
    'tenant:read',
    'tenant:manage',
    'members:read',
    'members:invite',
    'members:manage',
    'monitors:read',
    'monitors:manage',
    'incidents:read',
    'incidents:manage',
  ],
  viewer: ['tenant:read', 'members:read', 'monitors:read', 'incidents:read'],
};

export async function installApiFixture(page: Page, initial: Partial<ApiFixtureState> = {}) {
  const state: ApiFixtureState = {
    authenticated: initial.authenticated ?? false,
    hierarchy: initial.hierarchy ?? false,
    role: initial.role ?? 'owner',
    monitorCreated: initial.monitorCreated ?? false,
    monitorPaused: initial.monitorPaused ?? false,
    monitorName: initial.monitorName ?? 'Public API health',
    incidentAcknowledged: initial.incidentAcknowledged ?? false,
    incidentResolved: initial.incidentResolved ?? false,
    notificationsEnabled: initial.notificationsEnabled ?? true,
    invitationSent: initial.invitationSent ?? false,
    expireSession: false,
    dashboardRequests: 0,
    sseRefreshOnce: initial.sseRefreshOnce ?? false,
  };

  await page.route('**/api/v1/**', async (route) => handleApi(route, state));
  return state;
}

async function handleApi(route: Route, state: ApiFixtureState) {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname.replace('/api/v1', '');
  const method = request.method();

  if (path === '/auth/refresh' && method === 'POST') {
    if (!state.authenticated || state.expireSession)
      return error(route, 401, 'invalid_refresh_token');
    return json(route, 200, auth());
  }
  if (path === '/auth/signup' || path === '/auth/login') {
    state.authenticated = true;
    return json(route, path.endsWith('signup') ? 201 : 200, auth());
  }
  if (path === '/auth/forgot-password') return route.fulfill({ status: 202 });
  if (path === '/auth/reset-password') return route.fulfill({ status: 204 });
  if (path === '/auth/verify-email') return json(route, 200, { user });
  if (path === '/auth/me') {
    if (state.expireSession) return error(route, 401, 'invalid_session');
    return json(route, 200, { user });
  }
  if (path === '/auth/logout') {
    state.authenticated = false;
    return route.fulfill({ status: 204 });
  }
  if (state.expireSession) return error(route, 401, 'invalid_session');
  if (path === '/organizations' && method === 'GET') {
    return json(route, 200, { organizations: state.hierarchy ? [organization(state.role)] : [] });
  }
  if (path === '/organizations' && method === 'POST') {
    state.hierarchy = true;
    return json(route, 201, {
      organization: organization('owner'),
      membership: { organization_id: ids.org, user_id: ids.user, role: 'owner' },
      project: project('owner'),
      environment: environment('owner'),
    });
  }
  if (path === `/organizations/${ids.org}/projects`) {
    return json(route, 200, { projects: [project(state.role)] });
  }
  if (path === `/projects/${ids.project}/environments`) {
    return json(route, 200, { environments: [environment(state.role)] });
  }
  if (path === `/environments/${ids.environment}/events`) {
    if (state.sseRefreshOnce) {
      state.sseRefreshOnce = false;
      await new Promise((resolve) => setTimeout(resolve, 300));
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `id: 1\nevent: dashboard.changed\ndata: {"resource_type":"dashboard","resource_id":"${ids.environment}"}\n\n`,
      });
    }
    return error(route, 503, 'event_stream_unavailable');
  }
  if (path === `/environments/${ids.environment}/dashboard`) {
    state.dashboardRequests += 1;
    return json(route, 200, dashboard());
  }
  if (path === `/environments/${ids.environment}/monitors` && method === 'GET') {
    return json(route, 200, {
      monitors: state.monitorCreated ? [monitor(state)] : [],
    });
  }
  if (path === `/environments/${ids.environment}/monitors` && method === 'POST') {
    state.monitorCreated = true;
    const body = request.postDataJSON() as { name?: string };
    state.monitorName = body.name ?? state.monitorName;
    return json(route, 201, monitor(state));
  }
  if (path === `/environments/${ids.environment}/monitors/${ids.monitor}` && method === 'GET') {
    return json(route, 200, { ...monitor(state), state: 'unknown', recent_checks: [] });
  }
  if (path === `/environments/${ids.environment}/monitors/${ids.monitor}` && method === 'PUT') {
    const body = request.postDataJSON() as { name?: string };
    state.monitorName = body.name ?? state.monitorName;
    return json(route, 200, monitor(state));
  }
  if (path === `/environments/${ids.environment}/monitors/${ids.monitor}` && method === 'DELETE') {
    state.monitorCreated = false;
    return route.fulfill({ status: 204 });
  }
  if (path === `/environments/${ids.environment}/monitors/${ids.monitor}/report`) {
    return json(route, 200, report());
  }
  if (path === `/environments/${ids.environment}/monitors/${ids.monitor}/checks`) {
    return json(route, 200, { items: [], next_cursor: null });
  }
  if (path.endsWith('/test') && method === 'POST') {
    return json(route, 202, { job_id: '00000000-0000-4000-8000-000000000099' });
  }
  if ((path.endsWith('/pause') || path.endsWith('/resume')) && method === 'POST') {
    state.monitorPaused = path.endsWith('/pause');
    return json(route, 200, monitor(state));
  }
  if (path === `/environments/${ids.environment}/incidents`) {
    return json(route, 200, {
      items: [incident(state.incidentAcknowledged, state.incidentResolved)],
      next_cursor: null,
    });
  }
  if (path === `/environments/${ids.environment}/incidents/${ids.incident}`) {
    return json(route, 200, incidentSummary(state.incidentAcknowledged, state.incidentResolved));
  }
  if (path.endsWith('/acknowledge') && method === 'POST') {
    state.incidentAcknowledged = true;
    return json(route, 200, incidentSummary(true, state.incidentResolved));
  }
  if (path.endsWith('/resolve') && method === 'POST') {
    state.incidentResolved = true;
    return json(route, 200, incidentSummary(state.incidentAcknowledged, true));
  }
  if (path === `/organizations/${ids.org}/members`) {
    return json(route, 200, {
      members: [
        {
          user_id: ids.user,
          email: user.email,
          role: state.role,
          incident_notifications_enabled: state.notificationsEnabled,
          created_at: '2026-08-20T10:00:00Z',
        },
      ],
    });
  }
  if (path === `/organizations/${ids.org}/invitations` && method === 'POST') {
    state.invitationSent = true;
    const body = request.postDataJSON() as { email: string; role: string };
    return json(route, 201, {
      organization_id: ids.org,
      email: body.email,
      role: body.role,
      expires_at: '2026-09-02T00:00:00Z',
    });
  }
  if (path === `/organizations/${ids.org}/members/${ids.user}` && method === 'PATCH') {
    const body = request.postDataJSON() as { incident_notifications_enabled?: boolean };
    state.notificationsEnabled = body.incident_notifications_enabled ?? state.notificationsEnabled;
    return json(route, 200, {
      user_id: ids.user,
      email: user.email,
      role: state.role,
      incident_notifications_enabled: state.notificationsEnabled,
      created_at: '2026-08-20T10:00:00Z',
    });
  }
  return error(route, 404, 'not_found');
}

function auth() {
  return {
    user,
    session: { token: 'access-token', token_type: 'Bearer', expires_at: '2099-01-01T00:00:00Z' },
  };
}
function organization(role: 'owner' | 'viewer') {
  return {
    id: ids.org,
    name: 'Northstar Labs',
    slug: 'northstar-labs',
    role,
    allowed_actions: actions[role],
    created_at: '2026-08-20T10:00:00Z',
  };
}
function project(role: 'owner' | 'viewer') {
  return {
    id: ids.project,
    organization_id: ids.org,
    name: 'Core API',
    description: 'Production API',
    role,
    allowed_actions: actions[role],
  };
}
function environment(role: 'owner' | 'viewer') {
  return {
    id: ids.environment,
    organization_id: ids.org,
    project_id: ids.project,
    name: 'Production',
    type: 'production',
    role,
    allowed_actions: actions[role],
  };
}
function monitor(state: ApiFixtureState) {
  return {
    id: ids.monitor,
    organization_id: ids.org,
    environment_id: ids.environment,
    name: state.monitorName,
    url: 'https://api.example.com/health',
    method: 'GET',
    interval_seconds: 60,
    timeout_seconds: 5,
    expected_status_min: 200,
    expected_status_max: 299,
    version: 1,
    paused: state.monitorPaused,
    worker_pool_id: 'hosted',
    header_names: [],
  };
}
function report() {
  return {
    from: '2026-08-25T00:00:00Z',
    to: '2026-08-26T00:00:00Z',
    expected: 24,
    observed: 18,
    successful: 18,
    unknown: 6,
    observed_uptime: 1,
    coverage: 0.75,
    average_latency_ms: 126,
    fresh: true,
    corrected_at: null,
  };
}
function dashboard() {
  return {
    states: { healthy: 1, degraded: 0, down: 0, unknown: 1 },
    reliability: report(),
    open_incidents: 1,
    generated_at: '2026-08-26T00:00:00Z',
  };
}
function incident(acknowledged: boolean, resolved: boolean) {
  return {
    id: ids.incident,
    organization_id: ids.org,
    environment_id: ids.environment,
    monitor_id: ids.monitor,
    status: resolved ? 'resolved' : 'open',
    started_at: '2026-08-25T09:00:00Z',
    opened_at: '2026-08-25T09:02:00Z',
    acknowledged_at: acknowledged ? '2026-08-25T09:05:00Z' : null,
    acknowledged_by_user_id: acknowledged ? ids.user : null,
    resolved_at: resolved ? '2026-08-25T09:08:00Z' : null,
    resolved_by_user_id: resolved ? ids.user : null,
    resolution_kind: resolved ? 'manual_resolution' : null,
    resolution_reason: resolved ? 'Resolved from browser test' : null,
  };
}
function incidentSummary(acknowledged: boolean, resolved: boolean) {
  return {
    incident: incident(acknowledged, resolved),
    events: [
      {
        id: '00000000-0000-4000-8000-000000000010',
        type: 'incident_opened',
        actor_user_id: null,
        source_job_id: null,
        reason: null,
        occurred_at: '2026-08-25T09:02:00Z',
      },
      ...(acknowledged
        ? [
            {
              id: '00000000-0000-4000-8000-000000000011',
              type: 'incident_acknowledged',
              actor_user_id: ids.user,
              source_job_id: null,
              reason: 'Investigating',
              occurred_at: '2026-08-25T09:05:00Z',
            },
          ]
        : []),
      ...(resolved
        ? [
            {
              id: '00000000-0000-4000-8000-000000000013',
              type: 'manual_resolution',
              actor_user_id: ids.user,
              source_job_id: null,
              reason: 'Resolved from browser test',
              occurred_at: '2026-08-25T09:08:00Z',
            },
          ]
        : []),
    ],
    deliveries: [
      {
        id: '00000000-0000-4000-8000-000000000012',
        transition: 'opened',
        state: 'accepted',
        attempts: 1,
        next_attempt_at: '2026-08-25T09:02:00Z',
        provider_status: 'accepted',
        accepted_at: '2026-08-25T09:02:02Z',
        failed_at: null,
      },
    ],
  };
}
function json(route: Route, status: number, body: unknown) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
function error(route: Route, status: number, code: string) {
  return json(route, status, {
    error: { code, message: code.replaceAll('_', ' '), request_id: 'fixture-request' },
  });
}
