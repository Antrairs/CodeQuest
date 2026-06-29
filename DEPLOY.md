# Deploy with Docker and Gunicorn

This deployment uses Docker for the Django backend and for one-off frontend builds.

- Gunicorn runs Django on `127.0.0.1:8000`.
- SQLite is stored in `./data/db.sqlite3`.
- `deploy.sh` runs the repeatable deployment steps.

## 1. Server prerequisites

- DNS points your domain to the server.
- Docker and Docker Compose are installed.
- Your reverse proxy is configured outside this repository.

## 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` only if you need to change the domain or frontend output directory:

```env
DOMAIN=exam.mydomain.com
FRONTEND_DIST_DIR=/var/www/html/exam
```

`deploy.sh` will replace the default `DJANGO_SECRET_KEY` automatically.

## 3. Deploy

```bash
sh deploy.sh
```

The script runs:

- create `.env` from `.env.example` if missing
- create `data/`, `backend/staticfiles/`, and `${FRONTEND_DIST_DIR}`
- build frontend with a one-off `oven/bun:1` container into `${FRONTEND_DIST_DIR}`
- build the backend image
- run `migrate`, `collectstatic`, and `check` in one-off backend containers
- start the backend Gunicorn container

Create an admin user after the first deploy:

```bash
docker compose exec backend python manage.py createsuperuser
```

## 4. Verify

- Frontend: `https://exam.mydomain.com/`
- Django Admin: `https://exam.mydomain.com/admin/`
- Backend check:

```bash
docker compose exec backend python manage.py check
```

## 5. Data and cleanup

Persistent files are stored on the host:

- SQLite: `data/db.sqlite3`
- Django static files: `backend/staticfiles/`
- Frontend static files: `/var/www/html/exam`

Stopping containers keeps data:

```bash
docker compose down
```

Do not delete `data/` unless you intentionally want to remove the SQLite database.
