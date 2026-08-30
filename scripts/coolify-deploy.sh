#!/bin/sh
set -eu

usage() {
  cat >&2 <<'EOF'
Usage:
  coolify-deploy.sh inspect-image APPLICATION_UUID IMAGE_NAME
  coolify-deploy.sh deploy-image APPLICATION_UUID IMAGE_NAME sha256:DIGEST GIT_COMMIT_SHA GIT_REPOSITORY_URL GIT_BRANCH

Required environment variables:
  COOLIFY_API_URL   Trusted HTTPS Coolify origin, with or without /api/v1
  COOLIFY_TOKEN     Coolify API token with read, write, and deploy permissions
EOF
  exit 2
}

fail() {
  echo "Coolify deployment error: $*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || fail "curl is required."
command -v jq >/dev/null 2>&1 || fail "jq is required."
: "${COOLIFY_API_URL:?Set COOLIFY_API_URL to the trusted HTTPS Coolify URL}"
: "${COOLIFY_TOKEN:?Set COOLIFY_TOKEN to the Coolify API token}"
case "$COOLIFY_API_URL" in https://*) ;; *) fail "COOLIFY_API_URL must use HTTPS." ;; esac
api_base=${COOLIFY_API_URL%/}
case "$api_base" in */api/v1) ;; *) api_base="$api_base/api/v1" ;; esac
timeout_seconds=${COOLIFY_DEPLOY_TIMEOUT_SECONDS:-1200}
poll_seconds=${COOLIFY_DEPLOY_POLL_SECONDS:-10}
case "$timeout_seconds:$poll_seconds" in *[!0-9:]*|:*|*:) fail "Deployment timeout and poll interval must be positive integers." ;; esac
[ "$timeout_seconds" -gt 0 ] && [ "$poll_seconds" -gt 0 ] || fail "Deployment timeout and poll interval must be greater than zero."

api_request() {
  method=$1; path=$2; body=${3-}
  if [ -n "$body" ]; then
    curl --fail-with-body --silent --show-error --proto '=https' --tlsv1.2 --connect-timeout 10 --max-time 60 \
      --request "$method" --header "Authorization: Bearer $COOLIFY_TOKEN" --header 'Content-Type: application/json' \
      --data "$body" "$api_base$path"
  else
    curl --fail-with-body --silent --show-error --proto '=https' --tlsv1.2 --connect-timeout 10 --max-time 60 \
      --request "$method" --header "Authorization: Bearer $COOLIFY_TOKEN" "$api_base$path"
  fi
}

fail_if_invalid_uuid() { case "$1" in ''|*[!A-Za-z0-9_-]*) fail "Invalid Coolify resource UUID." ;; esac; }
validate_image() {
  case "$1" in ghcr.io/*/*) ;; *) fail "Expected a fully qualified ghcr.io/OWNER/IMAGE name." ;; esac
  case "$1" in *@*|*:*) fail "IMAGE_NAME must not contain a tag or digest." ;; esac
}
digest_hex() {
  case "$1" in sha256:*) hex=${1#sha256:} ;; *) fail "Image digest must start with sha256:." ;; esac
  [ "${#hex}" -eq 64 ] || fail "Image digest must contain exactly 64 hexadecimal characters."
  case "$hex" in *[!0-9a-f]*) fail "Image digest must use lowercase hexadecimal characters." ;; esac
  printf '%s' "$hex"
}
validate_commit() {
  case "${#1}" in 40|64) ;; *) fail "Git commit SHA must contain 40 or 64 hexadecimal characters." ;; esac
  case "$1" in *[!0-9a-f]*) fail "Git commit SHA must use lowercase hexadecimal characters." ;; esac
}
validate_repository() {
  case "$1" in https://github.com/*/*) ;; *) fail "Git repository must be a full https://github.com/OWNER/REPOSITORY URL." ;; esac
  case "$1" in *[?#]*) fail "Git repository URL must not contain a query string or fragment." ;; esac
}
validate_branch() {
  case "$1" in ''|*[!A-Za-z0-9._/-]*) fail "Git branch contains unsupported characters." ;; esac
}
tag_to_reference() {
  case "$2" in sha256-*) printf '%s@sha256:%s' "$1" "${2#sha256-}" ;; sha256:*) printf '%s@%s' "$1" "$2" ;; '') printf '%s:<unset>' "$1" ;; *) printf '%s:%s' "$1" "$2" ;; esac
}
write_output() { if [ -n "${GITHUB_OUTPUT:-}" ]; then printf '%s=%s\n' "$1" "$2" >> "$GITHUB_OUTPUT"; fi; }
summary() { if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then printf '%s\n' "$1" >> "$GITHUB_STEP_SUMMARY"; fi; }
inspect_image() {
  application_json=$(api_request GET "/applications/$1") || fail "Could not read Coolify application $1."
  actual_uuid=$(printf '%s' "$application_json" | jq -r '.uuid // empty')
  actual_image=$(printf '%s' "$application_json" | jq -r '.docker_registry_image_name // empty')
  actual_tag=$(printf '%s' "$application_json" | jq -r '.docker_registry_image_tag // empty')
  actual_commit=$(printf '%s' "$application_json" | jq -r '.git_commit_sha // empty')
  actual_repository=$(printf '%s' "$application_json" | jq -r '.git_repository // empty')
  actual_branch=$(printf '%s' "$application_json" | jq -r '.git_branch // empty')
  [ "$actual_uuid" = "$1" ] || fail "Coolify returned a different application than $1."
  [ "$actual_image" = "$2" ] || fail "Application $1 uses '$actual_image', expected '$2'."
  current_reference=$(tag_to_reference "$actual_image" "$actual_tag")
}
trigger_and_wait() {
  deploy_body=$(jq -cn --arg uuid "$1" '{uuid: $uuid, force: false}')
  deploy_json=$(api_request POST /deploy "$deploy_body") || fail "Coolify rejected deployment of $1."
  deployment_uuid=$(printf '%s' "$deploy_json" | jq -r --arg uuid "$1" '.deployments[]? | select(.resource_uuid == $uuid) | .deployment_uuid' | head -n 1)
  [ -n "$deployment_uuid" ] || fail "Coolify did not return a deployment UUID for $1."
  started_at=$(date +%s)
  while :; do
    deployment_json=$(api_request GET "/deployments/$deployment_uuid") || fail "Could not read deployment $deployment_uuid."
    status=$(printf '%s' "$deployment_json" | jq -r '.status // empty')
    case "$status" in finished|success|successful) break ;; queued|pending|in_progress|running) ;; failed|cancelled|canceled|cancelled-by-user) fail "Deployment $deployment_uuid ended with status '$status'." ;; '') fail "Deployment $deployment_uuid returned no status." ;; *) fail "Deployment $deployment_uuid returned unknown status '$status'." ;; esac
    now=$(date +%s)
    [ $((now - started_at)) -lt "$timeout_seconds" ] || fail "Deployment $deployment_uuid timed out after $timeout_seconds seconds."
    sleep "$poll_seconds"
  done
}

[ "$#" -ge 1 ] || usage
operation=$1; shift
case "$operation" in
  inspect-image)
    [ "$#" -eq 2 ] || usage
    fail_if_invalid_uuid "$1"; validate_image "$2"; inspect_image "$1" "$2"
    write_output current_reference "$current_reference"
    summary "- Inspected Coolify application \`$1\`: \`$current_reference\`"
    printf '%s\n' "$current_reference"
    ;;
  deploy-image)
    [ "$#" -eq 6 ] || usage
    uuid=$1; image=$2; digest=$3; commit=$4; repository=$5; branch=$6
    fail_if_invalid_uuid "$uuid"; validate_image "$image"; hex=$(digest_hex "$digest"); validate_commit "$commit"
    validate_repository "$repository"; validate_branch "$branch"
    desired_tag="sha256-$hex"; desired_reference="$image@sha256:$hex"
    inspect_image "$uuid" "$image"; previous_reference=$current_reference
    update_body=$(jq -cn \
      --arg tag "$desired_tag" --arg commit "$commit" \
      --arg repository "$repository" --arg branch "$branch" \
      '{docker_registry_image_tag: $tag, git_commit_sha: $commit, git_repository: $repository, git_branch: $branch}')
    api_request PATCH "/applications/$uuid" "$update_body" >/dev/null || fail "Could not update the image and Git metadata for $uuid."
    trigger_and_wait "$uuid"
    deployed_tag=$(printf '%s' "$deployment_json" | jq -r '.docker_registry_image_tag // empty')
    [ -z "$deployed_tag" ] || [ "$deployed_tag" = "$desired_tag" ] || fail "Deployment $deployment_uuid reports tag '$deployed_tag', expected '$desired_tag'."
    deployed_commit=$(printf '%s' "$deployment_json" | jq -r '.commit // empty')
    [ "$deployed_commit" = "$commit" ] || fail "Deployment $deployment_uuid reports commit '$deployed_commit', expected '$commit'."
    inspect_image "$uuid" "$image"
    [ "$current_reference" = "$desired_reference" ] || fail "Coolify is configured for '$current_reference', expected '$desired_reference'."
    [ "$actual_commit" = "$commit" ] || fail "Coolify is configured for commit '$actual_commit', expected '$commit'."
    [ "$actual_repository" = "$repository" ] || fail "Coolify is configured for repository '$actual_repository', expected '$repository'."
    [ "$actual_branch" = "$branch" ] || fail "Coolify is configured for branch '$actual_branch', expected '$branch'."
    write_output previous_reference "$previous_reference"; write_output deployed_reference "$desired_reference"; write_output deployment_uuid "$deployment_uuid"
    summary "- Deployed [$commit]($repository/commit/$commit) as \`$desired_reference\` to \`$uuid\` (deployment \`$deployment_uuid\`)."
    ;;
  *) usage ;;
esac
