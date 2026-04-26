# Testing Patterns

**Analysis Date:** 2026-04-25

## Test Framework

**Runner:**
- No test framework configured or detected
- No jest.config.js, vitest.config.js, or similar test configs found
- No test scripts in backend package.json (only start, dev, security-init, backup, restore, create-admin)
- No test scripts in frontend package.json (only dev, build, preview)
- No test scripts in mobile package.json

**Assertion Library:**
- Not applicable (no testing framework in use)

**Run Commands:**
- No test commands available
- Backend: `npm run dev` for development, `npm start` for production
- Frontend: `npm run dev` for development, `npm run build` for production
- Mobile: `npm start` for local dev, `npx expo start` for Expo

## Test File Organization

**Location:**
- No test files found in codebase (only dependencies' tests in node_modules)
- No `.test.js`, `.test.jsx`, `.spec.js`, `.spec.tsx` files detected outside node_modules
- No `__tests__` or `tests` directories in backend, frontend, or mobile

**Naming:**
- Not applicable (no test files present)

**Structure:**
- Not applicable

## Testing Status

**Current State:**
- No automated tests present in codebase
- Manual testing only (likely done through browser or mobile simulator)
- API testing can be done via curl, Postman, or API clients

## Testing Recommendations

**Backend (Express):**
- Suggested framework: Jest + Supertest
- Test location: `backend/tests/` or co-locate with code as `*.test.js`
- Key areas to test:
  - Route handlers (`src/routes/*`)
  - Model methods (`src/models/*`)
  - Service logic (`src/services/*`)
  - Middleware (`src/middleware/*`)
  - Validation rules

**Frontend (React):**
- Suggested framework: Vitest + React Testing Library
- Test location: `frontend/src/**/*.test.jsx` or dedicated `tests/` directory
- Key areas to test:
  - Page components (`src/pages/*`)
  - Context logic (`src/context/*`)
  - Query/mutation behavior
  - Error handling in modals and forms

**Mobile (React Native):**
- Suggested framework: Jest + React Native Testing Library
- Test location: `app/**/*.test.tsx`
- Key areas to test:
  - Screen components
  - Navigation flows
  - API integration

## Manual Testing Approach

**Current Testing Method:**
- Backend development: `npm run dev` in `backend/` starts server on port 3001
- Frontend development: `npm run dev` in `frontend/` starts dev server on port 3000 (proxies /api to localhost:3001)
- Mobile development: `npx expo start` in mobile directory
- Manual API testing via Postman/curl
- Manual UI testing via browser/simulator

**Development Workflow:**
- Make code changes
- Restart dev servers
- Test in browser/mobile simulator
- Check console logs for errors

## Test Data & Fixtures

**Current Approach:**
- No test fixtures or factories
- Database setup via migration scripts: `backend/scripts/`
- Default admin creation via bootstrap service: `BootstrapService.ensureDefaultAdmin()`
- Manual test data creation via API calls or direct database

**Suggested Fixture Pattern:**
```javascript
// Hypothetical test factory
const createTestCliente = async (salonId, overrides = {}) => {
  const defaults = {
    nome: 'Test Cliente',
    telefone: '11999999999',
    email: 'test@example.com',
    ...overrides
  };
  return await Cliente.create(defaults, salonId);
};
```

## Database Testing

**Current Setup:**
- Database: PostgreSQL (connection via `pg` package in `backend/src/config/database.js`)
- No test database configuration detected
- Database operations in development use live database

**Suggested Approach:**
- Use separate test database (test_softhair vs softhair)
- Reset/seed database before each test
- Use transactions to rollback changes after tests

## API Endpoint Testing

**Manual Testing Pattern:**
Routes are RESTful and follow these patterns:

**Backend routes (all require auth):**
- `GET /api/clientes` - List clients
- `POST /api/clientes` - Create client
- `PUT /api/clientes/:id` - Update client
- `DELETE /api/clientes/:id` - Delete client
- Similar patterns for profissionais, servicos, produtos, agendamentos, vendas, atendimentos, fechamentos

**Mobile app-specific routes (require API key + HMAC):**
- `GET /api/app/pedidos/saloes` - List salons
- `POST /api/app/auth/login` - Mobile login
- `GET /api/app/cliente/*` - Client-specific data

**Key Assertion Points:**
- Response status code (200, 201, 400, 401, 404, 500)
- Response JSON structure
- Data persistence (create/update operations)
- Authorization (401 for missing token, 403 for blocked user)
- Data isolation (salonId filtering for multi-tenant)

## Validation Testing

**Current Validation (Backend):**
- express-validator library used on all data routes
- Rules applied via middleware `src/middleware/validate.js`
- Example test candidates:
  ```javascript
  // In routes/clientes.js
  body('nome').trim().notEmpty().withMessage('Nome é obrigatório')
  body('telefone').trim().notEmpty().withMessage('Telefone é obrigatório')
  body('email').optional().isEmail().withMessage('Email inválido')
  ```

**Suggested Test Pattern:**
```javascript
describe('POST /api/clientes', () => {
  it('should reject missing nome', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({ telefone: '11999999999' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});
```

## Error Path Testing

**Areas Without Clear Error Handling:**
- Frontend: Some API calls use `.then()` without error handling in Dashboard
- Backend: Broad catch blocks that log to console but may miss specific error cases
- Mobile: Network timeouts, slow connections not explicitly tested

**Error Scenarios to Test:**
- Network errors (server down, timeout)
- Authentication errors (invalid token, expired token)
- Validation errors (missing required fields)
- Authorization errors (user blocked, insufficient permissions)
- Not found errors (resource doesn't exist)
- Conflict errors (duplicate entry)

## Frontend React Query Testing

**Current Patterns Observed:**
- useQuery with queryKey and queryFn
- useMutation with onSuccess/onError handlers
- queryClient.invalidateQueries for cache invalidation
- Example from `Clientes.jsx`:
  ```javascript
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clientes', search],
    queryFn: () => clientesAPI.getAll({ search }),
  });
  
  const createMutation = useMutation({
    mutationFn: (data) => clientesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
      closeModal();
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Error');
    },
  });
  ```

**Suggested Test Pattern:**
```javascript
describe('useQuery for clientes', () => {
  it('should fetch clients with search filter', async () => {
    const { result } = renderHook(() => 
      useQuery({
        queryKey: ['clientes', 'search'],
        queryFn: () => clientesAPI.getAll({ search: 'search' })
      })
    );
    
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
  });
});
```

## Mobile Testing Considerations

**Expo/React Native Specific:**
- No test framework installed
- Manual testing via Expo Go or built APK/IPA
- Use Metro bundler error output for debugging

**Suggested Setup:**
- Jest (comes with Expo by default)
- React Native Testing Library
- Mock AsyncStorage for testing

**Testing File-based Routing:**
- Test app tree structure
- Test link navigation
- Test parameter passing via route params

## Integration Testing

**Current Approach:**
- No integration tests
- Manual end-to-end testing through UI

**Suggested Scenarios:**
1. User registration → login → create client → create agendamento → convert to atendimento
2. Admin backup → restore
3. Commission calculation across multiple services
4. Multi-professional scheduling and availability

## Continuous Integration

**Current Setup:**
- No CI/CD pipeline detected (no GitHub Actions, GitLab CI, etc.)
- No pre-commit hooks enforcing tests

**Suggested CI Pipeline:**
```yaml
# GitHub Actions example
- Install dependencies
- Run linter (if configured)
- Run backend tests
- Run frontend tests
- Build frontend
- Deploy
```

## Coverage Goals

**Requirements:** 
- No coverage requirements enforced
- No coverage reporting configured

**Suggested Targets (Industry Standard):**
- Critical paths (auth, payments): 80%+
- Models and services: 70%+
- UI components: 50%+
- Overall: 60%+

## Common Testing Patterns to Establish

**Backend Route Testing Pattern:**
```javascript
const request = require('supertest');
const app = require('../src/server');

describe('GET /api/clientes', () => {
  let token;
  beforeAll(async () => {
    // Setup: Create test user, get token
  });
  
  it('should return list of clients', async () => {
    const res = await request(app)
      .get('/api/clientes')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
  });
});
```

**Frontend Component Testing Pattern:**
```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import Clientes from '../pages/Clientes';

describe('Clientes Page', () => {
  it('should display search input', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Clientes />
      </QueryClientProvider>
    );
    expect(screen.getByPlaceholderText('Buscar')).toBeInTheDocument();
  });
});
```

**Mobile Component Testing Pattern:**
```typescript
import { render } from '@testing-library/react-native';
import LoginScreen from '../app/(auth)/login';

describe('LoginScreen', () => {
  it('should render email input', () => {
    const { getByPlaceholderText } = render(<LoginScreen />);
    expect(getByPlaceholderText('Email')).toBeTruthy();
  });
});
```

---

*Testing analysis: 2026-04-25*
