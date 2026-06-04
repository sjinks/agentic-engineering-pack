---
name: review-cycle-gatekeeper
description: "Use when: enforcing review-fix cycle quality gates, verifying review findings are closed, checking merge readiness, validating fix evidence after a review round, deciding go/no-go on merge, auditing unresolved or reopened review threads, confirming regressions introduced by fixes are tracked, and producing a final pre-merge gate decision."
argument-hint: "Findings list, fix summary, verification evidence, and unresolved discussion threads."
user-invocable: true
---

# Review Cycle Gatekeeper

Enforces closure quality across review rounds to prevent superficial thread closure and ensure merge readiness.

## When to Use

Use after a change has been reviewed and at least one fix cycle occurred.

Typical triggers: reviewer findings addressed in follow-up commits; unresolved/reopened threads; unclear merge readiness; final go/no-go decision needed.

### Not to Be Used For

- Per-comment validation during active fix round (belongs to `pr-review-comments-workflow` Review Comment Validation Gate).
- PR replies, thread resolution, pushes, or GitHub mutations. This skill produces decisions; remediation via `pr-review-comments-workflow`.
- Substituting for `integrator-agent` during dual-reviewer arbitration. Consumes reconciled findings; does not produce them.
- General code review of unreviewed changes. Run review specialists first; apply after at least one fix cycle.

## Integration with This Pack

- Read-only, decision-only. No file edits, commands, commits, pushes, replies, or thread resolution. Remediation via `pr-review-comments-workflow` and builder/test specialists.
- Test-evidence source: `test-gap-to-test-plan`. `PLAN-READY` with all `must-have` cases `Status: landed` satisfies test-evidence rule; `BLOCK`, `PLAN-PARTIAL`, or unlanded `must-have` fails it. Functional fixes require test evidence or explicit no-test rationale.
- GitHub context from `github-context-agent` via orchestrator per `workflow-safety-gates`. Consumes distilled findings, fix evidence, visibility status.
- Anchors to `workflow-safety-gates`: "Pushed-visible" and "Remote-visible head branch" per Glossary; PR review visibility/thread rules; PR Readiness Evidence Gate.
- Severity vocabulary: title-case `Critical`/`High`/`Medium`/`Low` maps to canonical `CRITICAL`/`HIGH`/`MEDIUM`/`LOW`. Finding states: `fixed`/`owned-with-remediation-plan`/`waived-with-rationale`/`open`.
- Conflicts with `pr-review-comments-workflow`: choose conservative path. Gate outputs operator-facing; not reviewer-facing.

## Required Inputs

- Findings list with severity and current status.
- Fix summary or commit list tied to findings.
- Verification evidence after fixes, separated into targeted verification and Broad Safe Validation Gate evidence when PR-review fixes are in scope. broad evidence must include broad safe validation status (`passed`/`failed`/`blocked`/`skipped`/`not applicable`/`mutating-only`), repository-local discovery evidence, candidate command(s) inspected, selected command or unavailable-command conclusion, command classification basis, dirty-state boundary result when executed, freshness evidence for the final candidate worktree/fix batch, proceed/block effect, residual risk, and next operator action. If contextual/independent review, builder/test follow-up, formatting, generated-output handling, or any other fix step changed the worktree after broad validation evidence was produced, that evidence is stale until rerun or explicitly re-established for the final changed surface. stale or unknown freshness makes the gatekeeper emit `BLOCK`.
- Review visibility mode, exactly one of:
  - Existing PR: `Pushed-visible` PR-diff evidence per `workflow-safety-gates` Glossary, PR head SHA, and unresolved/reopened thread list (empty valid, unknown not). Thread state must be read after the PR head SHA reaches the current value, and the PR head SHA at the time of the thread read must match the PR head SHA at gatekeeper invocation. A mismatch means the snapshot is stale and input is invalid; produce `BLOCK`. Unknown thread state or stale snapshots → `BLOCK`.
  - Pre-PR/no PR: `Remote-visible head branch` evidence per `workflow-safety-gates` Glossary, the remote-visible head commit or explicit referenced commit set, and explicit no-PR proof with `thread state: not applicable - no PR exists yet` (for example no PR number, no linked PR, and PR creation has not yet run). Missing, stale, local-only, ambiguous, or collapsed no-PR proof → `BLOCK`.
- Fixed-finding visibility mapping: in Existing PR mode, each `fixed` finding's fix commit MUST be reachable from the PR head SHA reflected in the PR diff. In Pre-PR/no PR mode, each `fixed` finding's fix commit MUST be reachable from the remote-visible head commit or contained in the explicit referenced commit set for the remote-visible head branch. Unknown reachability → `BLOCK`.

## Severity Vocabulary

- `Critical`: exploitable now, no compensating control; severe impact. Maps to canonical `CRITICAL`.
- `High`: incorrect behavior, security/privacy/data-integrity risk, crash, production-impacting fault.
- `Medium`: likely regression, contract mismatch, weak error handling, meaningful operational risk.
- `Low`: maintainability/clarity issue, limited near-term risk. Advisory only.

Mapping: title-case `Critical`/`High`/`Medium`/`Low` in findings matrix correspond exactly to canonical `CRITICAL`/`HIGH`/`MEDIUM`/`LOW` per `workflow-safety-gates` "Severity Vocabulary". `Critical` preserved distinctly from `High` for downstream gates. `Critical` findings require `fixed` or full `CRITICAL` waiver evidence (security-owner sign-off, sunset date, tracking-issue link, "accepted residual risk" sentence). `owned-with-remediation-plan` invalid for `Critical`.

## Finding States

- `fixed`: defect no longer present, verified.
- `owned-with-remediation-plan`: defect remains, named owner, concrete plan.
- `waived-with-rationale`: defect remains, will not be fixed, explicit risk acceptance.
- `open`: defect remains, not fixed/owned/waived.

### Required Evidence Per State

| State | Required artifacts |
|---|---|
| `fixed` | Linked fix commit/PR change, plus verification evidence or explicit no-test rationale. |
| `owned-with-remediation-plan` | All fields under Ownership Rules. |
| `waived-with-rationale` | Base fields under Waiver Rules; `High` findings require `High`-only fields; `Critical` findings require `Critical`-only fields. |
| `open` | None, blocks per Gate Rules. |

### Reopened Findings

Reopened `fixed` findings return to `open`. Prior verification evidence invalidated.

## Gate Rules

1. Every `Critical` finding must be `fixed` or `waived-with-rationale` with `Critical`-only waiver fields. `owned-with-remediation-plan` invalid for `Critical`. Unaddressed `Critical` fails gate.
2. Every `High` finding must be `fixed` or `waived-with-rationale` with `High`-only waiver fields (compensating control or owner-accepted tradeoff). Invalid waiver fails gate.
3. Every `Medium` finding must be `fixed`, `owned-with-remediation-plan`, or `waived-with-rationale`.
4. Every `Low` finding tracked in one of four states. Never blocks merge.
5. Every functional fix requires test evidence or explicit no-test rationale. Functional fix: alters runtime behavior, public contract, persisted state, or security posture.
6. PR-review fix cycles require Broad Safe Validation Gate evidence. Targeted checks alone do not satisfy this rule when broad safe validation is available. `passed` satisfies the rule only when the evidence is fresh for the final candidate worktree/fix batch. `failed`, `blocked`, stale evidence, and unknown freshness make the gate emit `BLOCK`; missing, failed, blocked, stale, or unknown freshness broad safe validation emits `BLOCK`. a failed selected broad safe validation remains blocking until its failure is addressed, or until the workflow is re-scoped or reclassified so that command is no longer the selected broad safe validation. `skipped` and `not applicable` are valid only when the evidence includes repository-local discovery evidence, candidate command(s) inspected, selected command or unavailable-command conclusion, command classification basis, freshness evidence for the final candidate worktree/fix batch, proceed/block effect, residual risk, and next operator action. `mutating-only` is not a pass; it requires either a separately reported authorized mutating/output-writing run with dirty-state/output boundaries, or an accepted residual-risk rationale that explicitly covers not running it. Otherwise the gate emits `BLOCK` for missing evidence.
7. Visibility/thread evidence must match workflow context. Existing PR and PR-review reply/resolve paths require `Pushed-visible` PR-diff evidence, PR head SHA, and fresh unresolved/reopened thread state; `Remote-visible head branch` evidence is insufficient for those paths. Pre-PR Linear PR-creation readiness may use `Remote-visible head branch` evidence only with explicit no-PR proof and `thread state: not applicable - no PR exists yet`; it does not require PR head SHA or PR thread state because no PR exists yet.
8. Every fix batch requires full re-review of touched areas.
9. Regressions treated as new findings in matrix, summarized in "New regressions".
10. Gate passes when: all `Critical` findings `fixed` or fully waived; all `High` findings `fixed` or fully waived; all `Medium` findings `fixed`/owned/waived; visibility/thread evidence is valid for the workflow context; Broad Safe Validation non-blocking and fresh.

## Waiver Rules

Base fields (all waivers):
- Scope statement (exact code path/behavior/config).
- Technical rationale.
- Risk acceptance owner.
- Follow-up issue reference or `wontfix` rationale.

`High` findings (require base + one of):
- Named compensating control with one-line description, OR
- Owner-accepted tradeoff sentence: `Accepted residual risk: <what>`.

Invalid `High` waiver (base only, no compensating control/tradeoff) fails gate.

`Critical` findings (require base + all four):
- Security-owner sign-off (named security/SRE authority).
- Sunset date (explicit calendar date).
- Tracking-issue link (mandatory, satisfies base follow-up field).
- Accepted-residual-risk sentence.

Invalid `Critical` waiver (missing any field) → finding remains `open`, gate fails.

## Ownership Rules

`owned-with-remediation-plan` requires: named owner, target milestone/date, concrete remediation steps, tracking issue reference.

## Decision Procedure

1. Map each finding to one of four states; reject other labels.
2. Validate required artifacts per state.
3. Select exactly one visibility mode from the provided evidence. Reject missing, mixed, collapsed, stale, or workflow-incompatible visibility/thread evidence with `BLOCK`.
4. Verify fixes linked to findings under the selected visibility mode: PR head SHA reachability for Existing PR mode, or remote-visible head commit/referenced-commit reachability for Pre-PR/no PR mode. Confirm touched areas re-reviewed.
5. PR-review cycles: evaluate targeted and Broad Safe Validation separately. Reject targeted-only evidence when broad safe validation is available, and emit `BLOCK` for missing, failed, blocked, stale, or unknown freshness broad validation evidence.
6. Check regressions; add as findings.
7. Apply Gate Rules; issue decision.

### Insufficient Input

Missing/unreadable/vague inputs → emit `BLOCK` with: specific missing input, unevaluable findings/rules, concrete addition needed.

## Output Format

Operator-facing markdown for workflow Output Format. Do NOT post on GitHub/Linear surfaces. Per `workflow-safety-gates` Externally-Posted Content Gate, this contains workflow-internal diagnostics forbidden on external surfaces.

Include:
- Findings matrix: `id`, `severity`, `state`, `owner`, `evidence`. Regressions as own rows.
- New regressions summary.
- Missing evidence.
- Visibility and thread evidence: selected mode (`Existing PR` or `Pre-PR/no PR`), PR head SHA and fresh thread-state proof for Existing PR mode, or remote-visible head branch/head commit plus explicit no-PR proof and `thread state: not applicable - no PR exists yet` for Pre-PR/no PR mode; include whether each `fixed` finding maps to the selected head evidence.
- Broad Safe Validation Gate evidence: targeted verification status; broad safe validation status; repository-local discovery evidence; candidate command(s) inspected; selected command or unavailable-command conclusion; command classification basis; dirty-state boundary result when executed; freshness evidence for the final candidate worktree/fix batch; proceed/block effect; residual risk; next operator action; and whether the evidence is sufficient for this gate.
- Waivers and validity.
- Gate decision: `pass`, `fail`, or `BLOCK`.
- Exact blockers.
- Commit SHAs as plain text (no backticks/code span) for GitHub auto-linkification.

Use this shape:

```markdown
Gate decision: pass | fail | BLOCK

Findings matrix:
| id    | severity | state                         | owner       | evidence                                  |
|-------|----------|-------------------------------|-------------|-------------------------------------------|
| F-000 | Critical | fixed                         | -           | commit def5678, tests in auth.spec.ts     |
| F-001 | High     | fixed                         | -           | commit abc1234, tests in foo.spec.ts      |
| F-002 | Medium   | owned-with-remediation-plan   | @alice      | issue #42, target 2026-06-15              |
| F-003 | Low      | waived-with-rationale         | @bob (lead) | scope: legacy /v1 endpoint; issue #43     |

New regressions:
- <item or None>

Missing evidence:
- <item or None>

Visibility and thread evidence:
- selected mode: <Existing PR|Pre-PR/no PR>
- head evidence: <PR head SHA and pushed-visible PR diff evidence, or remote-visible head branch/head commit evidence>
- thread state: <fresh unresolved/reopened snapshot, or thread state: not applicable - no PR exists yet with proof>
- fixed-finding mapping: <each fixed finding reaches selected head evidence, or blocker>

Broad Safe Validation Gate evidence:
- targeted verification status: <status/evidence>
- repository-local discovery evidence: <docs/scripts/config/prior-local-evidence inspected>
- candidate command(s) inspected: <commands or None>
- selected command or unavailable-command conclusion: <selected command, or why none is selectable>
- broad safe validation status: <passed|failed|blocked|skipped|not applicable|mutating-only>
- command classification basis: <basis>
- dirty-state boundary result when executed: <before/after result or not executed>
- freshness evidence for the final candidate worktree/fix batch: <fresh, stale, or unknown, with later-edit evidence>
- proceed/block effect: <effect>
- residual risk: <risk>
- next operator action: <action>

Waivers:
- <id>: valid | invalid - <reason>

Blockers to clear:
- <blocker or None>
```

## Anti-Patterns

- Marking fixed without verification evidence.
- Closing threads without regression checks.
- Treating `owned-with-remediation-plan` as acceptable for `High`.
- Approving merge with undefined blockers.
