# Frontend PM Assessment - Visual Consistency, Performance, and Copy Alignment

Date: 2026-03-22  
Audience: Product Manager  
Scope: Authenticated frontend pages reviewed from the attached expanded and collapsed screenshots for `/upload`, `/mappings`, `/results`, `/history`, `/notifications`, and `/admin`.

## Assessment basis

Visual evidence reviewed:

- Compare BOM Revisions
- BOM Field Review
- Change Review
- Revision History
- Comparison Alerts
- Governance

Code evidence reviewed:

- `apps/frontend/components/app-shell.tsx`
- `apps/frontend/components/upload-validation-form.tsx`
- `apps/frontend/components/results-grid.tsx`
- `apps/frontend/components/mapping-control-center.tsx`
- `apps/frontend/components/history-panel.tsx`
- `apps/frontend/components/notifications-panel.tsx`
- `apps/frontend/components/admin-governance-console.tsx`
- `apps/frontend/components/active-workspace-notice.tsx`

Original limitation before the live addendum:

- The first draft of this report was based on screenshots plus code review.
- It did not yet include Lighthouse or runtime trace evidence.

Update after live profiling pass:

- An authenticated live profiling pass was completed against a clean local stack on `2026-03-22`.
- Lighthouse, runtime trace, and route timing artifacts were generated in:
  - `test-results/live-frontend-profile/runtime-profile-report.json`
  - `test-results/live-frontend-profile/lighthouse-*.json`
  - `test-results/live-frontend-profile/runtime-traces/*.json`
- Results interaction performance was benchmarked through:
  - `tests/e2e/results-interaction-perf.spec.ts`
- The Stage 4 benchmark was also executed during this review window for the standard small fixture pair.

Update after Results remediation pass:

- The expanded-navigation Results toolbar overlap was corrected in the current branch.
- Raw system labels in the Results table were replaced with operator-facing language.
- Focused validation passed on `2026-03-22`:
  - `tests/e2e/results-redesign.spec.ts`
  - targeted Results flows in `tests/e2e/auth-shell.spec.ts`
- A post-remediation reprofile was completed.
- The current branch now resolves the most visible Results layout/copy defects from the screenshot review, but the Results page still carries a Lighthouse CLS problem and remains the main frontend performance risk.

Update after S25 closeout implementation pass:

- `BACKLOG_S25_FRONTEND_PM_ASSESSMENT_CLOSEOUT.md` and `docs/SPRINT_S25_FRONTEND_PM_ASSESSMENT_CLOSEOUT.md` were added to convert the remaining PM findings into a sprint execution record.
- Manufacturing-focused navigation, page titles, subtitles, helper copy, and Compare-page slot labels were applied in the current branch.
- Secondary-page spacing, badge semantics, action labeling, and admin copy density were tightened across Mapping, History, Notifications, and Admin.
- The expanded-shell footer identity area was simplified and tenant detail was moved into the profile popover.
- Results polling was decoupled from filter/view state, slowed slightly with hidden-tab backoff, and share/history side-data loads were deferred until the corresponding dialogs are opened.
- Focused validation passed on `2026-03-22`:
  - `npm --prefix apps/frontend run typecheck`
  - `npm --prefix apps/frontend run build`
  - `tests/e2e/navigation-redesign.spec.ts`
  - `tests/e2e/results-redesign.spec.ts`
  - `tests/e2e/auth-shell.spec.ts`
  - `tests/e2e/results-interaction-perf.spec.ts`
  - `tests/e2e/perf-profile.spec.ts` with `PERF_PROFILE_V1=true`

## Overall verdict

The authenticated frontend is now substantially closer to a release-ready manufacturing workspace than it was in the first PM assessment. The cross-page naming, secondary-page density, profile/footer treatment, Compare hero height, and Results refetch behavior are all improved in the current branch. One material issue remains:

1. Results still shows measurable layout instability in Lighthouse even after the S25 refetch/lazy-load hardening pass

Release recommendation:

- The authenticated frontend can be treated as visually and operationally aligned for PM review, but do not mark the core review workflow fully complete until the remaining Results CLS issue is isolated and corrected.

## 1. Delivery Status Tracker

Status key:

- `Completed` = fixed in the current branch and validated
- `Open` = still requires implementation
- `Partially addressed` = improved, but not complete enough to close
- `Recommendation only` = wording or PM guidance not yet implemented in UI

| ID | Area | Original priority | Current status | Evidence | Next action |
| --- | --- | --- | --- | --- | --- |
| UI-01 | Results toolbar overlap with expanded navigation | Critical | Completed | Results remediation pass completed; validated in `tests/e2e/results-redesign.spec.ts` | Keep covered in regression tests. |
| UI-02 | Raw system language on Results table | High | Completed | Replaced in current branch; validated in focused Results tests | Extend the same plain-language cleanup to other pages where needed. |
| UI-03 | Results visual stability / CLS | Critical follow-up | Partially addressed | Results polling and side-data churn were reduced, but live profiling still reports Lighthouse `78` with `CLS 0.586446` | Instrument the remaining late-layout source on Results and remove the final moving block. |
| UI-04 | Loose spacing and oversized chrome on Mapping, History, Notifications, Admin | High | Completed | Secondary-page spacing, card padding, and action placement were tightened in the current branch | Keep under visual regression review. |
| UI-05 | Branding and operational naming consistency | High | Completed | Shell labels, page titles, subtitles, and helper copy now use manufacturing-facing language | Keep this naming set as the product baseline. |
| UI-06 | Weak action hierarchy on History, Notifications, and Admin | Medium | Completed | High-value actions are now labeled and sit closer to related content on the affected pages | Preserve the text-button treatment for primary actions. |
| UI-07 | Semantic inconsistency in pills and badges | Medium | Completed | Passive metadata pills now use lighter treatment and status badges retain stronger emphasis | Reuse `missionPillMeta` semantics on future pages. |
| UI-08 | Admin page reads like a long landing page before a console | Medium | Completed | Admin copy was shortened and the section surfaces now read more like an operational console | Keep frequent governance controls above the fold. |
| UI-09 | Compare page hero is taller than necessary | Low | Completed | Compare hero/dropzone padding was reduced in the current branch | Keep the tighter upload rhythm. |
| UI-10 | Expanded-navigation footer profile area is crowded | Low | Completed | Sidebar identity is shorter and tenant detail moved into the popover | Keep detailed tenant metadata out of the persistent rail. |
| PERF-01 | Results interaction timing against documented goal | High | Completed | `tests/e2e/results-interaction-perf.spec.ts` passed again in S25; the last measured benchmark stayed comfortably inside the target with p95 search `95.41 ms`, sort `83.83 ms`, filter `87.32 ms` | Keep benchmark in the regression/perf suite. |
| PERF-02 | Stage 4 small-fixture backend/data-delivery goals | High | Completed | Benchmark pass recorded diff/first-progress/first-row timings far inside targets | Keep existing benchmark as release evidence. |
| PERF-03 | Results polling/refetch churn | High | Completed | Results now uses decoupled status polling with hidden-tab backoff and lazy share/history data loading | Keep any future Results additions out of the primary load path by default. |
| COPY-01 | Manufacturing-focused text, titles, and navigation wording | High | Completed | Recommended wording set was implemented across shell labels, page headers, helper text, and Compare slot labels | Use the S25 naming set as the PM-approved copy baseline. |

## 2. Prioritized Cosmetic Issues

Historical note:

- Items 1 and 2 below were observed in the screenshot set and drove the Results remediation pass.
- They have been corrected in the current branch, but are retained here because they explain the priority order used during this review.

| Priority | Severity | Page(s) | Issue | Current status | Evidence from screenshots | Why it matters | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Critical | Results | Toolbar controls collide when the expanded left navigation is open. | Completed | The sort selector, pagination summary, page-size selector, and arrows overlap in the expanded Results state. | This reads as broken layout, reduces trust immediately, and makes a core review screen feel unstable. | Keep the two-row Results toolbar behavior and regression coverage. |
| 2 | High | Results | Internal/debug-style labels are exposed in the main review table. | Completed | `no_change`, `matched_no_change`, `unmatched_source_row`, `UNCLASSIFIED`, `none`, and `Needs Review` appear as raw system language. | The page feels technical rather than production-grade and is harder for purchasing, support, and managers to understand. | Keep the plain-language replacements and apply the same cleanup standard elsewhere. |
| 3 | High | Mapping, History, Notifications, Admin | Secondary pages have much looser spacing and more empty chrome than Compare and Results. | Completed | Large cards with wide empty right areas dominated History, Notifications, and Admin in the reviewed screenshots. | The product felt inconsistent across pages and visually slower than it probably was. | Tightening card heights, vertical padding, and action placement is implemented in the current branch. |
| 4 | High | Navigation, page headers, hero bands | Branding language and task language are mixed. | Completed | UI alternated between plain task labels and internal product phrases such as `Mission Feed`, `Mapping Mission Control`, `Tenant Governance`, `Diff workspace`, `Chains`, and `Notices`. | Cross-functional manufacturing users should not have to decode internal naming. This weakens clarity and brand confidence. | Manufacturing-focused wording is now applied across shell labels, page titles, subtitles, and helper text. |
| 5 | Medium | History, Notifications, Admin | Primary actions are not always visually obvious. | Completed | History used a lone `+` action and Notifications pushed `Open` too far away from the record content. | Users can miss next steps, especially infrequent reviewers and support staff. | High-value actions are now labeled and placed closer to related content on the affected pages. |
| 6 | Medium | History, Notifications, Results | Pills and chips are visually consistent as components, but not always semantically consistent. | Completed | Similar pill styles were used for status, metadata, mode labels, and passive tags with equal weight. | Important states did not stand out enough from passive metadata. | Passive metadata now uses a lighter pill treatment while state/urgency remains more prominent. |
| 7 | Medium | Admin | The page reads as a long landing page before it reads as an operational console. | Completed | Large section cards and long explanatory paragraphs pushed controls lower on the page. | Admin users had to scan too much explanatory copy before reaching actions. | Copy was shortened and the console surfaces were tightened in the current branch. |
| 8 | Low | Compare | The upload hero has more height than the task requires. | Completed | The drag-and-drop area was visually clean but oversized relative to the work area below it. | It was not broken, but it spent valuable vertical space on a page used repeatedly. | Hero/dropzone spacing is reduced in the current branch. |
| 9 | Low | Expanded navigation footer | Profile area looks crowded and truncated. | Completed | The email line truncated and the tenant label read like technical metadata. | This did not block workflow, but it reduced polish. | Visible identity is shorter and tenant detail now lives in the popover. |

## 3. Text, Title, and Navigation Recommendations

### Navigation and page-title recommendations

| Current UI text | Recommended UI text | Why this is better for manufacturing users |
| --- | --- | --- |
| `Compare` / `Compare BOMs` | `Compare BOM Revisions` | Makes the task and object explicit. |
| `Revision intake` | `Upload current and proposed BOMs` | Tells users exactly what to do. |
| `Mapping` / `Mapping Check` | `Field Review` or `BOM Field Understanding` | Less technical and closer to the business purpose of the screen. |
| `Governance and review` | `Confirm BOM columns and impact fields` | Explains the outcome instead of the mechanism. |
| `Results` | `Change Review` | Clearer for change managers and cross-functional reviewers. |
| `Diff workspace` | `BOM differences and impact` | Removes internal jargon. |
| `Chains` / `Revision Chains` | `Revision History` | More intuitive than `Chains`. |
| `BOM session history` | `Saved comparison history` | Easier for non-technical users to understand. |
| `Notices` / `Notifications` | `Alerts` or `Comparison Alerts` | Shorter and more operational. |
| `Event log` | `Completed, failed, and shared activity` | Explains the content in plain language. |
| `Admin` | `Governance` | Better reflects the page purpose. |
| `Policy controls` | `Access, audit, retention, and rules` | More concrete and meaningful. |

### Compare page copy recommendations

| Current UI text | Recommended UI text | Comment |
| --- | --- | --- |
| `Drag and drop BOM files` | `Upload BOM revisions` | Stronger task framing. |
| `Drop one or two files here. Two dropped files map to Revision A then Revision B.` | `Upload the current BOM and the new BOM revision. If you drop two files, the first becomes the current BOM and the second becomes the proposed revision.` | Better for occasional users. |
| `Revision A` | `Current BOM` | More meaningful than alphabetic slots. |
| `Primary source revision` | `Current or released BOM` | Stronger operational meaning. |
| `Revision B` | `Proposed BOM` | Easier for change review context. |
| `Candidate comparison revision` | `New or proposed BOM revision` | Less awkward and more descriptive. |
| `Waiting for source` | `File not loaded` | Simpler and more direct. |
| `Baseline BOM` | `Current BOM` | Clearer for manufacturing and purchasing users. |
| `Candidate BOM` | `Proposed BOM` | More natural wording. |

### Page-level helper text recommendations

| Page | Current tone | Recommended tone |
| --- | --- | --- |
| Mapping | System-oriented and still fairly abstract. | Focus on whether the BOM is understood well enough for safe comparison and impact review. |
| Results | Strong structure, but some wording is too technical. | Focus on review, impact, and decision readiness. |
| History | Accurate but somewhat abstract. | Emphasize saved comparison history and reopening prior revision pairs. |
| Notifications | Internal brand phrase `Mission Feed` is not needed. | Emphasize alerts, completion, failures, and follow-up actions. |
| Admin | Heavy governance language appears before user intent. | Lead with access, retention, audit, and change-rule management. |

### Recommended replacement copy for major page headers

| Page | Recommended title | Recommended support text |
| --- | --- | --- |
| Compare | `Compare BOM Revisions` | `Upload the current BOM and the proposed revision to identify part, quantity, revision, and supplier changes.` |
| Mapping | `BOM Field Review` | `Confirm which columns identify parts, revisions, quantities, suppliers, and impact-driving fields before comparison.` |
| Results | `Change Review` | `Review BOM differences, assess impact, and prepare follow-up actions for engineering, purchasing, and change control.` |
| History | `Revision History` | `Reopen saved BOM comparisons and track how a revision chain evolved over time.` |
| Notifications | `Comparison Alerts` | `Track completed, failed, and shared comparison activity and jump back into the related workspace.` |
| Admin | `Governance` | `Manage access, retention, audit evidence, and change-classification rules.` |

## 4. Performance and Load-Time Opportunities

| Priority | Area | Current evidence | Recommendation | Expected benefit |
| --- | --- | --- | --- | --- |
| 1 | Results polling | `results-grid.tsx` used to poll job status every second and recreate the interval whenever filters, paging, status, view mode, or expanded nodes changed. | Implemented in S25: polling is now decoupled from filter/view state, uses timed backoff, and pauses when the tab is hidden. | Lower request volume, fewer unnecessary rerenders, and a more stable review experience. |
| 2 | Results side data | `results-grid.tsx` used to eagerly load share recipients and session history whenever an active comparison/session was present. | Implemented in S25: share recipients now load when the Share dialog opens, and full session history loads when Current Comparison or Previous Comparisons is opened. | Faster first interactive load for Results and fewer nonessential layout changes during initial paint. |
| 3 | Secondary-page first paint | Mapping, Notifications, History, and Admin all fetch initial data in client `useEffect` after mount. | Move initial data fetch to server components or route-level loaders where practical, then stream or hydrate interactive sections afterward. | Faster first meaningful paint and less “page loads empty, then fills in” behavior. |
| 4 | Admin bootstrap load | `admin-governance-console.tsx` fans out to multiple endpoints on first load and auto-saves taxonomy edits after an 800 ms debounce. | Add a single admin bootstrap endpoint for initial counts and key lists. Increase taxonomy autosave debounce and send smaller diff-based saves if possible. | Less startup chatter and smoother editing in large taxonomy sets. |
| 5 | Perceived performance | History, Notifications, and Admin use oversized cards with high whitespace. | Compress vertical rhythm, reduce card height, and bring actions closer to content. | Pages will feel faster even before deeper engineering changes because users scan less empty space. |
| 6 | Results responsiveness | The most-used page already uses server pagination and a 50-row default, which is good. | Keep server pagination, but fix toolbar wrapping and avoid any future move toward oversized single-page tables. | Protects large-BOM performance while improving usability. |

## 5. Live Profiling Results

Important interpretation note:

- These measurements were captured on a local machine against a local backend/frontend stack.
- They are valid for comparative diagnosis and repo-goal comparison.
- They are not a substitute for networked production telemetry.
- The final workspace runtime trace bundle was regenerated from a cold local app start, so route timings are slightly more conservative than the earlier warm-route Playwright pass.

### 4.1 Page-level Lighthouse and runtime summary

| Page | HTTP | DOM Content Loaded | First Contentful Paint | Largest Contentful Paint | Lighthouse performance | Key takeaway |
| --- | --- | --- | --- | --- | --- | --- |
| Compare / Upload | 200 | 491 ms | 291 ms | 519 ms | 100 | The upload route remains healthy after the copy and spacing pass. |
| Mapping | 200 | 122 ms | 263 ms | 472 ms | 100 | The renamed field-review route remains fast and visually stable. |
| Results | 200 | 59 ms | 271 ms | 646 ms | 78 | Raw load remains strong, but the page is still penalized by layout instability. |
| History | 200 | 56 ms | 270 ms | 493 ms | 100 | Good route performance after the action-label and density changes. |
| Notifications | 200 | 53 ms | 268 ms | 490 ms | 100 | Good route performance after the alert copy and action cleanup. |
| Admin | 200 | 52 ms | 274 ms | 625 ms | 100 | Still a large DOM, but route performance remains healthy. |

### 4.2 Measured runtime observations

| Observation | Evidence | PM meaning |
| --- | --- | --- |
| Results is the only page with a materially lower Lighthouse score. | Lighthouse performance score `78` on Results versus `100` on all other audited pages. | The most important frontend performance issue is concentrated on the core review page. |
| Results instability is still a layout-shift problem, not a raw speed problem. | Post-S25 Lighthouse CLS on Results is `0.586446`, while FCP is `271 ms` and LCP is `646 ms`. | The page feels less stable because content moves, not because the app is slow to respond. |
| Results still shows the heaviest style recalculation activity in the live runtime bundle. | Post-S25 runtime trace records `RecalcStyleCount = 96` on Results, versus `3-7` on the other pages. | This reinforces that the remaining problem is concentrated on the core review page. |
| Results refetch hardening improved the code path, but did not materially move the Lighthouse score. | The S25 pass removed eager share/history fetches and decoupled polling from filter/view state, yet Lighthouse on Results remains `78`. | The remaining instability is likely driven by another late-rendering block rather than by the polling logic that was just removed. |
| Admin has the largest DOM footprint but not the worst performance. | Runtime metrics show `Nodes = 4461` on Admin, yet Lighthouse still scores `100`. | Admin’s issue is now primarily information density and content organization, not raw browser speed. |
| Upload remains healthy after the Compare hero compression pass. | Upload DCL is `491 ms`, Lighthouse FCP `291 ms`, Lighthouse `100`. | The Compare spacing fix improved density without creating a browser-side performance tradeoff. |

### 4.3 Comparison with documented goals

Reference: `docs/runbooks/s4-08-performance-baseline.md`

| Goal | Documented target | Measured result | Status | Comment |
| --- | --- | --- | --- | --- |
| Diff p95, small fixture tier | `<= 30s` | `226 ms` p95 | Pass | Far inside the backend timing budget on the reviewed fixture pair. |
| First progress response | `< 2s` | `212 ms` p95 | Pass | Strong initial responsiveness in the current local stack. |
| First row chunk visible | `< 5s` | `226 ms` p95 | Pass | The reviewed small fixture pair is well under the target. |
| Results grid search interaction | `< 500 ms` | `95.41 ms` p95 | Pass | Search updated well inside the target. |
| Results grid sort interaction | `< 500 ms` | `83.83 ms` p95 | Pass | Sort updated well inside the target. |
| Results grid filter interaction | `< 500 ms` | `87.32 ms` p95 | Pass | Filter updated well inside the target. |

### 4.4 Results interaction benchmark detail

Reference benchmark: `tests/e2e/results-interaction-perf.spec.ts`

| Interaction | Measured runs | Mean | p95 | Status |
| --- | --- | --- | --- | --- |
| Search | `95.41 ms`, `64.55 ms`, `53.60 ms` | `71.19 ms` | `95.41 ms` | Pass |
| Sort | `83.83 ms`, `78.18 ms`, `67.73 ms` | `76.58 ms` | `83.83 ms` | Pass |
| Filter | `65.15 ms`, `87.32 ms` | `76.23 ms` | `87.32 ms` | Pass |

### 4.5 PM conclusion from measured performance

- The documented backend and data-delivery goals are currently being met comfortably on the standard small fixture pair.
- The Results grid interaction target is also being met comfortably for search, sort, and filter.
- The first remediation pass resolved the obvious Results toolbar overlap and raw operator-facing copy problems.
- The main frontend performance risk is still not general slowness.
- The main frontend performance risk is the `Results` page continuing to combine:
  - the most important workflow
  - the only materially weak Lighthouse score
  - persistent CLS on the primary review surface
  - the highest layout/style recalculation activity in the final benchmark artifact

This means the next performance/design pass should stay centered on `Results`, but now with an even narrower scope: instrument and eliminate the remaining layout shift source. The evidence continues to show the page is operationally fast, but visually unstable.

## 6. What Is Already Working Well

| Area | Positive finding |
| --- | --- |
| Global shell | Expanded and collapsed navigation states are structurally consistent and establish a clear product shell. |
| Brand foundation | Compare and Results provide a clean Mission Control baseline with restrained color, thin borders, and usable technical typography. |
| Results data strategy | Server pagination and row limits are appropriate for BOM-scale datasets. |
| Cross-page framing | The top title bar and theme toggle create a recognizable common frame across the authenticated application. |
| Visual discipline | The product avoids heavy gradients and over-styled enterprise chrome, which is the right direction for a manufacturing operations tool. |

## 7. PM Action Order

| Sequence | Action | Why this order |
| --- | --- | --- |
| 1 | Instrument and eliminate the remaining Results layout shift. | This is now the only material PM-assessment issue still open in the current branch. |
| 2 | Consider server-first or streamed loading for secondary-page initial data. | This is now a maturity improvement, not a release blocker. |
| 3 | Preserve the S25 naming and density rules as the frontend baseline for future pages. | The product now has a clearer manufacturing-oriented language and should not drift back toward internal wording. |

## Final recommendation

This frontend now reads much more like one coherent operational product for BOM managers, change managers, engineering, purchasing, and support staff. The remaining release-significant work is concentrated on one place:

1. isolate and eliminate the remaining Results layout shift

Everything else that was open in the PM assessment is now implemented in the current branch and backed by focused validation.
