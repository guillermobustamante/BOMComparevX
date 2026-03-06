---
name: frontend-implementation
description: Converts approved UI foundation and UI generation outputs into implementation-ready frontend delivery guidance, file structure, component responsibilities, integration plan, acceptance rules, and AI-coding-agent build prompts aligned to the actual project stack.
version: 1.0.0
owner: project-team
intended_audience:
  - AI coding agents
  - frontend engineers
  - product managers
  - architects
stage:
  - after ui-generation passes QA
  - before or during frontend coding
  - when new UI modules enter implementation
tags:
  - frontend
  - implementation
  - ai-agent
  - ui
  - ux
  - engineering
---

# Frontend Implementation Skill

## Purpose

This skill translates approved UI strategy and screen specifications into implementation-ready frontend execution guidance tied to the actual repository and stack.

It must:
- consume approved outputs from UI Foundation and UI Generation
- inspect the current repository and existing frontend code structure
- align recommendations to the real stack already present in the project
- define file structure, component boundaries, state responsibilities, integration approach, and acceptance rules
- generate AI-coding-agent prompts that are precise enough to build from
- self-audit and run QA before the output is considered acceptable

This skill is the implementation bridge between screen specification and actual frontend coding.

## Required Inputs

This skill must use, in order of priority:

1. approved UI Foundation output
2. approved UI Generation output
3. current repository structure
4. frontend code already present in the repo
5. architecture documents
6. API contracts or backend integration definitions
7. backlog, stories, and acceptance criteria
8. testing setup and quality tooling already present
9. design system or component libraries already present

If UI Foundation or UI Generation is missing, incomplete, or not approved, this skill must stop and say exactly what is missing.

## When to Use

Use this skill:
- after UI Generation has passed QA
- before starting frontend coding for a module
- when AI coding agents need implementation-ready instructions
- when existing screens must be aligned to a clearer frontend structure
- when a new feature needs decomposition into implementable frontend slices

Do not use this skill to redefine product strategy or screen strategy. It must inherit those from earlier skills.

## Core Operating Principles

1. Treat UI Foundation and UI Generation outputs as source-of-truth inputs.
2. Align to the real repository, not an imagined ideal project structure.
3. Prefer reuse of existing architecture, components, patterns, and utilities where practical.
4. Recommend change only when the current structure clearly blocks quality, maintainability, accessibility, or delivery.
5. Make implementation guidance explicit, modular, testable, and practical for AI coding agents.
6. Ask clarifying questions only when ambiguity would materially alter:
   - file structure
   - state ownership
   - data flow
   - permissions handling
   - frontend routing
   - implementation sequencing
7. Otherwise proceed with explicit assumptions and confidence notes.
8. Do not produce generic architecture that could fit any repo.
9. Reject outputs that are not directly usable for implementation.

## Required Analysis Dimensions

### 1. Repository and stack alignment
Analyze:
- framework and runtime
- language choices
- routing model
- state management patterns
- styling approach
- component library usage
- test framework usage
- build tooling
- linting and formatting
- folder structure
- conventions already in use

### 2. Implementation readiness
Confirm:
- UI Foundation is approved
- UI Generation is approved
- screen list is implementation-ready
- APIs are sufficient or identify gaps
- roles and permissions are clear enough or identify gaps
- acceptance criteria are usable or identify gaps

### 3. Delivery decomposition
Break the work into:
- shared shell work
- shared primitives
- shared domain components
- screen-level implementation
- data integration tasks
- state handling tasks
- accessibility tasks
- responsive tasks
- testing tasks
- cleanup or refactor tasks if justified

### 4. File and component architecture
Define:
- recommended folder structure
- screen folders
- shared component folders
- feature-local component folders
- hooks or composables
- services or API layer
- state containers
- utility layers
- test file placement
- naming patterns

### 5. Component responsibility model
For each major component or group, define:
- purpose
- inputs
- outputs
- state ownership
- side effects
- accessibility obligations
- responsive obligations
- test expectations

### 6. State and data flow
Define:
- local state versus shared state
- async data loading boundaries
- caching assumptions
- mutation behavior
- optimistic versus confirmed updates
- validation ownership
- permission checks
- error boundaries
- retry behavior

### 7. Implementation sequencing
Define:
- build order
- dependency order
- what must exist first
- what can be parallelized
- low-risk implementation path
- handoff points to QA skill

### 8. AI-coding-agent instructions
Provide:
- prompt per major slice
- prompt per shared layer if needed
- coding boundaries
- acceptance expectations
- testing expectations
- refactor warnings
- repository-specific implementation notes

## Mandatory Deliverables

The skill must produce all of the following sections:

1. Frontend implementation summary
2. Input sufficiency and approval check
3. Repository and stack analysis
4. Recommended frontend implementation architecture
5. File and folder structure
6. Shared component and feature component plan
7. State and data flow plan
8. Integration and API dependency plan
9. Delivery decomposition into implementation slices
10. Screen-to-component mapping
11. Accessibility and responsive implementation obligations
12. Testing and validation implementation guidance
13. AI coding-agent implementation prompts
14. Suggested sequencing and parallelization plan
15. Risks, assumptions, and blockers
16. Self-audit and QA rubric
17. Revision notes
18. Final verdict

## Required Output Structure

### A. Frontend implementation summary
Summarize:
- which approved inputs were used
- what repo signals were found
- implementation readiness level

### B. Input sufficiency and approval check
State:
- whether UI Foundation is approved
- whether UI Generation is approved
- what missing prerequisites remain

### C. Repository and stack analysis
Document:
- framework
- language
- routing
- state
- styling
- testing
- component library usage
- conventions already present
- implementation constraints

### D. Recommended frontend implementation architecture
Define:
- overall frontend structure
- feature boundaries
- shared boundaries
- state boundaries
- service boundaries
- testing boundaries

### E. File and folder structure
Provide:
- recommended folders
- recommended file naming patterns
- where new code should go
- where not to put code

### F. Shared component and feature component plan
Provide:
- components to reuse
- components to create
- feature-specific components
- shared primitives
- wrapper or adapter components if needed

### G. State and data flow plan
Define:
- local state
- global or shared state
- API hooks or services
- mutation flow
- validation flow
- error and retry handling

### H. Integration and API dependency plan
Map screens and components to:
- endpoints
- schemas
- permissions
- feature flags
- loading dependencies

### I. Delivery decomposition into implementation slices
Break work into slices that an AI coding agent can execute cleanly.

### J. Screen-to-component mapping
Map each approved screen to:
- top-level component
- child components
- shared components
- state hooks
- data dependencies
- tests

### K. Accessibility and responsive implementation obligations
State explicit implementation requirements, not just design goals.

### L. Testing and validation implementation guidance
Define:
- unit test expectations
- integration test expectations
- accessibility test expectations
- visual regression guidance if applicable
- manual QA hooks

### M. AI coding-agent implementation prompts
Provide:
- one prompt per implementation slice
- one prompt for shared shell if needed
- one prompt for shared data or state layer if needed

### N. Suggested sequencing and parallelization plan
Recommend:
- first slice
- second slice
- parallel work opportunities
- dependency ordering
- risk-reduction order

### O. Risks, assumptions, and blockers
List:
- implementation risks
- repo uncertainties
- assumptions used
- blockers that must be resolved

### P. Self-audit and QA rubric
Run QA and determine pass or fail.

### Q. Revision notes
If QA fails, revise and rerun.

### R. Final verdict
Choose one:
- Pass
- Pass with conditions
- Fail

And one operational verdict:
- Ready for coding
- Needs prerequisite clarification
- Needs API clarification
- Needs UI generation refinement
- Needs delivery planning

## Rejection Triggers

Reject the output if any of the following is true:
- UI Foundation is ignored
- UI Generation is ignored
- recommendations do not match the repo stack
- file structure is vague
- component boundaries are unclear
- state ownership is unclear
- integration points are missing
- accessibility obligations are shallow
- responsive obligations are shallow
- testing guidance is missing
- AI-agent prompts are too weak
- output is generic enough to fit any project

## QA Rubric

Score each area from 1 to 5:
1. input alignment
2. repo specificity
3. architecture practicality
4. file structure clarity
5. component boundary clarity
6. state and data flow clarity
7. integration completeness
8. accessibility implementation usefulness
9. responsive implementation usefulness
10. testing guidance usefulness
11. AI-agent implementation usefulness
12. sequencing quality
13. project specificity

Thresholds:
- any score below 3 = automatic fail
- average below 4.0 = fail
- pass requires no critical omissions

## Revision Loop

If failed:
1. identify the exact weak areas
2. revise the relevant sections
3. rerun QA
4. repeat until pass

## AI Coding Agent Orientation

The output must be directly usable by an AI coding agent working in the current repository.

That means it must:
- define what files to create or modify
- define what components to build
- define where state should live
- define how APIs connect
- define what tests should exist
- define acceptance expectations
- define implementation sequence

Avoid vague advice. Use repository-aware implementation language.

## Suggested Companion Skills

This skill should feed:
- ui-qa
- acceptance-criteria
- test-scenarios
- code-review