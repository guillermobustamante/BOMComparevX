# Artifact Map

Use this file to choose the correct HTML examples from `artifacts/`.

## Generic shell and dashboard examples

Open these when you need global shell treatment, theme tokens, or a fallback reference for pages without a dedicated artifact pair:

* `artifacts/mockup-dark.html`
* `artifacts/mockup-light.html`

## Route-specific artifact pairs

Use the matching dark/light pair for the target route whenever it exists:

* `/upload`
  * `artifacts/mockup-upload-dark.html`
  * `artifacts/mockup-upload-light.html`
* `/results`
  * `artifacts/mockup-results-dark.html`
  * `artifacts/mockup-results-light.html`
* `/history`
  * `artifacts/mockup-history-dark.html`
  * `artifacts/mockup-history-light.html`
* `/admin`
  * `artifacts/mockup-admin-dark.html`
  * `artifacts/mockup-admin-light.html`

## Selection rules

* Single-page redesign:
  Open the matching route pair first.
* Whole-frontend rollout:
  Start with the generic pair for shell-level alignment, then use route-specific pairs per page family.
* No dedicated route pair:
  Use the generic pair plus `docs/DESIGN_CONCEPT.md`.
* User cites an explicit artifact file:
  Prioritize that file over the generic fallback.

## Minimal loading guidance

Do not read every artifact file by default.

Read only:

* the generic pair when shell-wide guidance is needed
* the route-specific pair for the current page
* additional pairs only when the redesign crosses route boundaries
