# Backlog S18 - Results Visual Parity

## Goal

Make `/results` match the target visual design in [Results-Redisign.html](/c:/Users/yetro/Evolve%20Global%20Solutions/BOM%20Compare%20-%20Documents/Code-BOMComparevX/BOMComparevX/randomtests/Results-Redisign.html) as closely as possible while preserving current backend wiring, tooltips, filters, pagination, exports, sharing, view toggles, and impact review behavior.

This stage explicitly excludes demo-data composition parity. The goal is UI parity, not forcing the live page to use the exact mock dataset.

## Architecture decision

Implemented architecture:

* Keep the implementation frontend-only
* Treat `/results` as the primary page scope
* Allow small shared-shell changes only where `/results` depends on the shell for header and theme-toggle rendering
* Avoid backend or data-contract changes unless a visual requirement cannot be met without them

Why this is the correct boundary:

* the gaps are visual and structural in the page shell and results surface
* current results behavior and backend wiring are already working
* changing data composition would create false coupling between design parity and business logic

## Scope

Implemented:

* restore the `MISSION CONTROL` eyebrow above the `/results` title
* replace the current results theme control with the compact pill-style toggle from the target
* make the desktop results toolbar read as one compact working row before responsive collapse
* reduce control height, radius, spacing, and typography to the target rhythm
* flatten the results surface chrome so it reads less like a large dashboard card
* align the table header band, header typography, and spacing with the target
* tighten row height, body typography, impact-cell spacing, and classification button styling
* retune semantic row fills to the target palette
* preserve all current results tooltips and interactions

Out of scope:

* matching the exact demo data shown in the mock
* changing comparison behavior, result ordering rules, or export behavior
* left-navigation redesign work beyond any already completed shell changes

## Tasks

1. Restore the `/results` eyebrow and reduce title scale to the target rhythm
   Status: `Completed`

2. Replace the results header theme control with the compact pill-style toggle
   Status: `Completed`

3. Rework the desktop results toolbar into a single compact horizontal working row
   Status: `Completed`

4. Reduce results control sizing, border radius, and spacing to the target visual system
   Status: `Completed`

5. Flatten the results outer surface chrome and spacing
   Status: `Completed`

6. Rework the table header band, header typography, and table density
   Status: `Completed`

7. Retune row typography, impact-cell spacing, and classification button styling
   Status: `Completed`

8. Tune semantic row colors to the target palette
   Status: `Completed`

9. Update results regression coverage for the new header and toolbar behavior
   Status: `Completed`

10. Run a QA pass against the target screenshot and `randomtests/Results-Redisign.html`
   Status: `Completed`

## QA

Required checks for this stage:

* `npm --prefix apps/frontend run typecheck`
* `npm run build` in `apps/frontend`
* `npx playwright test tests/e2e/results-redesign.spec.ts tests/e2e/navigation-redesign.spec.ts tests/e2e/results-visual-capture.spec.ts --workers=1`

QA focus:

* eyebrow restored on `/results`
* results title scale and spacing match the target more closely
* results theme toggle matches the compact pill behavior and still changes theme
* desktop toolbar stays on one working row at the target desktop width
* search, filters, actions, summary, and page size visually match the target rhythm
* table header strip, density, and typography match the target more closely
* semantic row fills are subtle and match the target palette family
* all existing results tooltips and action flows still work

QA execution:

* Captured a live `/results` screenshot to [results-visual-capture.png](/c:/Users/yetro/Evolve%20Global%20Solutions/BOM%20Compare%20-%20Documents/Code-BOMComparevX/BOMComparevX/artifacts/results-visual-capture.png)
* Compared the capture against [Results-Redisign.html](/c:/Users/yetro/Evolve%20Global%20Solutions/BOM%20Compare%20-%20Documents/Code-BOMComparevX/BOMComparevX/randomtests/Results-Redisign.html) and performed a follow-up rework pass to remove the inherited panel chrome and tighten the results header/theme control parity

## Risks

Primary risk:

* flattening `/results` too aggressively can unintentionally diverge from the shared shell language used elsewhere in the app

Mitigation:

* keep the strongest overrides results-specific
* isolate shared-shell changes to only the pieces `/results` actually owns, such as title eyebrow and theme control rendering
* keep Playwright regression coverage on both results and navigation

## Follow-up recommendation

After this stage, evaluate whether the refined results visual language should be promoted into broader shared-shell tokens for other pages instead of remaining results-specific overrides.

Residual note:

* the live page is now materially closer to the target mock, but exact screenshot parity will still depend on viewport composition and whether the navigation rail is visible in the captured frame
