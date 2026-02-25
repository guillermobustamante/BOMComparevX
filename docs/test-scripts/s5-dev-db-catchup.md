# S5 Dev DB Catch-up (Parked)

Status: `Parked for later execution`  
Scope: `Apply Stage 5 DB/schema changes locally before retesting`

## Purpose
Bring local Dev DB and backend runtime into sync with the latest Stage 5 changes.

## When to run this
- Before re-testing Stage 5 retention/admin/export behavior in browser.
- After pulling latest code that includes new Prisma schema/migrations.

## Steps
1. Generate Prisma client from latest schema:
```powershell
npm --prefix apps/backend run prisma:generate
```

2. Deploy pending migrations to your Dev DB:
```powershell
npm --prefix apps/backend run prisma:migrate:deploy
```

3. Restart backend:
```powershell
npm --prefix apps/backend run start:dev
```

## Expected outcome
- Prisma client generation succeeds.
- Migration deploy reports all migrations applied.
- Backend starts without Prisma model/runtime mismatches.

## Optional verification
1. Check new `exportArtifacts` table exists:
```sql
SELECT TOP 5 artifactId, tenantId, comparisonId, format, createdAtUtc
FROM dbo.exportArtifacts
ORDER BY createdAtUtc DESC;
```

2. Hit admin retention endpoint (as admin) and confirm response shape:
```http
POST /api/admin/retention/run
```

## Notes
- Requires valid `DATABASE_URL` resolution (direct env or Key Vault secret wiring).
- If migration fails, resolve migration state first, then rerun step 2.
