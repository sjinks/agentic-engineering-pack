---
name: pr-review-thread-context
description: "Internal use when: acquiring GitHub PR review-thread context, real thread IDs, comment reply IDs, fresh unresolved/reopened snapshots, and per-subaction blockers from orchestrator-sourced github-context-agent reads."
argument-hint: "PR context from orchestrator handoff, repository, branch, and the specific reply/resolve/read sub-actions that need IDs."
user-invocable: false
---

# PR Review Thread Context

Acquire PR review context and real identifiers for `pr-review-comments-workflow` from orchestrator-sourced github-context-agent reads. This skill is internal: the user-facing entry point remains `pr-review-comments-workflow`.

## Scope

- Receive orchestrator-sourced GitHub context from github-context-agent: active PR identity, repository, head/base branch, PR head SHA, review comments, thread state, and real IDs required for reply or resolution sub-actions.
- Produce a fresh unresolved/reopened snapshot before `review-cycle-gatekeeper` and before reply/resolve actions by requesting fresh github-context-agent reads via the orchestrator.
- Block only the affected sub-action when an ID needed for that sub-action is missing from the orchestrator-sourced context.
- Do not infer IDs from paths, line numbers, arbitrary URLs, user-provided fragments, stale cache, search snippets, placeholders, guesses, or prior partial reads. The only URL-derived exception is the narrow `html_url` `#discussion_r<digits>` fallback described under ID Mapping, and only for direct existing-comment replies.

## Approved Read Paths

GitHub PR review-thread context is owned by `github-context-agent` and accessed via orchestrator handoffs. pr-review-agent does not hold `github/pull_request_read` or `github.vscode-pull-request-github/activePullRequest` grants.

1. **Orchestrator-sourced PR metadata from github-context-agent**: The orchestrator calls `github-context-agent`, which uses `github.vscode-pull-request-github/activePullRequest` and `github/pull_request_read` (with `method=get`, `method=get_review_comments`, `method=get_reviews`) to read PR identity (owner, repo, PR number, URL, head/base branches, PR head SHA), review comments, review history, and thread state. The orchestrator distills this data and passes it in the pr-review-agent handoff.

2. **Orchestrator-provided thread node IDs and comment reply IDs**: The orchestrator's github-context-agent read includes review-thread node IDs (for `resolveReviewThread` operations) and review-comment reply IDs (for `github/add_reply_to_pull_request_comment` operations). These IDs are distilled and passed to pr-review-agent in the handoff.

3. **Orchestrator-sourced fresh unresolved/reopened snapshots from github-context-agent**: When the `pr-review-comments-workflow` coordinator workflow requires a fresh thread state after push visibility (see that workflow's step "Refresh unresolved/reopened review-thread state after push visibility"), the orchestrator invokes github-context-agent again to re-read the thread state, then passes the fresh snapshot to pr-review-agent. This read path applies the `workflow-safety-gates` Remote Read-Only Tool Intent Gate.

When the orchestrator is not on the call path or github-context-agent reads are unavailable, pr-review-agent cannot self-service this context. In that case, report that GitHub context is unavailable and route the operator to the orchestrator-mediated entry path.

## ID Mapping

- Review thread node ID: `reviewThreads.nodes.id`, commonly `PRRT_...`. Use this only for thread resolution/unresolution. It is not a comment ID, `commentId`, URL, file path, or line number.
- Review comment database ID: `reviewThreads.nodes.comments.nodes.databaseId`, numeric. Use this as the reply target when the selected reply tool requires a comment/reply ID. It is not the thread node ID.
- Direct existing-comment reply `commentId`: numeric. Prefer a direct numeric field from an approved fresh GitHub or VS Code PR extension read for the exact review comment, such as a tool-returned numeric `id`, `databaseId`, or documented review-comment reply ID. If no direct numeric field is available, the only fallback is parsing the exact `#discussion_r<digits>` fragment from that same exact comment's `html_url`. Do not parse arbitrary pasted URLs or user-provided fragments. Reject missing, malformed, non-numeric, stale, partial, search-snippet, non-exact-comment, conflicting, or thread-node values. If both a direct numeric field and the parsed `html_url` fallback are present, they must match; disagreement blocks the reply sub-action.
- PR head SHA: the commit SHA from real PR data after the latest push visibility check. It is not a local-only commit unless visibility has been confirmed.

## Output Contract

Return:

- PR identity: owner, repo, PR number, URL if available, head branch, base branch, PR head SHA, and source path for each field.
- Read paths used: active PR extension read, github-context-agent-owned MCP `get`, `get_review_comments`, and `get_reviews` reads, or not used, with success/failure status and read/not-read boundaries.
- Freshness: timestamp or sequence point, whether the snapshot is pre-push or post-push, and whether it is fresh for gatekeeper/reply/resolve.
- Thread snapshot: unresolved/reopened threads, resolved threads when relevant, outdated status when available, cited file/region, latest reviewer comment, thread node ID if available, comment database ID if available, direct existing-comment reply `commentId` if available, and whether review-thread and nested-comment pagination was exhausted or intentionally not needed.
- Per-subaction readiness: `reply-ready`, `resolve-ready`, `gatekeeper-ready`, or `blocked` for each thread/sub-action.
- Direct reply provenance: for each fallback-derived `commentId`, provide an operator-facing summary with read source, freshness point, exact-comment match basis, unavailable direct numeric field, parsed `html_url` fragment, and direct-vs-fallback disagreement check. Do not include this provenance summary in reviewer-facing replies.
- Per-subaction blockers: missing thread node ID, missing comment database ID or direct reply `commentId`, invalid `html_url` fragment, stale or partial snapshot, exact-comment mismatch, direct/fallback disagreement, missing PR number, missing repository owner/name, missing PR head SHA, incomplete pagination, read failure, or tool unavailable.

## Hard Stops

- If a required real critical identifier is unavailable, block only the affected reply or resolve sub-action and report the missing field.
- If the fresh unresolved/reopened snapshot cannot be produced, gatekeeper input is unknown; pass a blocker to `pr-review-round-closure` rather than reusing stale data.
- If github-context-agent-owned reads do not provide the needed `reviewThreads` or nested `comments` IDs, or pagination/read completeness cannot be proven, mark the affected reply/resolve sub-action or gatekeeper snapshot incomplete/blocked and do not present it as fresh or gatekeeper-ready. Do not recover missing IDs through generic GraphQL CLI/API or execute-capable paths.
- If only an arbitrary URL, file path, line number, user-provided fragment, guessed value, placeholder, dummy ID, search snippet, stale cache, or prior partial read is available, treat the ID as missing. The only URL-derived exception is the exact fresh-read `html_url` `#discussion_r<digits>` fallback for direct existing-comment reply `commentId`, under the provenance and fail-closed rules above.
- GitHub repository file mutation tools remain denied and are never a context fallback.
