# S5-03 to S5-07 Browser Test Script

## 0. Prerequisites
1. Start backend:
`npm --prefix apps/backend run start:dev`
2. Start frontend:
`npm --prefix apps/frontend run dev`
3. Sign in as owner user in browser.
4. Ensure you have at least one completed comparison so a valid `comparisonId` is available in `/results?...&comparisonId=...`.

## 1. S5-03 Sharing (invite/list/revoke)
1. Open `Results` with a valid `comparisonId`.
2. In sharing panel, invite a same-tenant email.
3. Confirm invite appears as active.
4. Sign in as invited user in another browser/incognito.
5. Open the same comparison results URL.
6. Expected: invited user can view results.
7. As owner, revoke invite.
8. Invited user refreshes results.
9. Expected: access denied/forbidden for revoked user.

## 2. S5-04 Notifications (in-app baseline)
1. Run a diff to completion.
2. Open `Notifications`.
3. Expected: completion notification appears.
4. Mark/read notification (if available).
5. Refresh page.
6. Expected: read state persists.
7. Trigger a failure case (invalid comparison/session).
8. Expected: failure notification appears.

## 3. S5-05 Admin Role Claim + Policy Controls
1. Sign in as admin user.
2. Open `Admin`.
3. Search for a target user.
4. Set upload policy override to unlimited.
5. Sign in as target user; open Upload.
6. Expected: no cooldown/credit blocking.
7. As admin, reset policy for that user.
8. Re-test Upload as target user.
9. Expected: standard policy limits apply.
10. Sign in as non-admin and open `/admin`.
11. Expected: `ADMIN_REQUIRED`.

## 4. S5-06 Retention Baseline Checks (UI-level)
1. Perform share + notification + export actions.
2. Verify records are visible/usable immediately.
3. Confirm records remain accessible until retention window/cleanup job applies.
4. Expected: no premature deletion.

## 5. S5-07 Audit + Guardrails
1. Perform invite, revoke, admin override, admin reset, and export.
2. Validate each action succeeds/fails with clear UI message.
3. Spot-check backend logs for corresponding audit events.
4. Expected: guarded actions enforce authorization and emit audit entries.

## 6. Pass Criteria
1. Sharing access enforcement is correct (owner/invited only).
2. Notifications appear for completion/failure.
3. Admin controls are admin-only.
4. No regressions in upload/results flow.
5. Unauthorized users receive consistent auth/forbidden responses.
