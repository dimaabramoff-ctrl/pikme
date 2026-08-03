#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"
if [ -f "$ROOT_DIR/docker-compose.yml" ]; then
  docker compose -f "$ROOT_DIR/docker-compose.yml" up -d postgres
else
  docker compose up -d postgres
fi

timeout 30s bash -c 'until docker exec pickme_postgres pg_isready -U pickme -d postgres >/dev/null 2>&1; do :; done'

docker exec pickme_postgres psql -U pickme -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'pickme_e2e'" | grep -q 1 || \
  docker exec pickme_postgres psql -U pickme -d postgres -c "CREATE DATABASE pickme_e2e"

export DATABASE_URL="postgresql://pickme:pickme@localhost:5432/pickme_e2e?schema=public"
export JWT_ACCESS_SECRET="e2e-access-secret"
export JWT_REFRESH_SECRET="e2e-refresh-secret"
export JWT_ACCESS_TTL="15m"
export JWT_REFRESH_TTL_DAYS="30"
export FRONTEND_URL="http://localhost:5173"
export COOKIE_SECURE="false"
export COOKIE_SAME_SITE="lax"
export NODE_ENV="test"

cd "$BACKEND_DIR"
npx prisma db push --force-reset --skip-generate
npm run seed
