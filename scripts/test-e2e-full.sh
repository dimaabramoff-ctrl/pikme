#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

source "$BACKEND_DIR/scripts/prepare-e2e-db.sh"

cd "$ROOT_DIR"
(lsof -ti :3000 2>/dev/null | xargs -r kill -9 || true)
(lsof -ti :5173 2>/dev/null | xargs -r kill -9 || true)
npx start-server-and-test \
  "cd backend && NODE_ENV=test DATABASE_URL=postgresql://pickme:pickme@localhost:5432/pickme_e2e?schema=public JWT_ACCESS_SECRET=e2e-access-secret JWT_REFRESH_SECRET=e2e-refresh-secret FRONTEND_URL=http://localhost:5173 COOKIE_SECURE=false COOKIE_SAME_SITE=lax npm run start" \
  http://localhost:3000/api/health \
  "cd frontend && PLAYWRIGHT_AUTH_E2E=1 npm run test:e2e -- --grep @auth"
