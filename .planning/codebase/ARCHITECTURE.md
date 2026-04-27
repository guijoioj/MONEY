# Architecture

**Analysis Date:** 2026-04-25

## Pattern Overview

**Overall:** Three-tier desktop application (Electron wrapper + Express backend + React frontend) with optional mobile backend layer

**Key Characteristics:**
- Monolithic backend (Express REST API + WebSocket)
- Stateless HTTP API with JWT authentication
- Real-time updates via WebSocket
- Salon-scoped multi-tenancy (data isolation via salonId)
- Packaged desktop deployment (Electron)

## Layers

**Presentation Layer (Frontend):**
- Purpose: React UI for salon management operations
- Location: `frontend/src/` with Vite bundler
- Contains: Page components, hooks, services, context (authentication)
- Depends on: HTTP API (`/api`), WebSocket (`/ws`), localStorage
- Used by: Electron renderer process via file:// protocol (when packaged) or http://localhost:3000 (dev)

**Desktop Wrapper Layer (Electron):**
- Purpose: Provide native desktop application container and spawn backend
- Location: `electron/main.js` and `electron/preload.js`
- Contains: Window management, backend process spawning, file protocol handling
- Depends on: Node.js child_process, Express backend running on port 3001
- Used by: End users (desktop application)

**Application Layer (Backend API):**
- Purpose: REST API endpoints and business logic
- Location: `backend/src/server.js` and `backend/src/routes/`
- Contains: Route handlers, models, middleware, services
- Depends on: PostgreSQL, WebSocket server, external services (Google Drive, email)
- Used by: React frontend (desktop), mobile app backend (`/api/app/*` endpoints)

**Data Layer (Database):**
- Purpose: Persistent data storage
- Location: PostgreSQL database
- Contains: Schema tables for salons, users, clients, appointments, services, products, sales, etc.
- Depends on: None
- Used by: Backend models via `pg` client pool

## Data Flow

**Desktop App Startup:**

1. Electron main process starts (`electron/main.js`)
2. Creates BrowserWindow with webPreferences (context isolation enabled)
3. Spawns backend Node.js process as child_process
4. Waits for backend to be ready (health check via `GET /api/health`)
5. Loads React app into window (dev: http://localhost:3000, prod: file:// protocol)
6. Frontend connects to backend at http://localhost:3001

**Authentication Flow:**

1. User submits login form on `Login.jsx`
2. Frontend calls `authAPI.login()` → POST `/api/auth/login`
3. Backend validates credentials against `clientes` table (models/Cliente.js)
4. Backend returns JWT token + user object
5. Frontend stores token in localStorage and user in React Context (AuthContext.jsx)
6. Subsequent requests include `Authorization: Bearer <token>` header
7. Backend middleware validates token, checks revocation, loads user data

**Appointment Request (Salon Operations):**

1. User submits appointment request in `Agenda.jsx`
2. Frontend calls API endpoint → POST `/api/agendamentos`
3. Backend validates input via express-validator
4. Backend creates agendamento record in database
5. Backend broadcasts WebSocket notification to salon clients (`notificarSalao()`)
6. Frontend receives update via `useWebSocket()` hook → triggers React Query refetch
7. UI updates with new appointment in real-time

**Mobile App Integration:**

1. Mobile app (`/api/app/*` routes) uses API key + HMAC signing for auth
2. Mobile routes branch to separate endpoint namespace: `/api/app/auth`, `/api/app/pedidos`, `/api/app/loja`, etc.
3. Shares same database and business logic as desktop routes

**State Management:**

- **Server state:** React Query (@tanstack/react-query) for API data caching
- **Auth state:** Context (AuthContext.jsx) for user, token, login/logout
- **Local state:** Component useState for UI interactions
- **Real-time state:** WebSocket via custom `useWebSocket()` hook for live updates
- **Offline:** Dexie (IndexedDB) for offline sync capability (frontend/sync/syncManager.js)

## Key Abstractions

**Models (Data Access):**
- Purpose: Encapsulate database queries for each entity
- Examples: `Cliente.js`, `Agendamento.js`, `Servico.js`, `Profissional.js`, `Venda.js`, `Atendimento.js`
- Pattern: Static class methods with async/await, parameterized SQL (placeholder conversion)
- Location: `backend/src/models/`

**Middleware (Request Processing):**
- Purpose: Cross-cutting concerns (auth, validation, security, rate limiting)
- Examples: `authMiddleware`, `validate`, `apiKeyMiddleware`, `hmacMiddleware`, `generalLimiter`
- Pattern: Express middleware functions that call `next()` or return response
- Location: `backend/src/middleware/`

**Services (Business Logic):**
- Purpose: Complex operations spanning multiple models
- Examples: `authService`, `securityService`, `emailService`, `googleDriveService`, `backupService`, `websocketService`
- Pattern: Static methods or singleton instances exporting functions
- Location: `backend/src/services/`

**Routes (Endpoints):**
- Purpose: Map HTTP methods/paths to handlers
- Examples: `/clientes`, `/agendamentos`, `/vendas`, `/profissionais`, `/app/pedidos`
- Pattern: Express router with inline or delegated handlers
- Location: `backend/src/routes/` (desktop) and `backend/src/routes/app/` (mobile)

## Entry Points

**Desktop Application:**
- Location: `electron/main.js`
- Triggers: User launches executable (via npm start, or packaged Electron binary)
- Responsibilities: Spawn Express backend, create React window, manage app lifecycle

**Backend Server:**
- Location: `backend/src/server.js`
- Triggers: Spawned by Electron main process or manual npm run dev
- Responsibilities: Initialize database, start Express server, setup WebSocket, apply middleware, register routes

**Frontend Application:**
- Location: `frontend/src/main.jsx` (entry) → `App.jsx` (routing)
- Triggers: Loaded by Electron BrowserWindow or Vite dev server
- Responsibilities: Auth flow, route navigation, API calls, real-time updates

## Error Handling

**Strategy:** Try/catch in async handlers with consistent error response format

**Patterns:**
- Backend routes: `try { ... } catch (e) { res.status(500).json({ error: e.message }); }`
- Frontend API calls: axios interceptor handles 401 unauthorized → redirect to login
- Security events: Logged to database via SecurityService.logSecurityEvent()
- WebSocket errors: Silently ignored, auto-reconnect after 5s

**Response Format:**
- Success: `{ data: ... }` or `{ success: true, ... }`
- Error: `{ error: "message" }` or `{ success: false, error: "message" }`

## Cross-Cutting Concerns

**Logging:**
- Backend: console.error() for errors, console.log() for info
- Database: SecurityService logs auth/security events to security_events table
- Frontend: No centralized logging (console only)

**Validation:**
- Backend: express-validator on POST/PUT routes (`middleware/validate.js`)
- Frontend: Form validation in page components (manual or library)
- Approach: Validate early, return 400 with validation details

**Authentication:**
- Backend: JWT via middleware, checks token validity and user status
- Frontend: Token stored in localStorage, included in all requests
- Approach: Stateless tokens, no session management

**Rate Limiting:**
- Backend: `express-rate-limit` on `/api/auth`, general limiter on `/api`
- Approach: 15-min sliding windows with configurable limits
- Also: `express-slow-down` for gradual slowdown before rejection

**Multi-tenancy:**
- Approach: All queries scoped by `salonId` from decoded JWT token
- Enforcement: Middleware adds `req.salonId`, models include in WHERE clauses
- Security: Cannot access other salons' data even with valid token

---

*Architecture analysis: 2026-04-25*
