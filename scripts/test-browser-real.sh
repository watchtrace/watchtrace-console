#!/bin/sh
set -eu

frontend_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
platform_root=${WATCHTRACE_PLATFORM_DIR:-"$frontend_root/../watchtrace-platform"}
compose_file="$platform_root/docker-compose.yml"
project_name="watchtrace-frontend-e2e-$$"
environment_file=$(mktemp "${TMPDIR:-/tmp}/watchtrace-frontend-e2e.XXXXXX")
api_log=$(mktemp "${TMPDIR:-/tmp}/watchtrace-frontend-api.XXXXXX")
api_pid=""

compose() {
  env WATCHTRACE_POSTGRES_ENV_FILE="$environment_file" \
    WATCHTRACE_POSTGRES_PORT=0 \
    WATCHTRACE_MAILPIT_SMTP_PORT=0 \
    WATCHTRACE_MAILPIT_HTTP_PORT=0 \
    docker compose --file "$compose_file" --project-name "$project_name" "$@"
}

cleanup() {
  if [ -n "$api_pid" ]; then
    kill "$api_pid" >/dev/null 2>&1 || true
    wait "$api_pid" >/dev/null 2>&1 || true
  fi
  compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -f -- "$environment_file" "$api_log"
}
trap cleanup EXIT HUP INT TERM

if [ ! -f "$platform_root/go.mod" ]; then
  echo "WatchTrace platform repository not found at $platform_root" >&2
  exit 1
fi

printf '%s\n' \
  'POSTGRES_DB=watchtrace_frontend_e2e' \
  'POSTGRES_USER=watchtrace_frontend_e2e' \
  'POSTGRES_PASSWORD=frontend-e2e-local-password' >"$environment_file"

compose up --detach --wait postgres mailpit
postgres_address=$(compose port postgres 5432)
postgres_port=${postgres_address##*:}
smtp_address=$(compose port mailpit 1025)
smtp_port=${smtp_address##*:}
database_url="postgres://watchtrace_frontend_e2e:frontend-e2e-local-password@127.0.0.1:$postgres_port/watchtrace_frontend_e2e?sslmode=disable"

cd "$platform_root"
env WATCHTRACE_DATABASE_URL="$database_url" go run ./cmd/migrate up
env \
  WATCHTRACE_DATABASE_URL="$database_url" \
  WATCHTRACE_HTTP_ADDRESS="127.0.0.1:18080" \
  WATCHTRACE_VERIFICATION_SMTP_ADDRESS="127.0.0.1:$smtp_port" \
  WATCHTRACE_VERIFICATION_URL="http://127.0.0.1:4180/verify-email" \
  WATCHTRACE_PASSWORD_RESET_URL="http://127.0.0.1:4180/reset-password" \
  WATCHTRACE_INVITATION_URL="http://127.0.0.1:4180/accept-invitation" \
  go run ./cmd/api >"$api_log" 2>&1 &
api_pid=$!

ready=0
attempt=0
while [ "$attempt" -lt 60 ]; do
  if curl --fail --silent http://127.0.0.1:18080/health/ready >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$api_pid" >/dev/null 2>&1; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "Real API did not become ready" >&2
  sed -n '1,200p' "$api_log" >&2
  exit 1
fi

cd "$frontend_root"
env WATCHTRACE_DEV_API_URL="http://127.0.0.1:18080" \
  WATCHTRACE_E2E_DATABASE_URL="$database_url" \
  npx playwright test --config=playwright.real.config.ts
