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
- Only the two dish-photo routes accept larger bodies (`PHOTO_MAX_BYTES`, default 10 MiB); every other route is refused with 413 above `MAX_CONTENT_LENGTH`.

## Dish photos
- Upload needs an OWNER or MANAGER token and only touches products of the caller's own company.
- The server never trusts the file name or the type the browser reports: it checks the first bytes, opens the image with Pillow, caps the pixel count (decompression-bomb guard), and re-encodes it as WebP. Nothing the user sent is stored as is, and the hidden photo data (EXIF: place, phone model, date) is dropped.
- At most two photos are processed at the same time; others wait up to 10 seconds, then get a "try again" answer.
- Files are named with a random key the server makes (never a name from the user) and kept in a volume that the web front door reads read-only. The public address of a photo is therefore guessable only by someone who already sees the menu, and the menu is public by design.
- The browser policy (CSP) allows `blob:` for images and media only so the phone can show the picture just taken and read a short video; scripts stay limited to the site itself.
- Responses include basic security headers against content sniffing, framing, and unsafe referrer leakage.
- Production CORS must be restricted to the real application origin.

## Before production
1. Replace bearer-token storage in the browser with a secure session architecture using HttpOnly/Secure/SameSite cookies or an equivalent design.
2. Move rate limiting to a shared production store so limits work across multiple application instances.
3. Review order tracking tokens and avoid exposing them in URLs where practical.
4. Enable GitHub secret scanning and push protection where available.
5. Run dependency and security checks before each production release.
