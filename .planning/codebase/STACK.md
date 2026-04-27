# Technology Stack

**Analysis Date:** 2026-04-25

## Languages

**Primary:**
- JavaScript (Node.js) 18+ - Backend server and Electron main process
- JavaScript/JSX - Frontend React application
- SQL - PostgreSQL database queries

**Secondary:**
- HTML/CSS - UI markup and styling

## Runtime

**Environment:**
- Node.js 18+ (via package scripts in `package.json`)
- Electron 28.3.3 - Desktop application container

**Package Manager:**
- npm - Primary package manager for all three layers
- Lockfile: `package-lock.json` present in root and per-workspace (backend/, frontend/)

## Frameworks

**Core:**
- Express.js 4.18.2 - Backend HTTP API server (`/home/ogejota/MONEY/SoftHair/backend/src/server.js`)
- React 18.2.0 - Frontend UI framework (`/home/ogejota/MONEY/SoftHair/frontend/src/App.jsx`)
- Electron 28.3.3 - Desktop app wrapper (`/home/ogejota/MONEY/SoftHair/electron/main.js`)

**Build/Dev:**
- Vite 5.0.12 - Frontend bundler and dev server (`/home/ogejota/MONEY/SoftHair/frontend/vite.config.js`)
- electron-builder 24.13.3 - Electron packaging and distribution

**Styling:**
- TailwindCSS 3.4.1 - Utility-first CSS (`/home/ogejota/MONEY/SoftHair/frontend/tailwind.config.js`)
- PostCSS 8.4.33 - CSS processing pipeline (`/home/ogejota/MONEY/SoftHair/frontend/postcss.config.js`)
- autoprefixer 10.4.17 - Vendor prefix injection

**Testing:**
- None configured or detected in package.json

## Key Dependencies

**Backend HTTP & Middleware:**
- express 4.18.2 - REST API framework
- cors 2.8.5 - Cross-origin resource sharing
- helmet 7.1.0 - HTTP security headers
- express-validator 7.0.1 - Input validation on routes
- express-rate-limit 7.1.5 - Rate limiting middleware
- express-slow-down 2.0.1 - Request throttling

**Authentication & Security:**
- jsonwebtoken 9.0.2 - JWT token generation and verification (`/home/ogejota/MONEY/SoftHair/backend/src/middleware/auth.js`)
- bcryptjs 2.4.3 - Password hashing

**Database:**
- pg 8.20.0 - PostgreSQL client with Pool support (`/home/ogejota/MONEY/SoftHair/backend/src/config/database.js`)

**Real-time Communication:**
- ws 8.20.0 - WebSocket server (`/home/ogejota/MONEY/SoftHair/backend/src/services/websocketService.js`)

**File Handling & Integration:**
- multer 1.4.5-lts.1 - File upload middleware
- nodemailer 6.9.8 - Email sending
- googleapis 131.0.0 - Google Drive and Sheets integration

**Frontend HTTP:**
- axios 1.6.5 - HTTP client with interceptors (`/home/ogejota/MONEY/SoftHair/frontend/src/services/api.js`)
- @tanstack/react-query 5.17.19 - Server state management

**Frontend UI & Utilities:**
- react-router-dom 6.21.2 - Client-side routing
- lucide-react 0.312.0 - Icon library
- recharts 3.8.1 - Chart/visualization library
- react-dom 18.2.0 - React DOM rendering

**Frontend Data:**
- dexie 4.4.2 - IndexedDB abstraction layer (likely for offline sync)

**Build & Development:**
- @vitejs/plugin-react 4.2.1 - React Fast Refresh for Vite
- dotenv 16.4.5 - Environment variable loading

**Utilities:**
- uuid 9.0.1 - UUID generation for IDs
- nodemon 3.0.3 - Dev server auto-reload

## Configuration

**Environment:**
- `.env` file (not committed - referenced in `server.js` at `require('dotenv').config()`)
- Environment variables configured per workspace:
  - Backend: `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DATABASE_URL` (fallback), `DATABASE_SSL`, `NODE_ENV`, `FORCE_HTTPS`
  - Frontend: `VITE_API_URL` (optional, defaults to `/api` or `http://localhost:3001/api` in Electron)

**Build:**
- Root: `package.json` with Electron build configuration and scripts
- Frontend: `vite.config.js` (dev server on port 3000, proxy to backend on 3001)
- Frontend: `tailwind.config.js` with custom primary color palette (pink #db2777)
- Frontend: `postcss.config.js` with tailwindcss and autoprefixer

## Platform Requirements

**Development:**
- Node.js 18+ (inferred from modern syntax and package versions)
- npm 8+
- PostgreSQL 12+ (based on features used in schema)
- Electron cross-platform support (Windows, macOS, Linux via electron-builder)

**Production:**
- Deployment: Desktop application (packaged Electron + Node.js backend)
- Backend runs as subprocess spawned by Electron main process (`/home/ogejota/MONEY/SoftHair/electron/main.js`)
- Database: PostgreSQL instance accessible from deployment environment
- Build artifacts: `/dist` directory with packaged application

---

*Stack analysis: 2026-04-25*
