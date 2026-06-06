#!/usr/bin/env bash
# Pushes the env vars in .env to a Render service via the REST API.
# Only updates vars that render.yaml declares as `sync: false` (dashboard-managed).
# Vars hardcoded in render.yaml (PORT, NODE_ENV, SITE_URL, SMTP_PORT, etc.) are
# left untouched — they're already pinned by the blueprint.
#
# Usage:
#   RENDER_API_KEY=rnd_xxx ./scripts/render-env-sync.sh
#   RENDER_API_KEY=rnd_xxx RENDER_SERVICE_ID=srv-... ./scripts/render-env-sync.sh
#   RENDER_API_KEY=rnd_xxx ./scripts/render-env-sync.sh --dry-run
#
# Get your API key: https://dashboard.render.com/u/settings#api-keys

set -euo pipefail

SERVICE_ID="${RENDER_SERVICE_ID:-srv-d7fpe03bc2fs739oqie0}"
ENV_FILE="${ENV_FILE:-.env}"
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --service) shift; SERVICE_ID="$1" ;;
    *) ;;
  esac
done

if [[ -z "${RENDER_API_KEY:-}" ]]; then
  echo "ERROR: RENDER_API_KEY is not set. Get one at https://dashboard.render.com/u/settings#api-keys" >&2
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found" >&2
  exit 1
fi

# Keys to push — must match the `sync: false` entries in render.yaml.
KEYS=(
  ADMIN_USERNAME
  ADMIN_PASSWORD
  ADMIN_SESSION_SECRET
  DATABASE_URL
  GROQ_API_KEY
  REDIS_URL
  SMTP_HOST
  SMTP_USER
  SMTP_PASS
  SMTP_SENDER_NAME
  CONTACT_TO_EMAIL
)

# Read a value from the .env file (handles quoted values, ignores comments).
get_env() {
  local key="$1"
  awk -F= -v k="$key" '
    /^[[:space:]]*#/ { next }
    {
      n = index($0, "=");
      if (n == 0) next;
      name = substr($0, 1, n-1);
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", name);
      if (name != k) next;
      val = substr($0, n+1);
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", val);
      if ((substr(val,1,1) == "\"" && substr(val,length(val),1) == "\"") ||
          (substr(val,1,1) == "\x27" && substr(val,length(val),1) == "\x27")) {
        val = substr(val, 2, length(val)-2);
      }
      print val;
      exit;
    }
  ' "$ENV_FILE"
}

# Build the JSON payload for the bulk env-vars PUT.
PAYLOAD='['
sep=""
missing=()
for key in "${KEYS[@]}"; do
  value="$(get_env "$key")"
  if [[ -z "$value" ]]; then
    missing+=("$key")
    continue
  fi
  # Escape for JSON: backslash, double quote, control chars.
  esc=$(printf '%s' "$value" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
  PAYLOAD+="${sep}{\"key\":\"${key}\",\"value\":${esc}}"
  sep=","
done
PAYLOAD+=']'

if (( ${#missing[@]} > 0 )); then
  echo "WARNING: missing in $ENV_FILE (skipped): ${missing[*]}" >&2
fi

URL="https://api.render.com/v1/services/${SERVICE_ID}/env-vars"

echo "Target service: $SERVICE_ID"
echo "Keys to update: $(echo "${KEYS[@]}" | tr ' ' ',')"

if (( DRY_RUN )); then
  echo "--- DRY RUN: payload preview (values redacted) ---"
  printf '%s' "$PAYLOAD" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data:
    v = item['value']
    redacted = v[:4] + '***' + v[-2:] if len(v) > 8 else '***'
    print('  ' + item['key'] + ' = ' + redacted)
"
  exit 0
fi

echo "PUT $URL"
HTTP_CODE=$(curl -sS -o /tmp/render-env-resp.json -w "%{http_code}" \
  -X PUT "$URL" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo "HTTP $HTTP_CODE"
cat /tmp/render-env-resp.json
echo

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "ERROR: env update failed" >&2
  exit 1
fi

echo
echo "Env vars updated. Triggering a deploy so the new values take effect..."
DEPLOY_CODE=$(curl -sS -o /tmp/render-deploy-resp.json -w "%{http_code}" \
  -X POST "https://api.render.com/v1/services/${SERVICE_ID}/deploys" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"clearCache":"do_not_clear"}')
echo "Deploy HTTP $DEPLOY_CODE"
cat /tmp/render-deploy-resp.json
echo
