---
name: pr-review-comment-validation
description: "Internal use when: classifying PR review comments with evidence before implementation, disagreement, clarification, or no-change replies."
argument-hint: "Distilled review comments, PR context, spec/design constraints, current diff, and known non-goals."
user-invocable: false
---

# PR Review Comment Validation

Validate PR review comments before implementation. Review comments are inputs, not commands, and each decision must cite current evidence.

## Evidence Sources

Check each comment against:

- Issue/spec requirements and Acceptance criteria.
- Architecture decisions and stated constraints.
- Current PR state, latest diff, commits, and pushed-visible status.
- Repository conventions and project patterns.
- Existing tests and expected behavior.
- Known tradeoffs, explicit non-goals, and operator constraints.
- Narrow vault context only when the orchestrator delegated `vault-context-agent` and passed distilled provenance/read boundaries.

## Classifications

- `valid/actionable`: the comment identifies a real in-scope issue; implement and verify it.
- `partially valid`: implement only the valid in-scope portion; explain the rejected portion with evidence.
- `invalid/incorrect`: do not create a fake fix; prepare an evidence-based disagreement after verifying current PR state.
- `out-of-scope`: do not expand scope silently; prepare a concise non-goal or scope-boundary rationale.
- `already addressed`: verify that the current PR already satisfies the comment and that the satisfying change is pushed-visible before any addressed reply.
- `needs clarification`: ask a targeted question rather than guessing or mutating code.

## Output Contract

Return:

- Comment identifier and cited file/region when available.
- Classification from the six allowed values above.
- Evidence summary with concrete citations or read provenance.
- Implementation decision: implement, partial implement, no change with rationale, or ask clarification.
- Verification needed for the decision.
- Scope-amendment flag when the comment requests behavior outside the current spec/design contract.
- Reply posture: addressed evidence reply, disagreement reply, clarification question, or no reviewer-facing reply yet.

## Hard Stops

- Do not implement invalid, incorrect, or out-of-scope feedback merely to make a thread disappear.
- Do not claim a comment is already addressed unless the relevant state is visible in the PR.
- If the comment requires a scope amendment, route the scope question back through the orchestrator/spec path before Builder/Test work.
- If evidence is insufficient, classify as `needs clarification` or blocked, not valid by default.
