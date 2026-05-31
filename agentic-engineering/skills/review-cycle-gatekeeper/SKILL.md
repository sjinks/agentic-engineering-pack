---
name: review-cycle-gatekeeper
description: "Use when: enforcing review-fix cycle quality gates, verifying review findings are closed, checking merge readiness, validating fix evidence after a review round, deciding go/no-go on merge, auditing unresolved or reopened review threads, confirming regressions introduced by fixes are tracked, and producing a final pre-merge gate decision."
argument-hint: "Findings list, fix summary, verification evidence, and unresolved discussion threads."
user-invocable: true
---

# Review Cycle Gatekeeper

Use this skill to enforce closure quality across iterative review rounds. The goal is to prevent superficial thread closure and ensure real merge readiness.

## When to Use

Use this skill when a change has already been reviewed and at least one fix cycle has occurred.

Typical triggers:

- Reviewer findings were addressed in one or more follow-up commits.
- There are unresolved or reopened review threads.
- Merge readiness is unclear due to missing evidence.
- A final go or no-go decision is needed before merge.

### Not to Be Used For

- Per-comment validation during an active fix round — that belongs to `pr-review-comments-workflow`'s Review Comment Validation Gate.
- Posting PR replies, resolving threads, pushing fixes, or any GitHub mutation. This skill produces a decision; remediation goes through `pr-review-comments-workflow`.
- Substituting for `integrator-agent` synthesis during dual-reviewer arbitration. This skill consumes the integrator's reconciled findings; it does not produce them.
- General code review of an unreviewed change. Run review specialists first (`code-reviewer-agent`, `independent-code-reviewer-agent`, etc.); apply this skill after at least one fix cycle.

## Integration with This Pack

- This skill is read-only and decision-only. It does not edit files, run commands, commit, push, reply, or resolve threads. Mutations are out of scope; remediation loops back through `pr-review-comments-workflow` and the appropriate builder/test specialists.
- Test-evidence input source: when the workflow ran reviewer specialists and produced findings with severity, the canonical upstream that produces the per-finding test cases this skill consumes is `test-gap-to-test-plan`. The planner's `PLAN-READY` with all `must-have` cases `Status: landed` satisfies the test-evidence rule (see `## Gate Rules`) for the relevant findings; the planner's `BLOCK`, `PLAN-PARTIAL`, or any `must-have` case not yet `landed` fails the rule. When no planner output is in the handoff (documentation-only changes, triage-only outcomes, or no findings with severity), the rule still requires test evidence for any functional fix or an explicit no-test rationale.
- GitHub MCP context (PR metadata, review comments, thread state, commit/push visibility) is provided by `github-context-agent` via orchestrator-mediated handoffs per `workflow-safety-gates`. This skill consumes distilled findings, fix evidence, and visibility status passed in by the operator or orchestrator; it does not call GitHub tools itself.
- Anchors to `workflow-safety-gates`:
  - "Pushed-visible" in the `fixed` state and the fix-batch rule in `## Gate Rules` follow the Glossary definition; local-only commits do not satisfy `fixed`.
  - PR Review Visibility and Thread Gate governs any inference about thread state and reply readiness.
  - PR Readiness Evidence Gate is the upstream sibling; this skill is the per-round closure check, not the pre-PR-creation check.
- Severity vocabulary (`Critical`/`High`/`Medium`/`Low` — the canonical `CRITICAL`/`HIGH`/`MEDIUM`/`LOW` from `workflow-safety-gates` "Severity Vocabulary" in title-cased matrix form) and finding states (`fixed`/`owned-with-remediation-plan`/`waived-with-rationale`/`open`) are authoritative for orchestrator and operator-facing reporting when this skill is applied. Reviewer specialists already emit the canonical vocabulary; the gatekeeper restates findings in title-cased form for the findings matrix per the mapping in `## Severity Vocabulary`.
- When this skill's decision conflicts with a `pr-review-comments-workflow` reply or with reviewer suggestions, choose the more conservative path: prefer not posting a reply or not resolving a thread over an overclaim. Gate outputs (especially `BLOCK` and `fail` reasons) are operator-facing diagnostics and must not be posted as reviewer-facing replies; `pr-review-comments-workflow`'s "Reviewer-Facing Content (All Surfaces)" rules continue to apply when replies are eventually composed.

## Required Inputs

- Findings list with severity and current status.
- Fix summary or commit list tied to findings.
- Verification evidence after fixes, separated into targeted verification and Broad Safe Validation Gate evidence when PR-review fixes are in scope. Targeted verification proves the specific finding or behavior; broad safe validation proves the broadest bounded, non-mutating, locally supported validation relevant to the changed surface. The broad evidence must include broad safe validation status (`passed`/`failed`/`blocked`/`skipped`/`not applicable`/`mutating-only`), repository-local discovery evidence, candidate command(s) inspected, selected command or unavailable-command conclusion, command classification basis, dirty-state boundary result when executed, freshness evidence for the final candidate worktree/fix batch, proceed/block effect, residual risk, and next operator action. If contextual/independent review, builder/test follow-up, formatting, generated-output handling, or any other fix step changed the worktree after broad validation evidence was produced, that evidence is stale until rerun or explicitly re-established for the final changed surface; stale or unknown freshness makes the gatekeeper emit `BLOCK`.
- Unresolved or reopened discussion thread list (may be empty; an empty list is a valid input, an unknown list is not). The thread list must be a fresh read taken after the PR head SHA reaches its current value (no pushes between the read and this invocation) and immediately before this invocation; stale snapshots are not valid input. The PR head SHA at the time of the thread read MUST match the PR head SHA at the time of invocation. If the freshness read fails, the PR head SHA at read time differs from the PR head SHA at invocation, or freshness state is unavailable, treat the thread list as unknown and the gatekeeper emits `BLOCK`.
- Pushed-visible state per the `workflow-safety-gates` Glossary, anchored to the PR head SHA at the time of invocation. Each `fixed`-state finding's linked fix commit MUST be reachable from the PR head SHA in this Required Input; commits that exist only locally do not satisfy `fixed`. An unknown pushed-visible status or unknown PR head SHA is treated identically to unknown thread state — the gatekeeper emits `BLOCK` and names the missing input.

## Severity Vocabulary

Use these severity levels consistently:

- `Critical`: exploitable or triggerable now with no compensating control; irreversible or production-impacting; severe security, privacy, data-loss, safety, legal, or business harm. Mapped to canonical `CRITICAL` per `workflow-safety-gates` "Severity Vocabulary".
- `High`: incorrect behavior, security/privacy risk, data integrity risk, crash, or production-impacting reliability fault.
- `Medium`: likely regression, contract mismatch, weak error handling, or meaningful operational risk.
- `Low`: maintainability or clarity issue with limited near-term risk. Advisory only.

Mapping to the canonical pack vocabulary (`workflow-safety-gates` "Severity Vocabulary"):

- This skill writes title-cased `Critical`/`High`/`Medium`/`Low` in the findings matrix; the title-cased labels correspond exactly to the canonical `CRITICAL`/`HIGH`/`MEDIUM`/`LOW`. `Critical` entries preserve their origin distinctly from `High` so that downstream gates (notably the orchestrator's pre-push blocking rule per `workflow-safety-gates` "Severity Vocabulary") can distinguish them. `Critical` findings must be `fixed` or `waived-with-rationale` with the full waiver evidence the `workflow-safety-gates` Severity Vocabulary table requires for `CRITICAL` (security-owner sign-off, sunset date, tracking-issue link, "accepted residual risk" sentence). `owned-with-remediation-plan` is not a valid state for a `Critical` finding.

## Finding States

Each finding must be in exactly one explicit state:

- `fixed`: the underlying defect is no longer present and has been verified.
- `owned-with-remediation-plan`: the defect remains, but a named owner has committed to a concrete remediation plan.
- `waived-with-rationale`: the defect remains and will not be fixed, with explicit risk acceptance.
- `open`: the defect remains and is not fixed, owned, or waived.

### Required Evidence Per State

| State                         | Required artifacts                                                                                                                                |
|-------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| `fixed`                       | Linked fix commit or PR change, plus verification evidence (tests, manual checks) or an explicit no-test rationale (see the test-evidence rule).  |
| `owned-with-remediation-plan` | All fields listed under Ownership Rules.                                                                                                          |
| `waived-with-rationale`       | Base fields under Waiver Rules; `High`-origin findings additionally require the `High`-only fields; `Critical`-origin findings additionally require the `Critical`-only fields. |
| `open`                        | None required, but the finding blocks per the Gate Rules.                                                                                         |

### Reopened Findings

If a previously `fixed` finding is reopened by a reviewer, it returns to `open`. Prior verification evidence is treated as invalidated and must be re-established before the finding can return to `fixed`.

## Gate Rules

1. Every `Critical` finding must be `fixed` or `waived-with-rationale` with the additional `Critical`-only waiver fields under `## Waiver Rules`. `owned-with-remediation-plan` is not valid for `Critical`. Reopened or unaddressed `Critical` findings fail the gate regardless of any other state in the matrix.
2. Every `High` finding must be `fixed` or `waived-with-rationale` with the additional `High`-only waiver fields under `## Waiver Rules` (a documented compensating control or an explicit owner-accepted tradeoff). A `waived-with-rationale` state on a `High` finding that lacks the compensating-control / owner-accepted-tradeoff evidence is treated as an invalid waiver and the gate fails. This rule is the operationalization of the canonical `HIGH` row in `workflow-safety-gates` Severity Vocabulary, which says HIGH blocks unless `fixed` or `waived-with-rationale` with documented compensating control or owner-accepted tradeoff.
3. Every `Medium` finding must be `fixed`, `owned-with-remediation-plan`, or `waived-with-rationale`.
4. Every `Low` finding must be tracked in one of the four declared states. `Low` findings never block merge regardless of state.
5. Every functional fix must include test evidence or an explicit rationale for no test. A functional fix is any change that alters runtime behavior, a public contract, persisted state, or security posture; documentation-only and pure formatting changes are excluded.
6. For PR-review fix cycles, Broad Safe Validation Gate evidence is required in addition to targeted verification. Targeted checks alone do not satisfy this rule when broad safe validation is available. `passed` satisfies the rule only when the evidence is fresh for the final candidate worktree/fix batch. `failed`, `blocked`, stale evidence, and unknown freshness make the gate emit `BLOCK`; a failed selected broad safe validation remains blocking until its failure is addressed, or until the workflow is re-scoped or reclassified so that command is no longer the selected broad safe validation. `skipped` and `not applicable` are valid only when the evidence includes repository-local discovery evidence, candidate command(s) inspected, selected command or unavailable-command conclusion, command classification basis, freshness evidence for the final candidate worktree/fix batch, proceed/block effect, residual risk, and next operator action. `mutating-only` is not a pass; it is valid only when the evidence includes the same fields plus either a separately reported authorized mutating/output-writing run with dirty-state/output boundaries, or an accepted residual-risk rationale that explicitly covers not running it. Otherwise the gate emits `BLOCK` for missing evidence.
7. Every fix batch must include full re-review of touched areas, not only thread-level replies. A fix batch is the set of changes pushed in a single review round (one push or one PR update), regardless of how many commits it contains.
8. Regressions introduced by fixes are treated as new findings, added to the findings matrix with their own severity and state, and additionally summarized in the "New regressions" output section for visibility.
9. The gate passes only when every `Critical` finding is `fixed` or `waived-with-rationale` with the `Critical`-only waiver fields, every `High` finding is `fixed` or `waived-with-rationale` with the `High`-only waiver fields under `## Waiver Rules`, every `Medium` finding is `fixed`, `owned-with-remediation-plan`, or `waived-with-rationale`, and any required Broad Safe Validation Gate evidence is non-blocking and fresh for the final candidate worktree/fix batch. Any other state for a `Critical`, `High`, or `Medium` finding fails the gate; missing, failed, blocked, stale, or unknown freshness broad safe validation emits `BLOCK`.

## Waiver Rules

A waiver is valid only if all base fields are present. `Critical`-origin findings additionally require all four `Critical`-only fields listed below.

Base fields (required for all waivers):

- Scope statement: the exact code path, behavior, configuration, or condition the waiver applies to, precise enough that a future change can be tested for re-entering the waived scope.
- Technical rationale: why the residual risk is acceptable in context.
- Risk acceptance owner: named individual or role accepting the residual risk.
- Follow-up issue reference, or explicit `wontfix` rationale.

Additional fields for `High` findings (required on top of the base fields; align with `workflow-safety-gates` "Severity Vocabulary" HIGH row): one of

- A named compensating control with a one-line description of what it mitigates and how the mitigation works in this specific scope, OR
- An explicit owner-accepted tradeoff sentence in the form `Accepted residual risk: <what is accepted, in one sentence>` named-signed by the same Risk acceptance owner listed in the base fields.

A `High` waiver that satisfies only the base fields without naming either the compensating control or the accepted-residual-risk sentence is invalid; the gate fails per the `High`-finding rule in `## Gate Rules`.

Additional fields for `Critical` findings (required on top of the base fields; align with `workflow-safety-gates` "Severity Vocabulary" CRITICAL row):

- Security-owner sign-off: a named individual with explicit security or SRE role authority, recorded verbatim in the waiver text (the base "risk acceptance owner" field is not a substitute when the finding is `Critical`).
- Sunset date: an explicit calendar date by which the waiver expires and the finding must be re-evaluated. `wontfix` alone is not a valid substitute for a sunset date on a `Critical` finding.
- Tracking-issue link: an inline link to a tracking issue. The base-field option of "or explicit `wontfix` rationale" is not available for `Critical` waivers; the tracking-issue link is mandatory. The Critical-only Tracking-issue link also satisfies the base `Follow-up issue reference` field — a Critical waiver does not require both a separate base reference and a Critical-only link.
- Accepted-residual-risk sentence: an explicit sentence stating what residual risk is being accepted, written in the waiver text in the form "Accepted residual risk: <what is accepted>".

A `Critical` waiver missing any of the four additional fields is invalid; the gatekeeper must reject it and the finding remains `open` per the Critical-finding rule in `## Gate Rules`.

## Ownership Rules

`owned-with-remediation-plan` is valid only if it includes:

- Named owner
- Target milestone/date
- Concrete remediation steps
- Tracking issue reference

## Decision Procedure

1. Map each finding to exactly one of the four declared states; reject any other label.
2. Validate that every finding carries the artifacts listed in "Required Evidence Per State".
3. Verify that fixes are linked to findings and that touched areas have been re-reviewed per the fix-batch rule in `## Gate Rules`.
4. For PR-review fix cycles, evaluate targeted verification and Broad Safe Validation Gate evidence separately. Reject targeted-only evidence when broad safe validation is available, and emit `BLOCK` for missing, failed, blocked, stale, or unknown freshness broad validation evidence.
5. Check for newly introduced regressions and add them as findings per the regressions rule in `## Gate Rules`.
6. Apply the Gate Rules and issue the final decision.

### Insufficient Input

If required inputs are missing, unreadable, or too vague to apply the Gate Rules (for example: a finding has no severity, fix commits are not linked to findings, or verification evidence is absent for any claimed `fixed` state), do not emit `pass` or `fail`. Emit `BLOCK` with:

- The specific missing or ambiguous input.
- The findings or rules that cannot be evaluated as a result.
- The smallest concrete addition needed to proceed.

## Output Format

Return output as operator-facing markdown for the workflow's Output Format report. Do NOT post this verbatim on any GitHub-visible surface (PR body, PR review reply, pending-review inline comment, review submission body) or Linear-visible surface (issue comment, status comment). Per the `workflow-safety-gates` Externally-Posted Content Gate, gate-decision narration, `BLOCK` reason text, `Missing evidence` rows, and `Waivers: invalid - <reason>` strings can contain workflow-internal diagnostics, tool names, MCP plumbing state, and self-referential workflow language; these are forbidden on externally-posted surfaces. The orchestrator and the calling workflow are responsible for compiling reviewer-facing replies separately (see `pr-review-comments-workflow` "Reviewer-Facing Content (All Surfaces)"); this Output Format is not a substitute.

Include:

- Findings matrix with `id`, `severity`, `state`, `owner`, `evidence`. Regressions introduced by fixes appear here as their own rows.
- Newly introduced regressions, summarized for visibility (each must also appear in the findings matrix).
- Missing evidence.
- Broad Safe Validation Gate evidence: targeted verification status; broad safe validation status; repository-local discovery evidence; candidate command(s) inspected; selected command or unavailable-command conclusion; command classification basis; dirty-state boundary result when executed; freshness evidence for the final candidate worktree/fix batch; proceed/block effect; residual risk; next operator action; and whether the evidence is sufficient for this gate.
- Waivers and whether each waiver is valid.
- Gate decision: `pass`, `fail`, or `BLOCK`.
- Exact blockers to clear before merge.
- Commit SHAs in the findings matrix and any prose evidence are written as plain text — no backticks, code span, or link markup. This formatting allows downstream tooling and any orchestrator-composed reviewer reply (built separately per `pr-review-comments-workflow` "Reviewer-Facing Content (All Surfaces)") to carry the SHA into a GitHub-rendered surface and have GitHub auto-linkify it. This Output Format itself MUST NOT be pasted verbatim into any externally-posted surface, per the header above.

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

- Marking a finding as fixed without verification evidence.
- Closing threads without checking touched-area regressions.
- Treating `owned-with-remediation-plan` as acceptable for `High` severity.
- Approving merge while blockers remain undefined.
