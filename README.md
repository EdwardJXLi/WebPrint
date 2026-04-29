# WebPrint

WebPrint is a self-hosted web print management portal with an Express backend, React SPA frontend, SQLite persistence, and IPP/CUPS integration.

## Features

- OAuth2 / OIDC login against a configurable provider
- Secure server-side sessions with `httpOnly` cookies
- OWASP-focused protections: Helmet, CSRF tokens, rate limiting, input validation, sanitized logging
- Role-based access for admins and end users
- PDF and common image upload with file size and content-type validation
- Print submission to CUPS using IPP
- Per-user job history, live status refresh, and cancel support
- Admin printer CRUD with SQLite-backed metadata and live queue inspection
- Dockerfile and Docker Compose for single-container deployment

## Stack

- Backend: Node.js, Express, `openid-client`, `better-sqlite3`, `ipp`
- Frontend: React, React Router, Tailwind CSS, Vite (embedded into Express during development)
- Persistence: SQLite

## Project Layout

```text
server/   Express API, auth, SQLite, IPP integration
src/      React SPA
storage/  SQLite database and uploaded files
```

## Requirements

- Node.js 22+
- npm 10+
- A reachable CUPS server exposing IPP queues
- An OAuth2/OIDC provider with a registered redirect URI

## Local Setup

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your OIDC settings, session secret, and CUPS endpoint. Leave `OIDC_CLIENT_SECRET` blank if your provider uses PKCE-only public clients.

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the backend and frontend in development mode:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`.

### OIDC Redirect URIs

- Development callback URI: `http://localhost:3000/auth/callback`
- Production callback URI: `https://your-domain.example/auth/callback`

The app now runs behind a single Express port in development and production. Use `APP_BASE_URL` as the single public origin for both the API and the SPA. PKCE is always used; if your provider does not issue a client secret, leave `OIDC_CLIENT_SECRET` empty and the app will use `token_endpoint_auth_method=none`.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | No | `development`, `test`, or `production` |
| `PORT` | No | Express server port |
| `APP_BASE_URL` | Yes | Public base URL for the backend and OIDC callback generation |
| `APP_NAME` | No | Display name shown in the browser, header, and login screen; default `WebPrint` |
| `LOGIN_BUTTON_TEXT` | No | Text shown on the SSO login button; default `Continue` |
| `SESSION_SECRET` | Yes | Long random secret for signed session cookies |
| `SESSION_COOKIE_SECURE` | No | Set to `true` behind HTTPS |
| `TRUST_PROXY` | No | Set to `true` when running behind a reverse proxy |
| `OIDC_DISCOVERY_URL` | Yes | Provider discovery document URL |
| `OIDC_CLIENT_ID` | Yes | OIDC client ID |
| `OIDC_CLIENT_SECRET` | No | OIDC client secret; leave blank for PKCE-only/public clients |
| `OIDC_REDIRECT_URI` | No | Explicit callback URI; defaults to `${APP_BASE_URL}/auth/callback` |
| `OIDC_SCOPE` | No | Requested scopes; default `openid profile email` |
| `OIDC_ROLE_CLAIM` | No | Optional claim path used to detect admin role |
| `OIDC_ADMIN_ROLE_VALUE` | No | Claim value treated as admin; default `admin` |
| `ADMIN_EMAILS` | No | Comma-separated admin email allowlist fallback |
| `CUPS_IPP_URL` | No | Base IPP URL for your CUPS server, for example `ipp://cups:631`; leave blank while testing auth/UI before CUPS is ready |
| `SQLITE_PATH` | No | SQLite database file path |
| `UPLOAD_DIR` | No | Directory where uploaded documents are stored |
| `MAX_UPLOAD_MB` | No | Maximum upload size in megabytes |

## Working with CUPS

This repository does **not** include a CUPS container. Point the app at an existing CUPS server instead. You can leave `CUPS_IPP_URL` blank temporarily if you only want to test login and the non-printing UI first.

- Use `CUPS_IPP_URL` to describe the reachable CUPS server base, such as `ipp://cups.internal:631`
- Admins can use **Detect from CUPS** to import queues exposed by that CUPS server
- In the admin UI, you can save either a full printer URI like `ipp://cups.internal:631/printers/office` or a queue name like `office`
- Queue-name shortcuts are expanded against `CUPS_IPP_URL`
- The backend uses IPP for printer connectivity checks, job submission, queue status, and cancel operations

Make sure the Node container can resolve and reach the CUPS host on the network.

## Production Build

Build the frontend bundle:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

The Express server serves the built SPA from `dist/client` in production, and serves the Vite-powered SPA from the same port during development.

## Docker

### Build and run with Compose

```bash
cp .env.example .env
docker compose up --build
```

The container:

- exposes the app on port `3000`
- persists SQLite data and uploads in `./storage`
- expects the CUPS server to already exist and be reachable from the container

## Security Notes

- Sessions are stored server-side in SQLite and sent with secure, `httpOnly`, `sameSite=lax` cookies
- Mutating API requests require an `X-CSRF-Token` header
- Input is validated with Zod and text fields are sanitized before persistence
- Uploaded files are validated by content signature, not just browser-declared MIME type
- Logs intentionally avoid request bodies, cookies, and token material

## Admin and User Roles

- Users can create, review, and cancel only their own jobs
- Admins can manage printers and oversee all jobs
- Admin status is determined by either:
  - the configured `OIDC_ROLE_CLAIM` + `OIDC_ADMIN_ROLE_VALUE`, or
  - membership in `ADMIN_EMAILS`

## Linting

```bash
npm run lint
```

## Notes

- Uploaded files remain on disk for audit/history purposes
- Job status refresh occurs when job lists and the dashboard are loaded
- If you want background reconciliation, add a worker or cron-style polling layer later
