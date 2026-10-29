# React + Django + PostgreSQL

A full-stack web application development environment using **React with Vite**, **Django**, **PostgreSQL**, and **Docker Compose**. The project uses multi-stage Docker builds to keep the development environment organized and efficient.

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Python + Django
- **Database:** PostgreSQL
- **Containerization:** Docker and Docker Compose

## Project Structure

```text
myproject/
├── docker-compose.yml
├── .env
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── package-lock.json
│   └── src/
└── backend/
    ├── Dockerfile
    ├── requirements.txt
    ├── manage.py
    └── config/
        ├── settings.py
        ├── urls.py
        ├── asgi.py
        └── wsgi.py
```

## Prerequisites

Install the following software before starting:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/macOS) or Docker Engine with the Compose plugin (Linux).
- Git, if you are cloning the repository.

Docker Compose manages the frontend, backend, and database containers.

## Environment Configuration

Create a `.env` file in the project root with the following variables:

```dotenv
# PostgreSQL
POSTGRES_DB=myapp
POSTGRES_USER=myapp_user
POSTGRES_PASSWORD=change_this_password
POSTGRES_PORT=5432

# Django
DJANGO_SECRET_KEY=replace_with_a_development_secret_key
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend

# Frontend
VITE_API_URL=http://localhost:8000
```

Update the values as required for your local environment. Use a unique Django secret key and a strong database password.

**Important:** Never commit `.env` or real credentials to version control. Keep `.env` in `.gitignore` and share a separate `.env.example` file with placeholder values if needed.

## Run the Project

### 1. Clone the Repository

```bash
git clone <repository-url>
cd myproject
```

Replace `<repository-url>` with the actual repository URL.

### 2. Build and Start Containers

Run the following command from the project root:

```bash
docker compose up --build
```

This builds the frontend and backend development images and starts all three services. Django waits for PostgreSQL to become healthy before starting, and database migrations run automatically when the backend starts.

### 3. Access the Application

Once the containers are running, open the following URLs:

| Service | URL |
|---|---|
| React frontend | http://localhost:5173 |
| Django backend | http://localhost:8000 |
| PostgreSQL | localhost:5432 |

The PostgreSQL port is exposed for local database tools. Within Docker, the backend connects to PostgreSQL using the hostname `db` and port `5432`.

### 4. Create a Django Superuser (Optional)

To access the Django administration interface, create a superuser:

```bash
docker compose exec backend python manage.py createsuperuser
```

Then open:

http://localhost:8000/admin/

## Development Workflow

### Hot Reloading

- **React:** Vite refreshes the frontend when source files change.
- **Django:** The development server automatically reloads when Python files change.
- **PostgreSQL:** Database data persists in a Docker-managed volume.

Source code is mounted into the containers, so normal code changes do not require rebuilding the images.

### View Logs

View logs for all services:

```bash
docker compose logs -f
```

View logs for an individual service:

```bash
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f db
```

### Run Database Migrations

Create migrations after changing Django models:

```bash
docker compose exec backend python manage.py makemigrations
```

Apply migrations:

```bash
docker compose exec backend python manage.py migrate
```

### Install New Dependencies

**Backend — Python packages**

1. Add the package to `backend/requirements.txt`.
2. Rebuild and restart the backend:

```bash
docker compose up --build -d backend
```

**Frontend — npm packages**

Install the package inside the running frontend container:

```bash
docker compose exec frontend npm install <package-name>
```

Ensure the updated `package.json` and `package-lock.json` are saved and committed. If you add or change dependencies, rebuild the frontend image when needed:

```bash
docker compose up --build -d frontend
```

### Stop the Project

Stop and remove the containers:

```bash
docker compose down
```

The PostgreSQL data volume is preserved.

To stop the containers and delete the database volume as well:

```bash
docker compose down -v
```

**Warning:** The second command permanently removes the database data stored in the Compose-managed volume.

## Useful Commands

| Task | Command |
|---|---|
| Start services | `docker compose up` |
| Build and start | `docker compose up --build` |
| Start in background | `docker compose up -d` |
| Stop services | `docker compose down` |
| Check running containers | `docker compose ps` |
| Follow logs | `docker compose logs -f` |
| Open Django shell | `docker compose exec backend python manage.py shell` |
| Create migrations | `docker compose exec backend python manage.py makemigrations` |
| Apply migrations | `docker compose exec backend python manage.py migrate` |
| Create admin user | `docker compose exec backend python manage.py createsuperuser` |
| Access PostgreSQL | `docker compose exec db psql -U myapp_user -d myapp` |

## Troubleshooting

### Port Already in Use

If ports `5173`, `8000`, or `5432` are already occupied, stop the conflicting application or change the host-side port mapping in `docker-compose.yml`.

### Backend Cannot Connect to PostgreSQL

Check the database container and its logs:

```bash
docker compose ps
docker compose logs db
```

Verify that the backend uses `POSTGRES_HOST=db` and `POSTGRES_PORT=5432`.

### Changes Are Not Appearing

Check that the source directories are mounted correctly and that the relevant service is running:

```bash
docker compose logs -f frontend
docker compose logs -f backend
```

If dependencies or Dockerfile instructions have changed, rebuild the relevant image.

## Notes

- This configuration is intended for **local development**, not production deployment.
- Keep secrets in environment variables rather than hardcoding them in application code or Dockerfiles.
- Do not expose the Django development server or PostgreSQL directly to the public internet.
- Back up important database data before deleting Docker volumes.
