# Sprint S12.1 - Results Chain Hardening

## 1. Sprint metadata
- Sprint: `S12.1`
- Theme: `Results Chain Hardening`
- Scope type: `Backlog / follow-up sprint definition`
- Owner: `Product + Engineering`
- Status: `Backlog`

## 2. Goal
Close the workflow-integrity gaps left after Sprint 12 so session comparison history behaves like a true auditable comparison chain across all authorized users.

## 3. Backlog stories

### S12.1-01 - Immutable reopen of prior comparisons
As a user reviewing a previous step in a BOM session, I want `Open` to reopen the original comparison record rather than recomputing it so that history, exports, shares, and audit lineage remain stable.

Scope:
- Persist or surface a stable comparison identity per session step
- Open previous comparisons by original `comparisonId`
- Avoid silent recomputation on reopen

Priority:
- `P0`

### S12.1-02 - Session-history access for authorized viewers
As an authorized same-tenant viewer of a comparison session, I want to see the comparison chain for that session so that shared review workflows work for Engineering, Purchasing, Sales, and support roles.

Scope:
- Define session-history read rules for non-owner viewers
- Reuse existing comparison/share authorization where valid
- Keep rename/delete permission boundaries explicit

Priority:
- `P0`

### S12.1-03 - Real comparison status in previous-comparisons modal
As a user reviewing session history, I want each chain step to show actual comparison state so that I can distinguish running, completed, and failed comparisons without inference.

Scope:
- Carry meaningful lifecycle state into session-history rows
- Display real status in Results previous-comparisons modal
- Keep `Latest` as a separate badge/treatment, not a replacement for status

Priority:
- `P1`

## 4. Acceptance bar
- Opening a prior comparison must not generate a new comparison ID.
- Shared viewers who are allowed to view the active comparison must be able to view the session chain.
- Previous-comparisons modal must show a real comparison status field.

## 5. Inputs
- Sprint 12 implementation record: `docs/SPRINT_S12_RESULTS_REVISION_CHAIN.md`
- Sprint 12 QA record: `docs/UI_QA_S12_RESULTS_REVISION_CHAIN.md`

## 6. Recommended sequencing
1. Fix immutable reopen semantics first.
2. Then fix session-history access rules.
3. Then expose real lifecycle status in the modal.
