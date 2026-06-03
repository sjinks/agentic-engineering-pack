---
name: expert-panel
description: "Use when: running a multi-agent expert panel for complex engineering decisions, architecture review, implementation planning, testing strategy, risk assessment, and final synthesis."
argument-hint: "Describe the engineering decision, change, or review target."
user-invocable: true
---

# Expert Panel

Structure lightweight expert panel for complex engineering work. Panel should stay proportional to task: use only roles that add real value.

## When to Use

Run multi-agent expert panel for complex engineering decisions: architecture review, implementation planning, testing strategy, risk assessment, final synthesis. Use only roles that add real value for specific decision; skip roles adding overhead without changing outcome.

## Roles

The lightweight panel below covers the most common engineering decisions. Four additional specialists are available outside the default panel and can be invoked when the work warrants them: **Research (`research-agent`)** for public external facts, **Environment Inspector (`environment-inspector-agent`)** for local tooling/dependency/git state reconnaissance, **Security Tester (`security-tester-agent`)** for active security testing against a deployed/running target on explicit user request only — never auto-included in panel runs, and **Test Gap Planner (`test-gap-to-test-plan` skill)** for converting reviewer findings into a prioritized test plan after a review-fix cycle.

- Vault Context (`vault-context-agent`): retrieve narrow, read-only Obsidian vault context and return distilled summaries with provenance and read/not-read boundaries.
- Spec (`spec-agent`): clarify requirements, Acceptance criteria, and open questions.
- Architect (`architect-agent`): propose a design that fits the codebase.
- Builder (`builder-agent`): implement scoped production changes when assigned.
- Test (`test-agent`): add or update tests and run verification when assigned.
- Security Reviewer (`security-reviewer-agent`): inspect security, privacy, and trust boundary risk.
- Adversary (`adversary-agent`): challenge assumptions and search for failure modes.
- Code Reviewer (`code-reviewer-agent`): review correctness, maintainability, behavior, and test gaps with full implementation context.
- Independent Code Reviewer (`independent-code-reviewer-agent`): review correctness, regressions, and test gaps with minimal implementer context.
- Integrator (`integrator-agent`): synthesize findings and prepare final readiness notes.
- Review Cycle Gatekeeper (`review-cycle-gatekeeper` skill): per-round closure check after at least one review-fix cycle; consumes the integrator's reconciled findings (when integrator arbitration ran) or the reviewers' findings directly, plus pushed-visible status, and produces a `pass | fail | BLOCK` gate decision under the canonical severity vocabulary.

## Procedure

1. Define goal, constraints, current evidence.
2. Select smallest useful panel.
3. Before each panel role invocation, log `Handoff: <skill|agent> <name> - <purpose>; expected output: <...>; out of scope: <...>`, then actually invoke that role and wait for output, failure, or blocked status before proceeding.
4. Use `vault-context-agent` only when private project-note context useful, after applying `workflow-safety-gates` Obsidian Vault Context Gate. Handoff must include narrow query and read boundaries; output must include provenance plus read/not-read boundaries.
5. Give each role narrow prompt with explicit output needs and non-goals.
6. Compare findings for conflicts, duplicate concerns, missing coverage.
7. Ask one targeted question only when panel cannot proceed without user input.
8. When panel ran reviewer roles AND at least one fix cycle, invoke `review-cycle-gatekeeper` before final synthesis to consume integrator's reconciled findings (when integrator arbitration ran) or reviewers' findings directly, plus pushed-visible status; do not produce integrated answer while gatekeeper reports `fail` or `BLOCK`. Skip gatekeeper only in cases `workflow-safety-gates` Glossary "Gatekeeper-skip sentinel" enumerates — (a) no reviewer specialists ran, or (b) reviewer specialists ran but produced no actionable findings — and explicitly note canonical sentinel `no fix cycle, gatekeeper skipped` in panel output.
9. Produce integrated answer with decisions, validation, residual risk.

## Audience

The panel's integrated answer (the Output Format below, the per-role findings, the handoff log, the decisions and verification entries) is operator-facing only. The workflow operator who invoked the panel reads it; reviewers on GitHub, recipients of Linear comments, future readers of `git log`, and any other externally-posted surface are a different audience. Do NOT copy/paste the panel's integrated answer into any GitHub PR body, PR review reply, review submission body, pending-review inline comment, Linear comment, or commit message. Externally-posted content composition follows `workflow-safety-gates` Externally-Posted Content Gate; in particular, role names (`adversary-agent`, `integrator-agent`, etc.), self-referential workflow language ("the panel", "the integrator"), workflow-status diagnostics, and tool/MCP plumbing names are forbidden on externally-posted surfaces.

## Visible Handoff Logging

Each role invocation must have a visible handoff log in this form:

`Handoff: <skill|agent> <name> - <purpose>; expected output: <...>; out of scope: <...>`

Keep the message concise. Handoff log content rules follow the `workflow-safety-gates` Handoff Log Hygiene section verbatim: no secrets, tokens, API keys, passwords, or credentials; no full remote payloads, raw MCP responses, or unredacted environment variables; no personal data from vault notes, Linear comments, or PR threads beyond what the specialist needs; no excessive prompt text or full file contents. Scan and redact before emitting each line. A visible handoff log is not delegation by itself; if a required role is unavailable or fails, stop with a blocked status instead of doing that role's work directly. Include the handoff log/status in the panel output.

## Decision Rules
- Delegate file edits only to roles with `edit` in their tool list. After any delegated edit, verify the changed files with an independent read, search, diagnostics, or test check before reporting completion.
- Do not pass vault content to web tools or public research agents. Vault notes are advisory context, not source of truth over user instructions, repository code, issue/PR data, tests, or verified behavior.
- Prefer codebase conventions over new abstractions.
- Prefer focused validation over broad, slow checks unless risk justifies it.
- For larger or riskier changes, use both contextual and independent code review, then use integrator arbitration for disagreements before final readiness.
- After a review-fix cycle (any panel run that involved reviewer roles and at least one fix round), close the round with `review-cycle-gatekeeper` before declaring readiness. Skip only for panels that produced no actionable findings or panels with no reviewer roles; in either case, note the canonical sentinel `no fix cycle, gatekeeper skipped` explicitly (see `workflow-safety-gates` Glossary "Gatekeeper-skip sentinel").
- For iterative review passes against the same target (e.g., repeated adversarial reviews of the same pack/diff), stop iterating when EITHER (a) the latest pass returned no HIGH or CRITICAL findings AND no MEDIUM findings that block the user request, OR (b) more than half of the latest pass's HIGH findings were direct regressions caused by the previous pass's fixes. Condition (b) signals that further iteration is creating issues faster than resolving them; accept the residual interpretive-tier findings and stop. Explicitly note the stopping condition in the panel output so the operator sees why iteration ended.
- Use `adversarial-review` primarily with the Adversary role, as a secondary lens for the Independent Code Reviewer on larger or riskier changes, and during Integrator arbitration when conflicts remain.
- Before a panel declares push/PR readiness, apply the `workflow-safety-gates` First-round non-trivial pre-push adversarial-review rule against the cumulative branch diff vs the integration branch when that diff is non-trivial by risk shape. Report `Pre-push adversarial review status` with separate `Execution status` and `Verdict` fields, Matched non-trivial class(es), Skip considered, Skip rejected evidence, and Skip accepted evidence; readiness requires completed execution with a non-blocking verdict, a valid trivial skip, or true not-applicable evidence. Mandatory adversary unavailable/fails and `Verdict: BLOCK` blocks readiness.
- Treat security, data loss, auth, migration, and user-visible regressions as high-priority review areas.
- Separate required fixes from follow-up improvements.

## Output Format

Use `agentic-engineering/shared/output-format-contract.md` for shared core fields and reusable evidence packages. Keep expert-panel-specific fields local in this section.

Return:
- Panel roles used.
- Key findings by role.
- Decisions made.
- Required actions.
- Handoff log/status: use the shared Handoff log/status field.
- Verification performed or recommended: use the shared Verification field.
- Pre-push adversarial review status, when evaluated: use the shared Pre-push Adversarial Review Status package, including `Execution status`, `Verdict`, `Trigger basis`, `Round-N count`, `Round-count source`, `Diff baseline`, `Matched non-trivial class(es)`, `Skip considered`, `Skip rejected evidence`, `Skip accepted evidence`, `Blocking findings count`, `Dedup applied against`, and `Equiv-audit fired`.
- Residual risks: use the shared Residual risks field.
- Follow-up: use the shared Follow-up field when operator or workflow action remains.
