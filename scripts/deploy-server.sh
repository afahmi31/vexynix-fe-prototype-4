#!/usr/bin/env bash
# =============================================================================
# Runs ON the staging server (piped in over SSH by deploy-staging.yml).
# Fetches the target commit, builds the frontend image, recreates the container.
# =============================================================================
# Expects two env vars from the caller:
#   GH_TOKEN     ephemeral GitHub Actions token (private-repo git auth)
#   DEPLOY_SHA   the exact commit to deploy
set -euo pipefail

REPO_DIR="$HOME/webgame-deploy/game-web-client-facing"
REMOTE_CLEAN="https://github.com/harisoche/game-web-client-facing.git"
COMPOSE="deploy/docker-compose.client.yml"

cd "$REPO_DIR"

# Point origin at the token-authenticated URL for THIS fetch only.
git remote set-url origin "https://x-access-token:${GH_TOKEN}@github.com/harisoche/game-web-client-facing.git"
git fetch origin "${DEPLOY_SHA}"
git checkout "${DEPLOY_SHA}"
# Restore the clean URL so no token is left in .git/config.
git remote set-url origin "${REMOTE_CLEAN}"

echo "=== checked out ==="
git log --oneline -1

# deploy/client.env holds runtime env; it is excluded from git (.git/info/exclude)
# so the checkout above never touches it. Fail loudly if it's missing.
if [ ! -f deploy/client.env ]; then
  echo "ERROR: deploy/client.env missing on server — create it from deploy/client.env.example" >&2
  exit 1
fi

# Build + recreate ONLY the frontend service (never Traefik / backend).
docker compose -f "${COMPOSE}" up -d --build frontend

echo "=== frontend container ==="
docker ps --filter name=game-web-client --format 'table {{.Names}}\t{{.Status}}'

# Prune dangling images from previous builds to keep disk in check.
docker image prune -f >/dev/null 2>&1 || true
