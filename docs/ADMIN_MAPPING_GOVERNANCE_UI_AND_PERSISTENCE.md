# Admin, Mapping Governance, and Persistence Guide

## Purpose

This document describes the implemented UI areas for:
- `Admin > Access & Roles`
- `Admin > Audit & Compliance`
- `Admin > Data Retention`
- `Admin > Mapping Governance`
- `Mappings`

It also covers the persistence changes for:
- authenticated sessions in SQL
- uploaded revision persistence and chained-comparison recovery in SQL

## UI Areas

### Admin > Access & Roles

Location:
- `/admin`

What users can do:
- claim the first tenant admin role when the tenant has no admins yet
- grant admin to another tenant user
- revoke admin from another tenant user
- view tenant users and their current admin status
- keep using upload policy reset and unlimited override from the same operating area

Behavior notes:
- the system blocks revoking the last active admin in a tenant
- role assignment is tenant-scoped, not global

### Admin > Audit & Compliance

Location:
- `/admin`

What users can do:
- export tenant audit evidence as `CSV` or `NDJSON`
- filter exports by `limit`, `action type`, and `actor email`
- run an audit archive job
- review prior archive runs with timestamp, actor, record count, and storage target

### Admin > Data Retention

Location:
- `/admin`

What users can do:
- trigger a manual retention sweep
- optionally provide a `nowUtcIso` value for controlled verification
- review deleted export artifact, notification, and revoked-share counts

### Admin > Mapping Governance

Location:
- `/admin`

What users can do:
- review tenant-learned aliases
- see confirmation counts and confidence bands
- disable noisy learned aliases
- re-enable previously disabled aliases

Behavior notes:
- disabling an alias removes `TENANT_PACK` promotion for that alias in future previews
- alias learning remains tenant-scoped

### Mappings

Location:
- `/mappings`

What users can do:
- review confirmed mapping snapshots
- inspect snapshot details by revision
- open a revision mapping preview directly when they know the revision ID

Additional explainability:
- on `/mappings/:revisionId`, each row now has an `Explain` action
- the explainability panel groups:
  - positive evidence
  - suppression / negative signals
  - strategy, confidence, review state, and field class

## Persistence Changes

### Authenticated Sessions in SQL

Implementation:
- backend now uses a SQL-backed session store when `DATABASE_URL` is set
- session records are stored in `appSessions`

What this improves:
- signed-in sessions survive backend restarts, subject to browser cookie lifetime and session TTL

Environment:
- `DATABASE_URL`
- `SESSION_SECRET`
- `SESSION_TTL_HOURS`

### Uploaded Revision Persistence / Recovery

Implementation:
- uploaded revisions are stored in `uploadedRevisions`
- revision pairs and chained-comparison context are stored in `uploadedRevisionPairs`

What this improves:
- chained comparisons can recover after backend restart
- revision-backed diff and export flows can rehydrate file context from SQL

## DB Setup

1. Set `DATABASE_URL` in `.env.local` or resolve it from Key Vault.
2. Run migrations:

```powershell
cd apps/backend
npx prisma migrate deploy --schema prisma/schema.prisma
npx prisma generate --schema prisma/schema.prisma
cd ../..
```

3. Start backend and frontend:

```powershell
npm --prefix apps/backend run start:dev
npm --prefix apps/frontend run dev
```

## Validation

Recommended verification:

```powershell
npm --prefix apps/backend run prisma:generate
npm --prefix apps/backend run typecheck
npm --prefix apps/frontend run typecheck
npm --prefix apps/backend run test:e2e
```

Expected result:
- all commands pass
- admin, mapping governance, snapshot review, and async revision recovery paths remain stable
