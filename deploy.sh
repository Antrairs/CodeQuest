#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT_DIR"

DEFAULT_SECRET="change-me-to-a-long-random-secret"

command -v docker >/dev/null 2>&1 || { echo "Docker is required" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 is required" >&2; exit 1; }

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
FRONTEND_DIST_DIR="${FRONTEND_DIST_DIR:-/var/www/html/exam}"

[ -d "$FRONTEND_DIST_DIR" ] || mkdir -p "$FRONTEND_DIST_DIR" 2>/dev/null || {
  sudo mkdir -p "$FRONTEND_DIST_DIR"
  sudo chown "$(id -u):$(id -g)" "$FRONTEND_DIST_DIR"
}
mkdir -p data backend/staticfiles

echo "Building frontend into $FRONTEND_DIST_DIR"
docker run --rm \
  -v "$ROOT_DIR/frontend:/app" \
  -v "$FRONTEND_DIST_DIR:/dist" \
  -w /app \
  oven/bun:1 \
  sh -c "bun install --frozen-lockfile && bun run build && mkdir -p /dist && rm -rf /dist/* && cp -a dist/. /dist/"

echo "Building backend"
docker compose build backend

echo "Preparing database and static files"
docker compose run --rm backend python manage.py migrate --noinput
docker compose run --rm backend python manage.py collectstatic --noinput
docker compose run --rm backend python manage.py check

echo "Starting backend"
docker compose up -d backend

echo "Deployment complete:"
echo "- Frontend: https://$DOMAIN/"
echo "- Admin: https://$DOMAIN/admin/"
