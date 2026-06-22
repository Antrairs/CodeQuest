# Deploy with Docker, Gunicorn, and Existing Caddy

This deployment uses Docker for the Django backend and for one-off frontend builds. It reuses the Caddy already installed on the server.

- Gunicorn runs Django on `127.0.0.1:8000`.
- Caddy serves `/var/www/html/exam` and `backend/staticfiles`.
- Caddy reverse proxies `/api/*` and `/admin/*` to Gunicorn.
- SQLite is stored in `./data/db.sqlite3`.
- `deploy.sh` runs the repeatable deployment steps.

## 1. Server prerequisites

- DNS points your domain to the server.
- Ports `80` and `443` are open.
- Docker and Docker Compose are installed.
- Caddy is already installed and running on the host.

## 2. Configure host Caddy once

Add the `Caddyfile.example` block to `/etc/caddy/Caddyfile`.

Replace `/opt/codequest` with the absolute path of this repository on your server. The frontend path defaults to `/var/www/html/exam`.

```bash
sudo caddy reload --config /etc/caddy/Caddyfile
```

## 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` only if you need to change the domain or frontend output directory:

```env
DOMAIN=exam.mydomain.com
FRONTEND_DIST_DIR=/var/www/html/exam
```

`deploy.sh` will replace the default `DJANGO_SECRET_KEY` automatically.

## 4. Deploy

```bash
sh deploy.sh
```

The script runs:

- create `.env` from `.env.example` if missing
- create `data/`, `backend/staticfiles/`, and `${FRONTEND_DIST_DIR}`
- build frontend with Docker into `${FRONTEND_DIST_DIR}`
- build and start the backend container
- run `python manage.py check`
- reload Caddy when possible

If your user cannot reload Caddy without a password, the script prints the manual reload command.

Create an admin user after the first deploy:

```bash
docker compose exec backend python manage.py createsuperuser
```

## 5. Verify

- Frontend: `https://exam.mydomain.com/`
- Django Admin: `https://exam.mydomain.com/admin/`
- Backend check:

```bash
docker compose exec backend python manage.py check
```

## 6. Data and cleanup

Persistent files are stored on the host:

- SQLite: `data/db.sqlite3`
- Django static files: `backend/staticfiles/`
- Frontend static files: `/var/www/html/exam`

Stopping containers keeps data:

```bash
docker compose down
```

Do not delete `data/` unless you intentionally want to remove the SQLite database.
