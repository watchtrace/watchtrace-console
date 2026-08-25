# WatchTrace Console

React and TypeScript customer console for WatchTrace Phase 1 uptime monitoring. It is a separate repository and communicates only through the frozen customer API contract in [`openapi/customer-v1.openapi.yaml`](openapi/customer-v1.openapi.yaml).

## Requirements

- Node.js 22.12 or newer (CI and the container build use Node 24.12)
- npm 10 or newer
- Chromium installed through Playwright for browser tests
- Docker and the sibling `watchtrace-platform` repository only for the optional real-backend browser suite

## Local development

```sh
npm ci
npm run dev
```

Vite serves the console at `http://127.0.0.1:3000` and proxies `/api` to `http://127.0.0.1:8080`. Set `WATCHTRACE_DEV_API_URL` to change the development proxy target.

Runtime build configuration is documented in `.env.example`:

- `VITE_API_BASE_URL` defaults to `/api/v1`.
- `VITE_API_CONTRACT_VERSION` must equal the compiled contract version `1.0.0`.
- `VITE_REQUEST_TIMEOUT_MS` defaults to 10 seconds.

Access tokens remain in memory. Session restoration and rotation use the backend’s scoped HttpOnly refresh cookie; no token is stored in local or session storage.

## Verification

```sh
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run contract:check
npm run build
npx playwright install chromium
npm run test:browser
```

`npm run test:browser` uses a controlled API fixture for deterministic signup, realtime interruption, polling, incident, role, responsive, session-expiry, and accessibility scenarios.

To exercise the actual Go API with ephemeral PostgreSQL and Mailpit containers:

```sh
npm run test:browser:real
```

The real-backend suite creates an account, tenant hierarchy, and monitor solely through the public API. It then inserts a controlled incident fixture into the ephemeral test database and verifies incident acknowledgement through the actual API. Override the sibling backend location with `WATCHTRACE_PLATFORM_DIR` if needed.

## Structure

```text
src/api          frozen generated types, client, and endpoint boundary
src/auth         account and session flows
src/tenants      hierarchy onboarding and workspace settings
src/dashboard    observed uptime and coverage overview
src/monitors     lifecycle, reports, history, and ECharts latency view
src/incidents    incident lists, timelines, notifications, and actions
src/team         membership, roles, invitations, and alert preferences
src/realtime     authenticated SSE refresh hints and polling fallback
e2e              controlled and real-backend Playwright suites
openapi          pinned Phase 1 customer API contract
```

SSE messages are refresh hints only. Ordinary authorized APIs remain the source of truth, and a 15-second polling fallback reconstructs state after disconnection or browser sleep.

## Build artifact

`npm run build` creates a route-split static build in `dist/` with `build.json` recording frontend version `1.0.0` and compatible API contract `1.0.0`. CI uploads it as the versioned `watchtrace-console-v1.0.0` artifact. The Dockerfile packages the same build behind Nginx; API/SSE proxying belongs to the deferred deployment configuration.
