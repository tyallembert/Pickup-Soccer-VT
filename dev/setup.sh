#!/usr/bin/env bash
# First-run setup for the Docker dev stack (compose.yaml). Safe to re-run any
# time: after `docker compose down -v`, after pulling new seed data, or just to
# check everything is wired up.
#
#   1. writes .env from .env.example (Tailscale name + IP, dev admin password)
#   2. starts the Convex backend and stores its admin key in .env
#   3. starts the whole stack and waits for `convex dev` to push functions
#   4. sets the Convex env vars, creates the admin account, seeds locations
set -euo pipefail
cd "$(dirname "$0")/.."

env_get() { sed -n "s/^$1=//p" .env | tail -n 1; }
env_set() {
  awk -v k="$1" -v v="$2" '
    index($0, k "=") == 1 { print k "=" v; done = 1; next }
    { print }
    END { if (!done) print k "=" v }
  ' .env >.env.tmp && mv .env.tmp .env
}

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

if [ -z "$(env_get DEV_HOST)" ]; then
  env_set DEV_HOST "$(tailscale status --self --json |
    python3 -c 'import json, sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')"
fi
if [ -z "$(env_get DEV_BIND_IP)" ]; then
  env_set DEV_BIND_IP "$(tailscale ip -4)"
fi
if [ -z "$(env_get DEV_ADMIN_PASSWORD)" ]; then
  env_set DEV_ADMIN_PASSWORD "$(openssl rand -hex 12)"
fi

echo "Starting the Convex backend..."
docker compose up -d --wait backend

# Derived from the instance secret in the convex-data volume, so this is a
# no-op unless the volume was wiped (then the old key is dead anyway).
env_set CONVEX_ADMIN_KEY "$(docker compose exec -T backend ./generate_admin_key.sh 2>/dev/null | tail -n 1)"

echo "Starting the rest of the stack..."
docker compose up -d

echo "Waiting for convex dev to push functions..."
for _ in $(seq 1 120); do
  if docker compose logs convex 2>/dev/null | grep -q "Convex functions ready"; then
    break
  fi
  if [ "$(docker compose ps -q convex | xargs docker inspect -f '{{.State.Restarting}}' 2>/dev/null)" = "true" ]; then
    docker compose logs --tail 30 convex
    echo "convex dev keeps crashing; see the log above." >&2
    exit 1
  fi
  sleep 2
done
docker compose logs convex | grep -q "Convex functions ready" || {
  docker compose logs --tail 30 convex
  echo "Timed out waiting for convex dev." >&2
  exit 1
}

host="$(env_get DEV_HOST)"
web_port="$(env_get WEB_PORT)"
docker compose exec -T \
  -e DEV_ADMIN_EMAIL="$(env_get DEV_ADMIN_EMAIL)" \
  -e DEV_ADMIN_PASSWORD="$(env_get DEV_ADMIN_PASSWORD)" \
  -e SITE_URL="https://$host:${web_port:-8444}" \
  convex node dev/bootstrap.mjs

cat <<EOF

Dev stack is up (tailnet only):
  app        https://$host:${web_port:-8444}
  dashboard  https://$host:$(env_get DASHBOARD_PORT)
  sign in as $(env_get DEV_ADMIN_EMAIL) / password in .env (DEV_ADMIN_PASSWORD)
EOF
