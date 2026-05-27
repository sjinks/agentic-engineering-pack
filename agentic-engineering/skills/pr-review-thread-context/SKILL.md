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
- Do not infer IDs from URLs, paths, line numbers, fragments, or prior partial reads.

## Approved Read Paths

Use the first available read-only source that satisfies the needed fields:

1. `github.vscode-pull-request-github/activePullRequest` for active PR context in VS Code. This is approved read-only PR context acquisition; it does not authorize reply or resolution.
2. MCP `get_review_comments` (`mcp_github_pull_request_read` with method `get_review_comments`) for review comments and thread metadata when available.
3. Orchestrator-mediated `gh api graphql` fallback when extension or MCP reads are unavailable or omit actual thread node IDs or comment database IDs. This fallback is approval-bound and may run only through an environment-inspector or equivalent local read-only handoff with exact repository, PR number, command scope, and output-minimization instructions from the orchestrator. Specialists must not run `gh api graphql`, request broad GitHub access, or acquire GitHub context directly. Query only the minimum shape needed for owner/repo/PR identity, review thread node IDs, and review comment database IDs. The query shape must include review-thread pagination and nested-comment pagination metadata: `repository.pullRequest.reviewThreads(first: 100, after: $reviewThreadsCursor) { pageInfo { hasNextPage endCursor } nodes { id isResolved comments(first: 50, after: $commentsCursor) { pageInfo { hasNextPage endCursor } nodes { databaseId } } } }`. Exhaust `reviewThreads.pageInfo` and each `comments.pageInfo` cursor needed for the selected threads; if any required cursor cannot be exhausted or proven unnecessary, return an incomplete/blocked snapshot rather than a fresh complete snapshot. Do not expose full payloads, review bodies, secrets, credentials, or unrelated repository data; pass only distilled IDs/context, pagination provenance, and read/not-read boundaries onward.

Do not use any mutating GitHub, VS Code, or shell command as a probe to discover whether an ID is valid.

## ID Mapping

- Review thread node ID: `reviewThreads.nodes.id`, commonly `PRRT_...`. Use this only for thread resolution/unresolution. It is not a comment ID, URL, file path, or line number.
- Review comment database ID: `reviewThreads.nodes.comments.nodes.databaseId`, numeric. Use this as the reply target when the selected reply tool requires a comment/reply ID. It is not the thread node ID.
- PR head SHA: the commit SHA from real PR data after the latest push visibility check. It is not a local-only commit unless visibility has been confirmed.

## Output Contract

Return:

- PR identity: owner, repo, PR number, URL if available, head branch, base branch, PR head SHA, and source path for each field.
- Read paths used: active PR extension read, MCP `get_review_comments`, GraphQL fallback, or not used, with success/failure status.
- Freshness: timestamp or sequence point, whether the snapshot is pre-push or post-push, and whether it is fresh for gatekeeper/reply/resolve.
- Thread snapshot: unresolved/reopened threads, resolved threads when relevant, outdated status when available, cited file/region, latest reviewer comment, thread node ID if available, comment database ID if available, and whether review-thread and nested-comment pagination was exhausted or intentionally not needed.
- Per-subaction readiness: `reply-ready`, `resolve-ready`, `gatekeeper-ready`, or `blocked` for each thread/sub-action.
- Per-subaction blockers: missing thread node ID, missing comment database ID, missing PR number, missing repository owner/name, missing PR head SHA, stale snapshot, incomplete pagination, read failure, or tool unavailable.

## Hard Stops

- If a required real critical identifier is unavailable, block only the affected reply or resolve sub-action and report the missing field.
- If the fresh unresolved/reopened snapshot cannot be produced, gatekeeper input is unknown; pass a blocker to `pr-review-round-closure` rather than reusing stale data.
- If GraphQL fallback pagination cannot be exhausted for the needed `reviewThreads` or nested `comments` connections, mark the snapshot incomplete/blocked and do not present it as fresh or gatekeeper-ready.
- If only a URL, file path, line number, URL fragment, guessed value, placeholder, or dummy ID is available, treat the ID as missing.
- GitHub repository file mutation tools remain denied and are never a context fallback.
