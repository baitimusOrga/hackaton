# Accounts and authentication (HAC-27)

This branch adds registration, login/logout, server-side session expiry, a private profile and email password recovery. External-provider sign-in remains optional future work.

## Local walkthrough

1. Start the existing Postgres service with `docker compose up -d db`.
2. In `backend/`, run `./mvnw spring-boot:run -Dspring-boot.run.profiles=local` (`.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"` on Windows).
3. In `frontend/`, run `npm start` and visit `http://localhost:4200/register`.
4. Register with a unique email, display name and password of 12–128 characters. Sign in, edit `/account`, refresh to verify the session survives, then sign out.
5. Password recovery requires a local SMTP catcher listening on localhost:1025 or configured SMTP credentials. The app never prints recovery links or tokens to logs. Follow the email's link to `/reset-password#token=...`; it expires after 30 minutes. A successful reset signs out every session, and the link cannot be reused.

SMTP is not required to start or use the app. Without it, recovery still returns its generic confirmation and logs a delivery failure. Registration does not verify email ownership in this MVP. If the email account itself is lost, there is no manual identity-recovery workflow yet.

## Consistent local test account

The explicit `local` Spring profile creates this account on startup:

| Field | Value |
|---|---|
| Email | `test@example.com` |
| Password | `LocalTest123!` |
| Display name | Local Test User |
| Location / canton | Luzern / LU |
| Contact preference | In the app |

It is inserted once with a PBKDF2 password hash. Restarting preserves the same account ID, password and profile; it does not overwrite edits or duplicate the user. If you deliberately change its password, the original password is not restored on restart.

In an IDE, add `local` to the active Spring profiles. The fixture is disabled for test/staging/production profiles and refuses to run unless `app.env=dev` and the database URL points to loopback Postgres. Normal startup without `local` does not seed any accounts. No shared Flyway migration contains the fixture.

## Configuration

Set environment variables in the backend process or IDE run configuration; Spring Boot does not automatically source `.env` files.

| Variable | Local default | Use |
|---|---|---|
| `AUTH_PUBLIC_URL` | `http://localhost:4200` | Trusted frontend origin for recovery links; set to the actual HTTPS origin outside local development |
| `AUTH_MAIL_FROM` | `no-reply@hackaton.local` | Sender address accepted by your mail service |
| `SMTP_HOST` | `localhost` | Mail server |
| `SMTP_PORT` | `1025` | Mail port; use the provider's STARTTLS port when configured |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | empty | SMTP credentials, supplied privately |
| `SMTP_AUTH` | `false` | Set `true` for authenticated SMTP |
| `SMTP_STARTTLS` | `false` | Set `true` to require STARTTLS with a real remote mail server |
| `SPRING_SESSION_TIMEOUT` | `30m` | Idle session timeout, enforced by the server |

No deployment settings or remote secrets were changed. SMTP delivery does not determine liveness; monitor the recovery-delivery warning separately.

## API contract

All paths are under `/api/auth`. Responses contain no password hashes or reset tokens.

| Method and path | Body / result |
|---|---|
| `GET /csrf` | `{headerName, token}`; establishes a session if necessary |
| `POST /register` | JSON `{email, password, displayName}` → 201; does not sign in automatically |
| `POST /login` | **Form URL encoded** `email=...&password=...` → 204, rotating the session ID |
| `POST /logout` | → 204, invalidating the session and deleting its cookie |
| `GET /me` | Authenticated `{id, email, displayName, location, canton, contactPreference}` |
| `PUT /me` | JSON `{displayName, location, canton, contactPreference}` → updated profile |
| `POST /forgot-password` | JSON `{email}` → 202, regardless of account existence or delivery status |
| `POST /reset-password` | JSON `{token, password}` → 204; invalid/expired/used token → 400 |

Fetch `/csrf` first and send the returned token using its returned header name on **every mutation**, including login, logout and recovery. Spring masks this token for BREACH protection. Login/logout clear the old CSRF token, so fetch a new one afterwards. The Angular interceptor does this automatically for API mutations. Authentication is carried only by the HttpOnly `SESSION` cookie; no bearer credentials are stored in browser storage.

Session cookies use SameSite=Lax and become Secure on HTTPS requests. The existing forwarded-header setup must only trust headers supplied by the reverse proxy. Production access must use HTTPS.

Blank/invalid fields return 400 without echoing their submitted values; incorrect login returns a generic 401; missing CSRF returns 403; repeated auth attempts from one address return 429 and Retry-After. The throttle allows 20 auth POSTs per address per five minutes in one backend process, with bounded memory. Multiple replicas need a shared edge/distributed limiter. Duplicate registration returns a generic 409. These responses do not guarantee identical timing for existing/missing accounts.

All new API endpoints require authentication unless explicitly permitted in `SecurityConfig`. Public listing GETs stay available. Future listing/bid controllers must additionally enforce ownership and auction rules; those resources do not exist on this branch.

## Tests

Backend: `./mvnw verify`. Tests include the real Spring Security and Spring Session filters against the H2 database in PostgreSQL mode. They check password hashing, generic login failures, CSRF, session rotation/logout/expiry, HTTPS cookie flags, profile isolation, canton validation, reset expiry/replacement/single use/session revocation, and throttling. SMTP is mocked in automated tests.

Frontend: `npm run lint`, `npm test -- --watch=false`, `npm run build`. Tests cover CSRF transport, login/session restoration, logout, expired sessions, failed server access, confirmation validation and recovery UI.
