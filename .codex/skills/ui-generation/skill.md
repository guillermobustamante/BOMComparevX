---
name: ui-generation
description: Translates the approved UI foundation into screen-by-screen UI generation guidance, implementation-ready specifications, component structure, interaction rules, and AI-coding-agent prompts for frontend delivery.
version: 1.0.0
owner: project-team
intended_audience:
  - AI coding agents
  - product managers
  - frontend engineers
  - designers
  - architects
stage:
  - after ui-foundation passes QA
  - before frontend implementation
  - when new screens or modules are introduced
tags:
  - ui
  - ux
  - frontend
  - design-system
  - screen-spec
  - ai-agent
---

# UI Generation Skill

## Purpose

This skill converts the approved UI foundation into implementation-ready UI generation outputs for the current project.

It must:
- consume the outputs of the UI Foundation Skill first
- generate specific, screen-level UI definitions
- define layout, component composition, behaviors, states, accessibility, and responsive rules
- produce outputs suitable for direct use by AI coding agents
- preserve alignment to domain, user mentality, workflows, and architecture
- run self-audit and QA before considering the output acceptable

This skill is not the UI strategy skill. It is the execution bridge between UI foundation and frontend implementation.

## Required Inputs

This skill must use, in order of priority:

1. approved output from the UI Foundation Skill
2. repository context and current frontend structure
3. architecture documents
4. backend contracts or API definitions
5. backlog, user stories, and acceptance criteria
6. component libraries or design system already present in the repo
7. branding inputs if available

If the UI Foundation Skill output is missing, incomplete, or not approved, this skill must stop and explicitly say that the UI foundation needs to be completed or approved first.

## When to Use

Use this skill:
- after the UI Foundation Skill has passed QA
- when the team wants screen-by-screen UI generation outputs
- when an AI coding agent needs implementable screen specs
- when a new module or workflow needs UI definitions derived from the established foundation

Do not use this skill as a substitute for the UI Foundation Skill.

## Core Operating Principles

1. Treat the UI Foundation Skill as the source of truth for strategy.
2. Do not invent a new UI direction unless the foundation clearly fails to support a required screen.
3. Generate outputs that are implementation-oriented, not vague design commentary.
4. Keep all generated screens aligned with:
   - user mentality
   - workflow reality
   - architecture
   - accessibility
   - responsive behavior
   - component reuse rules
5. Favor consistency over novelty.
6. Reuse existing components and patterns wherever possible.
7. Ask clarifying questions only if ambiguity would materially alter:
   - screen behavior
   - core layout
   - permissions
   - workflow state logic
   - key responsive treatment
8. If enough evidence exists, proceed with explicit assumptions and confidence notes.
9. Reject outputs that are too generic, too visual-only, or not usable by AI coding agents.

## What This Skill Must Generate

This skill must produce:

- screen-by-screen specifications
- layout definitions
- component breakdowns
- state definitions
- action definitions
- permission-sensitive behavior notes
- responsive behavior by screen
- accessibility notes by screen
- data binding and backend dependency notes
- design-system mapping
- implementation prompts for AI coding agents
- sequencing recommendations for frontend delivery
- QA checks for each screen or component set

## Required Analysis Dimensions

### 1. Foundation alignment
Before generating screens, confirm:
- the UI foundation is present
- the primary UI direction is clear
- the navigation and IA are clear
- the screen inventory is clear enough to proceed
- the component guidance is sufficient

If not, list the exact gaps.

### 2. Screen model
For each screen or screen type, define:
- screen name
- purpose
- primary users
- primary workflow stage
- entry points
- exit paths
- dependencies
- key decisions made on the screen

### 3. Layout model
For each screen, define:
- page shell
- header structure
- navigation region
- primary content region
- secondary content region
- action areas
- filter or side panels
- modal, drawer, or inline behavior
- density mode
- responsive shifts

### 4. Component model
For each screen, define:
- required components
- reused components
- new components needed
- component hierarchy
- variant rules
- interaction contracts

### 5. Data and state model
For each screen, define:
- required data inputs
- API or state dependencies
- async states
- validation states
- role-based visibility
- permissions
- loading, empty, error, partial, and no-access states

### 6. Interaction model
For each screen, define:
- primary actions
- secondary actions
- destructive actions
- confirmations
- inline edits
- workflows
- bulk actions
- navigation transitions
- save and cancel behavior
- optimistic versus confirmed updates if relevant

### 7. Accessibility model
For each screen, define:
- heading structure
- keyboard path
- focus behavior
- announcements for dynamic updates
- accessible labels
- error handling behavior
- table and form accessibility rules
- non-color status communication

### 8. Responsive model
For each screen, define:
- breakpoint behavior
- action priority changes
- navigation changes
- table adaptation
- panel collapse rules
- content ordering shifts
- what stays visible at all sizes

### 9. AI-agent implementation model
For each screen or component group, define:
- implementation priority
- suggested file boundaries
- component decomposition
- props and state considerations
- acceptance guidance
- test scenarios
- coding-agent prompt seed

## Mandatory Deliverables

The skill must produce all of the following sections:

1. UI generation summary
2. Foundation alignment check
3. Screen generation plan
4. Screen-by-screen specifications
5. Shared layout and shell guidance
6. Shared component mapping
7. Screen state matrix
8. Accessibility by screen
9. Responsive behavior by screen
10. Data dependency and integration notes
11. Design-system and component reuse mapping
12. AI coding agent implementation prompts
13. Suggested file and component structure
14. Delivery sequencing guidance
15. QA checklist and self-audit
16. Revision notes
17. Final verdict

## Required Output Structure

### A. UI generation summary
Summarize:
- what foundation inputs were used
- what screens are covered
- readiness level for implementation

### B. Foundation alignment check
State:
- whether the UI foundation is sufficient
- any gaps that weaken screen generation
- assumptions used

### C. Screen generation plan
List:
- screens to generate
- priority order
- grouping by workflow or module
- reusable patterns across screens

### D. Screen-by-screen specifications
For each screen, provide:
- name
- purpose
- users
- workflow stage
- layout structure
- component breakdown
- actions
- states
- accessibility notes
- responsive notes
- backend or state dependencies
- implementation notes
- AI coding-agent prompt seed

### E. Shared layout and shell guidance
Define:
- app shell
- navigation shell
- page header conventions
- page spacing and density rules
- cross-screen action placement rules

### F. Shared component mapping
Define:
- standard components to reuse
- variants
- new components required
- component naming guidance

### G. Screen state matrix
Define per screen:
- loading
- empty
- populated
- filtered-empty
- validation-error
- server-error
- no-access
- partial-degradation
- success-feedback

### H. Accessibility by screen
Define explicit screen-level accessibility rules.

### I. Responsive behavior by screen
Define explicit screen-level breakpoint changes.

### J. Data dependency and integration notes
Map screens to:
- APIs
- state containers
- role assumptions
- permissions
- feature flags if relevant

### K. AI coding agent implementation prompts
Provide:
- one prompt per major screen or component group
- one prompt for shared shell
- one prompt for shared component primitives if needed

### L. Suggested file and component structure
Recommend:
- folders
- file naming
- shared versus local components
- screen composition structure

### M. Delivery sequencing guidance
Recommend:
- what to build first
- dependency order
- low-risk sequence
- what can be parallelized

### N. QA checklist and self-audit
Run QA and self-audit.

### O. Revision notes
If QA fails, revise and rerun.

### P. Final verdict
Choose one:
- Pass
- Pass with conditions
- Fail

And one operational verdict:
- Ready for frontend implementation
- Needs more UI foundation
- Needs API clarification
- Needs delivery planning

## Rejection Triggers

Reject the output if any of the following is true:
- UI foundation is missing or ignored
- screens are inconsistent with the foundation
- layouts are vague
- component breakdown is too abstract
- states are incomplete
- accessibility is shallow
- responsive behavior is underspecified
- permissions are ignored where relevant
- data dependencies are missing
- AI-agent prompts are too weak to implement from
- output is generic enough to fit any project

## QA Rubric

Score each area from 1 to 5:
1. foundation alignment
2. screen specificity
3. layout clarity
4. component practicality
5. interaction clarity
6. state completeness
7. accessibility completeness
8. responsive completeness
9. data dependency clarity
10. AI-agent implementation usefulness
11. delivery sequencing quality
12. project specificity

Thresholds:
- any score below 3 = automatic fail
- average below 4.0 = fail
- pass requires no critical omissions

## Revision Loop

If failed:
1. identify specific weaknesses
2. revise the exact sections
3. rerun QA
4. repeat until pass

## AI Coding Agent Orientation

The output must be directly usable by an AI coding agent.

That means it must:
- define what to build
- define how screens are composed
- define what states and interactions exist
- define what shared components to create
- define what dependencies matter
- define what can be validated in tests

Avoid purely aesthetic language unless it is tied to implementation behavior.

## Suggested Companion Skills

This skill should feed:
- frontend implementation skill
- UI QA skill
- acceptance-criteria skill
- component-library skill
- test-scenario skill