# External Integrations

**Analysis Date:** 2026-04-25

## APIs & External Services

**Google Services:**
- Google Drive - Backup and file storage
  - SDK/Client: googleapis 131.0.0 (`/home/ogejota/MONEY/SoftHair/backend/src/services/googleDriveService.js`)
  - Auth: Environment variable configuration (not read - credentials handled securely)

**Email Services:**
- Email delivery - Transactional emails and notifications
  - SDK/Client: nodemailer 6.9.8 (`/home/ogejota/MONEY/SoftHair/backend/src/services/emailService.js`)
  - Auth: SMTP configuration via environment variables

## Data Storage

**Databases:**
- PostgreSQL 12+ (primary)
  - Connection: Pool via `pg` client, configured in `/home/ogejota/MONEY/SoftHair/backend/src/config/database.js`
  - Config: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
  - Fallback: `DATABASE_URL` connection string for cloud deployments
  - SSL: Optional SSL via `DATABASE_SSL`, `DB_SSL_CA`, `DB_SSL_CERT`, `DB_SSL_KEY`
  - Pool: 10 max connections, 30s idle timeout, 5s connection timeout

**File Storage:**
- Local filesystem: `backend/data/` directory (relative to backend executable)
- Google Drive: For backup export/restore via googleapis
- Browser IndexedDB: Frontend offline storage via dexie 4.4.2

**Caching:**
- None detected (no Redis, Memcached, or @tanstack/react-query persistent cache layer)

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Implementation: `/home/ogejota/MONEY/SoftHair/backend/src/middleware/auth.js`
  - Token generation: `/home/ogejota/MONEY/SoftHair/backend/src/services/authService.js`
  - Token verification: jsonwebtoken library
  - Token storage: localStorage on frontend (`/home/ogejota/MONEY/SoftHair/frontend/src/context/AuthContext.jsx`)
  - Token revocation: SecurityService tracks revoked tokens

**Auth Flow:**
- Login endpoint: `POST /api/auth/login` - returns JWT token and user object
- Register endpoint: `POST /api/auth/register` - creates new user with hashed password
- Password reset: email-based token flow via `/auth/forgot-password` and `/auth/reset-password`
- Auth middleware: Validates Bearer token on protected routes, checks revocation status

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Datadog, or similar)

**Logs:**
- Console logging via `console.error()` and `console.log()` in backend
- SecurityService logs authentication events and security violations to database: `/home/ogejota/MONEY/SoftHair/backend/src/services/securityService.js`

**WebSocket Events:**
- Real-time notifications via `/ws` endpoint
  - Client types: `salao` (salon), `cliente` (client app), `profissional` (professional)
  - Broadcast via `notificarSalao()`, `notificarCliente()`, `notificarProfissional()` methods

## CI/CD & Deployment

**Hosting:**
- Desktop application - Electron packaged binary
- Build targets: Windows (via `--win`), Linux (via `--linux`), macOS (inferred)
- Build output: `dist/` directory

**CI Pipeline:**
- None configured (no GitHub Actions, GitLab CI, or Jenkins detected)

**Build Commands:**
- `npm run build:frontend` - Vite build (frontend only)
- `npm run build` - Full build: frontend + electron-builder packaging
- `npm run build:win` - Windows-specific build
- `npm run build:linux` - Linux-specific build

## Environment Configuration

**Required env vars (Backend):**
- `PORT` - Server port (default: 3001)
- `DB_HOST` - Database hostname
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `NODE_ENV` - Environment (development/production)

**Optional env vars:**
- `DATABASE_URL` - Full connection string (fallback if individual vars missing)
- `DATABASE_SSL` - Enable SSL for DB connections (true/false)
- `DB_SSL_CA`, `DB_SSL_CERT`, `DB_SSL_KEY` - SSL certificate paths
- `FORCE_HTTPS` - Force HTTPS redirect (true/false)

**Frontend env vars:**
- `VITE_API_URL` - API base URL (optional, defaults to environment-aware URL)

**Secrets location:**
- `.env` file (not committed, loaded at runtime via dotenv)
- Credentials must be set in environment before application startup

## Webhooks & Callbacks

**Incoming:**
- `POST /api/app/pedidos/*/verificar-disponibilidade` - Check appointment availability (mobile app)
- `PUT /api/app/pedidos/*/aprovar` - Approve booking request
- `PUT /api/app/pedidos/*/rejeitar` - Reject booking request

**Outgoing:**
- Email notifications via nodemailer (transactional emails)
- WebSocket push notifications to connected clients via `notificarSalao()`, `notificarCliente()`, `notificarProfissional()`
- Google Drive backup exports (one-way, initiated by user)

## Security Headers

**Helmet Configuration (Backend):**
- Content-Security-Policy: Restrictive - self-origin only
- HSTS: 1-year max age with subdomains and preload
- Frame ancestors: Disabled (X-Frame-Options: DENY)
- Object sources: None
- Cross-origin resource sharing: Configured via CORS middleware

---

*Integration audit: 2026-04-25*
