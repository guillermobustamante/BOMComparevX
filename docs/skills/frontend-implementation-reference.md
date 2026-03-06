# Frontend Implementation Reference Guide

## Why this skill exists

UI strategy and screen specs still do not tell a coding agent exactly how to build the frontend in the current repository. This skill bridges that gap.

It exists to convert approved UX work into:
- repo-aware implementation structure
- file and component boundaries
- state and data flow guidance
- testing expectations
- implementation slices and prompts

## What this skill is responsible for

It should:
- read the repo as it really is
- preserve approved UX intent
- define practical implementation boundaries
- support incremental delivery
- support AI-agent execution without guesswork

## What this skill is not responsible for

It is not:
- redefining UI strategy
- replacing architecture
- inventing a new stack
- writing all production code itself
- bypassing QA

## Core reasoning order

This skill should reason in this order:

1. confirm approved upstream inputs exist
2. inspect the actual repo and stack
3. identify implementation boundaries
4. decompose work into slices
5. map screens to components
6. define data and state flow
7. define tests
8. define implementation prompts and sequence

## Good implementation guidance

Good implementation guidance should answer:
- where code goes
- what each component owns
- what state lives where
- how data gets in and out
- what should be reused
- what tests prove it works
- what order to build it in

## Typical implementation slices

Most UI projects break cleanly into:
- app shell
- shared primitives
- feature primitives
- first screen
- detail or edit screen
- advanced interactions
- state and integration hardening
- test hardening

## Quality bar

The output is only good if:
- it fits the real repo
- it supports actual coding
- it reduces ambiguity
- it is not generic
- it is testable
- it passes its QA rubric