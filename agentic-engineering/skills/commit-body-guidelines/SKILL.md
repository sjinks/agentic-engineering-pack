---
name: commit-body-guidelines
description: "Use when: writing, reviewing, revising, validating, or applying structured commit bodies; selecting relevant commit body sections; explaining commit rationale; preserving Markdown headings in git commit messages."
argument-hint: "Optional: target diff, commit SHA/range, proposed message, issue key, or whether to create/amend the commit."
user-invocable: true
---

# Commit Body Guidelines

Use this skill when a commit message needs a required body that explains the reasoning behind the change. The body should be structured, concise, and useful to reviewers or future maintainers who need to understand why the change exists.

This skill complements `conventional-commits`: use Conventional Commits for the summary line and this skill for the body content.

## Core Rule

Always include a commit body. The body must explain the reasoning behind the change, not merely restate the diff.

For trivial changes, such as formatting-only commits, a concise body is acceptable:

```text
No functional changes.
```

## Safety Rules

- **Apply workflow-safety-gates before executable commit guidance.** Before creating, amending, applying, or recommending executable commit commands, apply `workflow-safety-gates` and confirm the real target workspace/repo, current branch, default/base branch, upstream/remote, dirty/staged/unstaged scope, pushed/shared status, and exact target range/branch/SHA/path where relevant.
- **Draft only when scope is uncertain.** If the target repository, branch, upstream, dirty/staged/unstaged scope, pushed/shared status, target range, target path, or commit-ish values are ambiguous, draft or revise the message only and report the blocker.
- **Use local git execution only after delegated mutation gates pass.** Commit creation, amend, or history rewrite requires passed `workflow-safety-gates` preflight plus a satisfied Local Git Mutation Delegation Contract that names an edit/execute-capable specialist or an explicitly approved local execution path. The orchestrator must not create commits directly.
- **Stop when requested local execution is unavailable.** If requested executable guidance cannot pass preflight, approval, local execution/delegation, scope validation, or executable command guidance checks, return `Status: blocked`. Return `Status: draft-only` only when executable guidance is not requested and a body can still be drafted, reviewed, or revised.
- **Pass message text via `-F <message-file>` only.** Commit messages must reach git via `-F <message-file>` from a file written by an authorized file-write tool. Never use `git commit -m "..."`, `-m '...'`, `echo ... > file`, `printf ... > file`, `cat <<EOF`, or any other shell-interpolated path for the message. See `workflow-safety-gates` "Shell-Safe Local Execution" for the canonical rule.

## Status Contract

Return exactly one operator-facing status:

- `Status: ready` only when executable command guidance was requested, the message body is ready, and the message body plus executable guidance are allowed by passed preflight, approval, local execution/delegation, scope validation, and `-F <message-file>` guidance checks.
- `Status: draft-only` when a body can be drafted, revised, or reviewed and executable guidance is not requested.
- `Status: blocked` when preflight, approval, local execution/delegation, scope validation, or executable command guidance is blocked.

When executable guidance is requested and blocked, `Status: blocked` takes precedence over `Status: draft-only` even if a draft or revised body can still be included.

For drafting from a diff, rationale-to-diff validation, or requested executable guidance, empty or no relevant diff, staged-commit requests with no staged changes, or unrelated changes outside the requested scope block the request. Return `Status: blocked`, do not invent rationale, list the exact missing diff, missing staged changes, or unrelated files/ranges, and ask for the intended files, diff, or range. These scope blockers do not block content-only validation of an existing or proposed commit body. For content-only validation without a relevant diff, return `Validation: pass` or `Validation: fail` with a caveat that diff alignment and rationale-to-diff fit were not checked.

## Validation and Review Mode

When asked to validate, review, or revise an existing or proposed commit body, do not rewrite it by default. Validate it against the Core Rule, Audience and Content rules, forbidden content rules, structure guidance, and Testing and Validation honesty.

Return `Validation: pass`, `Validation: fail`, or `Validation: not requested`. For failed validation, list the failed checks and concise evidence. Provide a revised body only when the user asks for a revision or when the requested task is explicitly to rewrite the body.

When no relevant diff is available, content-only validation of an existing or proposed body is still allowed. Include a caveat that diff alignment and rationale-to-diff fit were not checked; block only requested rationale-to-diff validation, drafting-from-diff, or executable guidance that needs the missing scope.

## Body Structure

Use the relevant Markdown section headers in this order. Omit sections that do not add useful information; do not include empty or filler sections.

```markdown
## Purpose and Context

Explain what problem this change addresses or what feature it implements.
Mention relevant background, motivation, constraints, or related issues.

## Key Changes

- List the most important code-level changes.
- Include new functions, refactored components, deleted code, config
  changes, dependency updates, or API changes.

## Impact and Considerations

Note impact on system behavior, performance, security, compatibility,
deployment, data, configuration, or user experience.

Mention migrations, configuration changes, rollout concerns, limitations,
or known side effects when relevant.

## Testing and Validation

Describe tests that were added, updated, or run.

Describe manual validation performed or still required. If validation was
not run, state that clearly.
```

Prefer keeping `Purpose and Context` because the body must explain why the change exists. Include `Testing and Validation` when the change was tested, should have been tested, or needs an explicit note that validation was not run. Omit `Key Changes` or `Impact and Considerations` when the summary and remaining body already cover the relevant information clearly.

## Optional Signals

Include these details only when they are relevant and useful:

- **Related work:** Issue, ticket, pull request, or project references.
- **Decision notes:** Why this approach was chosen over obvious alternatives.
- **Compatibility:** API, CLI, config, data format, migration, or deprecation notes.
- **Risk and rollout:** Feature flags, deployment order, rollback path, or operational concerns.
- **Security and privacy:** Auth, permissions, tenancy, secrets, PII, logging, or data exposure impact.
- **Performance:** Expected performance effect, tradeoff, or measurement result.
- **Follow-up work:** Concrete follow-up tasks that are intentionally out of scope.
- **Trailers:** `BREAKING CHANGE:`, `Fixes`, `Closes`, `Refs`, `Co-authored-by:`, or other repository-standard trailers.

Do not add optional signals just to fill space. The body should answer what the diff cannot: why the change exists, what reviewers should notice, and what future maintainers must not miss.

## Audience and Content

The commit body is written for code reviewers reading the PR, engineers running `git blame` years later, release-note compilers, and anyone bisecting history. The workflow operator who triggered this commit is not the audience.

The body must contain only content useful to those audiences:

- The problem the change addresses and why it exists.
- The important code-level changes (when not obvious from the diff).
- Impact, compatibility, security, performance, migration, or rollout notes when relevant.
- Validation honestly described in plain engineering terms.
- Issue/ticket references when they explain the context.

The forbidden categories, positive rules, authorship-disclosure carve-out, and anti-pattern example are defined canonically in `workflow-safety-gates` Externally-Posted Content Gate. This section adds commit-body-specific guidance only.

**Commit-body-specific forbidden content (in addition to the Externally-Posted Content Gate Forbidden list).** Because commit bodies are durable history — re-cloned, mirrored, indexed, and operationally expensive to scrub — never paste any of the following into a commit body, even when the diff happens to include them:

- Secrets, tokens, API keys, passwords, signing keys, OAuth credentials, or any header containing `Authorization:`, `Bearer`, `Cookie:`, or equivalent credential material.
- Customer or end-user personal data (names, emails, account IDs, IP addresses, support ticket text, log lines containing user identifiers).
- Internal hostnames, internal IP addresses, internal URLs, internal infrastructure paths (`/srv/`, `/var/log/`, `/opt/<service>/`, cluster names, Kubernetes namespaces) that reveal production topology.
- Full log dumps, full stack traces, or full HTTP response bodies. Summarize the failure mode in plain engineering terms; the body MUST stand on its own as an engineering record. External links (CI run URL, log artifact URL, gist URL) are permitted ONLY as supplemental references to a self-contained summary, not as a substitute for the summary itself. CI logs default to 90-day retention; gists and CI artifact URLs are revocable and can 404 over the lifetime of the commit history. A body whose evidence is a bare link to an external artifact becomes a tombstone link.
- Full file contents or full diffs pasted into the body (the diff is already in the commit; do not duplicate it in prose).
- Code snippets copied from license-incompatible sources — copyleft (GPL/AGPL) project code embedded in a permissively-licensed repository's commit body, commercial-vendor sample code with restrictive terms, or code copied from sources with unknown license. Commit bodies are durable license-bearing artifacts and embedded code carries the source's license terms. Describe the algorithm or approach in your own words; do not paste licensed code into the commit body.

If any of these categories must be referenced to explain the change, replace the literal content with a sanitized summary or a stable link to a non-public artifact. Suspected leak of any item in this list into a pushed commit body is a hard stop: return `Status: blocked` and route remediation through `workflow-safety-gates` and `commit-hygiene`. Credentials, tokens, signing keys, and other authenticators must be rotated or revoked before any history rewrite. Rewriting a pushed leak requires explicit approval under the Local Git Mutation Delegation Contract. Backup branches, bundles, patches, or other artifacts that contain the leak must not be pushed and must be deleted after the remediation path completes. Leaks on the default branch route out to specialized history-scrubbing support such as `git filter-repo`, BFG, or GitHub support; this skill stops at that boundary.

A commit body explains the change to a future maintainer who has no knowledge of how the change was produced. Write it as that maintainer would want to read it. If the only content available would be workflow trace, the commit is probably not ready — return to the diff and write a body about the change itself, or note honestly that the change is trivial (see Core Rule).

## Writing Procedure

1. **Inspect the change.**
   - Run `git status --short` to understand staged and unstaged files.
   - Run `git diff --staged` for staged commits, or `git diff HEAD` when drafting from current work.
   - If revising an existing commit, inspect it with `git show --stat --patch <commit-ish>`.
   - When revising existing commits or referring to commit-ish values, use real commit SHAs/ranges from read-only inspection. Do not use placeholder or example commit-ish values in actual git commands.
   - If drafting from a diff, validating rationale-to-diff fit, or giving executable guidance is requested and there is no relevant diff, no staged changes for a staged-commit request, or unrelated changes outside the requested scope, stop with `Status: blocked`; list the exact missing or unrelated scope and ask for the intended files, diff, or range. Continue only for content-only validation of an existing or proposed body, with the diff-alignment caveat from Validation and Review Mode.
   - These inspection commands are read-only. Mutating commit, amend, or rewrite commands require the safety rules above.

2. **Identify the reason for the change.**
   - State the problem, motivation, user need, bug, risk, or maintenance reason.
   - Include issue IDs or links when they materially explain the context.
   - If the reason cannot be determined from the diff, request, issue context, or supplied body, do not invent one; return `Status: blocked` for drafting-from-diff or rationale-to-diff validation and ask for the missing rationale. For content-only validation, state that rationale-to-diff fit was not checked.

3. **Summarize key changes when useful.**
   - Name the important code-level changes without copying the entire diff.
   - Prefer bullets for multiple changes.
   - Omit this section for tiny changes where it would only repeat the subject.

4. **Describe impact and tradeoffs when relevant.**
   - Mention behavior changes, compatibility concerns, security or performance impact, migrations, configuration, deployment, or rollout notes.
   - Omit this section when there are no meaningful impact notes beyond the rest of the body.

5. **Record validation honestly.**
   - List tests added, updated, or run.
   - Include manual checks when relevant.
   - If tests were not run, write a short, truthful note such as `Not run; documentation-only change.` or `Not run; local environment unavailable.`

## Formatting Rules

- Separate the summary line and body with one blank line.
- Wrap body lines at about 72 characters.
- Use full sentences in present tense.
- Use professional, neutral, technically clear language.
- Avoid vague phrases such as `various fixes`, `cleanup`, or `updates` unless the body makes them specific.
- Use Markdown headers and lists for structure when they improve readability.
- Omit irrelevant sections instead of writing `N/A`, `none`, or filler text.
- Include a `BREAKING CHANGE:` footer when the commit changes public APIs, CLI behavior, config, data formats, or other compatibility contracts.

## Git Cleanup Rule for Markdown Headings

Git treats lines starting with the configured comment character, usually `#`, as commit message comments when using the editor. That can remove Markdown headings such as `## Purpose and Context` during cleanup.

When creating a commit message that contains Markdown headings after `workflow-safety-gates` preflight passes and the Local Git Mutation Delegation Contract names an edit/execute-capable specialist or an explicitly approved local execution path, use one of these approaches:

In the command forms below, `<message-file>` is a placeholder; replace it with a real approved path before execution.

1. Write the prepared commit message (with Markdown headings) to a message file using an authorized file-write tool.
2. Invoke `git commit -F <message-file> --cleanup=whitespace` (or `git commit --amend -F <message-file> --cleanup=whitespace` for amend). The `--cleanup=whitespace` option preserves lines beginning with `#` while trimming trailing whitespace.
3. After commit/amend, verify the recorded message using the byte-preserving raw extraction procedure defined in `workflow-safety-gates` "Shell-Safe Local Execution" Post-Commit Verification. Do not use `git log -1 --pretty=%B` for this step — it appends an extra trailing newline that causes false corruption reports. If the raw extraction and source file differ, stop and report a corruption blocker per that gate.

`--cleanup=verbatim` is acceptable when the message must be preserved exactly. Avoid `--cleanup=strip` for Markdown-headed bodies because it removes comment-character lines. Never use `git commit -m`, `--message`, or any shell-interpolated form; the message reaches git only via `-F`.

**Placeholder caution:** When this skill writes `<message-file>` in examples, it is a documentation placeholder for the literal path to your commit message file. Do not pass the literal string `<message-file>` to any command. Substitute an approved workspace path such as `commit-message.txt` or another real path supplied by the delegation contract.

If executable commit or amend guidance was requested and preflight, approval, or local execution/delegation is unavailable, do not provide executable commit commands; return `Status: blocked`; include the commit message only when drafting or revising remains valid.

Do not globally change `core.commentChar` unless the user explicitly wants that repository or global preference changed.

## Example Commit Message

```text
feat(auth): add refresh token rotation

## Purpose and Context

The existing session flow keeps long-lived refresh tokens valid after
use, which increases risk if a token is leaked. Rotating refresh tokens
reduces replay exposure while preserving the current login experience.

## Key Changes

- Add refresh token rotation during session renewal.
- Store the replacement token before returning the renewed session.
- Reject reuse of an already-rotated refresh token.

## Impact and Considerations

Users remain signed in during normal renewal. Clients that retry with an
old refresh token receive an authentication failure and must restart the
login flow. No database migration is required.

## Testing and Validation

Added unit coverage for successful rotation and reused-token rejection.
Ran the authentication test suite locally.
```

## Output Format

Return:

- **Status:** `ready`, `draft-only`, or `blocked`.
- **Validation:** `pass`, `fail`, or `not requested`; when validation fails, list the failed checks.
- **Blockers:** Exact preflight, approval, local execution/delegation, scope validation, executable command guidance, missing diff, missing staged changes, unrelated changes, or real message-file path blockers; write `none` only when there are no blockers.
- **Commit message:** When drafting or revising, return the complete message in a fenced `text` code block.
- **Body rationale:** A brief note explaining the main reasoning captured in the body.
- **Validation note:** Any tests or checks reflected in the message, including when none were run.
- **Commit command guidance:** Include executable command guidance only when requested, all gates pass, local execution/delegation is available, and a real message-file path is known. When the message uses Markdown headings and the user wants to commit, include the three-step `-F` command guidance only after `workflow-safety-gates` Shell-Safe Local Execution and Local Git Mutation Delegation Contract preflight passes: write the message to a file with an authorized file-write tool, run `git commit -F <real-message-file-path> --cleanup=whitespace`, then verify the stored message bytes using the byte-preserving raw extraction procedure from `workflow-safety-gates` Post-Commit Verification. Never include or recommend a `git commit -m "..."` form. If preflight fails, local execution is unavailable, or no real message-file path is available, return `Status: blocked` for requested executable guidance and provide the message only when drafting or revising is still valid.