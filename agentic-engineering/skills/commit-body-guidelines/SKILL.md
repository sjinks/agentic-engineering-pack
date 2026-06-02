---
name: commit-body-guidelines
description: "Use when: writing, reviewing, revising, validating, or applying structured commit bodies; selecting relevant commit body sections; explaining commit rationale; preserving Markdown headings in git commit messages."
argument-hint: "Optional: target diff, commit SHA/range, proposed message, issue key, or whether to create/amend the commit."
user-invocable: true
---

# Commit Body Guidelines

Use when a commit message needs a required body explaining the reasoning. The body should be structured, concise, and useful to reviewers or maintainers.

This skill complements `conventional-commits`: use Conventional Commits for the summary line and this skill for the body.

## Core Rule

Always include a commit body. The body explains reasoning, not merely restating the diff. For trivial changes such as formatting-only commits, a concise body is acceptable: `No functional changes.`

## Safety Rules

- **Apply `workflow-safety-gates` before executable commit guidance.** Confirm real target workspace/repo, current branch, default/base branch, upstream/remote, dirty/staged/unstaged scope, pushed/shared status, exact range/branch/SHA/path.
- **Draft only when scope uncertain.** If ambiguous, draft/revise message only and report blocker.
- **Use local git execution only through authorized specialist.** Commit creation/amend/history rewrite requires workflow/user authorization.
- **Stop when local execution unavailable.**
- **No GitHub file mutation substitutes.** Do not use `mcp_github_*` as commit/amend/push substitutes.
- **Pass message via `-F <message-file>` only.** Never use `git commit -m`, `-m '...'`, echo/printf/heredoc. See `workflow-safety-gates` "Shell-Safe Local Execution".

## Body Structure

Use relevant Markdown section headers in order. Omit sections without useful information; no empty/filler sections.

```markdown
## Purpose and Context

Explain problem, feature, background, motivation, constraints, related issues.

## Key Changes

- List important code-level changes: functions, refactoring, deletions, config changes, dependencies, API changes.

## Impact and Considerations

Note impact on behavior, performance, security, compatibility, deployment, data, configuration, UX. Mention migrations, config changes, rollout concerns, limitations, side effects.

## Testing and Validation

Describe tests added/updated/run. Describe manual validation. If not run, state clearly.
```

Prefer `Purpose and Context` (body must explain why). Include `Testing and Validation` when tested, should have been tested, or needs explicit note validation wasn't run. Omit `Key Changes` or `Impact and Considerations` when summary/remaining body already covers the information.

## Optional Signals

Include only when relevant:

- **Related work:** Issue/ticket/PR/project references.
- **Decision notes:** Why this approach over alternatives.
- **Compatibility:** API/CLI/config/data format/migration/deprecation notes.
- **Risk and rollout:** Feature flags, deployment order, rollback, operations.
- **Security and privacy:** Auth, permissions, tenancy, secrets, PII, logging, data exposure.
- **Performance:** Effect, tradeoff, measurement.
- **Follow-up:** Concrete out-of-scope tasks.
- **Trailers:** `BREAKING CHANGE:`, `Fixes`, `Closes`, `Refs`, `Co-authored-by:`, repository-standard trailers.

Do not add to fill space. The body should answer what the diff cannot: why the change exists, what reviewers should notice, what maintainers must not miss.

## Audience and Content

The commit body is written for code reviewers reading the PR, engineers running `git blame` years later, release-note compilers, and anyone bisecting history. The workflow operator who triggered this commit is not the audience.

The body must contain only content useful to those audiences:

- The problem the change addresses and why it exists.
- The important code-level changes (when not obvious from the diff).
- Impact, compatibility, security, performance, migration, or rollout notes when relevant.
- Validation honestly described in plain engineering terms.
- Issue/ticket references when they explain the context.

First apply `workflow-safety-gates` Externally-Posted Content Gate. Then apply commit-body-specific forbidden content below. The forbidden categories, positive rules, authorship-disclosure carve-out, and anti-pattern example are defined canonically in `workflow-safety-gates` Externally-Posted Content Gate. This section adds commit-body-specific guidance only.

**Commit-body-specific forbidden content (in addition to the Externally-Posted Content Gate Forbidden list).** Because commit bodies are durable history — re-cloned, mirrored, indexed, and operationally expensive to scrub — never paste any of the following into a commit body, even when the diff happens to include them:

- Secrets, tokens, API keys, passwords, signing keys, OAuth credentials, or any header containing `Authorization:`, `Bearer`, `Cookie:`, or equivalent credential material.
- Customer or end-user personal data (names, emails, account IDs, IP addresses, support ticket text, log lines containing user identifiers).
- Internal hostnames, internal IP addresses, internal URLs, internal infrastructure paths (`/srv/`, `/var/log/`, `/opt/<service>/`, cluster names, Kubernetes namespaces) that reveal production topology.
- Full log dumps, full stack traces, or full HTTP response bodies. Summarize the failure mode in plain engineering terms; the body MUST stand on its own as an engineering record. External links (CI run URL, log artifact URL, gist URL) are permitted ONLY as supplemental references to a self-contained summary, not as a substitute for the summary itself. CI logs default to 90-day retention; gists and CI artifact URLs are revocable and can 404 over the lifetime of the commit history. A body whose evidence is a bare link to an external artifact becomes a tombstone link.
- Full file contents or full diffs pasted into the body (the diff is already in the commit; do not duplicate it in prose).
- Code snippets copied from license-incompatible sources — copyleft (GPL/AGPL) project code embedded in a permissively-licensed repository's commit body, commercial-vendor sample code with restrictive terms, or code copied from sources with unknown license. Commit bodies are durable license-bearing artifacts and embedded code carries the source's license terms. Describe the algorithm or approach in your own words; do not paste licensed code into the commit body.

If any of these categories must be referenced to explain the change, replace the literal content with a sanitized summary or a stable link to a non-public artifact. Suspected leak of any item in this list into a pushed commit body is NOT self-cleaning and requires this remediation sequence in order:

1. **For credentials, tokens, signing keys, or any other authenticator** — rotate or revoke the leaked credential FIRST, verify the old credential is rejected by the system that issued it, and update any service or operator that still references the old credential. Do this before any history rewrite. Once pushed, the credential is compromised independent of the rewrite — every clone, fork, mirror, CI cache, and account that fetched between the push and the rewrite retains it. History rewrite without prior rotation is theater and produces a false "remediated" signal.
2. **Then schedule a history rewrite under `commit-hygiene`** with explicit verbatim user approval per the `workflow-safety-gates` Local Git Mutation Delegation Contract. When the rewrite proceeds, the `commit-hygiene` Pre-Rewrite Checks create a backup branch (`<current>-pre-cleanup-<timestamp>`); for leak-remediation rewrites, that backup branch itself contains the leak in its full pre-rewrite form. The backup branch MUST be created on an isolated filesystem path or recorded as a git bundle outside the working tree, MUST NEVER be pushed to any remote (including via `git push --all` or `git push --mirror`), and MUST be deleted (and any bundle file securely removed) after rotation, the remote rewrite, and any fork or mirror coordination complete. If the leak landed on the default branch, the `commit-hygiene` "current branch is NOT the default branch" refusal applies — use `git filter-repo`, BFG, or the GitHub support ticket process for orphan-SHA removal; this skill stops at the boundary of those tools.
3. **Finally, verify the rotated credential is not embedded in the rewritten history** and coordinate fork/mirror invalidation as appropriate.

A commit body explains the change to a future maintainer who has no knowledge of how the change was produced. Write it as that maintainer would want to read it. If the only content available would be workflow trace, the commit is probably not ready — return to the diff and write a body about the change itself, or note honestly that the change is trivial (see Core Rule).

## Writing Procedure

1. **Inspect the change.**
   - Run `git status --short` to understand staged and unstaged files.
   - Run `git diff --staged` for staged commits, or `git diff HEAD` when drafting from current work.
   - If revising an existing commit, inspect it with `git show --stat --patch <commit-ish>`.
   - When revising existing commits or referring to commit-ish values, use real commit SHAs/ranges from read-only inspection. Do not use placeholder or example commit-ish values in actual git commands.
   - These inspection commands are read-only. Mutating commit, amend, or rewrite commands require the safety rules above.

2. **Identify the reason for the change.**
   - State the problem, motivation, user need, bug, risk, or maintenance reason.
   - Include issue IDs or links when they materially explain the context.

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

When creating a commit message that contains Markdown headings after workflow safety preflight passes and authorized local git execution/delegation is available, use one of these approaches:

1. Write the prepared commit message (with Markdown headings) to a message file using an authorized file-write tool.
2. Invoke `git commit -F <message-file> --cleanup=whitespace` (or `git commit --amend -F <message-file> --cleanup=whitespace` for amend). The `--cleanup=whitespace` option preserves lines beginning with `#` while trimming trailing whitespace.
3. After commit/amend, verify the recorded message using the byte-preserving raw extraction procedure defined in `workflow-safety-gates` "Shell-Safe Local Execution" Post-Commit Verification. Do not use `git log -1 --pretty=%B` for this step — it appends an extra trailing newline that causes false corruption reports. If the raw extraction and source file differ, stop and report a corruption blocker per that gate.

`--cleanup=verbatim` is acceptable when the message must be preserved exactly. Avoid `--cleanup=strip` for Markdown-headed bodies because it removes comment-character lines. Never use `git commit -m`, `--message`, or any shell-interpolated form; the message reaches git only via `-F`.

**Placeholder caution:** When this skill writes `<message-file>` in examples, it is a documentation placeholder for the literal path to your commit message file. Do not pass the literal string `<message-file>` to any command. Substitute the actual path (for example, `.git/COMMIT_EDITMSG` or a file you wrote with `git commit -F path/to/message.txt`).

If preflight, approval, or local execution/delegation is unavailable, do not provide executable commit commands; return the commit message and blocked status instead.

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

- **Commit message:** The complete message in a fenced `text` code block.
- **Body rationale:** A brief note explaining the main reasoning captured in the body.
- **Validation note:** Any tests or checks reflected in the message, including when none were run.
- **Commit command guidance:** When the message uses Markdown headings and the user wants to commit, include the two-step `-F` command guidance (write the message to a file with an authorized file-write tool, then `git commit -F <message-file> --cleanup=whitespace`) only after `workflow-safety-gates` Shell-Safe Local Execution and Local Git Mutation Delegation Contract preflight passes, authorized local execution/delegation is available, and a real message file path is known. Never include or recommend a `git commit -m "..."` form. If preflight fails or local execution is unavailable, report blocked and provide the message only.