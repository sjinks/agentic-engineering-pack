---
name: pr-review-thread-context
description: "Internal use when: acquiring GitHub PR review-thread context, real thread IDs, comment reply IDs, fresh unresolved/reopened snapshots, and per-subaction blockers."
argument-hint: "PR context, repository, branch, and the specific reply/resolve/read sub-actions that need IDs."
user-invocable: false
---

# PR Review Thread Context

Acquire PR review context and real identifiers for `pr-review-comments-workflow`. This skill is internal: the user-facing entry point remains `pr-review-comments-workflow`.

## Scope

- Identify the active PR, repository, head/base branch, PR head SHA, review comments, thread state, and real IDs required for reply or resolution sub-actions.
- Produce a fresh unresolved/reopened snapshot before `review-cycle-gatekeeper` and before reply/resolve actions.
- Block only the affected sub-action when an ID needed for that sub-action is missing.
- Do not infer IDs from paths, line numbers, arbitrary URLs, user-provided fragments, stale cache, search snippets, placeholders, guesses, or prior partial reads. The only URL-derived exception is the narrow `html_url` `#discussion_r<digits>` fallback described under ID Mapping, and only for direct existing-comment replies.

## Approved Read Paths

Use the first available read-only source that satisfies the needed fields:

1. `github.vscode-pull-request-github/activePullRequest` for active PR context in VS Code. This is approved read-only PR context acquisition; it does not authorize reply or resolution.
2. MCP `get_review_comments` (`mcp_github_pull_request_read` with method `get_review_comments`) for review comments and thread metadata when available.
3. Orchestrator-mediated `gh api graphql` fallback when extension or MCP reads are unavailable or omit actual thread node IDs or comment database IDs. This fallback is approval-bound and may run only through an environment-inspector or equivalent local read-only handoff with exact repository, PR number, command scope, and output-minimization instructions from the orchestrator. Specialists must not run `gh api graphql`, request broad GitHub access, or acquire GitHub context directly. Query only the minimum shape needed for owner/repo/PR identity, review thread node IDs, and review comment database IDs. The query shape must include review-thread pagination and nested-comment pagination metadata: `repository.pullRequest.reviewThreads(first: 100, after: $reviewThreadsCursor) { pageInfo { hasNextPage endCursor } nodes { id isResolved comments(first: 50, after: $commentsCursor) { pageInfo { hasNextPage endCursor } nodes { databaseId } } } }`. Exhaust `reviewThreads.pageInfo` and each `comments.pageInfo` cursor needed for the selected threads; if any required cursor cannot be exhausted or proven unnecessary, return an incomplete/blocked snapshot rather than a fresh complete snapshot. Do not expose full payloads, review bodies, secrets, credentials, or unrelated repository data; pass only distilled IDs/context, pagination provenance, and read/not-read boundaries onward.

Do not use any mutating GitHub, VS Code, or shell command as a probe to discover whether an ID is valid.

## ID Mapping

- Review thread node ID: `reviewThreads.nodes.id`, commonly `PRRT_...`. Use this only for thread resolution/unresolution. It is not a comment ID, `commentId`, URL, file path, or line number.
- Review comment database ID: `reviewThreads.nodes.comments.nodes.databaseId`, numeric. Use this as the reply target when the selected reply tool requires a comment/reply ID. It is not the thread node ID.
- Direct existing-comment reply `commentId`: numeric. Prefer a direct numeric field from an approved fresh GitHub or VS Code PR extension read for the exact review comment, such as a tool-returned numeric `id`, `databaseId`, or documented review-comment reply ID. If no direct numeric field is available, the only fallback is parsing the exact `#discussion_r<digits>` fragment from that same exact comment's `html_url`. Do not parse arbitrary pasted URLs or user-provided fragments. Reject missing, malformed, non-numeric, stale, partial, search-snippet, non-exact-comment, conflicting, or thread-node values. If both a direct numeric field and the parsed `html_url` fallback are present, they must match; disagreement blocks the reply sub-action.
- PR head SHA: the commit SHA from real PR data after the latest push visibility check. It is not a local-only commit unless visibility has been confirmed.

## Output Contract

Return:

- PR identity: owner, repo, PR number, URL if available, head branch, base branch, PR head SHA, and source path for each field.
- Read paths used: active PR extension read, MCP `get_review_comments`, GraphQL fallback, or not used, with success/failure status.
- Freshness: timestamp or sequence point, whether the snapshot is pre-push or post-push, and whether it is fresh for gatekeeper/reply/resolve.
- Thread snapshot: unresolved/reopened threads, resolved threads when relevant, outdated status when available, cited file/region, latest reviewer comment, thread node ID if available, comment database ID if available, direct existing-comment reply `commentId` if available, and whether review-thread and nested-comment pagination was exhausted or intentionally not needed.
- Per-subaction readiness: `reply-ready`, `resolve-ready`, `gatekeeper-ready`, or `blocked` for each thread/sub-action.
- Direct reply provenance: for each fallback-derived `commentId`, provide an operator-facing summary with read source, freshness point, exact-comment match basis, unavailable direct numeric field, parsed `html_url` fragment, and direct-vs-fallback disagreement check. Do not include this provenance summary in reviewer-facing replies.
- Per-subaction blockers: missing thread node ID, missing comment database ID or direct reply `commentId`, invalid `html_url` fragment, stale or partial snapshot, exact-comment mismatch, direct/fallback disagreement, missing PR number, missing repository owner/name, missing PR head SHA, incomplete pagination, read failure, or tool unavailable.

## Hard Stops

- If a required real critical identifier is unavailable, block only the affected reply or resolve sub-action and report the missing field.
- If the fresh unresolved/reopened snapshot cannot be produced, gatekeeper input is unknown; pass a blocker to `pr-review-round-closure` rather than reusing stale data.
- If GraphQL fallback pagination cannot be exhausted for the needed `reviewThreads` or nested `comments` connections, mark the snapshot incomplete/blocked and do not present it as fresh or gatekeeper-ready.
- If only an arbitrary URL, file path, line number, user-provided fragment, guessed value, placeholder, dummy ID, search snippet, stale cache, or prior partial read is available, treat the ID as missing. The only URL-derived exception is the exact fresh-read `html_url` `#discussion_r<digits>` fallback for direct existing-comment reply `commentId`, under the provenance and fail-closed rules above.
- GitHub repository file mutation tools remain denied and are never a context fallback.
