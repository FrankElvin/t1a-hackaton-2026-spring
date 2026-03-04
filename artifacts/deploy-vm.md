# Starting Never Empty on a VM with a DNS Name using Docker Compose

Assumes your DNS name is `myapp.example.com` and the VM has Docker installed.
HTTP-only is covered first; TLS is described at the end.

## Prerequisites

- Docker 24+ and Docker Compose v2 (`docker compose version`)
- DNS A record pointing `myapp.example.com` to the VM's public IP
- A Google Cloud Service Account JSON file (a placeholder empty file works if not using OCR/Gmail)

---

## 1. Open firewall ports on the VM

| Port | Service |
|------|---------|
| 3000 | Frontend |
| 9090 | Keycloak |
| 8081 | Backend API (only if direct access is needed; normally proxied by the frontend nginx) |

On most cloud providers (AWS/GCP/Azure/Hetzner) this is done via the security group or firewall rules in the console.

---

## 2. Configure `.env` for the DNS name

The key difference from localhost: every URL that a browser opens must use the public DNS name. Since Vite bakes those URLs into the JS bundle at build time, the values must be set **before** the first `docker compose up --build`.

Edit `.env` at the project root:

```bash
# ── Keycloak ──────────────────────────────────────────────────────────────────
KEYCLOAK_PORT=9090
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=some-strong-password   # !
KEYCLOAK_REALM=neverempty
KEYCLOAK_CLIENT_ID=household-ui

# ── Ports exposed on the host ─────────────────────────────────────────────────
BACKEND_PORT=8081
FRONTEND_PORT=3000

# ── PostgreSQL ────────────────────────────────────────────────────────────────
POSTGRES_PASSWORD=some-strong-password         # !

# ── OpenAI / Barcode / Google (same as localhost) ─────────────────────────────
OPENAI_API_KEY=...
GOOGLE_CREDENTIALS_FILE=./google-credentials.json
GMAIL_IMPERSONATE_EMAIL=...
BARCODE_LOOKUP_KEY=...
```

---

## 3. Update `docker-compose.yml` with the DNS name

Open `docker-compose.yml` and replace `localhost` with `myapp.example.com` in three places:

**`keycloak` service — `KC_HOSTNAME`:**
```yaml
KC_HOSTNAME: http://myapp.example.com:${KEYCLOAK_PORT:-9090}
```

**`backend` service — `KEYCLOAK_ISSUER_URI`:**
```yaml
KEYCLOAK_ISSUER_URI: http://myapp.example.com:${KEYCLOAK_PORT:-9090}/realms/${KEYCLOAK_REALM:-neverempty}
```

**`frontend` service — build args:**
```yaml
args:
  VITE_KEYCLOAK_URL: http://myapp.example.com:${KEYCLOAK_PORT:-9090}
  VITE_KEYCLOAK_REALM: ${KEYCLOAK_REALM:-neverempty}
  VITE_KEYCLOAK_CLIENT_ID: ${KEYCLOAK_CLIENT_ID:-household-ui}
  VITE_MOCK_AUTH: ${VITE_MOCK_AUTH:-false}
```

You can also remove the `extra_hosts: localhost:host-gateway` line from the backend service —
on a VM the backend resolves the DNS name through normal container DNS instead.

---

## 4. Prepare the Google credentials file and start

```bash
echo '{}' > google-credentials.json  # or copy the real service account JSON

docker compose up --build -d
```

---

## 5. First-run Keycloak setup

### a) Open the admin console

```
http://myapp.example.com:9090
```

Click **Administration Console** and log in with `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD`.

### b) Create the realm

- Top-left dropdown → **Create realm**
- **Realm name**: `neverempty`
- Click **Create**

### c) Create the client

- Left sidebar → **Clients** → **Create client**
- **Client type**: OpenID Connect
- **Client ID**: `household-ui`
- Click **Next**
- **Client authentication**: OFF (public browser SPA)
- **Standard flow**: ON
- **Direct access grants**: OFF
- Click **Next**
- **Valid redirect URIs**: `http://myapp.example.com:3000/*`
- **Web origins**: `http://myapp.example.com:3000`
- Click **Save**

### d) Create a test user

- Left sidebar → **Users** → **Create new user**
- Fill in **Username** and **Email**, click **Create**
- **Credentials** tab → **Set password** → fill in, toggle **Temporary** OFF → **Save**

---

## 6. Access the app

| Service | URL |
|---------|-----|
| Frontend | http://myapp.example.com:3000 |
| Backend API | http://myapp.example.com:8081/api/v1 |
| Keycloak admin | http://myapp.example.com:9090 |

---

## Adding TLS (HTTPS)

For HTTPS the simplest path is a Caddy reverse proxy added to the compose stack. Caddy handles certificate issuance automatically via Let's Encrypt.

### a) Add the `caddy` service to `docker-compose.yml`

```yaml
caddy:
  image: caddy:alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./Caddyfile:/etc/caddy/Caddyfile:ro
    - caddy_data:/data
    - caddy_config:/config
  networks:
    - internal
```

Add the new volumes under the top-level `volumes:` key:

```yaml
volumes:
  mongodb_data:
  postgres_data:
  caddy_data:
  caddy_config:
```

Remove the host-port mappings from `frontend` and `keycloak` services
(Caddy will proxy to them internally; they no longer need to be exposed directly).

### b) Create `Caddyfile` at the project root

```
myapp.example.com {
    reverse_proxy frontend:80
}

keycloak.myapp.example.com {
    reverse_proxy keycloak:8080
}
```

### c) Update URLs to `https://`

In `docker-compose.yml`:

```yaml
# keycloak service
KC_HOSTNAME: https://keycloak.myapp.example.com

# backend service
KEYCLOAK_ISSUER_URI: https://keycloak.myapp.example.com/realms/${KEYCLOAK_REALM:-neverempty}

# frontend build args
VITE_KEYCLOAK_URL: https://keycloak.myapp.example.com
```

### d) Update the Keycloak client redirect URIs

After restarting, go to the Keycloak admin console and update the `household-ui` client:

- **Valid redirect URIs**: `https://myapp.example.com/*`
- **Web origins**: `https://myapp.example.com`

### e) Open ports 80 and 443 in the firewall

Ports 3000 and 9090 can be closed once Caddy is in front.
