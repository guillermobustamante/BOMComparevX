# S8 Security + Compliance Baseline Closeout

## Objective
Operationalize Stage 8 controls with repeatable verification and rollback-safe procedures:
- rate-limiting abuse controls
- consent version tracking
- history parity (rename/tag/soft-delete)
- admin audit export governance and append-only archive metadata
- secure SDLC CI gates (vulnerability/license/secret)

## Required Flags
- `RATE_LIMITING_V1=true`
- `CONSENT_TRACKING_V1=true`
- `HISTORY_PARITY_V1=true`
- `AUDIT_EXPORT_STAGE8_V1=true`
- `AUDIT_ARCHIVE_STAGE8_V1=true`

## Acceptance-to-Test Matrix
1. Stage 8 bullet 1 (rate limit enforcement)
- `apps/backend/test/stage1.e2e-spec.ts`
- Tests:
  - `rate limiting returns 429 when explicitly enabled in test env`
  - `rate-limit allowlist bypasses throttling for exempt tenant`

2. Stage 8 bullets 2-3 (consent tracking and re-accept)
- `apps/backend/test/stage1.e2e-spec.ts`
- Test:
  - `consent tracking requires acceptance and re-prompts on version changes`

3. Stage 8 bullets 4-5 (history parity + audit)
- `apps/backend/test/stage1.e2e-spec.ts`
- Test:
  - `history parity supports list, rename, tag, and soft-delete for owner only`

4. Stage 8 bullets 6-7 (audit export governance + archive evidence)
- `apps/backend/test/stage1.e2e-spec.ts`
- Test:
  - `admin audit export and archive endpoints enforce tenant scope and append-only evidence metadata`

5. Stage 8 bullet 8 (secure SDLC gates)
- `npm run ci:security`
- Scripts:
  - `tools/security/check-vulnerabilities.mjs`
  - `tools/security/check-licenses.mjs`
  - `tools/security/check-secrets.mjs`

6. Stage 8 bullet 9 (integration regression)
- `npm run verify:story`

## CI Security Gate Contract
CI must fail when:
1. high/critical vulnerabilities exist and are not allowlisted
2. denied licenses are detected by policy
3. potential secrets are detected in scanned text files

Policy/config files:
- `.security/vulnerability-allowlist.json`
- `.security/secret-scan-ignore.txt`
- `docs/security/license-policy.json`

## Evidence Collection
1. Export evidence:
- `GET /api/admin/audit/export?format=csv`
- Save CSV artifact from response.

2. Archive evidence:
- `POST /api/admin/audit/archive/run`
- Capture response payload (`archiveId`, `sha256`, `recordCount`, `artifactUri`, `manifestUri`).
- `GET /api/admin/audit/archive/runs` for history proof.

3. Security gate evidence:
- CI logs for `Run security gates (vuln/license/secret)`.

## Rollout Steps
1. Enable Stage 8 flags in Dev.
2. Run:
- `npm --prefix apps/backend run test:e2e`
- `npm run ci:security`
- `npm run verify:story`
3. Validate browser flows:
- consent gate
- history rename/tag/delete
- admin audit export and archive run

## Rollback Steps
1. Disable Stage 8 flags:
- `RATE_LIMITING_V1=false`
- `CONSENT_TRACKING_V1=false`
- `HISTORY_PARITY_V1=false`
- `AUDIT_EXPORT_STAGE8_V1=false`
- `AUDIT_ARCHIVE_STAGE8_V1=false`
2. Restart backend/frontend.
3. Re-run `npm run verify:story` to confirm Stage 1-7 behavior remains intact.

