---
name: ui-foundation
description: Establishes the user interface foundation for a project by analyzing the repo, architecture, domain, user mentality, workflows, and technical context, then producing a rigorous, self-audited UI foundation specification with QA gates and execution-readiness guidance for AI coding agents and product teams.
version: 1.0.0
owner: project-team
intended_audience:
  - AI coding agents
  - product managers
  - architects
  - frontend engineers
  - designers
stage:
  - after architecture is defined
  - before frontend coding
  - on demand for new features or modules
tags:
  - ui
  - ux
  - design-system
  - information-architecture
  - enterprise
  - web-app
  - ai-agent
---

# UI Foundation Skill

## Purpose

This skill defines the user interface foundation for a project in a way that is reusable, rigorous, implementation-aware, and suitable for repeated use across multiple projects.

It must:
- understand the current project context from the repository and project artifacts
- understand the application domain, industry context, user mentality, workflows, and operational environment
- define a clear, modern, practical user interface direction
- produce outputs that humans and AI coding agents can act on directly
- self-audit its work
- run a QA process and revise until it passes
- identify execution-readiness gaps for downstream implementation

This skill is a foundation skill and should be used before UI generation, frontend implementation, and detailed backlog/task generation for user-facing features.

## When to Use

Use this skill:
- after solution architecture is defined and before frontend coding begins
- when a new feature, module, workflow, or major UI surface is introduced
- when the project needs a fresh UI foundation aligned to architecture and domain needs
- when an AI coding agent needs implementation-ready UI direction
- when the project lacks a consistent user experience strategy

Do not use this skill as a substitute for visual mockup generation, component coding, or branding execution. It is the UI foundation and decision-making skill that prepares those later steps.

## Core Operating Principles

1. Be conservative with missing inputs.
2. Ask questions only when ambiguity would materially change the UI outcome.
3. While investigating, identify missing inputs and recommend options to the architect.
4. Auto-discover everything available in the repository and related project artifacts.
5. Use explicit assumptions when proceeding without full context.
6. Optimize for:
   - simple user experience
   - enterprise trust
   - low cognitive load
   - scalability
   - accessibility
   - AI-agent friendliness
7. Remain framework-aware but do not become framework-locked unless the repo clearly points to a stack.
8. Recommend one stack when the repo already suggests it.
9. If the repo does not provide enough business context, produce a partial UI foundation, a missing-inputs section, and recommended artifacts needed from the architect.
10. Do not benchmark named competitor products unless the project specifically requests that elsewhere. Focus on patterns, conventions, user expectations, and domain realities instead.

## Inputs to Discover and Analyze

Auto-discover and evaluate all relevant information available in the repository and project context, including but not limited to:

### Repository and technical context
- README files
- package manifests
- lock files
- tsconfig, jsconfig, vite, webpack, next, angular, vue, tailwind, eslint, prettier, storybook, testing, and build configs
- frontend folder structure
- backend folder structure where relevant to UI
- API contracts
- OpenAPI specs
- GraphQL schemas
- environment examples
- CI/CD definitions
- infrastructure notes
- architecture documents
- ADRs
- feature flags
- routing structure
- state management patterns
- authentication and authorization notes
- localization or multilingual setup
- design token or theme files
- existing components
- existing pages
- tests that indicate expected UI behavior

### Product and delivery context
- backlog and user stories
- acceptance criteria
- feature specs
- BRDs
- sprint artifacts if present
- planning documents
- release notes
- issue tracker references if present in repo docs
- module notes
- support notes
- user-facing help docs

### Domain and business context
- domain terminology
- industry cues
- user types
- workflows
- operational risk areas
- trust-sensitive actions
- approval flows
- exception handling needs
- data density expectations
- reporting requirements
- auditability requirements
- compliance or regulated-industry implications if suggested by context

## Required Clarification Behavior

Ask clarifying questions only if the ambiguity would materially alter:
- information architecture
- navigation model
- primary workflows
- user persona assumptions
- compliance posture
- device strategy
- implementation constraints
- design system direction

When asking, provide recommended options to the architect, not open-ended vague questions.

If enough evidence exists to proceed, proceed and clearly mark:
- evidence-based conclusions
- assumptions
- confidence level
- missing inputs
- architect decisions still needed

## Required Analysis Dimensions

The skill must analyze and document the following.

### 1. Project understanding
- what the product or module does
- who it serves
- what the architecture implies for the UI
- what technical constraints shape the frontend
- what implementation path is most likely from the repo

### 2. Domain understanding
- application domain
- industry characteristics
- operational constraints
- user expectations in this domain
- terminology and mental models that should appear in the UI
- trust, accuracy, speed, and exception handling expectations

### 3. User mentality
Define detailed user mentalities and personas, separating evidence-based findings from assumptions.

For each primary user type, describe:
- role
- goals
- urgency level
- domain knowledge
- attention patterns
- risk tolerance
- trust needs
- error sensitivity
- multitasking level
- device context
- what they fear
- what they need to feel in control
- what kind of interface helps or hurts them

### 4. Workflow and task model
- top workflows
- critical decisions
- recurring tasks
- approvals
- exceptions
- data lookup patterns
- data entry patterns
- status tracking needs
- escalation points
- audit/history expectations

### 5. UX direction
Produce:
- one primary direction
- one fallback modern direction

The primary direction should optimize for simplicity, trust, and scalability.
The fallback should be a more modern option that still remains practical for enterprise use.

### 6. Information architecture
Define:
- top-level IA
- content groupings
- screen inventory
- module boundaries
- navigation hierarchy
- cross-navigation rules
- discoverability rules
- search expectations
- deep-linking expectations

### 7. Interaction patterns
Define expected rules for:
- forms
- tables
- dashboards
- filters
- faceted search
- search result ranking expectations
- workflows
- approvals
- comments or collaboration if relevant
- activity/history
- status indicators
- progress states
- alerts
- confirmations
- destructive actions
- bulk actions
- empty states
- error states
- loading states
- no-access states
- offline or degraded states if relevant

### 8. Information density guidance
Define guidance by:
- user type
- task type
- device size

Specify where the UI should be:
- sparse and calming
- moderate density
- high density
- expert-compact

### 9. Responsive behavior
Define:
- breakpoint strategy
- how navigation changes by breakpoint
- how key components adapt by breakpoint
- where content priority shifts on smaller screens
- what should never be hidden
- what can collapse safely

### 10. Accessibility
Target WCAG 2.2 AA by default.

Define:
- keyboard navigation expectations
- focus management
- semantic structure
- screen reader considerations
- contrast expectations
- motion reduction expectations
- form accessibility
- table accessibility
- error messaging accessibility
- responsive accessibility concerns

### 11. Visual system and design-library awareness
Be aware of modern design ecosystems, including:
- React ecosystem
- Next.js ecosystem
- Vue ecosystem
- Angular ecosystem
- Tailwind
- shadcn/ui
- Radix
- Material UI
- Ant Design
- Chakra UI
- major charting libraries
- major table/grid libraries
- form libraries
- accessibility-focused component systems
- icon systems
- motion/animation libraries

Recommend one stack only when:
- the repo already suggests it
- architecture strongly implies it
- implementation practicality clearly supports it

Otherwise remain stack-aware and describe the characteristics the chosen UI layer should satisfy.

### 12. Branding behavior
If branding is absent:
- produce a neutral enterprise visual baseline
- avoid inventing a heavy brand system
- define tone, density, spacing, hierarchy, and interaction feel in neutral terms

If branding exists:
- align with it without letting branding weaken usability or clarity

### 13. Governance and consistency
Define:
- component reuse rules
- naming patterns
- consistency rules
- design debt warnings
- when to create versus reuse a component
- acceptable variation boundaries
- documentation expectations for new UI patterns

### 14. Anti-patterns
Provide a "do not do this" section with reasons and correction guidance.

Include anti-patterns such as:
- overcrowded dashboards with no priority hierarchy
- forms with unclear required fields
- tables without sort/filter affordances where needed
- destructive actions with weak confirmation
- inaccessible custom controls
- hidden status meaning
- overuse of modals
- poor empty states
- too many primary actions
- decorative motion that harms focus
- visual inconsistency across modules
- modern styling that reduces trust or legibility

### 15. Execution-readiness assessment
Assess whether the project is ready for AI coding agents to execute the UI.

Check whether the project has enough:
- screen inventory
- workflow clarity
- acceptance criteria
- component expectations
- interaction rules
- frontend architecture clarity
- data contract clarity
- dependency mapping
- test scenarios
- sprint planning or sequencing support

If not, produce a gap list and recommended next artifacts.

## Mandatory Deliverables

The skill must produce all of the following sections.

1. Executive summary
2. Project understanding summary
3. Domain and industry understanding
4. User mentality and personas
5. Workflow and task model
6. Primary UI direction
7. Fallback modern UI direction
8. UX principles
9. Information architecture
10. Navigation model
11. Screen inventory
12. Key screen summaries
13. Low-fidelity wireframe descriptions
14. Component/system recommendations
15. Visual and interaction guidance
16. Design token guidance at a high level
17. Accessibility requirements
18. Responsive behavior guidance
19. Data-heavy pattern guidance
20. Error/loading/empty/no-access state guidance
21. Governance and consistency rules
22. Anti-patterns
23. AI coding agent implementation guidance
24. Prompt seeds for a second UI generation skill
25. Execution-readiness gap analysis
26. Missing inputs and architect decisions
27. Self-audit report
28. QA rubric results
29. Revision notes
30. Final verdict

## Output Structure

Use the following output structure exactly.

### A. Executive summary
Provide a concise summary of:
- what was analyzed
- what was concluded
- what is still missing
- readiness level

### B. Project understanding
Summarize:
- product/module purpose
- likely technical context
- architectural implications for UI
- constraints and opportunities

### C. Domain and user analysis
Document:
- domain
- industry characteristics
- user types
- user mentality
- trust expectations
- operational risks
- evidence versus assumptions

### D. UX strategy
Document:
- primary UI direction
- fallback modern direction
- UX principles
- design posture
- information density strategy
- accessibility posture

### E. Information architecture and navigation
Document:
- IA
- navigation
- screen inventory
- relationships
- content grouping logic
- search/discoverability expectations

### F. Screen and interaction specification
For each major screen or screen type, provide:
- purpose
- primary users
- primary tasks
- key information
- actions
- state variations
- low-fidelity layout description
- responsive notes
- accessibility notes

### G. Component and design-system guidance
Document:
- recommended component categories
- what should be standardized
- what should remain flexible
- design token guidance
- reuse and governance rules

### H. AI coding agent guidance
Document:
- implementation sequencing
- frontend implementation assumptions
- component breakdown
- dependency notes
- what should be built first
- acceptance guidance
- test and QA hooks
- prompts for a second UI generation skill

### I. Execution readiness
Document:
- readiness gaps
- missing artifacts
- architect decisions needed
- recommended next steps
- whether sprint documentation or planning artifacts are still needed for agent execution

### J. Self-audit
Run a self-audit against all mandatory outputs and rejection triggers.

### K. QA rubric
Score the output and determine pass/fail thresholds.

### L. Revision loop
If QA fails, revise and rerun QA until passing.

### M. Final verdict
Provide both:
- executive verdict
- operational verdict

## Required QA Process

This skill must not consider its work acceptable until it passes QA.

### Rejection triggers
Reject the output if any of the following is true:
- missing domain understanding
- weak mapping to user needs
- inconsistent navigation or IA
- poor accessibility coverage
- unrealistic component or library choices
- no evidence of alignment to repo architecture
- weak or vague workflow understanding
- vague screen definitions
- missing execution-readiness assessment
- no clear assumptions or missing-input handling
- poor AI-agent usefulness
- output is too generic to guide implementation

### QA rubric
Use a scored rubric with pass/fail thresholds and mandatory revision notes.

Score each area from 1 to 5:
1. project understanding
2. domain understanding
3. user mentality fidelity
4. workflow coverage
5. UI direction quality
6. IA and navigation quality
7. screen definition quality
8. component/system practicality
9. accessibility coverage
10. responsive behavior quality
11. governance quality
12. anti-pattern usefulness
13. AI-agent execution usefulness
14. execution-readiness analysis
15. clarity and actionability

Suggested thresholds:
- any score below 3 = automatic fail
- average below 4.0 = fail
- pass requires no critical omissions

### Revision loop
If failed:
1. identify exact weaknesses
2. revise the relevant sections
3. rerun QA
4. repeat until pass

## AI Coding Agent Orientation

Write for a mixed audience, but make AI coding agents the most operationally enabled reader.
The product manager is the primary human reader after the AI coding agent.

Therefore the output must be:
- explicit
- structured
- implementation-aware
- testable
- not reliant on vague aesthetic language
- useful for backlog refinement and downstream UI generation

## Required Final Verdict Format

Provide both:

### Executive verdict
Choose one:
- Pass
- Pass with conditions
- Fail

### Operational verdict
Choose one:
- Ready for UI generation
- Needs context
- Needs architecture refinement
- Needs delivery planning

Then list:
- top blockers
- top assumptions
- next best artifact to produce

## Default Behavioral Notes

- Prefer precision over trendiness.
- Prefer calm, trustworthy, clear interfaces over flashy interfaces.
- Prefer patterns that reduce cognitive load.
- Prefer scalable systems over one-off screens.
- Prefer accessible defaults.
- Prefer practical recommendations that AI agents can implement.
- Do not hide uncertainty. Label it.
- Do not invent unsupported business facts.
- Do not overfit to one framework unless the repo strongly suggests it.

## Suggested Companion Skills

This skill should feed:
- UI generation skill
- frontend implementation skill
- backlog refinement skill
- acceptance criteria skill
- component library skill
- QA/test scenario skill