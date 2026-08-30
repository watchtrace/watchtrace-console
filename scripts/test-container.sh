#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
image_name="watchtrace-console:test-$$"
network_name="watchtrace-console-test-$$"
api_name="watchtrace-console-api-$$"
console_name="watchtrace-console-web-$$"

cleanup() {
    docker rm --force "$console_name" "$api_name" >/dev/null 2>&1 || true
    docker network rm "$network_name" >/dev/null 2>&1 || true
    docker image rm --force "$image_name" >/dev/null 2>&1 || true
}

trap cleanup EXIT HUP INT TERM

if ! command -v docker >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
    echo "Docker and curl are required." >&2
    exit 1
fi

cd "$repository_root"
docker build --check .
docker build --tag "$image_name" .
docker run --rm "$image_name" nginx -t

docker network create "$network_name" >/dev/null
docker run --detach \
    --name "$api_name" \
    --network "$network_name" \
    --network-alias api \
    --volume "$repository_root/tests/fixtures/mock-api.mjs:/mock-api.mjs:ro" \
    node:24.12.0-alpine node /mock-api.mjs >/dev/null
docker run --detach \
    --name "$console_name" \
    --network "$network_name" \
    --publish 127.0.0.1::8080 \
    "$image_name" >/dev/null

published_address=$(docker port "$console_name" 8080/tcp)
attempt=0
while [ "$attempt" -lt 30 ]; do
    if curl --fail --silent --max-time 2 "http://$published_address/health" >/dev/null 2>&1; then
        break
    fi
    attempt=$((attempt + 1))
    sleep 1
done

if ! curl --fail --silent --show-error --max-time 2 \
    --dump-header - --output /dev/null \
    "http://$published_address/" |
    grep -i '^X-WatchTrace-Frontend:[[:space:]]*watchtrace-console' >/dev/null; then
    echo "Frontend response did not identify the console service." >&2
    exit 1
fi

attempt=0
proxy_response=
while [ "$attempt" -lt 30 ]; do
    if proxy_response=$(curl --fail --silent --max-time 2 \
        --header 'Host: watchtrace.example.test' \
        --header 'X-Forwarded-Proto: https' \
        "http://$published_address/api/v1/proxy-check?value=1" 2>/dev/null); then
        break
    fi
    attempt=$((attempt + 1))
    sleep 1
done
case "$proxy_response" in
    *'"host":"watchtrace.example.test"'*'"forwardedProto":"https"'*'"url":"/api/v1/proxy-check?value=1"'*) ;;
    *)
        echo "Unexpected API proxy response: $proxy_response" >&2
        exit 1
        ;;
esac

sse_headers=$(curl --fail --silent --show-error --max-time 5 --dump-header - \
    "http://$published_address/api/v1/environments/test/events")
case "$sse_headers" in
    *'Content-Type: text/event-stream'*'X-Accel-Buffering: no'*'event: refresh'*) ;;
    *)
        echo "SSE proxy response was incomplete." >&2
        exit 1
        ;;
esac
