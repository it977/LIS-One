# LIS-One Final Security Deployment Checklist

## Migration order
1. Run `supabase/migrations/2026_05_17_phase3_patients_outlab_roles.sql`
2. Run `supabase/migrations/2026_05_17_phase4_security_patch.sql`

## Required env vars
Frontend / Vite local dev:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server / Cloudflare Pages Functions:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` or `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LIS_AUTH_SECRET` (recommended)

## Build command
```bash
npm run build
```

## Deploy command
Use your normal Cloudflare Pages / CI deploy flow after the build succeeds.

## Post-deploy smoke test
1. Open the login page and sign in with a known account.
2. Verify `/api/login` returns a token and role.
3. Verify `/api/data` supports select requests.
4. Verify mutation requests without token return 401.
5. Verify mutation requests with a valid token and allowed role succeed.
6. Verify rate limiting returns 429 after repeated login/mutation attempts.

## Notes
- Frontend reads through the `/api/data` proxy.
- Mutations must not be sent directly to Supabase from the browser.
- Legacy plaintext passwords are migrated to `password_hash` on successful login.
