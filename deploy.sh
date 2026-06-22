#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT_DIR"

ENV_FILE=".env"
DEFAULT_SECRET="change-me-to-a-long-random-secret"

fail() {
  echo "Error: $*" >&2
  exit 1
}

ensure_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

ensure_writable_dir() {
  dir="$1"
  if [ -d "$dir" ] && [ -w "$dir" ]; then
    return
  fi

  if mkdir -p "$dir" 2>/dev/null; then
    return
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo mkdir -p "$dir"
    sudo chown "$(id -u):$(id -g)" "$dir"
    return
  fi

  fail "cannot create writable directory: $dir"
}

replace_default_secret() {
  if grep -q "^DJANGO_SECRET_KEY=$DEFAULT_SECRET$" "$ENV_FILE"; then
    secret=$(od -An -N48 -tx1 /dev/urandom | tr -d ' \n')
    sed -i "s/^DJANGO_SECRET_KEY=.*/DJANGO_SECRET_KEY=$secret/" "$ENV_FILE"
    echo "Generated DJANGO_SECRET_KEY in .env"
  fi
}

ensure_command docker
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required"

if [ ! -f "$ENV_FILE" ]; then
  cp .env.example "$ENV_FILE"
  echo "Created .env from .env.example"
fi

replace_default_secret

set -a
. "./$ENV_FILE"
set +a

: "${DOMAIN:?DOMAIN is required in .env}"
FRONTEND_DIST_DIR="${FRONTEND_DIST_DIR:-/var/www/html/exam}"
CADDY_CONFIG="${CADDY_CONFIG:-/etc/caddy/Caddyfile}"
RELOAD_CADDY="${RELOAD_CADDY:-1}"

ensure_writable_dir "$FRONTEND_DIST_DIR"
mkdir -p data backend/staticfiles

echo "Building frontend into $FRONTEND_DIST_DIR"
docker compose --profile build run --rm frontend-build

echo "Building and starting backend"
docker compose build backend
docker compose up -d backend
docker compose exec -T backend python manage.py check

if [ "$RELOAD_CADDY" = "1" ]; then
  if command -v caddy >/dev/null 2>&1; then
    if [ "$(id -u)" -eq 0 ]; then
      caddy reload --config "$CADDY_CONFIG"
    elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
      sudo caddy reload --config "$CADDY_CONFIG"
    else
      echo "Skipped Caddy reload. Run: sudo caddy reload --config $CADDY_CONFIG"
    fi
  else
    echo "Skipped Caddy reload because caddy is not in PATH."
  fi
fi

echo "Deployment complete:"
echo "- Frontend: https://$DOMAIN/"
echo "- Admin: https://$DOMAIN/admin/"
