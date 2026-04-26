# Codebase Concerns

**Analysis Date:** 2026-04-25

## Tech Debt

**Loose Code Quality in Frontend SyncManager:**
- Issue: Incomplete statement and inconsistent indentation throughout file
- Files: `frontend/src/syncManager.js` lines 95, 183
- Impact: Line 95 has orphaned increment operator `+ change.attempts` instead of `change.attempts++`, line 183 has orphaned comma. This will cause runtime errors when offline sync is triggered.
- Fix approach: Complete the statement on line 95 as `change.attempts++`, remove orphaned comma on line 183. Review entire file for consistent indentation and statement completion.

**Typo in Authentication Route:**
- Issue: Variable name `bcryptUpdate` instead of `bcrypt` in password change endpoint
- Files: `backend/src/routes/app/auth.js` lines 93, 95
- Impact: Password change endpoint will crash with "bcryptUpdate is not defined" error when clients attempt to change passwords
- Fix approach: Replace `bcryptUpdate.compare` with `bcrypt.compare` and `bcryptUpdate.hash` with `bcrypt.hash`

**Implicit Type Coercion in Dashboard Calculations:**
- Issue: Division by zero risk and implicit type coercion in commission calculations
- Files: `backend/src/routes/app/profissional.js` lines 54, 223
- Impact: Commission calculations may produce NaN if profissionalComissao is undefined or zero, silently propagating to client
- Fix approach: Add explicit null checks and default values. Use safe division pattern: `comissaoPct || 0`

## Security Concerns

**API Key Exposed in Frontend Environment:**
- Risk: API_KEY and HMAC_SECRET stored in client-side environment variables (accessible in compiled bundles)
- Files: `frontend/src/syncManager.js`, `mobile/services/api.ts`
- Current mitigation: API Key is checked server-side
- Recommendations: Move API Key and HMAC Secret to server-only endpoints. Implement OAuth2 or session-based auth for client apps instead of static keys. For mobile, use SecureStore for all credentials (currently only used for JWT tokens).

**CORS Misconfiguration Allows Empty Origin:**
- Risk: CORS validation allows requests with no origin header
- Files: `backend/src/middleware/security.js` lines 104-110
- Current mitigation: Checks against allowedOrigins list
- Recommendations: Deny empty origin in production. Change condition from `!origin ||` to `origin &&` to require origin header. Set default to deny if ALLOWED_ORIGINS not configured.

**Weak JWT Verification Missing Signature Validation:**
- Risk: `validateTokenIntegrity` middleware uses `jwt.decode()` instead of `jwt.verify()`
- Files: `backend/src/middleware/security.js` lines 79-102
- Current mitigation: Checks exp/iat claims but doesn't validate signature
- Recommendations: Use `jwt.verify()` with secret instead of `decode()`. The middleware should validate token cryptographic signature.

**Device Inactivity Timeout Too Long:**
- Risk: Devices remain authorized for 24 hours (86400 seconds) without activity
- Files: `backend/src/middleware/appAuth.js` line 40
- Current mitigation: Device disabled but no notification to user
- Recommendations: Reduce to 1-2 hours for sensitive operations. Notify user before auto-logout. Implement refresh token mechanism.

**Direct Path Traversal Risk in File Operations:**
- Risk: Google Drive config and backup files read/written without path validation
- Files: `backend/src/services/googleDriveService.js` lines 17-18, `backend/src/config/database.js` lines 15-22
- Current mitigation: Files must exist (existence check prevents some attacks)
- Recommendations: Use path.resolve() with base directory validation. Never trust env variables for file paths without normalization.

**Plaintext Credentials in Shell Commands:**
- Risk: execSync used to generate SSL certificates with shell commands
- Files: `backend/src/services/securityInitService.js` lines 203, 212, 215
- Current mitigation: Only runs during initialization
- Recommendations: Use Node.js crypto modules instead of shell commands. This approach is vulnerable to injection if inputs aren't sanitized. Replace with node-forge or similar.

**Missing HMAC Secret in Mobile App:**
- Risk: HMAC generation relies on environment variable exposed in build
- Files: `mobile/services/api.ts` line 33
- Current mitigation: Server validates HMAC
- Recommendations: HMAC_SECRET should never be in frontend/mobile. Use server-signed tokens instead. For mobile HMAC, implement backend endpoint to generate signatures.

## Performance Bottlenecks

**N+1 Query Pattern in Professional Routes:**
- Problem: Multiple sequential queries for single resource fetch
- Files: `backend/src/routes/app/profissional.js` lines 40-51, 261-266
- Cause: Uses Promise.all but performs separate queries for each entity instead of optimized joins
- Improvement path: Replace separate Atendimento.getAll, PontoRegistro.getResumoHoje, etc. with single complex query using joins. Consider SQL view for dashboard data.

**Inefficient Commission Calculation in Dashboard:**
- Problem: Loops through atendimentos array twice (once for receita, once for comissao)
- Files: `backend/src/routes/app/profissional.js` lines 53-54
- Cause: Separate calculations could be combined in single loop
- Improvement path: Combine calculations into single reduce operation. Cache profissional commission percentage to avoid array lookup.

**Synchronous File Read on Server Startup:**
- Problem: SQL security file read blocks server initialization
- Files: `backend/src/services/securityInitService.js` lines 74-94
- Cause: Uses `fs.readFileSync` during async initialization
- Improvement path: Keep async but use `fs.promises.readFile()`. Parallelize SQL statement execution.

**Multiple localStorage Writes Per Operation:**
- Problem: SyncManager writes to localStorage on every change queue
- Files: `frontend/src/syncManager.js` lines 41, 54, 105
- Cause: No batching of localStorage updates
- Improvement path: Batch updates, write once per sync cycle. Use IndexedDB for larger datasets instead of localStorage.

**Unindexed Queries on Large Result Sets:**
- Problem: Queries without indexes on frequently filtered columns
- Files: `backend/src/routes/app/profissional.js` line 244-253 (clientes query)
- Cause: No indexes visible on profissionalId, clienteId, data columns
- Improvement path: Add compound indexes on (profissionalId, salonId), (clienteId, salonId), (data, salonId).

## Fragile Areas

**Offline Sync Data Loss Risk:**
- Files: `frontend/src/syncManager.js` lines 33-42
- Why fragile: Stores pending changes in localStorage which can be cleared by browser or user. No backup mechanism. Retry logic (lines 97-101) uses setTimeout instead of queue.
- Safe modification: Add fallback persistent storage. Implement proper retry queue with exponential backoff. Test clearing localStorage during operation.
- Test coverage: No tests visible for offline flow. Missing coverage for: localStorage corruption, browser clear operations, retry exhaustion.

**Transactional Integrity in Fechamento Model:**
- Files: `backend/src/models/Fechamento.js`
- Why fragile: Complex transaction with 10+ separate delete operations. If one fails mid-way, partial deletes leave inconsistent state. Error handling at lines 42, 66 catches and logs but continues.
- Safe modification: Wrap entire transaction in explicit try/catch at top level. Use SAVEPOINT for atomic groups. Add transaction validation at end.
- Test coverage: No visible tests for transaction rollback scenarios.

**Race Condition in Commission Calculation:**
- Files: `backend/src/routes/app/profissional.js` lines 44-50
- Why fragile: Dashboard data queried without session lock. Concurrent requests from same professional can see stale commission data if payments processed between queries.
- Safe modification: Use row-level locks in transaction or add cache validation. Include data timestamp in response.
- Test coverage: No concurrency tests visible.

**String Date Handling Without Timezone:**
- Files: `backend/src/routes/app/profissional.js` line 38, multiple models
- Why fragile: `.split('T')[0]` assumes ISO format and local timezone. International deployments will have date boundary issues.
- Safe modification: Use moment.js or date-fns with explicit timezone handling. Store all dates as UTC in DB.
- Test coverage: No timezone tests.

## Scaling Limits

**WebSocket Connection Limits:**
- Current capacity: No connection pooling visible, single ws.init() per server
- Limit: Single Node.js process can handle ~10k concurrent connections (theoretical), but current implementation creates new notification handlers per connection
- Scaling path: Implement Redis adapter (socket.io-redis) for multi-process/multi-server. Add connection pooling and heartbeat.

**Database Pool Size Hardcoded:**
- Current capacity: `max: 10` connections in pool
- Limit: Will exhaust under moderate load (10 concurrent requests = saturated)
- Scaling path: Make configurable via env var, default to 20-50. Add monitoring for idle connection leaks.

**localStorage Size Limit on Pending Changes:**
- Current capacity: Modern browsers ~5-10MB, but no cleanup of old synced items
- Limit: After ~1000 offline operations, localStorage fills and fails
- Scaling path: Implement IndexedDB for large datasets. Add size quota monitoring. Archive synced items after successful sync.

**No Pagination on Large Result Sets:**
- Current capacity: Routes return full result sets (e.g., clientes, agendamentos)
- Limit: 10k+ records will cause frontend memory issues and UI freeze
- Scaling path: Add limit/offset parameters to all GET routes. Implement cursor-based pagination. Add response size warnings.

## Dependencies at Risk

**Google APIs Library Version:**
- Risk: `googleapis@131.0.0` is outdated (published 2024), may have OAuth2 security issues
- Impact: If vulnerability found, no security updates available without major version bump
- Migration plan: Review current version in npm registry. Pin to specific security-vetted version with automated updates. Consider using google-auth-library separately.

**Multer File Upload:**
- Risk: `multer@1.4.5-lts.1` is LTS but no longer actively maintained, known issues with file size validation bypass
- Impact: File upload endpoints vulnerable to resource exhaustion attacks
- Migration plan: Upgrade to express.static for static files, use dedicated S3/Cloud Storage. If multer needed, use latest busboy-based version.

**Old pg Driver Version:**
- Risk: `pg@8.20.0` is EOL, security vulnerabilities may exist in connection pooling
- Impact: SQL injection or connection hijacking in edge cases
- Migration plan: Upgrade to pg@latest (15+). Review PostgreSQL connection string parsing.

**Nodemailer Without TLS Pinning:**
- Risk: `nodemailer@6.9.8` doesn't validate SMTP certificate by default
- Impact: MITM attacks on email sending
- Migration plan: Enable `tls.rejectUnauthorized` and certificate pinning in email config.

## Missing Critical Features

**No Rate Limiting Per User:**
- Problem: Rate limiting is global (100 req/15min) with no per-user tracking
- Blocks: Prevents mitigation of brute force attacks against specific accounts
- Impact: 5 login attempts allowed globally, not per account per IP
- Fix: Implement per-user, per-IP rate limiting using RedisStore instead of memory store

**No Audit Logging:**
- Problem: No audit trail for sensitive operations (password changes, financial transactions, deletions)
- Blocks: Cannot investigate fraud or unauthorized access post-incident
- Impact: Regulatory non-compliance, inability to prove data integrity
- Fix: Add audit table, log all changes with user/timestamp, implement retention policy

**No Encryption for Sensitive Data at Rest:**
- Problem: Passwords hashed but other PII (phone, email) and financial data stored plaintext
- Blocks: Database breach exposes client contact info and salon financials
- Impact: LGPD/GDPR violations
- Fix: Implement column-level encryption for PII, use postgres pgcrypto or application-level encryption

**No Two-Factor Authentication:**
- Problem: Only password-based auth, no MFA
- Blocks: Cannot prevent account takeover via compromised credentials
- Impact: Professional and client accounts vulnerable to password spraying
- Fix: Implement TOTP (authenticator apps) or SMS-based MFA

**No Data Retention/Deletion Policy:**
- Problem: No mechanism to delete/redact client data per LGPD Article 43
- Blocks: Cannot comply with right-to-be-forgotten requests
- Impact: Legal liability
- Fix: Add soft delete with retention period, implement data anonymization for historical records

## Test Coverage Gaps

**No Backend API Tests:**
- What's not tested: All route handlers, authentication flows, transaction rollbacks, concurrent operations
- Files: `backend/src/routes/*` - all files untested
- Risk: Regression bugs on every deploy, security fixes may introduce new vulnerabilities
- Priority: High - implement integration tests for auth, commission calculations, financial transactions

**No Frontend Offline Tests:**
- What's not tested: SyncManager offline flow, localStorage corruption, retry logic, data consistency
- Files: `frontend/src/syncManager.js`
- Risk: Offline feature silently fails, data loss on sync
- Priority: High - implement unit tests for queueChange, flushPendingChanges, error recovery

**No Mobile Security Tests:**
- What's not tested: HMAC signature generation, device fingerprinting, secure storage
- Files: `mobile/services/api.ts`, `mobile/services/securityInitService.ts`
- Risk: Security bypass not caught until production
- Priority: High - implement security-focused tests

**No Database Transaction Tests:**
- What's not tested: Transaction rollback on error, race conditions, concurrent modifications
- Files: `backend/src/models/Fechamento.js` and all models using withTransaction
- Risk: Data corruption under concurrent load
- Priority: High - implement transaction scenario tests

**No Load/Performance Tests:**
- What's not tested: API response times under load, database connection pool exhaustion, WebSocket scaling
- Files: `backend/src/server.js` and all routes
- Risk: Unknown scaling limits discovered in production
- Priority: Medium - implement k6 or Apache JMeter load tests

**No SQL Injection/Input Validation Tests:**
- What's not tested: Placeholder conversion (? to $N), malicious input handling
- Files: `backend/src/config/database.js` and all routes
- Risk: SQL injection vulnerabilities not caught
- Priority: Critical - add OWASP ZAP/SQLmap integration tests

---

*Concerns audit: 2026-04-25*
