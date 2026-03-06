# UI QA Skill Examples

These are shape examples only.

## Example 1: Severity-based finding

### Finding ID: A11Y-003
- Category: Accessibility
- Severity: High
- Location: Intake Queue screen spec, Accessibility notes
- Finding: Keyboard behavior for row-level action menus is not defined, and no fallback behavior is specified for users navigating the table without a pointer device.
- Why it matters: This leaves a workflow-critical screen partially inaccessible and will likely produce inconsistent implementations across agents.
- Required change: Define keyboard access path for row actions, focus return behavior after menu close, and accessible naming for each action.
- Retest focus: Verify keyboard-only completion of row action flow and correct focus management.

## Example 2: Alignment finding

### Finding ID: ALIGN-002
- Category: Alignment
- Severity: Critical
- Location: UI Generation vs Frontend Implementation
- Finding: UI Generation specifies a right-side detail preview panel on large screens for queue workflows, but the implementation plan omits it entirely and routes all details to a separate screen.
- Why it matters: This changes the review workflow and increases context switching for high-volume operators, which conflicts with the approved user mentality and workflow model.
- Required change: Restore the detail preview panel in the implementation plan or explicitly seek approval for the workflow change.
- Retest focus: Revalidate queue workflow efficiency and consistency with the approved foundation.

## Example 3: Required revisions summary

Minimum changes required to pass:
1. Define keyboard and focus behavior for all modal, drawer, and row-action flows.
2. Add filtered-empty and no-access states to the Review Queue screen spec.
3. Reconcile the mismatch between queue preview behavior in UI Generation and Frontend Implementation.
4. Add explicit permission-based action visibility rules for supervisor-only bulk actions.