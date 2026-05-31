---
name: pr-review-fix-cycle
description: "Internal use when: running the PR review fix cycle through Builder/Test, targeted verification, broad safe validation, commit hygiene, push, and pushed-visible confirmation."
argument-hint: "Validated comments, fix scope, allowed commands/mutations, branch context, and verification expectations."
user-invocable: false
---

# PR Review Fix Cycle

Coordinate implementation and verification for validated PR review comments. This skill owns the local fix cycle contract; GitHub context and mutation are delegated to `pr-review-agent`.

## Builder/Test Contract

- Delegate implementation only for comments classified as `valid/actionable` or the valid portion of `partially valid`.
- Pass spec/design contract status, validated comment evidence, non-goals, affected files, and exact mutation/check boundaries into Builder/Test handoffs.
- For reviewer-derived fixes, include the equivalence-class audit instruction when applicable and require numeric `audited: N, deferred: M` reporting.
- Tests are owned by `test-agent` unless the handoff explicitly assigns a bounded test-edit scope to Builder.

## Targeted Verification

- Verify each addressed comment with targeted evidence tied to the comment and changed file/region.
- Report targeted verification separately from broad safe validation.
- If targeted verification fails, stop before broad validation, commit, push, reply, or resolution.

## Broad Safe Validation Gate

Broad safe validation is the broadest bounded, non-mutating, locally supported validation relevant to the changed surface, selected from repository-local evidence and changed-surface risk after targeted PR-review fix verification has already passed. Its evidence is valid only when fresh for the final candidate worktree/fix batch.

Discovery and classification:

- Discover candidate validation commands from repository-local evidence only, such as checked-in workflow docs, project scripts, contributor docs, existing task definitions, tool configuration, and prior local evidence supplied in the handoff. Do not use ecosystem, framework, language, or package-manager preference order as normative behavior.
- Classify each candidate by observed or documented behavior, not by command name or ecosystem. The classification basis must state why the command is expected to be non-mutating and locally supported, or why it is approval-bound or unavailable.
- Select the broadest bounded candidate that is relevant to the changed surface and still safe under the current workflow boundaries. This does not mean "run the whole suite" by default; it means the widest safe local validation that reasonably exercises the affected surface without installing packages, contacting external systems, starting services, mutating git state, or writing unapproved output.
- Mutating, package-management, dependency-changing, network-contacting, service-starting, environment-changing, and output-writing commands are not ordinary broad safe validation. They require explicit policy/operator authorization that names the exact command, expected dirty-state boundaries, generated/output paths, timeout or cleanup plan, and whether produced artifacts may remain dirty, and authorization alone does not make them non-blocking evidence.
- Output-writing validation is reported separately from ordinary broad safe validation. It is neither a pass nor a substitute unless the authorized command actually ran and the output/dirty-state boundaries are reported as separate accepted evidence.
- Freshness is part of the evidence, not an optional note. Record the final candidate worktree/fix batch the evidence applies to and whether any contextual/independent review, builder/test follow-up, formatting, generated-output handling, or other fix step changed the worktree afterward. Later edits invalidate prior broad validation until it is rerun or explicitly re-established for the final changed surface.

Status handling:

- `passed`: the selected broad safe validation completed successfully, dirty-state boundaries remained acceptable, and the evidence is fresh for the final candidate worktree/fix batch.
- `failed`: the selected broad safe validation ran and failed. This blocks push, reviewer-facing replies, and thread resolution until the selected broad safe validation failure is addressed, or until the workflow is re-scoped or reclassified so that command is no longer the selected broad safe validation. A failed selected broad safe validation cannot be waived through residual risk.
- `blocked`: broad safe validation should run but cannot be selected or executed under current policy, tooling, dirty-state, or command-boundary constraints. This blocks push, reviewer-facing replies, and thread resolution.
- `skipped`: broad safe validation is available but intentionally skipped only with repository-local discovery evidence, candidate command(s) inspected, selected command or unavailable-command conclusion, command classification basis, freshness evidence for the final candidate worktree/fix batch, proceed/block effect, residual risk, and next operator action. A skip is valid only when the workflow policy accepts the residual risk for this changed surface.
- `not applicable`: no meaningful broad validation exists for the changed surface after repository-local inspection. This may proceed only with repository-local discovery evidence, candidate command(s) inspected, selected command or unavailable-command conclusion, command classification basis, freshness evidence for the final candidate worktree/fix batch, proceed/block effect, residual risk, and next operator action.
- `mutating-only`: only mutating, network, service-starting, package-management, or output-writing candidates exist. This is not a pass. It may proceed only with freshness evidence for the final candidate worktree/fix batch and after either the authorized mutating/output-writing candidate actually ran and is reported separately with dirty-state/output boundaries, or an accepted residual-risk rationale explicitly covers not running it.

Operator-facing evidence must include:

- Targeted verification status and commands/evidence.
- Broad safe validation status using the vocabulary above.
- Repository-local discovery evidence, candidate command(s) inspected, and selected command or unavailable-command conclusion.
- Command classification basis for command-behavior outcomes (`local-only`, `approval-bound`, or `forbidden`) and status outcomes (`skipped`, `not applicable`, `blocked`, or `mutating-only`).
- dirty-state boundary result when executed, including before/after evidence for any executed broad validation.
- Freshness evidence for the final candidate worktree/fix batch, including whether later edits occurred and how broad validation was rerun or re-established after them.
- Proceed/block effect, residual risk, and next operator action.

## Hard Gate

- If the Broad Safe Validation Gate is missing, failed, blocked, stale, or not fresh for the final candidate worktree/fix batch, do not push, do not post reviewer-facing replies, and do not resolve threads.
- A valid `skipped` or `not applicable` status may proceed only when the output names repository-local discovery evidence, candidate command(s) inspected, selected command or unavailable-command conclusion, command classification basis, freshness evidence for the final candidate worktree/fix batch, proceed/block effect, residual risk, and next operator action.
- `mutating-only` is not a pass; proceed only after the authorized mutating/output-writing command ran and is reported separately with dirty-state/output boundaries, or after an accepted residual-risk rationale explicitly covers not running it.

## Commit and Push Contract

- Confirm current branch is the PR head branch.
- Do not push to default/base branch.
- Do not force push or rewrite pushed/shared history without explicit user approval.
- Delegate commit and push mechanics only to the appropriate edit/execute-capable workflow specialist after branch/upstream checks and explicit workflow or user authorization.
- Before delegating commit or push mechanics, record the Local Git Mutation Delegation Contract with exact repo, branch/ref, staging scope, command class, push target, and approval status.
- Do not create remote GitHub branches or mutate repository files through GitHub as a fallback for local git workflow, builder/test delegation, commit hygiene, push mechanics, or failed/unavailable tooling.
- Do not use `git add .` or broad staging unless explicitly scoped, inspected, and approved.
- Read-only reviewer, security, adversary, environment-inspector, and integrator agents must not commit, push, or perform local git mechanics.
- Use atomic meaningful commits with conventional subjects and structured bodies.
- Invoke and apply `commit-hygiene`, `conventional-commits`, and `commit-body-guidelines` before push. If any required commit skill is unavailable, blocked, or fails, stop with local-only status.
- Push only after targeted verification and Broad Safe Validation Gate evidence are non-blocking and fresh, commit readiness has passed, and any mandatory pre-push adversarial review has completed with a non-blocking verdict, valid trivial skip, or true not-applicable evidence. `Verdict: BLOCK` blocks push readiness.
- Confirm pushed-visible state: the fix commit is committed locally, pushed to the PR branch, and reflected in the GitHub PR diff.

## Output Contract

Return:

- Fix summary per validated comment.
- Files changed.
- Targeted verification status and evidence.
- Broad Safe Validation Gate evidence package.
- Equivalence-class audit report when applicable.
- Commit readiness: commit-hygiene, Conventional Commit subject, and commit body status.
- Pre-push adversarial review status received from the orchestrator: use the shared Pre-push Adversarial Review Status package from `agentic-engineering/shared/output-format-contract.md`.
- Commit/push status and pushed-visible confirmation.
- Blockers and local-only status when push/readiness cannot proceed.
