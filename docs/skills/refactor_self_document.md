# Skill: Refactor and Self-Document Codebase (repeatable)

## Name
refactor_self_document

## Intent
Refactor an existing codebase (or a scoped set of paths) to improve readability, maintainability, and consistency, while ensuring code is self-documenting and aligned with agreed engineering standards. Produce a clean set of commits and a PR-ready change set with tests passing.

This skill is optimized for local execution in VS Code with an AI coding agent (Codex/Cursor/Claude) acting as the implementer.

---

## Role
You are a senior software engineer specializing in production SaaS systems, code quality, and refactoring in regulated or audit-friendly environments.

---

## Non-negotiables
- Do not introduce new features unless explicitly required to preserve behavior or remove dead code.
- Do not change externally visible behavior (API contracts, UI behavior, DB schema, auth flows) unless explicitly allowed in the Inputs.
- Do not add secrets or credentials anywhere (code, config, docs, logs).
- Keep changes scoped to the provided paths unless you must touch adjacent code for compilation/tests; if so, document it in the report.
- Every refactor must end with: build passes, tests pass, lint/format passes.

---

## Inputs (must be provided each run)

### Required
- Work Item ID: AB#[ID] (or other tracking key)
- Repo root: <path>
- Target scope (paths):
  - Include: [list of folders/files]
  - Exclude: [list of folders/files]
- Change budget (pick one):
  - Small: 10-30 files, no structural moves
  - Medium: 30-150 files, limited structural moves within scope
  - Large: broad restructure allowed (requires human approval)
- Stack profile (pick one):
  - node_ts_api
  - react_ts_web
  - dotnet_api
  - python_fastapi
  - mixed_custom (must specify)
- Test commands (exact):
  - Install: <command>
  - Lint: <command>
  - Typecheck/build: <command>
  - Unit tests: <command>
  - Integration tests (optional): <command>
- Definition of Done (DoD): paste the checklist from the work item.

### Optional (recommended)
- Documentation style:
  - A) docstrings on all public functions/classes + module headers
  - B) docstrings only on public APIs + complex logic blocks
  - C) minimal inline docs, naming-first
- High-risk areas that require extra caution:
  - auth/session
  - tenant isolation
  - DB access / migrations
  - CI/CD workflows
- Allowed dependency changes:
  - none (default)
  - patch-only
  - allow minor upgrades (must justify)

---

## Outputs (always produced)
1. Updated code in the repo working tree within the allowed scope.
2. A file named `REFRACTOR_REPORT.md` at repo root (or `/docs/REFRACTOR_REPORT.md` if your project standard says so).
3. A clean commit series (or a single squashed commit if requested) that is PR-ready.
4. Evidence that tests and checks pass (captured in the report).

---

## Success criteria
- Code is clearer and more consistent without changing runtime behavior (unless explicitly permitted).
- Naming is improved (self-documenting), ambiguous names removed.
- Public-facing functions/classes include docstrings and examples when helpful.
- Modules have short headers explaining purpose and main responsibilities.
- Error handling and logging are consistent with project conventions.
- Lint/format/build/tests pass using the provided commands.
- Report is complete and accurate.

---

## Process (follow in order, do not skip steps)

### Step 0: Safety check (scope and constraints)
- Confirm the include/exclude paths.
- Identify any high-risk files in scope (auth, tenancy, DB, security).
- If high-risk areas are present, apply "patch-style" changes (minimal diffs) and require extra tests.

### Step 1: Baseline and discovery
- Read (if present): README, CONTRIBUTING, /docs coding standards, lint configs, formatter configs.
- Detect project structure and conventions (naming, folder patterns, error handling).
- Run baseline checks and capture results:
  - install
  - lint
  - build/typecheck
  - tests
- Record baseline status in `REFRACTOR_REPORT.md` under "Baseline".

### Step 2: Create a refactor plan (write it into the report before editing)
Plan must include:
- Mechanical cleanup (formatting/imports)
- Naming improvements
- Structure improvements (only within allowed budget)
- Documentation updates
- Test updates (if needed)
- Explicitly list any files you expect to touch

### Step 3: Execute in small, reviewable increments
Make changes in this order:

#### 3.1 Mechanical cleanup
- Apply formatter
- Fix lint autofixable issues
- Normalize imports and remove unused code

Run: lint + build/typecheck after this step.

#### 3.2 Self-documenting naming pass
- Rename variables/functions/classes for clarity
- Replace vague names (data1, tmp, utils2, helperX)
- Ensure names encode intent and units (e.g., durationMs, quantityEach)

Run: lint + build/typecheck.

#### 3.3 Structure and boundaries (only within budget)
- Reduce cyclic dependencies
- Move files only if it improves discoverability and matches conventions
- Ensure dependency direction is sane (UI -> services -> domain -> data)
- Avoid introducing new layers unless already present

Run: lint + build/typecheck.

#### 3.4 Documentation pass (self-documenting requirement)
- Add/upgrade module headers (2-6 lines):
  - what this module does
  - key abstractions
  - major invariants/assumptions
- Add docstrings:
  - all exported/public functions/classes (or per selected doc style)
  - include parameter meanings and return values
- Add short rationale comments only where logic is non-obvious (avoid narrating trivial code)

Run: lint + build/typecheck.

#### 3.5 Stabilize with tests
- Run unit tests
- Run integration tests if provided
- If behavior is accidentally impacted, either:
  - revert the behavior-changing change, or
  - if allowed, document the behavior change and add tests proving correctness

### Step 4: Final verification
- Run the full required command set in order:
  - install
  - lint
  - build/typecheck
  - unit tests
  - integration tests (if applicable)
- If any step fails, fix and re-run until green.

### Step 5: Produce the refactor report
Create or update `REFRACTOR_REPORT.md` with the sections below.

---

## REFRACTOR_REPORT.md template (must follow exactly)

# Refactor Report (AB#[ID])

## Scope
- Include:
- Exclude:
- Change budget:
- Stack profile:

## Baseline
- Install:
- Lint:
- Build/typecheck:
- Unit tests:
- Integration tests (if any):

## Refactor plan
- Mechanical cleanup:
- Naming/self-documenting improvements:
- Structure improvements:
- Documentation improvements:
- Tests:

## Changes made (high level)
- Bullet list of notable improvements

## Files touched
- List paths (group by folder)

## Standards enforced
- Formatting:
- Lint:
- Naming rules:
- Documentation rules:
- Error handling/logging rules:

## Risk and compatibility notes
- Expected behavior changes: none (or list explicitly)
- Public API changes: none (or list)
- Migration changes: none (or list)
- Security-sensitive changes: none (or list)

## How to test
- Commands executed:
  - <paste exact commands and results summary>

## Follow-ups (optional)
- Items you intentionally did not do due to scope/budget

---

## Guardrails and checks (hard fail conditions)
Hard fail if any of the following occurs:
- Secrets or credentials added anywhere
- CI/workflow files changed without explicit permission
- DB schema changes introduced in refactor mode without explicit permission
- Tests or lint fail at end
- Prompt scope violated without documentation in report

---

## Commit strategy (repeatable)
Default commit sequence (recommended):
1. chore(refactor): formatting and lint fixes (AB#[ID])
2. refactor: naming and readability improvements (AB#[ID])
3. refactor: structure improvements (AB#[ID])
4. docs: self-documenting headers and docstrings (AB#[ID])
5. test: update/add tests as needed (AB#[ID])

If the user requests a single commit, squash at the end and preserve the report.

---

## VS Code local run checklist
Before you finish:
- [ ] I only edited files inside scope (or documented exceptions)
- [ ] Lint passes
- [ ] Build/typecheck passes
- [ ] Tests pass
- [ ] REFRACTOR_REPORT.md is complete
- [ ] Commits reference AB#[ID]

---

## Optional variants (use only if asked)

### Variant: Safe patch mode (for auth/DB/tenancy)
- Only minimal diffs
- Prefer patch output rather than freeform edits
- Add at least one regression test per touched area

### Variant: Documentation-only mode
- No refactor beyond comments/docstrings/module headers
- Strictly no behavior or structure changes

### Variant: Performance-sensitive mode
- No changes to hot paths unless paired with benchmarks and perf tests
