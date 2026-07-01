#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT_DIR"

IMAGE_NAME="codequest-backend"
CONTAINER_NAME="codequest-backend"
DEFAULT_SECRET="change-me-to-a-long-random-secret"

ensure_dir() {
  [ -d "$1" ] || mkdir -p "$1" 2>/dev/null || {
    sudo mkdir -p "$1"
    sudo chown "$(id -u):$(id -g)" "$1"
  }
}

backend_env() {
  docker run --rm \
    --env-file .env \
    -e DJANGO_ALLOWED_HOSTS="$DOMAIN" \
    -e DJANGO_CSRF_TRUSTED_ORIGINS="https://$DOMAIN" \
    -e SQLITE_PATH=/data/db.sqlite3 \
    -e STATIC_ROOT=/data/static \
    -e MEDIA_ROOT=/data/media \
    -v "$DATA_DIR:/data" \
    "$IMAGE_NAME" "$@"
}

command -v docker >/dev/null 2>&1 || { echo "Docker is required" >&2; exit 1; }

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

if grep -q "^DJANGO_SECRET_KEY=$DEFAULT_SECRET$" .env; then
  secret=$(od -An -N48 -tx1 /dev/urandom | tr -d ' \n')
  sed -i "s/^DJANGO_SECRET_KEY=.*/DJANGO_SECRET_KEY=$secret/" .env
  echo "Generated DJANGO_SECRET_KEY in .env"
fi

set -a
. ./.env
set +a

: "${DOMAIN:?DOMAIN is required in .env}"
FRONTEND_DIST_DIR="${FRONTEND_DIST_DIR:-/var/www/exam}"
DATA_DIR="${DATA_DIR:-/data/codequest}"

ensure_dir "$FRONTEND_DIST_DIR"
ensure_dir "$DATA_DIR"
mkdir -p "$DATA_DIR/static" "$DATA_DIR/media"

echo "Building frontend into $FRONTEND_DIST_DIR"
docker run --rm \
  -v "$ROOT_DIR/frontend:/app" \
  -v "$FRONTEND_DIST_DIR:/dist" \
  -w /app \
  oven/bun:1 \
  sh -c "bun install --frozen-lockfile && bun run build && mkdir -p /dist && rm -rf /dist/* && cp -a dist/. /dist/"

echo "Building backend image"
docker build -t "$IMAGE_NAME" ./backend

echo "Preparing database and static files"
backend_env python manage.py migrate --noinput
backend_env python manage.py collectstatic --noinput
backend_env python manage.py check

echo "Starting backend container"
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --env-file .env \
  -e DJANGO_ALLOWED_HOSTS="$DOMAIN" \
  -e DJANGO_CSRF_TRUSTED_ORIGINS="https://$DOMAIN" \
  -e SQLITE_PATH=/data/db.sqlite3 \
  -e STATIC_ROOT=/data/static \
  -e MEDIA_ROOT=/data/media \
  -v "$DATA_DIR:/data" \
  -p 127.0.0.1:8000:8000 \
  "$IMAGE_NAME"

echo "Deployment complete:"
echo "- Frontend: https://$DOMAIN/"
echo "- Admin: https://$DOMAIN/admin/"
