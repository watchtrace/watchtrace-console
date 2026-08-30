#!/bin/sh
set -eu
repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT HUP INT TERM
export PATH="$repository_root/tests/fixtures/coolify:$PATH"
export MOCK_CURL_STATE="$temporary_directory/state"
export COOLIFY_API_URL=https://coolify.example.test
export COOLIFY_TOKEN=test-token
export COOLIFY_DEPLOY_POLL_SECONDS=1
export COOLIFY_DEPLOY_TIMEOUT_SECONDS=2
export GITHUB_OUTPUT="$temporary_directory/output"
printf '{"tag":"main","commit":""}\n' > "$MOCK_CURL_STATE"

current=$($repository_root/scripts/coolify-deploy.sh inspect-image frontend-app ghcr.io/watchtrace/watchtrace-console)
[ "$current" = "ghcr.io/watchtrace/watchtrace-console:main" ]
digest=sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
commit=dddddddddddddddddddddddddddddddddddddddd
$repository_root/scripts/coolify-deploy.sh deploy-image frontend-app ghcr.io/watchtrace/watchtrace-console "$digest" "$commit"
grep -F 'previous_reference=ghcr.io/watchtrace/watchtrace-console:main' "$GITHUB_OUTPUT" >/dev/null
grep -F 'deployed_reference=ghcr.io/watchtrace/watchtrace-console@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' "$GITHUB_OUTPUT" >/dev/null
grep -F 'deployment_uuid=deployment-frontend-app' "$GITHUB_OUTPUT" >/dev/null
[ "$(jq -r '.commit' "$MOCK_CURL_STATE")" = "$commit" ]

if $repository_root/scripts/coolify-deploy.sh deploy-image frontend-app ghcr.io/watchtrace/watchtrace-console "$digest" invalid-commit >/dev/null 2>&1; then
  echo "The frontend helper accepted an invalid Git commit SHA." >&2
  exit 1
fi

if COOLIFY_API_URL=http://coolify.example.test $repository_root/scripts/coolify-deploy.sh inspect-image frontend-app ghcr.io/watchtrace/watchtrace-console >/dev/null 2>&1; then
  echo "The frontend helper accepted an insecure Coolify API URL." >&2
  exit 1
fi
echo "Coolify frontend deployment helper tests passed."
