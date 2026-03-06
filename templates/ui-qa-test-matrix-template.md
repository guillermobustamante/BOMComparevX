# UI QA Test Matrix

| ID | Category | Severity | Artifact or Screen | Finding | Why It Matters | Required Change | Retest Focus | Status |
|----|----------|----------|--------------------|---------|----------------|-----------------|-------------|--------|
| A11Y-001 | Accessibility | High | Example Screen | Missing keyboard path for primary action group | Blocks keyboard-only completion | Define keyboard path and focus order | Keyboard-only flow | Open |
| RESP-001 | Responsive | Medium | Example Screen | Filter rail collapse behavior undefined below tablet breakpoint | Likely inconsistent mobile implementation | Specify drawer behavior and preserved actions | Tablet and mobile layout | Open |
| STATE-001 | State coverage | High | Example Screen | No filtered-empty state | Users will not understand why results disappeared after filtering | Add filtered-empty content and reset affordance | Empty-result flow | Open |
| ALIGN-001 | Alignment | Critical | UI Generation vs Frontend Implementation | Queue preview behavior mismatched | Changes workflow and breaks approved UX intent | Reconcile preview behavior | Queue workflow consistency | Open |