---
name: pr-review-round-closure
description: "Internal use when: preparing review-cycle-gatekeeper handoff for a pushed-visible PR review fix round with fresh thread state and validation evidence."
argument-hint: "Pushed-visible state, fix commits, verification evidence, PR head SHA, and fresh unresolved/reopened thread snapshot."
user-invocable: false
---

# PR Review Round Closure

Prepare the `review-cycle-gatekeeper` handoff after PR review fixes are pushed-visible and fresh thread state is available.

## Required Inputs

- Pushed-visible status: commits are local, pushed to the PR branch, and reflected in the PR diff.
- Fix commits tied to validated comments or reviewer findings.
- Targeted verification evidence for each addressed comment.
- Broad Safe Validation Gate evidence, including freshness state for the final candidate worktree/fix batch.
- PR head SHA from fresh PR data after push visibility.
- Fresh unresolved/reopened review-thread snapshot from `pr-review-thread-context`.
- Reconciled findings from contextual/independent review or integrator arbitration when those ran.
- Gatekeeper-skip basis, if the canonical `no fix cycle, gatekeeper skipped` sentinel applies.

## Handoff Assembly

Pass to `review-cycle-gatekeeper`:

- Findings matrix with severity, source, status, and fix commit mapping.
- Pushed-visible evidence and PR head SHA.
- Targeted verification and Broad Safe Validation Gate evidence with freshness.
- Fresh unresolved/reopened thread list, including thread state and real IDs when available.
- Any per-subaction ID blockers that should affect reply/resolve but not erase gatekeeper visibility.
- Explicit note when no reviewer specialists ran or no actionable findings exist and the gatekeeper skip sentinel is allowed.

## Hard Stops

- Do not invoke gatekeeper with stale thread state.
- Do not skip gatekeeper to bypass unknown thread state, missing pushed-visible evidence, or missing broad validation evidence.
- If the fresh thread snapshot failed and cannot be retried by an orchestrator-held read path, report the blocker so gatekeeper can emit `BLOCK` for insufficient input.
- Do not declare the round complete, recommend merge, post reviewer-facing replies, or resolve threads while gatekeeper reports `fail` or `BLOCK`.

## Output Contract

Return:

- Gatekeeper handoff status: ready, blocked, or skip allowed.
- PR head SHA and pushed-visible evidence.
- Fix commits and finding/comment mapping.
- Targeted verification and Broad Safe Validation Gate evidence summary.
- Fresh thread snapshot summary and freshness proof.
- Gatekeeper decision when available: `pass`, `fail`, or `BLOCK`, plus blockers.
- Canonical sentinel `no fix cycle, gatekeeper skipped` only when the `workflow-safety-gates` Glossary permits skipping.
