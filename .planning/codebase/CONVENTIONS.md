# Coding Conventions

**Analysis Date:** 2026-04-25

## Naming Patterns

**Files:**
- Backend models: PascalCase, one per file. Examples: `Cliente.js`, `Profissional.js`, `Agendamento.js` in `src/models/`
- Backend routes: lowercase plural, e.g., `clientes.js`, `profissionais.js`, `agendamentos.js` in `src/routes/`
- Backend middleware: camelCase descriptive names, e.g., `auth.js`, `validate.js`, `security.js` in `src/middleware/`
- Backend services: PascalCase with Service suffix, e.g., `AuthService`, `BackupService`, `EmailService` in `src/services/`
- Frontend pages: PascalCase, one per page. Examples: `Dashboard.jsx`, `Clientes.jsx`, `Agendamentos.jsx` in `src/pages/`
- Frontend components: PascalCase. Located in `src/components/` (currently minimal)
- Frontend context: PascalCase with Context suffix, e.g., `AuthContext.jsx` in `src/context/`
- Mobile routes: kebab-case files within folder-based structure using Expo Router conventions. Examples: `login.tsx`, `index.tsx`, `[id].tsx` in `app/(auth)/`, `app/(cliente)/`

**Functions/Methods:**
- Backend: camelCase. Examples: `findById()`, `getAll()`, `createBackup()`, `sendEmail()`
- Backend class methods: static, async/await pattern. Examples in `AuthService`: `static async register()`, `static async login()`
- Frontend hooks: camelCase prefixed with `use`. Examples: `useAuth()`, `useQuery()`, `useMutation()`
- Frontend handlers: camelCase with verb prefix. Examples: `handleLogin()`, `handleDelete()`, `handleSubmit()`
- Mobile: Same as frontend hooks and handlers

**Variables:**
- camelCase for all variables. Examples: `clientesData`, `profissionaisLista`, `agendamentosHoje`, `isLoading`, `setSearch`
- Boolean flags: camelCase with `is` prefix when possible. Examples: `isLoading`, `isModalOpen`, `isRefetching`
- State arrays/objects: descriptive plural names. Examples: `clientes`, `profissionais`, `agendamentos`, `produtos`
- Loop variables: short, conventional names. Examples: `i`, `item`, `e` for error

**Types:**
- Backend: No TypeScript, implicit types through JSDoc or context
- Frontend React: JSDoc or implicit through React prop usage
- Mobile: TypeScript with explicit interfaces. Example: `interface Salao { id: string; nome: string; cidade: string; }`

## Code Style

**Formatting:**
- No linting tool configured (no .eslintrc found)
- No formatter configured (no .prettierrc found)
- Indentation: 2 spaces (observed across codebase)
- Line length: Not enforced, but most lines < 100 characters
- Quote style: Single quotes for strings, double quotes for JSX attributes
- Semicolons: Always included

**Linting:**
- No eslint configuration detected in project root
- No pre-commit hooks enforcing lint rules
- Code follows basic conventions but not machine-enforced

## Import Organization

**Order:**
1. External dependencies (Node.js builtins, npm packages)
2. Relative imports from local files (models, services, utilities)
3. Custom middleware/config imports

**Backend Pattern (Express routes):**
```javascript
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const SomeModel = require('../models/SomeModel');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
```

**Frontend Pattern (React components):**
```javascript
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SomeIcon } from 'lucide-react';
import api from '../services/api';
import { SomeComponent } from '../components/SomeComponent';
```

**Mobile Pattern (Expo/React Native):**
```typescript
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import api from '../services/api';
```

**Path Aliases:**
- Frontend: No aliases configured in vite.config.js
- Mobile: No aliases configured in app structure
- Backend: Uses relative paths (../models, ../services)

## Error Handling

**Backend Patterns:**
- All routes wrap logic in `try/catch` blocks
- Catch blocks return standardized JSON error responses with status codes
- Examples:
  ```javascript
  router.get('/', async (req, res) => {
    try { 
      res.json({ data: await Model.getAll(req.query, req.salonId) }); 
    }
    catch (e) { 
      res.status(500).json({ error: e.message }); 
    }
  });
  ```
- Error responses: `{ error: "message" }` or `{ success: false, error: "message" }`
- HTTP status codes: 200 (success), 201 (created), 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 500 (server error)

**Frontend Patterns:**
- React Query handles async/error state automatically
- Component-level error state: useState with setError, display via conditional render
- Example from `Clientes.jsx`:
  ```javascript
  const [error, setError] = useState('');
  const createMutation = useMutation({
    mutationFn: (data) => clientesAPI.create(data),
    onError: (err) => {
      setError(err.response?.data?.error || err.message || 'Erro ao criar cliente');
    },
  });
  ```
- Error display: Conditional rendering with error banners/alerts

**Mobile Patterns:**
- React Query for server state errors
- Alert for user-facing errors: `Alert.alert('Erro', message)`
- Catch blocks with try/finally for cleanup

## Logging

**Framework:** No structured logging library (console.log used directly)

**Patterns:**
- Backend: `console.log()` for info, `console.error()` for errors
- Server startup: Detailed logging of configuration, security status, port/protocol info in `src/server.js`
- Database queries: No query logging detected
- API requests: No request logging middleware detected
- Frontend: `console.log()` for debugging, some API response logging. Example in `Clientes.jsx`:
  ```javascript
  console.log('Historico API response:', res.data);
  console.error('Erro ao buscar historico:', err);
  ```
- Mobile: No logging detected

**When/how to log:**
- Backend: Log on server startup, security events, errors
- Frontend: Log API responses when debugging, errors in catch blocks
- Mobile: Minimal logging

## Comments

**When to Comment:**
- Complex business logic that's not self-evident
- Non-obvious parameter meanings
- Bug workarounds or temporary solutions
- No extensive JSDoc observed in codebase
- Most code relies on clear naming rather than comments

**JSDoc/TSDoc:**
- Backend: Minimal JSDoc usage (not found in explored files)
- Frontend: No JSDoc observed
- Mobile: TypeScript with inline type annotations, no extensive TSDoc

## Function Design

**Size:** 
- Generally small, 10-30 lines per function
- Route handlers: 5-15 lines
- Service methods: 10-25 lines
- React components: 50-200 lines depending on complexity

**Parameters:**
- Backend models: Data object or ID + salonId pattern
  ```javascript
  static async create(data, salonId)
  static async update(id, data, salonId)
  ```
- Backend routes: Use `req` object for all data (params, body, query)
- Frontend: Props passed as objects/destructured
- Services: API methods accept params object or individual args

**Return Values:**
- Backend models: Return query results or boolean success
- Backend services: Return sanitized objects or success messages
- Frontend APIs: Return Promise<axios response>
- React Query: Queries return raw data, mutations return data
- Mobile: Same as frontend

## Module Design

**Exports:**
- Backend models: `module.exports = ClassName`
- Backend services: `module.exports = ServiceClass`
- Backend routes: `module.exports = router`
- Frontend services: Named exports for API object groups
  ```javascript
  export const authAPI = { ... }
  export const clientesAPI = { ... }
  export default api; // Default export of axios instance
  ```

**Barrel Files:**
- Frontend: No barrel files (`index.js`) detected in services or components
- Backend: No barrel files detected
- Mobile: Importing directly from service files

## Class Patterns (Backend)

**Model Classes:**
- Static methods only, no instantiation
- Pattern: `static async methodName(params) { ... }`
- Database interaction through `queryOne()`, `query()`, `queryRun()` helpers
- All methods include salonId isolation for multi-tenant support
- Example:
  ```javascript
  class Cliente {
    static async create(data, salonId) { ... }
    static async findById(id, salonId) { ... }
    static async getAll(filters = {}, salonId) { ... }
    static async update(id, data, salonId) { ... }
    static async delete(id, salonId) { ... }
  }
  ```

**Service Classes:**
- Static methods only
- Contain business logic, validation, integrations
- Examples: `AuthService`, `BackupService`, `EmailService`, `SecurityService`

## Async/Await Patterns

**Consistency:** 
- Backend: async/await everywhere, no callbacks
- Frontend: async/await in mutation handlers, Promise chains in query functions
- Mobile: async/await in service calls

**Promise handling:**
- Backend: Full try/catch/finally where needed
- Frontend: React Query handles promise state
- Mobile: React Query + try/catch in manual API calls

## Validation

**Backend:**
- express-validator library used on all POST/PUT routes
- Validation applied before route handler via middleware
- Pattern:
  ```javascript
  router.post('/', [
    body('nome').trim().notEmpty().withMessage('Nome é obrigatório'),
    body('telefone').trim().notEmpty().withMessage('Telefone é obrigatório'),
  ], validate, async (req, res) => { ... })
  ```
- Custom validate middleware: `src/middleware/validate.js`

**Frontend:**
- Form validation done before API calls
- Example: Check field values, trim, validate format
- No formal validation library observed

**Mobile:**
- Basic validation in form handlers (trim, empty checks)
- No validation library

## Security Patterns

**Backend:**
- Authentication via JWT stored in `Authorization: Bearer {token}` header
- Token verification in `authMiddleware` before protected routes
- Password hashing with bcryptjs (12 salt rounds)
- Token revocation checking via SecurityService
- HTTPS/SSL optional based on NODE_ENV
- Helmet security headers configured in `src/server.js`
- CORS configured
- Rate limiting via express-rate-limit

**Frontend:**
- Token stored in localStorage (not secure for sensitive data)
- Automatic logout on 401 response
- API interceptor adds token to all requests

**Mobile:**
- Token stored in AsyncStorage (mobile equivalent of localStorage)
- Device fingerprinting for API calls
- HMAC signature for request integrity
- API_KEY and HMAC_SECRET via environment variables

---

*Convention analysis: 2026-04-25*
