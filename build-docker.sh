#!/usr/bin/env bash
# Run this once before `docker build` to prepare the marketing-auto frontend
# and copy the Python backend into the MAIN-SITE build context.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MKT_DIR="$SCRIPT_DIR/../marketing-patience-ai/frontend"   # adjust if different
BACKEND_DIR="$SCRIPT_DIR/../marketing-patience-ai/backend"

echo "==> Building marketing-auto React frontend..."
cd "$MKT_DIR"
npm ci --legacy-peer-deps
npm run build   # outputs to dist/ with base /marketing-auto/

echo "==> Copying marketing-auto build to MAIN-SITE/dist/marketing-auto..."
mkdir -p "$SCRIPT_DIR/dist/marketing-auto"
cp -r "$MKT_DIR/dist/." "$SCRIPT_DIR/dist/marketing-auto/"

echo "==> Copying Python backend to MAIN-SITE/backend/..."
rm -rf "$SCRIPT_DIR/backend"
cp -r "$BACKEND_DIR" "$SCRIPT_DIR/backend"

echo "==> Done. Now run: docker build -t patienceai . && docker run -p 4000:4000 --env-file .env patienceai"
