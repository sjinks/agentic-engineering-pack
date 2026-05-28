# Shared Output Format Contract

This document defines reusable output fields shared across workflow reports.

## Core Shared Fields

- Handoff log/status
  - Which delegated skills or agents were invoked and whether each returned output, failed, or blocked.
- Verification
  - Evidence from checks or tests run, including incomplete or skipped verification with rationale.
- Blockers
  - Any condition currently preventing safe completion.
- Residual risks
  - Known limitations, deferred work, and edge cases not fully covered.
- Follow-up
  - Next actions needed from operator or workflow.

## Decision and Gate Fields

- Gate decision
  - Use canonical values where applicable: `pass`, `fail`, or `BLOCK`.
- Validation status
  - For workflows with explicit validation stages, include per-stage outcomes and rationale.

## Mutation-Readiness Fields

- Commit/push status
  - Whether local changes are committed, pushed, and visible where required.
- Readiness summary
  - Clear statement whether workflow output is ready for the next stage.

## Usage Guidance

- Workflow-specific skill files should include only fields unique to that workflow.
- Shared fields should be referenced from this contract to reduce duplication.
- If a shared field is intentionally omitted, include a short reason in the workflow file.
