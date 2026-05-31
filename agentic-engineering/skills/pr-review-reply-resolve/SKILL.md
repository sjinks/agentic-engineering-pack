---
name: pr-review-reply-resolve
description: "Internal use when: composing reviewer-facing PR review replies and resolving review threads after gatekeeper pass or allowed skip."
argument-hint: "Gatekeeper decision, pushed-visible commits, real thread/comment IDs, validation decisions, and reply/resolve plan."
user-invocable: false
---

# PR Review Reply Resolve

Reply to PR review threads and resolve them only after pushed-visible fixes and review-cycle closure gates pass.

## Preconditions

- Fix-backed replies have pushed-visible fix commits. Verified no-change, disagreement, and clarification replies are verified against current PR state and carry evidence citation/provenance instead of a fix commit SHA.
- `review-cycle-gatekeeper` returned `pass`, or the canonical `no fix cycle, gatekeeper skipped` sentinel is allowed.
- Fresh thread/comment IDs came from `pr-review-thread-context` or other real GitHub/VS Code PR extension data.
- Required reply target and thread node ID are available for the specific sub-action. Direct existing-comment replies require a numeric `commentId` with provenance accepted by `workflow-safety-gates` Direct Review Comment Reply ID Provenance Gate; thread resolution requires the review thread node ID.
- Reviewer-facing text passes the `workflow-safety-gates` Externally-Posted Content Gate.

## Reply Before Resolve

- For every addressed thread whose cited file or region was touched by the pushed fix commits, post a per-thread evidence reply before resolving.
- The reply names the relevant fix commit SHA as plain text and gives a one-line summary of what changed.
- For every fix-backed reply, include the relevant pushed-visible fix commit SHA as plain text plus the reviewer-relevant summary and test evidence when applicable.
- For verified no-change, disagreement, and clarification replies that are not fix-backed and do not correspond to touched cited files or regions, cite the evidence/provenance for the decision and do not require or invent a fix commit SHA.
- Thread classification does not exempt a touched file/region from the evidence reply; invalid, out-of-scope, and needs-clarification threads still require the reply when the pushed diff touched the cited file or region.
- A top-level review submission body, batch summary, outdated status, or resolution call does not substitute for the per-thread evidence reply.
- Resolve only with the actual review thread node ID. Reply only with the actual per-comment reply/database ID required by the selected reply surface. Direct existing-comment replies use `mcp_github_add_reply_to_pull_request_comment` with params `owner`, `repo`, `pullNumber`, numeric `commentId`, and `body`.

## Reply Surface Selection

- Direct existing-comment mode posts a reply to an existing PR review comment. Use only `mcp_github_add_reply_to_pull_request_comment` with `owner`, `repo`, `pullNumber`, numeric `commentId`, and `body`, after the Direct Review Comment Reply ID Provenance Gate passes.
- New-review mode creates new review feedback through the approved review-write surface.
- If the selected surface's required ID is unavailable, stale, ambiguous, conflicting, or from an unsafe source, block that reply sub-action rather than switching surfaces or probing with a mutating tool.

## Pending Review Lifecycle (Not Currently Available)

Pending-review inline comments (`mcp_github_add_pull_request_review_comment_to_pending_review`) are not currently granted to any agent in this pack. The lifecycle below documents the design but is not an active workflow path. If pending-review inline support is restored in the future, the following rules apply:

Pending-review inline comments are staged draft content, not GitHub-visible posted evidence. Treat them as posted per-thread evidence only after submit-pending-review succeeds and the submitted review/comment visibility is confirmed from the tool result or a fresh read. Staging a pending inline comment, receiving a pending comment ID, or composing a top-level review body is not enough to resolve the thread.

- In direct-reply mode, a successful per-thread reply creation can satisfy the posted-evidence prerequisite for that thread.
- In pending-review mode, reply creation and pending-review submission are separate sub-actions. Do not collapse them into `reply+resolve`.
- If pending-review submission fails, is skipped, returns an ambiguous result, or cannot be confirmed as GitHub-visible, stop before resolution and classify the affected threads as `pending-submit-failed` or `pending-submit-unconfirmed`.
- If the Externally-Posted Content Gate rejects any pending-review inline comment or review body, do not submit the pending review. Rejected content is not submitted. If any rejected content was already staged, delete or abandon that pending review before any thread resolution. Report the operator-facing state as blocked or abandoned; do not post the rejected content and do not resolve affected threads.
- Resolution may proceed for a pending-review thread only after the corresponding pending inline comment is confirmed posted and all other resolution prerequisites still pass.

## Approved Resolution Surface

Use the exact thread-resolution surface allowed by `workflow-safety-gates`: MCP review-thread resolution or `github.vscode-pull-request-github/resolveReviewThread`, only with a real thread ID from extension/GitHub data, pushed-visible fix or verified no-change rationale, gatekeeper pass or allowed skip, and no mutating probe.

## Reviewer-Facing Content Gate

Reviewer-facing replies must describe only the code/doc/test change, verified no-change rationale, or targeted clarification question. They must not contain tool names, MCP plumbing, workflow diagnostics, operator instructions, gatekeeper status, handoff status, ID-resolution mechanics, or apologies for tooling limitations. If the only honest content would violate this gate, do not post it; report the diagnostic only in the operator-facing Output Format.

## Partial Failure Buckets

Process reply-then-resolve pairs conservatively:

- `reply+resolve`: reply succeeded and resolution succeeded.
- `reply-only`: reply succeeded and resolution failed; do not retry the reply without explicit operator approval.
- `untouched`: reply was not attempted because a prerequisite or earlier sub-action failed.
- `blocked`: missing real reply ID, missing direct reply `commentId`, rejected `commentId` provenance, missing real thread ID, unsubmitted or unconfirmed pending review, required abandon/delete not completed, or unavailable exact surface.

(When pending-review inline support is not granted, `pending-staged`, `pending-submit-failed`, `pending-submit-unconfirmed`, and `abandoned` buckets are not applicable.)

On the first per-thread reply or resolve failure, stop the loop and report counts plus thread IDs in each bucket. Do not issue duplicate replies as automatic recovery.

## Output Contract

Return:

- Reply/resolve plan by thread.
- Reviewer-facing reply text for each thread that will receive a reply, including its evidence mode: fix-backed SHA, touched-file SHA, verified no-change evidence/provenance, disagreement evidence/provenance, or clarification question provenance.
- Reply surface for each reply: direct existing-comment or new-review feedback; direct existing-comment entries include operator-facing `commentId` provenance status without leaking ID mechanics into reviewer-facing text.
- External-content gate result.
- Reply/resolve execution status by thread.
- Partial failure buckets with counts and real thread IDs.
- Threads intentionally not replied to or not resolved, with operator-facing reasons.
