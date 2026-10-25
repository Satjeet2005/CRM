# ADR-0003: Session Management, Authentication, and CSRF Protection

## Status
Accepted

## Context
PRD Section 4, 6.1, and 12 require a robust, production-grade authentication and session system rather than client-side tokens (like localStorage JWTs) or mock auth:
- Passwords must be hashed using Argon2id.
- Server-side sessions must use high-entropy opaque tokens whose raw values are never stored in the database.
- Browser communication relies on `HttpOnly`, `SameSite=Lax`, `Path=/` cookies with `Secure` flags in production.
- Because cookie authentication is subject to Cross-Site Request Forgery (CSRF), state-changing requests must be strictly protected.
- Session lifetime is 12 hours max, with a 60-minute idle timeout.
- User deactivation and password changes revoke all active sessions.

## Decision
1. **Password Hashing**:
   - Utilize `pwdlib[argon2]` with Argon2id parameters recommended for password security.
2. **Session Storage**:
   - Issue cryptographically secure random 32-byte tokens (`secrets.token_urlsafe(32)`).
   - In PostgreSQL `sessions` table, store only the SHA-256 digest (`token_hash`), along with `user_id`, `organization_id`, `created_at`, `last_seen_at`, `expires_at`, and `revoked_at`.
   - The raw session token is sent to the client via an `HttpOnly`, `SameSite=Lax`, `Path=/` cookie (`forgeflow_session`).
3. **Session Expiry & Renewal**:
   - Idle timeout (60 minutes): If `now - last_seen_at > 60m`, the session is rejected.
   - Absolute lifetime (12 hours): If `now > expires_at`, the session is rejected.
   - For valid authenticated requests, `last_seen_at` is updated.
4. **CSRF Strategy**:
   - Dual protection: Strict Origin/Referer header verification against `FRONTEND_ORIGIN` plus double-submit cookie / synchronizer header (`forgeflow_csrf` cookie matched with `X-CSRF-Token` header).
   - Safe HTTP methods (GET, HEAD, OPTIONS) do not require CSRF token validation and must never mutate state.
   - All state-changing methods (POST, PUT, PATCH, DELETE) require valid CSRF protection.
5. **Rate Limiting & Generic Errors**:
   - Failed logins return a generic error message ("Invalid email or password") to prevent user enumeration.
   - In-memory/database login throttling by IP and email identifier.

## Consequences
- Tokens are inaccessible to malicious JavaScript (XSS mitigation).
- Server retains instant revocation capability (e.g., logout, security lockout, deactivation).
- Complete compliance with OWASP ASVS session recommendations.
