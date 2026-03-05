# Starting Never Empty on Localhost with Docker Compose

## Prerequisites

- Docker 24+ and Docker Compose v2 (`docker compose version`)
- Git clone of this repo
- A Google Cloud Service Account JSON file (for OCR/Gmail features; a placeholder empty file works if not using those)

---

## 1. Configure environment

The `./artifacts/example-localhost.env` example file already exists. Edit it and fill in all values marked with <tbd>, then save it as `./.env` so docker-compose will utilize it.

```bash
# Mandatory — change these
POSTGRES_PASSWORD=some-strong-password
KEYCLOAK_ADMIN_PASSWORD=some-strong-password
OPENAI_API_KEY=sk-...          # leave empty if not using LLM features
BARCODE_LOOKUP_KEY=...         # leave empty if not using barcode lookup

# Google credentials — path to your service account JSON on the host
GOOGLE_CREDENTIALS_FILE=./google-credentials.json
GMAIL_IMPERSONATE_EMAIL=you@example.com
```

All other values have working defaults for localhost.

---

## 2. Prepare the Google credentials file

If you have a service account JSON, copy it to the project root as `google-credentials.json`.

If you don't have one yet, create a placeholder so Docker doesn't create a directory instead of a file:

```bash
echo '{}' > google-credentials.json
```

---

## 3. Start all services

```bash
docker compose up --build -d
```

The first run downloads base images and compiles the backend (~3–5 min). Subsequent starts are fast.

Watch health status until everything is `healthy`:

```bash
docker compose ps
```

Expected final state:

```
NAME         STATUS
mongodb      healthy
postgres     healthy
keycloak     healthy
backend      running
frontend     running
```

---

## 4. First-run Keycloak setup

This is a one-time manual step. Keycloak does not auto-configure the realm.

### a) Open the admin console

```
http://localhost:9090
```

Click **Administration Console** and log in with `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` from `.env`.

### b) Create the realm

- Top-left dropdown → **Create realm**
- **Realm name**: `neverempty`
- Click **Create**

### c) Create the client

- Left sidebar → **Clients** → **Create client**
- **Client type**: OpenID Connect
- **Client ID**: `household-ui`
- Click **Next**
- **Client authentication**: OFF (it's a public browser SPA)
- **Standard flow**: ON
- **Direct access grants**: OFF
- Click **Next**
- **Valid redirect URIs**: `http://localhost:3000/*`
- **Web origins**: `http://localhost:3000`
- Click **Save**

### d) Create a test user (optional but needed to log in)

- Left sidebar → **Users** → **Create new user**
- Fill in **Username** and **Email**, click **Create**
- **Credentials** tab → **Set password** → fill in, toggle **Temporary** OFF → **Save**

---

## 5. Access the app

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8081/api/v1 |
| Keycloak admin | http://localhost:9090 |

---

## Common operations

```bash
# Stop (keeps volumes/data)
docker compose down

# Stop and wipe all data
docker compose down -v

# Rebuild and restart one service
docker compose up --build -d backend
```
