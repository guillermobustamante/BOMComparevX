# Backend (NestJS)

Planned framework: NestJS + TypeScript with Passport strategies for Google/Microsoft.

## Local Run
1. Install deps: `npm install --prefix apps/backend`
2. Ensure `.env.local` is populated from `.env.example`
3. Start dev server: `npm --prefix apps/backend run start:dev`

## Implemented Auth Contract Endpoints
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/auth/microsoft/start`
- `GET /api/auth/microsoft/callback`
- `GET /api/health`

## Notes
- Secrets are resolved via Azure Key Vault secret names from env contract.
- Local fallback supports direct `GOOGLE_*` and `MICROSOFT_*` env vars for development.
