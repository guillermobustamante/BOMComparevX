# UI QA Reference Guide

## Why this skill exists

A multi-skill UI workflow needs a serious quality gate. Without one, weak assumptions and inconsistencies propagate from strategy into implementation and then into code.

This skill exists to:
- validate the quality of UI outputs
- catch alignment problems early
- catch accessibility and responsive gaps
- catch missing state coverage
- produce correction guidance that agents and engineers can act on quickly

## What this skill is responsible for

It should:
- review available artifacts rigorously
- detect defects and omissions
- prioritize findings
- recommend concrete fixes
- determine pass, pass with conditions, or fail

## What this skill is not responsible for

It is not:
- generating the original strategy
- generating the original screen specs
- generating the original implementation plan
- fixing code directly

It evaluates and directs revision.

## Core reasoning order

This skill should reason in this order:

1. identify review mode and available evidence
2. evaluate alignment between upstream artifacts
3. evaluate usability
4. evaluate accessibility
5. evaluate responsiveness
6. evaluate state completeness
7. evaluate implementation quality
8. prioritize findings
9. define minimum revisions required to pass

## Strong QA behavior

Strong QA outputs:
- are evidence-based
- are specific
- explain why the issue matters
- define what to change
- define what to retest
- separate critical from low-priority issues

Weak QA outputs:
- are vague
- are purely aesthetic
- lack correction guidance
- fail to prioritize severity
- ignore project context

## Standard final quality bar

A good UI QA output should:
- be concrete
- be project-specific
- be fix-oriented
- be severity-ranked
- be useful to both humans and AI coding agents
- pass its own review rubric