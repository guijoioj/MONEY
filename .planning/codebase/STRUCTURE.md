# Codebase Structure

**Analysis Date:** 2026-04-25

## Directory Layout

```
/home/ogejota/MONEY/SoftHair/
├── backend/                          # Express REST API + business logic
│   ├── src/
│   │   ├── server.js                 # Express app setup & middleware
│   │   ├── config/                   # Configuration (database, paths, initialization)
│   │   ├── middleware/               # Request processing (auth, validation, security)
│   │   ├── models/                   # Data access layer (query builders)
│   │   ├── routes/                   # API endpoint handlers
│   │   │   └── app/                  # Mobile app specific routes
│   │   ├── services/                 # Business logic (auth, security, email, backups)
│   │   ├── scripts/                  # Utility scripts (admin creation, backups)
│   │   └── utils/                    # Helper functions
│   ├── data/                         # Local data storage (SQLite, backups)
│   ├── backups/                      # Backup archives
│   ├── package.json
│   └── node_modules/
│
├── frontend/                         # React UI + Vite bundler
│   ├── src/
│   │   ├── main.jsx                  # Entry point (React DOM render)
│   │   ├── App.jsx                   # Root routing component
│   │   ├── index.css                 # Global styles (Tailwind)
│   │   ├── pages/                    # Page components (routes)
│   │   ├── components/               # Reusable UI components
│   │   ├── context/                  # React Context providers (auth)
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── services/                 # API client functions
│   │   └── sync/                     # Offline sync logic (Dexie)
│   ├── public/                       # Static assets
│   ├── index.html                    # HTML entry point
│   ├── vite.config.js                # Vite bundler config
│   ├── tailwind.config.js            # Tailwind CSS theme
│   ├── postcss.config.js             # PostCSS plugins
│   ├── package.json
│   ├── dist/                         # Build output
│   └── node_modules/
│
├── electron/                         # Electron desktop wrapper
│   ├── main.js                       # Main process (window, backend spawn)
│   └── preload.js                    # Context isolation bridge
│
├── docs/                             # Documentation
├── tools/                            # External tools (LightRAG)
├── .planning/                        # Analysis & planning documents
├── package.json                      # Root package (Electron build)
├── package-lock.json
├── .env                              # Environment config (not committed)
└── .gitignore
```

## Directory Purposes

**backend/src/:**
- Purpose: All server-side code
- Contains: Express application, models, routes, middleware, services
- Key files: `server.js` (entry), `config/database.js` (DB connection)

**backend/src/config/:**
- Purpose: Configuration and initialization
- Contains: Database setup, schema initialization, app paths
- Key files: `database.js` (pool, query helpers), `initDb.js` (schema loader)

**backend/src/middleware/:**
- Purpose: Request processing and cross-cutting concerns
- Contains: Auth validation, input validation, security headers, rate limiting
- Key files: `auth.js` (JWT validation), `validate.js` (express-validator wrapper), `security.js` (headers, limits)

**backend/src/models/:**
- Purpose: Data access abstraction
- Contains: Static class methods for CRUD operations per entity
- Key files: `Cliente.js`, `Agendamento.js`, `Servico.js`, `Profissional.js`, `Venda.js`, `Atendimento.js`, etc.
- Pattern: `static async create()`, `static async findById()`, `static async getAll()`, `static async update()`, `static async delete()`

**backend/src/routes/:**
- Purpose: HTTP endpoint handlers
- Contains: One file per resource (clientes.js, servicos.js, etc.)
- Key files: Desktop routes in root (auth, clientes, agendamentos, etc.)
- App routes: `routes/app/` for mobile-specific endpoints (auth, pedidos, loja, profissional, cliente, security)

**backend/src/services/:**
- Purpose: Business logic and external integrations
- Contains: Auth service, email service, Google Drive backup, security event logging, WebSocket broadcasting
- Key files: `authService.js` (JWT), `securityService.js` (event logging), `emailService.js`, `googleDriveService.js`, `websocketService.js`

**backend/data/:**
- Purpose: Local data persistence (relative to running process)
- Contains: SQLite databases, backup files
- Usage: Runtime files, not version controlled

**frontend/src/:**
- Purpose: All React application code
- Contains: Components, pages, context, hooks, services
- Entry point: `main.jsx` → renders to `#root` in `index.html`

**frontend/src/pages/:**
- Purpose: Full-page components mapped to routes
- Key files: `Login.jsx`, `Dashboard.jsx`, `Agenda.jsx`, `Agendamentos.jsx`, `Clientes.jsx`, `Profissionais.jsx`, `Atendimentos.jsx`, `Vendas.jsx`, `Fechamento.jsx`, `Backup.jsx`, `Configuracoes.jsx`, etc.
- Pattern: Each page is a React component exported and routed in `App.jsx`

**frontend/src/components/:**
- Purpose: Reusable UI components
- Contains: Layout, navigation, modals, forms, tables
- Key file: `Layout.jsx` (main app layout wrapper)

**frontend/src/services/:**
- Purpose: API client functions
- Key files: `api.js` (axios instance + endpoint definitions), `serverApi.js` (alternative/server-side API calls)
- Pattern: Exported objects with API call functions (authAPI, clientesAPI, servicosAPI, etc.)

**frontend/src/context/:**
- Purpose: React Context providers for global state
- Key file: `AuthContext.jsx` (user, token, login/logout)
- Pattern: Provider wraps app root, custom hook `useAuth()` for consumption

**frontend/src/hooks/:**
- Purpose: Custom React hooks for reusable logic
- Key file: `useWebSocket.js` (WebSocket connection management with auto-reconnect)

**frontend/src/sync/:**
- Purpose: Offline sync and data persistence
- Key file: `syncManager.js` (Dexie-based IndexedDB sync)

**frontend/public/:**
- Purpose: Static assets
- Contains: Logo, favicon, icons
- Bundled: Copied to dist/ during build

**electron/:**
- Purpose: Desktop application container
- Key files: `main.js` (window creation, backend spawning), `preload.js` (IPC bridge)
- Functionality: Manages app lifecycle, spawns backend process, handles window events

## Key File Locations

**Entry Points:**
- `backend/src/server.js`: Backend initialization, middleware setup, route registration
- `frontend/src/main.jsx`: React DOM render entry
- `electron/main.js`: Electron main process, window creation, backend spawning

**Configuration:**
- `backend/src/config/database.js`: PostgreSQL pool and query helpers
- `backend/src/config/initDb.js`: Schema initialization
- `frontend/vite.config.js`: Build config, dev server proxy to :3001
- `frontend/tailwind.config.js`: Color theme (custom primary #db2777)

**Core Logic:**
- `backend/src/models/`: Entity-specific queries (Client, Appointment, Service, etc.)
- `backend/src/middleware/auth.js`: JWT validation, user loading
- `backend/src/services/authService.js`: Token generation, user authentication
- `frontend/src/context/AuthContext.jsx`: Auth state and login/logout logic

**Testing:**
- None found (no test directory or test files)

## Naming Conventions

**Files:**
- Backend: camelCase.js (e.g., `server.js`, `clientes.js`, `authService.js`)
- Backend models: PascalCase.js (e.g., `Cliente.js`, `Agendamento.js`)
- Frontend components: PascalCase.jsx (e.g., `App.jsx`, `Dashboard.jsx`)
- Frontend utilities: camelCase.js (e.g., `api.js`, `syncManager.js`)

**Directories:**
- lowercase plural nouns (src, config, middleware, models, routes, services, pages, components, context, hooks, public, dist)

**Variables & Functions:**
- camelCase (e.g., `salonId`, `clienteName`, `getAll()`, `queryOne()`)

**Database Columns:**
- camelCase with quotes in SQL: `"salonId"`, `"dataNascimento"`, `"updatedAt"`

**Routes:**
- Lowercase paths with hyphens: `/api/auth/forgot-password`, `/api/app/pedidos`

**React Components:**
- PascalCase in JSX: `<Dashboard />`, `<ProtectedRoute />`

## Where to Add New Code

**New Feature (New Entity):**
- Model: `backend/src/models/YourEntity.js` (CRUD methods)
- Route: `backend/src/routes/yourentity.js` (endpoint handlers, validation)
- Frontend Page: `frontend/src/pages/YourEntity.jsx` (listing, create, edit, delete UI)
- API Service: Add methods to `frontend/src/services/api.js` (yourEntityAPI object)
- Route registration: Add to `backend/src/server.js` app.use('/api/yourentity', ...)
- Frontend routing: Add route in `frontend/src/App.jsx`

**New Mobile Endpoint:**
- Route file: `backend/src/routes/app/yourfeature.js`
- Registration: Add to `backend/src/server.js` under `/api/app` namespace
- Model: Reuse existing models (share business logic)

**New Component:**
- Reusable UI: `frontend/src/components/YourComponent.jsx`
- Full-page UI: `frontend/src/pages/YourPage.jsx`

**New Utility/Helper:**
- Backend: `backend/src/utils/yourHelper.js`
- Frontend: `frontend/src/services/yourHelper.js` or `frontend/src/hooks/useYourHook.js`

**New Service (Business Logic):**
- Location: `backend/src/services/yourService.js`
- Export: Static methods or functions
- Usage: Import in routes or other services

**Testing:**
- Backend: `backend/src/__tests__/` or `.test.js` alongside implementation
- Frontend: `frontend/src/__tests__/` or `.test.jsx` alongside components
- Config: Create `jest.config.js` or `vitest.config.js` (not yet configured)

## Special Directories

**backend/data/:**
- Purpose: Runtime data storage (SQLite backups, exports)
- Generated: Yes (created at runtime)
- Committed: No (in .gitignore)

**backend/backups/:**
- Purpose: Backup archives from Google Drive or manual exports
- Generated: Yes (created by backup service)
- Committed: No (in .gitignore)

**frontend/dist/:**
- Purpose: Vite build output (optimized production bundle)
- Generated: Yes (via `npm run build`)
- Committed: No (in .gitignore)

**frontend/node_modules/ & backend/node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (via npm install)
- Committed: No (in .gitignore)

**.planning/:**
- Purpose: Analysis documents and planning artifacts (this codebase map)
- Generated: Yes (via gsd-map-codebase)
- Committed: Yes

**electron/ in .claude/worktrees/:**
- Purpose: Git worktrees for parallel development branches
- Generated: Yes (via git worktree add)
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-04-25*
