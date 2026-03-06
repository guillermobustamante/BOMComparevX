---
name: ui-qa
description: Reviews UI foundation, UI generation, and frontend implementation outputs or produced frontend code for consistency, usability, accessibility, responsiveness, correctness, and implementation readiness, then produces a structured QA verdict with required revisions.
version: 1.0.0
owner: project-team
intended_audience:
  - AI coding agents
  - frontend engineers
  - product managers
  - QA reviewers
  - architects
stage:
  - after ui-generation
  - after frontend-implementation
  - during frontend review
  - before acceptance or release
tags:
  - qa
  - ui
  - ux
  - accessibility
  - frontend
  - review
  - ai-agent
---

# UI QA Skill

## Purpose

This skill performs structured quality assurance for the UI workstream.

It must be able to review:
- UI Foundation outputs
- UI Generation outputs
- Frontend Implementation outputs
- actual frontend code when available
- screen behavior definitions
- accessibility and responsive behavior coverage
- alignment between strategy, specs, and implementation

It must:
- identify defects, risks, omissions, inconsistencies, and quality gaps
- prioritize findings by severity
- recommend exact revisions
- determine whether the UI work is acceptable
- rerun evaluation after revisions if needed

## Review Modes

This skill may operate in one or more of these modes:

1. Strategy QA
   - reviews UI Foundation outputs

2. Screen-spec QA
   - reviews UI Generation outputs

3. Implementation-plan QA
   - reviews Frontend Implementation outputs

4. Code-aware UI QA
   - reviews actual frontend code and compares it to approved outputs

The skill must state which mode or modes it is using.

## Required Inputs

Use whatever is available, in this priority order:

1. approved UI Foundation output
2. approved UI Generation output
3. approved Frontend Implementation output
4. actual frontend code in the repo
5. acceptance criteria
6. architecture constraints
7. design system or component conventions
8. test artifacts if present

If a requested review depends on missing upstream artifacts, state exactly what is missing and which review areas cannot be assessed fully.

## When to Use

Use this skill:
- after UI Foundation to validate strategy quality
- after UI Generation to validate screen quality
- after Frontend Implementation to validate implementation readiness
- after code is generated to validate real UI behavior
- before handoff, acceptance, or release
- when AI coding agents need a revision-focused quality gate

## Core Operating Principles

1. Be rigorous and explicit.
2. Do not give shallow "looks good" feedback.
3. Evaluate against approved upstream artifacts and the real project context.
4. Distinguish:
   - defect
   - omission
   - inconsistency
   - risk
   - recommendation
5. Prioritize findings by severity.
6. For each meaningful finding, explain:
   - what is wrong
   - why it matters
   - what to change
7. Reject generic QA outputs.
8. Ask questions only when the missing information prevents a meaningful verdict.
9. Otherwise proceed with a bounded verdict and clear uncertainty.

## Required Evaluation Dimensions

### 1. Alignment
Check alignment between:
- UI Foundation
- UI Generation
- Frontend Implementation
- actual frontend code if available

### 2. Usability
Evaluate:
- clarity
- cognitive load
- task completion support
- priority hierarchy
- discoverability
- workflow efficiency
- error recovery
- trust and control

### 3. Accessibility
Evaluate:
- semantic structure
- keyboard support
- focus management
- labels and accessible names
- status communication
- form validation treatment
- modal or drawer accessibility
- table accessibility
- reduced-motion considerations
- WCAG 2.2 AA alignment where relevant

### 4. Responsive behavior
Evaluate:
- breakpoint handling
- preserved functionality on smaller screens
- action priority handling
- density adaptation
- table and filter adaptation
- overflow behavior
- content priority

### 5. State completeness
Evaluate:
- loading states
- empty states
- filtered-empty states
- validation errors
- system errors
- no-access states
- partial degradation states
- success feedback states

### 6. Component and consistency quality
Evaluate:
- reuse quality
- naming consistency
- visual and interaction consistency
- pattern drift
- design-system misuse
- unnecessary custom components

### 7. Implementation readiness or code quality
If reviewing implementation guidance or actual code, evaluate:
- file and component boundary clarity
- state ownership clarity
- integration clarity
- permissions handling
- testing coverage expectations
- maintainability risks

### 8. Project specificity
Check whether the reviewed outputs are genuinely tailored to the project.

## Mandatory Deliverables

The skill must produce all of the following sections:

1. QA summary
2. Review mode and evidence used
3. Overall verdict
4. Severity-based findings list
5. Detailed findings by category
6. Accessibility findings
7. Responsive findings
8. State-coverage findings
9. Alignment findings
10. Implementation or code findings
11. Required revisions
12. Suggested retest plan
13. Self-audit and QA rubric
14. Final pass or fail decision

## Required Output Structure

### A. QA summary
Summarize:
- what was reviewed
- what evidence was used
- major outcome

### B. Review mode and evidence used
State:
- review mode or modes
- artifacts reviewed
- what could not be reviewed fully

### C. Overall verdict
Choose one:
- Pass
- Pass with conditions
- Fail

And one operational verdict:
- Ready for next stage
- Ready after minor revisions
- Needs substantial revision
- Blocked by missing inputs

### D. Severity-based findings list
Group findings by:
- Critical
- High
- Medium
- Low

### E. Detailed findings by category
For each finding, include:
- id
- category
- severity
- location or section
- finding
- why it matters
- required change
- retest focus

### F. Accessibility findings
Summarize the accessibility-specific issues and required fixes.

### G. Responsive findings
Summarize the responsive-specific issues and required fixes.

### H. State-coverage findings
Summarize missing or weak UI states.

### I. Alignment findings
Summarize mismatches between strategy, specs, implementation guidance, and code if present.

### J. Implementation or code findings
Summarize maintainability, clarity, and implementation-quality concerns.

### K. Required revisions
List the minimum changes required to reach pass.

### L. Suggested retest plan
List what should be retested after revision.

### M. Self-audit and QA rubric
Run a QA rubric on the review quality itself.

### N. Final pass or fail decision
State final decision clearly.

## Rejection Triggers

Reject the reviewed work if any of the following is true:
- major mismatch between strategy and screen specs
- major mismatch between screen specs and implementation guidance
- major mismatch between implementation guidance and code
- accessibility treatment is clearly inadequate
- responsive behavior is clearly inadequate
- important UI states are missing
- workflow-critical usability is weak
- permissions or role behavior is ignored where relevant
- reviewed output is generic and not project-specific
- critical defects lack concrete revision guidance

## QA Rubric For This Skill

Score each area from 1 to 5:
1. evidence quality
2. alignment analysis quality
3. usability analysis quality
4. accessibility analysis quality
5. responsive analysis quality
6. state coverage analysis quality
7. implementation analysis quality
8. severity prioritization quality
9. revision guidance usefulness
10. project specificity

Thresholds:
- any score below 3 = fail
- average below 4.0 = fail
- pass requires concrete, actionable findings

## Revision Loop

If the reviewed work fails:
1. identify the minimum required fixes
2. recommend exact revisions
3. specify retest scope
4. rerun QA after revision if requested

## AI Coding Agent Orientation

The output must help an AI coding agent or engineer fix the problems quickly.

That means:
- findings must be concrete
- severity must be explicit
- revision actions must be specific
- retest scope must be clear

Do not produce vague critique without correction guidance.

## Suggested Companion Skills

This skill should follow:
- ui-foundation
- ui-generation
- frontend-implementation

This skill should feed:
- code-review
- bug-fix
- acceptance-validation