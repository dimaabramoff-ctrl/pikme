#!/usr/bin/env bash
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"

source "$BACKEND_DIR/scripts/prepare-e2e-db.sh"

cd "$BACKEND_DIR"
jest --config ./test/jest-e2e.json
