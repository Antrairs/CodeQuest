# Deploy with Docker and Gunicorn

This project uses one long-running Docker container for the Django backend. Compose is not needed.

- Gunicorn runs Django on `127.0.0.1:8000`.
- SQLite, Django static files, and uploaded media live in `/data/codequest`.
- The frontend is built once into `/var/www/exam`.
- Your existing Caddy serves `/var/www/exam` and proxies `/api/` and `/admin/` to `127.0.0.1:8000`.

## 1. Server prerequisites

- DNS points your domain to the server.
- Docker is installed.
- Caddy is configured outside this repository.

## 2. Configure environment

```bash
cp .env.example .env
```

Common values:

```env
DOMAIN=exam.mydomain.com
FRONTEND_DIST_DIR=/var/www/exam
DATA_DIR=/data/codequest
DJANGO_DEBUG=False
```

`deploy.sh` replaces the default `DJANGO_SECRET_KEY` automatically.

## 3. Deploy

```bash
sh deploy.sh
```

The script runs:

- create `.env` from `.env.example` if missing
- create `${DATA_DIR}/static`, `${DATA_DIR}/media`, and `${FRONTEND_DIST_DIR}`
- build the frontend with a one-off `oven/bun:1` container
- build the backend image as `codequest-backend`
- run `migrate`, `collectstatic`, and `check`
- restart the `codequest-backend` container on `127.0.0.1:8000`

Create an admin user after the first deploy:

```bash
docker exec -it codequest-backend python manage.py createsuperuser
```

## 4. Verify

- Frontend: `https://exam.mydomain.com/`
- Django Admin: `https://exam.mydomain.com/admin/`

Backend check:

```bash
docker exec codequest-backend python manage.py check
```

Backend logs:

```bash
docker logs -f codequest-backend
```

## 5. Data and cleanup

Persistent files are stored on the host:

- SQLite: `/data/codequest/db.sqlite3`
- Django static files: `/data/codequest/static/`
- Uploaded media files: `/data/codequest/media/`
- Frontend static files: `/var/www/exam`

Stop the backend without deleting data:

```bash
docker stop codequest-backend
```

Remove and recreate the backend container:

```bash
docker rm -f codequest-backend
sh deploy.sh
```

Do not delete `/data/codequest/` unless you intentionally want to remove the SQLite database and uploaded media.
