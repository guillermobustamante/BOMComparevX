# UI Foundation Reference Guide

## Why this skill exists

Many projects start frontend work too early. They begin coding screens before the team has a stable understanding of:
- who the users really are
- how those users think
- what the domain demands
- which workflows matter most
- what the architecture implies
- how the UI should scale
- what an AI coding agent needs in order to implement correctly

This skill exists to make the UI foundation explicit before code generation begins.

## What this skill is responsible for

This skill is responsible for defining the UI foundation, not for generating final visual comps or production code.

It should:
- understand the project deeply
- define how the UI should behave
- define what the UI must optimize for
- reduce ambiguity
- create implementation-ready guidance
- identify delivery and planning gaps
- prevent weak UI decisions from spreading downstream

## What this skill is not responsible for

It is not:
- a branding agency
- a pixel-perfect mockup tool
- a frontend code generator
- a substitute for architecture
- a substitute for backlog refinement
- a substitute for component implementation

It prepares those later stages.

## Standard reasoning model

The skill should reason in this order:

1. Domain
2. User mentality
3. Workflow
4. Risk and trust
5. Information architecture
6. Navigation
7. Screen model
8. Interaction patterns
9. Components and system rules
10. Accessibility and responsiveness
11. AI-agent execution readiness

This order matters. Do not jump straight to visual design language before understanding the domain and user behavior.

## Domain analysis guidance

For each project, identify:
- domain category
- business operating model
- risk profile
- speed versus accuracy needs
- user expertise level
- common task repetition patterns
- exception frequency
- trust-sensitive operations
- approval requirements
- reporting or audit needs

Examples:
- A manufacturing workflow app often needs dense operational visibility, exception clarity, auditability, and efficiency.
- A property management operations app often needs strong status visibility, document context, approvals, and searchability.
- A finance-adjacent workflow app often needs trust, precision, reversible actions, and highly legible status states.
- A field-service app often needs fast task recognition, mobile resilience, and low-friction data capture.

## User mentality guidance

A good UI does not just support tasks. It matches how the user thinks under real conditions.

For each persona, describe:
- what they are trying to get done
- what they already know
- how much time pressure they are under
- whether they are cautious or action-oriented
- whether they work from memory or from procedure
- what mistakes would be costly
- whether they need reassurance or speed
- what kind of UI wording and layout reduces stress

Examples:
- A compliance-oriented approver wants confidence, audit trail, and low ambiguity.
- A high-volume operator wants speed, consistency, keyboard efficiency, and low visual noise.
- A manager wants fast anomaly detection, prioritization, and status visibility.
- A casual internal user wants guidance, plain language, and forgiving interactions.

## Primary versus fallback UI direction

Every run should define:
- one primary direction
- one fallback modern direction

The primary direction should be the most practical for the project.
The fallback should be more modern visually, but still realistic and enterprise-safe.

Example pattern:
- Primary: calm enterprise workflow interface with high clarity and moderate density
- Fallback: modern productized interface with stronger visual hierarchy, more modular cards, and more expressive layout treatment

## Information architecture guidance

A strong IA:
- groups by user intent, not internal org chart
- reduces the number of top-level choices
- makes module boundaries obvious
- supports both browsing and searching
- works for both novice and expert users
- does not bury frequent tasks
- allows deep links where useful

Poor IA signs:
- top-level nav mirrors backend structure instead of user workflows
- too many peer-level items
- screens organized by internal implementation rather than task logic
- important actions hidden inside unrelated areas

## Screen inventory guidance

The skill should define the screen inventory before implementation begins.

Typical screen types:
- dashboard
- list/index
- detail
- create/edit form
- review/approval
- search/results
- analytics/report
- admin/configuration
- history/audit
- exception handling
- help/onboarding if needed

For each screen, define:
- why it exists
- who uses it
- what the success state is
- what data is critical
- what actions matter
- what state variants exist

## Low-fidelity wireframe description guidance

Describe layout in implementation-friendly terms.

Useful example:
- Header with page title, status pill, primary action, and secondary overflow actions
- Left side filter rail collapsible on tablet and mobile
- Main content area starts with summary metrics row
- Below metrics, tabbed content: Overview, Activity, Documents, History
- Right side contextual panel for assignments and related actions on desktop only
- Activity feed becomes full-width below tabs on smaller screens

Avoid vague language like:
- "clean modern feel"
- "nice balanced layout"
- "attractive hierarchy"

Describe structural intent instead.

## Component recommendation guidance

Recommend component categories, not just isolated widgets.

Common categories:
- navigation shell
- page header
- breadcrumbs
- tabs
- segmented controls
- data tables
- filter panels
- faceted search controls
- forms
- drawers
- modals
- side panels
- cards
- status badges
- timelines
- activity feeds
- upload controls
- approval panels
- bulk action bars
- toasts
- banners
- empty-state panels
- permission-state panels

Make recommendations practical to the stack.

## Data-heavy pattern guidance

Enterprise and operational apps often fail because they under-specify data-heavy behavior.

Always consider:
- sorting
- filtering
- saved views
- bulk actions
- row selection behavior
- column density
- freeze/sticky behavior where justified
- detail expansion
- inline editing boundaries
- pagination versus virtualized scrolling
- export behavior
- audit/history access
- system feedback after actions

## Accessibility guidance

Default target is WCAG 2.2 AA.

The skill should define:
- semantic structure expectations
- keyboard path for primary workflows
- focus order and visible focus
- accessible naming for controls
- error association and validation guidance
- non-color status communication
- touch target expectations where relevant
- reduced motion behavior
- screen reader treatment of dynamic content
- accessible table strategies for dense data

## Responsive behavior guidance

Responsive design is not just shrinking layouts.

The skill should define:
- what changes structurally at each breakpoint
- which actions remain top-level
- what moves into overflow
- when tables become cards or maintain horizontal scroll
- when filters move from rail to drawer
- how dense expert workflows remain usable on smaller screens
- which content priority shifts are acceptable

## Governance guidance

The skill should help teams avoid UI drift.

Document:
- what counts as a standard component
- how variants should be named
- when local deviation is allowed
- when a new pattern must be documented
- how consistency should be preserved across modules
- what should not be customized casually

## Execution-readiness guidance

The skill must determine whether AI coding agents can execute from the available inputs.

Typical missing artifacts:
- incomplete screen inventory
- vague acceptance criteria
- unclear workflow states
- missing API/state assumptions
- missing role/permission definitions
- unclear responsive expectations
- no test scenarios
- no sequencing plan

If gaps exist, say so clearly and recommend the next artifacts.

## Suggested downstream artifacts after this skill

Depending on project maturity, this skill may recommend:
- UI generation brief
- screen-by-screen design prompt pack
- component implementation backlog
- frontend architecture note
- acceptance criteria pack
- test scenario pack
- sprint-ready implementation slices
- state model note
- API dependency map

## Standard final quality bar

The skill should be considered good only if:
- it clearly understands the project
- it matches UI to user mentality
- it defines a coherent IA
- it gives actionable screen guidance
- it handles accessibility and responsiveness properly
- it is practical for the likely stack
- it identifies real missing inputs
- it is useful to an AI coding agent
- it passes its own QA rubric