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
- **Use local git execution only through an authorized specialist.** Commit creation, amend, or history rewrite must be done through local git execution by the appropriate edit/execute-capable specialist under workflow/user authorization. The orchestrator must not create commits directly.
- **Stop when local execution is unavailable.** If authorized local execution/delegation is unavailable, stop and report blocked, or draft the message only.
- **No GitHub file mutation substitutes.** Do not use `mcp_github_create_or_update_file`, `mcp_github_push_files`, or `mcp_github_delete_file` as commit, amend, branch-preparation, push, or recovery substitutes.
- **Pass message text via `-F <message-file>` only.** Commit messages must reach git via `-F <message-file>` from a file written by an authorized file-write tool. Never use `git commit -m "..."`, `-m '...'`, `echo ... > file`, `printf ... > file`, `cat <<EOF`, or any other shell-interpolated path for the message. See `workflow-safety-gates` "Shell-Safe Local Execution" for the canonical rule.

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