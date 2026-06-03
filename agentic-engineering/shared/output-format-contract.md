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

## Workflow Status Packages

### Readiness Decision

Use this package when a workflow reports final readiness.

- Readiness decision
  - Use one of: `blocked`, `partial`, `ready`, or `not ready`.
  - Use `ready` only when required specialist outputs, verification/check evidence, review/arbitration evidence, gatekeeper evidence, thread-state freshness, PR/template evidence when applicable, and explicit not-applicable rationales for skipped gates are complete.
  - Use `partial` when named portions are complete but blocked portions remain.
  - Use `not ready` when work ran but evidence or required checks are incomplete.
  - Use `blocked` when a gate, missing input, unavailable specialist, unknown thread state, scope amendment, or BLOCK sentinel prevents progress.
- Result summary
  - Summarize what was completed and what remains.
- Files changed or reviewed
  - Name changed, reviewed, or intentionally untouched files when relevant.
- Verification performed
  - Summarize checks, test evidence, skipped checks, and reasons.

### Requirements and Design Status

Use this package whenever spec-first or architecture-first gates were evaluated.

- Spec status
  - Use one of: `present (spec-agent ran; summary: <one-line>)`, `provided by operator (in-session paste)`, `provided by operator (<source>); distilled by spec-agent`, or `skipped (reason: <rationale per Spec-skip carve-out>)`.
- Spec readiness
  - Use one of: `blocked`, `partial`, `ready`, or `skipped/not applicable`; name blocked portions for `partial` or `blocked`.
  - `skipped/not applicable` is valid only when `Spec status` is skipped with rationale.
- Architecture status
  - Use one of: `present (architect-agent ran; summary: <one-line>)`, `provided by operator (in-session paste)`, `provided by operator (<source>); distilled by architect-agent`, or `skipped (reason: <rationale per Architecture-skip carve-out>)`.
- Design contract status
  - Use one of: `complete`, `incomplete`, `missing`, or `skipped`, plus any `Scope amendments requested`.
  - If scope amendments are present, report blocked until spec-agent or the operator confirms the amendment.

### Context and Handoff Status

Use this package when a workflow delegates or consumes contextual findings.

- Handoff log/status
  - Name each delegated skill or agent, whether the visible handoff log was emitted, whether real invocation completed, failed, or blocked, and what evidence came back.
- Research findings used
  - Include public research findings only when they affected spec, architecture, implementation, tests, or review.
- Environment findings used
  - Include local tooling, package, dependency, command, or git-state findings only when they affected downstream decisions.
- Vault findings used
  - Include distilled vault provenance and read/not-read boundaries only when vault context affected downstream decisions.
- Manual workspace-preparation status
  - Include whether an external project stop condition fired, which workspace folder was confirmed, or why work remained blocked.

## Decision and Gate Fields

- Gate decision
  - Use canonical values where applicable: `pass`, `fail`, or `BLOCK`.
- Validation status
  - For workflows with explicit validation stages, include per-stage outcomes and rationale.

## Reusable Evidence Packages

### Broad Safe Validation Gate Evidence

Use this package when a workflow reports the `Broad Safe Validation Gate`.

- targeted verification status
  - State whether targeted verification passed, failed, was blocked, was skipped, or was not applicable, and include the evidence or rationale.
- broad safe validation status
  - Use one of: `passed`, `failed`, `blocked`, `skipped`, `not applicable`, or `mutating-only`.
- repository-local discovery evidence
  - Name the checked-in docs, scripts, task definitions, tool configuration, or prior local inspection used for discovery.
- candidate command(s) inspected
  - Name the candidate command(s) inspected from repository-local evidence, or state that no candidate was found.
- selected command or unavailable-command conclusion
  - Name the selected broad safe validation command, or explain why no command was selectable under the workflow boundaries.
- command classification basis
  - Explain the behavior-based classification, including whether the command is local-only, approval-bound, forbidden, unavailable, skipped, not applicable, or mutating-only.
- dirty-state boundary result when executed
  - When a command ran, report the before/after dirty-state or output boundary; when it did not run, state why.
- freshness evidence for the final candidate worktree/fix batch
  - State whether evidence is fresh for the final candidate worktree/fix batch, stale, or unknown, and identify any later edit that changed freshness.
- proceed/block effect
  - State whether the gate permits the next workflow action or blocks it.
- residual risk
  - Record accepted or remaining risk, especially for `skipped`, `not applicable`, or `mutating-only` outcomes.
- next operator action
  - Name the next operator or workflow action needed.

### Pre-push Adversarial Review Status

Use this package when a workflow reports `Pre-push adversarial review status`.

- Execution status
  - Use one of: `completed`, `skipped`, `blocked`, or `not applicable`.
- Verdict
  - Use one of: `BLOCK`, `CONCERNS`, `CLEAN`, `defer to prior adversarial review`, or `Verdict: not produced (execution status: <execution-status>)` when no adversary verdict exists.
- Trigger basis
  - Use one of: `first-round non-trivial`, `Round-N >= 2`, `synthesis non-trivial`, `operator-requested`, `New Shared Module invoke`, or `not applicable`.
- Round-N count
  - Use an integer greater than or equal to 1, `not applicable`, or `unknown` with the Round-N metadata sentinel.
- Round-count source
  - Name the read source and returned count, or state `not applicable` before PR metadata exists.
- Diff baseline
  - Name the baseline used for review, such as cumulative branch diff vs integration branch.
- Matched non-trivial class(es)
  - List the risk-shape classes that made the diff non-trivial, or state none.
- Skip considered
  - Use `yes` or `no`.
- Skip rejected evidence
  - State why non-trivial review won, or `None`.
- Skip accepted evidence
  - State the valid trivial skip class or rationale, or `None`.
- Blocking findings count
  - Use a non-negative integer.
- Dedup applied against
  - Name the prior finding sources or state none/not applicable.
- Equiv-audit fired
  - Use a boolean; when true, name the matched surfaces and any recorded operator override rationale.

### PR Template and Body Status

- PR template status
  - Use one of: `exactly-one-template-used`, `multiple-templates-user-selection-required`, `multiple-templates-selected-by-convention`, `blocked-on-template-choice`, `selected-template-unreadable-choice-required`, `no-template-fallback-used`, or `unreadable-template-fallback-used`.
- Selected template path
  - Name the selected readable template path, the convention-selected template path, the user-selected unreadable template path, or `not applicable` when fallback/no-template behavior applies.
- Fallback reason
  - State why fallback was used or is being requested, such as no template found, every candidate unreadable, selected unreadable template with confirmed fallback, or `not applicable` when a template was selected.
- Unreadable path/error summary
  - List unreadable candidate template path(s) with sanitized read-error summaries when they affected template selection, fallback, or blocker status; use `None` when no unreadable candidate affected the decision.
- Readable alternatives
  - List readable candidate template paths when multiple readable templates require a choice or when a selected unreadable template has readable alternatives; use `None` when no readable alternatives are relevant.
- User-choice blocker
  - State the unresolved user choice that blocks PR creation, PR-ready body publication, or final PR body emission, such as choosing among readable templates, choosing a readable alternative, or confirming fallback use; use `None` when no user choice is blocking.
- PR Body Audit Gate status
  - Use one of: `pass`, `repaired`, `blocked`, or `not applicable`.

### Test-Gap Plan Status

Use this package when review findings, fix cycles, or test-agent handoffs need planner status.

- Test-gap plan status
  - Use one of: `present (test-gap-to-test-plan ran; verdict: <PLAN-READY|PLAN-PARTIAL|BLOCK>)`, `provided by operator (<source>)`, or `skipped (reason: <one-line rationale>)`.
  - Include rationale and must-have cases when present.
  - Keep this separate from the gatekeeper skip sentinel `no fix cycle, gatekeeper skipped`.

### Review Closure and Thread-State Evidence

Use this package when a fix cycle, PR-review workflow, Linear workflow, or gatekeeper handoff is in scope.

- Gate decision
  - Report `pass`, `fail`, or `BLOCK` from `review-cycle-gatekeeper` when a fix cycle ran.
  - If no fix cycle ran, report the explicit sentinel `no fix cycle, gatekeeper skipped`.
- Gatekeeper thread-state evidence
  - Include fresh unresolved/reopened thread snapshot details, or `thread state: not applicable - no PR exists yet` plus proof.
  - Unknown thread state blocks readiness.
- Gatekeeper findings matrix
  - Include the gatekeeper findings matrix when the gatekeeper ran.

### Equivalence-Class Follow-ups

Use this package when reviewer-derived fixes or bug-class-prone surface audits were evaluated.

- Equivalence-class follow-ups
  - List items in the same class as a fixed finding that were intentionally not audited or not fixed in this round, with rationale.
  - Group deferred items by `scope: reviewer-finding-equivalence-class` and `scope: bug-class-prone-surface` when both audits fired in the same handoff.
  - Reference the tracked follow-up location for each deferred item.
- Equivalence-class audit counts
  - Report numeric `audited: N` and `deferred: M` counts from the implementer when the audit ran.

### Verified Internals and Non-Changes

Use this package when deliberate non-changes, library-internal evidence, or PR-body verified non-change sections were evaluated.

- Verified-internals notes captured this session
  - Include `/memories/repo/<topic>.md` paths when captured, or `verified-internals capture blocked: no approved memory/write capability` when capture was required but unavailable.
- Verified non-changes section status
  - Use one of: `present`, `not applicable`, or `blocked`, and include the PR Body Audit Gate result when a PR was created or prepared.

### BLOCK Sentinels and Advisory Artifacts

Use this package when a canonical sentinel, operator advisory prompt, or rationale validation path was evaluated.

- BLOCK sentinels fired this session
  - Include canonical strings and the evaluation step that produced each sentinel.
- Operator advisory artifacts
  - Include New Shared Module Prompt or equivalence-class audit override decisions, rationale status, rejected rationale status when applicable, and where the durable artifact was recorded.
- Rationale validation status
  - State whether the operator rationale passed, was repaired/re-prompted, or blocked artifact creation.

## Mutation-Readiness Fields

- Commit/push status
  - Whether local changes are committed, pushed, and visible where required.
- Remote-visible head branch status/provenance
  - Whether the intended remote owner/repo has the head branch with referenced commits reachable, plus the evidence source. Report separately from commit/push status and pushed-visible PR-diff visibility.
- Pushed-visible PR-diff visibility status/provenance
  - Requires PR head SHA/commit reachability and GitHub PR-diff evidence that the relevant commits are reflected in the PR. Report separately from remote-visible head branch and local push/ref evidence.
- Readiness summary
  - Clear statement whether workflow output is ready for the next stage.

## Usage Guidance

- Workflow-specific skill files should include only fields unique to that workflow.
- Shared fields should be referenced from this contract to reduce duplication.
- If a shared field is intentionally omitted, include a short reason in the workflow file.
