# BOM Compare VX

Execution baseline for Stage 1 with selected stack:
- Next.js frontend
- NestJS backend
- MSAL/Passport auth
- Prisma + Azure SQL

## Current Execution Scope
- S1-09: Identity provider provisioning and secret management foundations.
- S1-01/S1-02 backend auth scaffolding for Google and Microsoft callbacks.
- S1-06 frontend responsive authenticated shell (`/upload`, `/history`, `/login`).
- CI checks for env/documentation contracts and backend typecheck/build.

## Quick Start (Current Baseline)
1. Copy `.env.example` to `.env.local` for local development values.
2. Follow `docs/runbooks/s1-09-idp-keyvault-dev-setup.md` to provision Dev OAuth and Key Vault secrets.
3. Install backend dependencies: `npm install --prefix apps/backend`.
4. Install frontend dependencies: `npm install --prefix apps/frontend`.
5. Run `npm run ci:checks`.
6. Start backend: `npm --prefix apps/backend run start:dev`.
7. Start frontend: `npm --prefix apps/frontend run dev`.
8. Push branch to trigger CI.
