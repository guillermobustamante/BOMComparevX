# UI Generation Reference Guide

## Why this skill exists

A UI foundation is necessary, but it is not enough for implementation. Teams and coding agents still need screen-level clarity.

This skill exists to convert the approved UI foundation into:
- screen definitions
- layout structures
- component hierarchies
- state models
- implementation guidance

## What this skill is responsible for

It is responsible for translating strategy into implementable screen guidance.

It should:
- preserve alignment to the UI foundation
- generate concrete screen and component specs
- define states and interactions
- make responsive and accessibility behavior explicit
- support direct implementation by AI coding agents

## What this skill is not responsible for

It is not:
- creating a new UI strategy
- bypassing architecture
- inventing unrelated new patterns
- generating final visual comps by itself
- writing final production code

## Core reasoning order

This skill should reason in this order:

1. confirm UI foundation sufficiency
2. identify screens and workflow priority
3. define page shell and shared patterns
4. define each screen layout
5. define components
6. define states
7. define accessibility behavior
8. define responsive behavior
9. define dependencies
10. define implementation prompts and sequence

## Screen quality bar

A strong screen spec should answer:
- why the screen exists
- who uses it
- where it sits in the workflow
- what information is most important
- what actions matter
- which states must be implemented
- what changes by breakpoint
- what accessibility behaviors are required
- what backend or state dependencies exist
- what an AI coding agent should build first

## Shared shell guidance

Most apps should standardize:
- app shell
- top nav or side nav patterns
- page headers
- primary versus secondary action placement
- feedback components
- empty or error state patterns
- status presentation

This skill should identify what is shared versus screen-specific.

## State modeling guidance

Every generated screen should specify the relevant states.

Common states:
- initial loading
- populated
- empty
- filtered empty
- validation error
- server error
- permission-limited
- no access
- partial degradation
- success confirmation

Do not leave states implicit.

## Accessibility guidance

Accessibility must be screen-specific, not just generic.

Examples:
- tables need sort announcements and keyboard row action access
- forms need validation messaging tied to fields
- drawers and modals need proper focus trapping and return focus behavior
- status badges need non-color semantics
- dynamic updates may require announcements

## Responsive guidance

Responsive behavior should define structural changes, not just stack direction.

Examples:
- filter rail becomes drawer
- detail preview panel disappears below large desktop
- bulk action placement changes after row selection
- low-priority table columns move behind row expansion
- action menus collapse into overflow

## AI-agent guidance

A good output should let an AI coding agent:
- create the right components
- split shared versus local components
- know the required states
- understand the data dependencies
- implement accessible and responsive behavior
- test key interactions

## Standard final quality bar

The output should be considered good only if:
- it is clearly anchored in the UI foundation
- it is screen-specific
- it is implementation-friendly
- it covers states, accessibility, and responsiveness
- it is useful to an AI coding agent
- it passes its own QA rubric