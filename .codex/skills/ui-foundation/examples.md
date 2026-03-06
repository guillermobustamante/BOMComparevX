# UI Foundation Skill Examples

These examples show the expected level of specificity and structure. They are not meant to be copied literally.

## Example 1: Strong executive summary

A manufacturing operations web application was analyzed using the repository structure, architecture notes, API contracts, and user story set. The current stack signals indicate React, TypeScript, Tailwind, and a data-heavy workflow model centered on exception handling and status tracking.

The recommended primary UI direction is a calm, high-clarity enterprise workflow interface with moderate-to-high information density for expert users, supported by strong tables, detail panels, and exception-first navigation. The fallback direction is a more productized modern interface with stronger card hierarchy and more visually modular screens, while preserving operational trust.

The project is not fully ready for UI execution by an AI coding agent because role-specific acceptance criteria, responsive behavior rules for data-heavy screens, and a finalized screen inventory are still missing. A provisional UI foundation can proceed now, but implementation should wait until those gaps are documented.

## Example 2: Good persona section

### Persona: Operations Coordinator
- Role: high-volume internal operator
- Evidence basis: user stories reference recurring review, correction, and status progression tasks
- Primary goal: process work items quickly with minimal context switching
- Urgency level: high during peak intake periods
- Domain knowledge: medium to high
- Attention pattern: scan-first, detail-on-demand
- Trust need: wants visible status, clear ownership, and confidence that actions succeeded
- Error sensitivity: medium, but errors can create downstream rework
- Multitasking level: high
- Device context: primarily desktop, occasional laptop
- What they fear: losing place, repeating work, hidden errors, ambiguous item state
- What helps: dense but structured tables, strong filters, sticky context, obvious next actions
- What hurts: excessive modal flows, hidden metadata, weak validation feedback, too many visual distractions

## Example 3: Good screen definition

### Screen: Work Item List
- Purpose: allow users to scan, filter, prioritize, and open work items
- Primary users: operations coordinators, supervisors
- Primary tasks:
  - find assigned or unassigned items
  - filter by status, priority, date, and owner
  - sort by urgency or recency
  - open an item detail view
  - perform limited safe bulk actions
- Key information:
  - item identifier
  - status
  - priority
  - due date
  - owner
  - exception indicator
  - last updated timestamp
- Key actions:
  - open item
  - apply filters
  - save view
  - bulk assign
  - export if permitted
- State variations:
  - default populated state
  - filtered empty state
  - no access state
  - loading state
  - partial system degradation state
- Low-fidelity layout description:
  - page header with title, saved view selector, primary action, and secondary overflow
  - collapsible left filter rail on desktop, drawer on tablet and mobile
  - main content area with results summary row above data table
  - table supports row selection, sortable columns, sticky header, and inline status indicators
  - detail preview panel optional on large desktop only
- Responsive notes:
  - on smaller screens, filter rail becomes drawer
  - lower-priority columns move behind row expansion
  - bulk actions appear only after selection
- Accessibility notes:
  - full keyboard support for filter controls and row actions
  - visible focus states
  - non-color status indicators
  - sortable columns announced properly to assistive tech

## Example 4: Good QA verdict

### QA rubric summary
- Project understanding: 4
- Domain understanding: 4
- User mentality fidelity: 4
- Workflow coverage: 5
- UI direction quality: 4
- IA and navigation quality: 4
- Screen definition quality: 4
- Component practicality: 4
- Accessibility coverage: 4
- Responsive behavior quality: 3
- Governance quality: 4
- Anti-pattern usefulness: 4
- AI-agent execution usefulness: 5
- Execution-readiness analysis: 5
- Clarity and actionability: 4

Average score: 4.1

Pass status: Pass with conditions

Revision required before clean pass:
- strengthen mobile behavior guidance for dense data tables
- define responsive rules for side panels versus stacked content
- clarify permission-based action visibility on review screens