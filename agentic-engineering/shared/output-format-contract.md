# Shared Output Format Contract

This document defines reusable output fields shared across workflow reports. Workflow-specific skills should reference these packages instead of repeating the full field lists locally.

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

## Reusable Evidence Packages

### Broad Safe Validation Gate Evidence

Use this package when a workflow reports the `Broad Safe Validation Gate`.

- Targeted verification status
  - State whether targeted verification passed, failed, was blocked, was skipped, or was not applicable, and include the evidence or rationale.
- Broad safe validation status
  - Use one of: `passed`, `failed`, `blocked`, `skipped`, `not applicable`, or `mutating-only`.
- Candidate commands inspected
  - Name the candidate command(s) inspected from repository-local evidence, or state that no candidate was found.
- Selected or unavailable command conclusion
  - Name the selected broad safe validation command, or explain why no command was selectable under the workflow boundaries.
- Repository-local discovery evidence
  - Name the checked-in docs, scripts, task definitions, tool configuration, or prior local inspection used for discovery.
- Command classification basis
  - Explain the behavior-based classification, including whether the command is local-only, approval-bound, forbidden, unavailable, skipped, not applicable, or mutating-only.
- Dirty-state boundary
  - When a command ran, report the before/after dirty-state or output boundary; when it did not run, state why.
- Freshness for final candidate worktree/fix batch
  - State whether evidence is fresh for the final candidate worktree/fix batch, stale, or unknown, and identify any later edit that changed freshness.
- Proceed/block effect
  - State whether the gate permits the next workflow action or blocks it.
- Residual risk
  - Record accepted or remaining risk, especially for `skipped`, `not applicable`, or `mutating-only` outcomes.
- Next action
  - Name the next operator or workflow action needed.

### Pre-push Adversarial Review Status

Use this package when a workflow reports `Pre-push adversarial review status`.

- Execution status
  - Use one of: `completed`, `skipped`, `blocked`, or `not applicable`.
- Verdict
  - Use one of: `BLOCK`, `CONCERNS`, `CLEAN`, `defer to prior adversarial review`, or `Verdict: not produced (execution status: <execution-status>)` when no adversary verdict exists.
- Trigger basis
  - Name the trigger, such as first-round non-trivial, Round-N >= 2, operator-requested, security-sensitive, or not applicable.
- Diff baseline
  - Name the baseline used for review, such as cumulative branch diff vs integration branch.
- Matched non-trivial class(es)
  - List the risk-shape classes that made the diff non-trivial, or state none.
- Skip considered/rejected/accepted evidence
  - Report whether a skip was considered, why it was rejected, or why it was accepted.
- Blocking findings count
  - Use a non-negative integer.
- Dedup applied against
  - Name the prior finding sources or state none/not applicable.

### PR Template and Body Status

- PR template status
  - Use one of: `exactly-one-template-used`, `multiple-templates-user-selection-required`, `multiple-templates-selected-by-convention`, `blocked-on-template-choice`, `selected-template-unreadable-choice-required`, `no-template-fallback-used`, or `unreadable-template-fallback-used`.
- PR Body Audit Gate status
  - Use one of: `pass`, `repaired`, `blocked`, or `not applicable`.

## Mutation-Readiness Fields

- Commit/push status
  - Whether local changes are committed, pushed, and visible where required.
- Readiness summary
  - Clear statement whether workflow output is ready for the next stage.

## Usage Guidance

- Workflow-specific skill files should include only fields unique to that workflow.
- Shared fields should be referenced from this contract to reduce duplication.
- If a shared field is intentionally omitted, include a short reason in the workflow file.
