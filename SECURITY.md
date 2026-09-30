# Security

## Secrets
- Never commit real credentials, API keys, database passwords, or signing keys.
- Configure production secrets outside the repository.
- Keep `FLASK_DEBUG=false` in production.
- Use a long, randomly generated `SECRET_KEY`.

## Authentication
- API bearer tokens expire after 8 hours.
- Administrative endpoints require authenticated roles.
- Company-scoped endpoints validate the authenticated user's `company_id`.
- Login failures are throttled per email and source IP.

## HTTP protections
- Request bodies are limited by `MAX_CONTENT_LENGTH` (default: 1 MiB).
- Responses include basic security headers against content sniffing, framing, and unsafe referrer leakage.
- Production CORS must be restricted to the real application origin.

## Before production
1. Replace bearer-token storage in the browser with a secure session architecture using HttpOnly/Secure/SameSite cookies or an equivalent design.
2. Move rate limiting to a shared production store so limits work across multiple application instances.
3. Review order tracking tokens and avoid exposing them in URLs where practical.
4. Enable GitHub secret scanning and push protection where available.
5. Run dependency and security checks before each production release.
