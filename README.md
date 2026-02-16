# BOM Compare VX

Execution baseline for Stage 1 with selected stack:
- Next.js frontend
- NestJS backend
- MSAL/Passport auth
- Prisma + Azure SQL

## Current Execution Scope
- S1-09: Identity provider provisioning and secret management foundations.
- CI contract checks for required environment and documentation artifacts.

## Quick Start (Current Baseline)
1. Copy `.env.example` to `.env.local` for local development values.
2. Follow `docs/runbooks/s1-09-idp-keyvault-dev-setup.md` to provision Dev OAuth and Key Vault secrets.
3. Run `npm run check:env-contract`.
4. Push branch to trigger CI.
