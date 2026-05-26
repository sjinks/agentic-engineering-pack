---
name: conventional-commits
description: "Use when: writing, creating, suggesting, revising, validating, or applying Conventional Commit messages for pending changes, recent commits, release prep, or user-requested commits."
argument-hint: "Optional: target changes, commit SHA/range, issue key, preferred type/scope, or whether to create the commit."
user-invocable: true
---

# Conventional Commits

Use this skill to generate, review, or apply commit messages that follow the Conventional Commits 1.0.0 format. The goal is a clear, atomic message that describes the user-visible or maintenance impact of the change without overstating the scope. Use `commit-body-guidelines` for the required structured body.

## When to Use

- **Generate a commit message** for pending or recent changes.
- **Revise an existing message** to follow Conventional Commits.
- **Validate a commit message** against type, scope, breaking-change, and footer rules.
- **Generate or validate a Pull Request title** in Conventional Commit subject style (subject line only; no body or footers).
- **Pair the summary with a required body** using `commit-body-guidelines`.
- **Prepare release-friendly history** by aligning messages with semantic versioning expectations.
- **Prepare commit execution** when a workflow or user explicitly asks to commit, while leaving local git execution to the appropriate edit/execute-capable specialist after safety gates pass.

## Safety Rules

- **Inspect before writing.** Review the requested change before proposing a message.
- **Do not create commits unless requested or approved.** Generating a message is safe; modifying git history is not automatic.
- **Apply workflow-safety-gates before executable commit guidance.** Before creating, amending, applying, or recommending executable commit commands, apply `workflow-safety-gates` and confirm the real target workspace/repo, current branch, default/base branch, upstream/remote, dirty/staged/unstaged scope, pushed/shared status, and exact target range/branch/SHA/path where relevant.
- **Confirm real commit scope before applying.** Creating or applying commits requires real staged/unstaged scope confirmation; do not put placeholder commit SHAs/ranges or issue IDs in commit messages or footers. If scope, repository, branch, upstream, pushed/shared status, target path, or references are uncertain, draft the message only and report the blocker.
- **Use local git execution only through an authorized specialist.** Commit creation, amend, or history rewrite must be done through local git execution by the appropriate edit/execute-capable specialist under workflow/user authorization. The orchestrator must not create commits directly.
- **Stop when local execution is unavailable.** If authorized local execution/delegation is unavailable, stop and report blocked, or draft the message only.
- **No GitHub file mutation substitutes.** Do not use `mcp_github_create_or_update_file`, `mcp_github_push_files`, or `mcp_github_delete_file` as commit, amend, branch-preparation, push, or recovery substitutes.
- **Preserve unrelated user work.** If the working tree contains unrelated changes, call that out and keep the message scoped to the requested changes.
- **Prefer one logical change per commit.** If the diff contains unrelated work, suggest splitting it into multiple commits.
- **Avoid claiming verification that was not run.** Mention tests only when the diff or user request makes them relevant, and only report actual results.
- **Commit subject and body reach git via `-F <message-file>` only.** Even a single-line conventional subject must not be passed through `git commit -m "..."` or any shell-interpolated argv; a stray `` ` ``, `$`, or `\` in the subject would be evaluated by the shell before git received it. See `workflow-safety-gates` "Shell-Safe Local Execution" for the canonical rule and `commit-body-guidelines` for the file-based execution procedure.
- **Subjects and PR titles are externally-posted content.** Commit subjects appear in `git log`, GitHub UI, release notes, and blame; PR titles appear in the GitHub UI and search. Both surfaces are explicitly Covered by `workflow-safety-gates` Externally-Posted Content Gate. Do not include MCP tool names (`mcp_github_*`, `mcp_linear_*`, `mcp_obsidian_*`, `pull_request_read`, `resolve_thread`, etc.), MCP/host/plumbing state diagnostics, self-referential workflow language ("the skill", "the orchestrator", "handoff log"), workflow status diagnostics ("PR template status", "gatekeeper pass", "freshness refresh"), sentinel strings, or operator-side instructions in subjects or titles. Anti-example (forbidden): `chore(github-mcp): wire mcp_github_pull_request_review_write resolve_thread`. Acceptable replacement that describes the change in reviewer-facing English: `chore(workflow): document approved PR review write tools in the allowlist`.

## Workflow

1. **Inspect the change.** Review the requested change source before writing the message.
2. **Classify the change.** Identify the primary intent, affected scope, breaking-change status, and issue references.
3. **Compose the message.** Use the smallest accurate type and optional scope, then add the required structured body with `commit-body-guidelines`.
4. **Apply only when requested and gated.** Confirm the intended commit content first, apply `workflow-safety-gates`, and use the command guidance in `commit-body-guidelines` only when authorized local execution/delegation is available.

## Message Format

```text
type(scope)!: description

required body

footer trailers when relevant
```

The subject line uses a lowercase type and optional lowercase scope. The **type** is required (e.g., `feat`, `fix`, `docs`). The **scope** names the affected area when useful (e.g., `auth`, `search`). The **`!`** signals a breaking change. The **body** is required in this repository per `commit-body-guidelines` and should explain purpose, key changes, and impact. **Footers** are trailers for breaking changes, issue closure, or co-authors.

## Commit Types

| Type | Use For |
| --- | --- |
| `feat` | A new feature or user-visible capability. |
| `fix` | A bug fix or corrected behavior. |
| `docs` | Documentation-only changes. |
| `style` | Formatting or whitespace changes that do not affect behavior. |
| `refactor` | Code changes that neither fix a bug nor add a feature. |
| `perf` | Performance improvements. |
| `test` | Adding, updating, or fixing tests. |
| `build` | Build system, packaging, or dependency changes. |
| `ci` | CI workflow or automation changes. |
| `chore` | Maintenance work that does not modify source or test behavior. |
| `revert` | Reverting a previous commit. |

## Message Rules

- **Subject:** maximum about 72 characters; imperative mood; present tense; no trailing period.
- **Scope:** optional and lowercase; use a concise module, package, directory, or feature name.
- **Breaking changes:** add `!` after type or scope, and include a `BREAKING CHANGE:` footer.
- **Body:** required; use `commit-body-guidelines` to explain purpose, key changes, impact, and validation; wrap around 72 characters.
- **Footers:** use valid trailers such as `Closes #123`, `Fixes #456`, `Refs #789`, or `Co-authored-by:`.
- **Multiple concerns:** recommend multiple commits instead of a vague combined message.

## Validation

When asked to validate a commit message or PR title, apply this checklist deterministically and report each failed check by name:

1. **Type:** the message begins with a type from the canonical Commit Types table above (`feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert`). Lowercase. No other types are accepted in this pack.
2. **Scope shape (when present):** matches `\(([a-z0-9][a-z0-9-]*)\)` — lowercase alphanumeric with optional hyphens; no spaces, no slashes, no underscores.
3. **Breaking marker (when present):** `!` appears immediately after the type or after the closing paren of the scope, before the colon. No space before `!`. Either `!` in the subject, a `BREAKING CHANGE:` footer, or both, signals a breaking change; downstream tooling treats any of the three forms as breaking.
4. **Separator:** the subject contains `: ` (colon + single space) exactly once between the type/scope and the description.
5. **Description (after the colon):** present (not empty); imperative mood (`add`, `fix`, `rename`, not `added`/`adds`/`adding`); first character lowercase unless it is a proper noun, acronym, or required casing; no trailing period.
6. **Length:** the entire subject line is ≤ 72 characters including type, optional scope, optional `!`, `: `, and description; warn at > 50 characters.
7. **Externally-posted content audit:** the subject contains no MCP tool names, no skill/agent names, no sentinel strings, no workflow-status diagnostics, no self-referential workflow language, per the rule in Safety Rules above.
8. **Anchored regex (machine check):** `^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9][a-z0-9-]*\))?!?: \S.*\S$` matches the subject (anchored at start and end; description must start and end with non-whitespace; multi-line input fails because `.` does not match newlines). The regex alone does not enforce checks 5, 6, 7, 9, or 10; report those as separate items.
9. **Footer and body content audit (when a body or footer is present).** Any commit body, any `BREAKING CHANGE:` footer, and any other footer trailer (`Closes #...`, `Refs ...`, `Co-authored-by:`, etc.) MUST satisfy the `workflow-safety-gates` Externally-Posted Content Gate — commit bodies are explicitly Covered Surfaces, and `BREAKING CHANGE:` footers are extracted verbatim into GitHub release notes and downstream changelog tooling (`conventional-changelog`, `semantic-release`, `release-please`). Audit the body and every footer for MCP tool names, skill/agent names, sentinel strings, workflow-status diagnostics, and self-referential workflow language. Apply the commit-body-specific forbidden list from `commit-body-guidelines` (no secrets, tokens, customer PII, internal hostnames, full log dumps, full file contents).
10. **PR-title-only checks (when validating a PR title).** Apply in addition to checks 1–9: (a) the title field contains a single line — no embedded newlines, no body, no footers; (b) the type and scope describe the PR as a whole, not a single commit (when the PR contains multiple commits with different types, the title type is the dominant `feat`/`fix`/etc.); (c) issue keys appear in the title only when repository convention requires it, otherwise in the PR body. Skip check 10 for commit-subject validation; apply it for PR-title validation.
11. **Description character-class audit.** The description (text after `: `) MUST NOT contain: leading or trailing whitespace; control characters (U+0000–U+001F, U+007F); bidirectional override codepoints (U+202A–U+202E, U+2066–U+2069); zero-width characters (U+200B–U+200D, U+FEFF); ASCII tab characters in the middle of the description. These can spoof rendered output on externally-posted surfaces (`git log`, GitHub UI, release notes, blame).

Report validation results in the form `Validation: pass` or `Validation: fail (checks N, M, ...)` so downstream `## Output Format` consumers can audit which check failed. When a check has sub-rules (for example check 5's imperative-mood / first-character-casing / no-trailing-period rules), report at sub-check granularity in the form `fail (check 5.imperative, check 5.casing)`.

## PR Title Use

PR titles use only the Conventional Commit subject line — the same `type(scope)!: description` form as a commit subject, with the same length, mood, and casing rules. The structured body, footers, and `BREAKING CHANGE:` trailer do NOT apply to a PR title; those live in the PR body (composed by `pull-request-description` and the PR Template Gate) and in the commits themselves.

Rules specific to PR titles:

- Use a single Conventional Commit subject line; no trailing period; no body or footers in the title field.
- The type and scope should describe the PR as a whole, not any single commit. When the PR contains multiple commits with different types, choose the type that best describes the user-visible or maintenance impact (typically the dominant `feat` or `fix`).
- Breaking changes still use `!` after type or scope in the PR title (for example `feat(config)!: rename timeout option to timeoutMs`), and the body explains the break.
- Repository issue keys (Linear, GitHub, JIRA) belong in the PR body. Include the key in the title only if repository convention requires it, and never let the key displace or obscure the conventional subject.
- Treat `commit-body-guidelines` as not applicable to the title; the structured body it defines is for commit bodies and for the PR body, not the PR title.

When validating a PR title, apply the full 11-point Validation checklist above (checks 1–9 cover the subject portion; check 10 covers the PR-title-only rules; check 11 covers the description character-class audit). Report findings using the same per-check reporting form as commit-subject validation.

## Examples

Simple bug fix:

```text
fix(auth): refresh expired sessions before retry

## Purpose and Context

Expired sessions can fail before the refresh path has a chance to renew
the token, which forces users back through login unnecessarily.

## Key Changes

- Refresh expired sessions before retrying authenticated requests.

## Impact and Considerations

Users stay signed in during normal token renewal. No configuration or
database changes are required.

## Testing and Validation

Updated authentication retry coverage for expired-session renewal.
```

Documentation update:

```text
docs(readme): add local setup notes

## Purpose and Context

The README does not describe the local setup path clearly enough for new
contributors.

## Key Changes

- Add setup notes for installing dependencies and running the project.

## Impact and Considerations

This is a documentation-only change with no runtime impact.

## Testing and Validation

Not run; documentation-only change.
```

Feature with issue closure:

```text
feat(search): add pagination controls

## Purpose and Context

Search callers need stable chunks of large result sets without loading
every result at once.

## Key Changes

- Add page and per-page parameters to search requests.
- Preserve existing defaults for callers that do not pass pagination.

## Impact and Considerations

The endpoint continues to return the first page by default. Existing
callers do not need to change.

## Testing and Validation

Added request coverage for explicit and default pagination behavior.

Closes #42
```

Breaking change:

```text
feat(config)!: rename timeout option to timeoutMs

## Purpose and Context

The timeout option does not make its unit clear, which leads to ambiguous
configuration and inconsistent usage.

## Key Changes

- Rename the timeout configuration key to timeoutMs.
- Update configuration loading to read the new key.

## Impact and Considerations

Existing configuration files must be updated before upgrading.

## Testing and Validation

Updated configuration loading tests for the renamed key.

BREAKING CHANGE: The timeout configuration key is now timeoutMs.
Update existing configuration files before upgrading.
```

PR title only (no body or footers):

```text
feat(search): add pagination controls
```

A PR titled with this subject line covers all commits in the PR. The structured body explaining purpose, key changes, impact, and validation belongs in the PR body (see `pull-request-description`), not in this title field.

## Output Format

Return:

- **Recommended message:** The complete commit message, including the required body, in a fenced `text` code block.
- **Rationale:** One short sentence explaining the chosen type and scope when useful.
- **Alternatives:** Only include alternatives when the diff supports more than one reasonable interpretation.
- **Split recommendation:** If the diff contains unrelated concerns, list the suggested commit split instead of forcing one broad message.
- **Commit execution status:** If the user asked to create the commit, either report the resulting commit hash after authorized local git execution, or report blocked with the missing preflight/delegation requirement. Do not include executable commit commands when preflight or local execution/delegation is unavailable.
- **PR title (when requested):** When the user or workflow asks for a PR title, return the title as a single Conventional Commit subject line in a fenced `text` code block, with no body, footers, or `BREAKING CHANGE:` trailer in the title field. State whether the title was newly drafted or validated from an existing draft.
- **PR title rationale (when relevant):** One short sentence explaining the chosen type and scope for the PR as a whole when the choice would not be obvious from the subject.