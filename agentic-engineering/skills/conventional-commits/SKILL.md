---
name: conventional-commits
description: "Use when: writing, creating, suggesting, revising, validating, or applying Conventional Commit messages for pending changes, recent commits, release prep, or user-requested commits."
argument-hint: "Optional: target changes, commit SHA/range, issue key, preferred type/scope, or whether to create the commit."
user-invocable: true
---

# Conventional Commits

Generate, review, or apply commit messages following Conventional Commits 1.0.0 format. Use `commit-body-guidelines` for the required structured body.

## When to Use

- Generate commit message for pending or recent changes.
- Revise existing message to follow Conventional Commits.
- Validate message against type, scope, breaking-change, and footer rules.
- Generate or validate Pull Request title in Conventional Commit subject style (subject only; no body/footers).
- Pair summary with required body using `commit-body-guidelines`.
- Prepare release-friendly history aligning messages with semantic versioning.
- Prepare commit execution when workflow/user explicitly asks to commit, while leaving local git execution to appropriate edit/execute-capable specialist after safety gates pass.

## Safety Rules

- **Inspect before writing.** Review requested change before proposing message.
- **Do not create commits unless requested or approved.** Generating message is safe; modifying git history is not automatic.
- **Apply workflow-safety-gates before executable commit guidance.** Before creating/amending/applying/recommending executable commit commands, apply `workflow-safety-gates` and confirm real target workspace/repo, current branch, default/base branch, upstream/remote, dirty/staged/unstaged scope, pushed/shared status, exact target range/branch/SHA/path.
- **Confirm real commit scope before applying.** Creating/applying commits requires real staged/unstaged scope confirmation; no placeholder commit SHAs/ranges or issue IDs. If uncertain, draft message only and report blocker.
- **Use local git execution only through authorized specialist.** Commit creation/amend/history rewrite via local git by appropriate edit/execute-capable specialist under workflow/user authorization. Orchestrator must not create commits directly.
- **Stop when local execution unavailable.** If unavailable, stop and report blocked, or draft message only.
- **No GitHub file mutation substitutes.** Do not use `mcp_github_create_or_update_file`, `mcp_github_push_files`, `mcp_github_delete_file` as commit/amend/branch-prep/push/recovery substitutes.
- **Preserve unrelated user work.** If working tree contains unrelated changes, call that out and keep message scoped.
- **Prefer one logical change per commit.** If diff contains unrelated work, suggest splitting.
- **Avoid claiming verification not run.** Mention tests only when diff/request makes them relevant, report actual results only.
- **Commit subject and body reach git via `-F <message-file>` only.** Even single-line conventional subject must not pass through `git commit -m "..."` or shell-interpolated argv. See `workflow-safety-gates` "Shell-Safe Local Execution" and `commit-body-guidelines`.
- **Subjects and PR titles are externally-posted content.** Covered by `workflow-safety-gates` Externally-Posted Content Gate. Do not include MCP tool names, MCP/host/plumbing state diagnostics, self-referential workflow language, workflow status diagnostics, sentinel strings, or operator-side instructions. Anti-example (forbidden): `chore(github-mcp): wire mcp_github_pull_request_review_write resolve_thread`. Acceptable: `chore(workflow): document approved PR review write tools in the allowlist`.

## Workflow

1. Inspect requested change source.
2. Classify: primary intent, affected scope, breaking-change status, issue references.
3. Compose message: smallest accurate type and optional scope, then add required structured body with `commit-body-guidelines`.
4. Apply only when requested and gated: confirm intended commit content, apply `workflow-safety-gates`, use command guidance in `commit-body-guidelines` only when authorized local execution/delegation available.

## Message Format

```text
type(scope)!: description

required body

footer trailers when relevant
```

The subject uses lowercase type and optional lowercase scope. **Type** required (e.g., `feat`, `fix`, `docs`). **Scope** names affected area when useful (e.g., `auth`, `search`). **`!`** signals breaking change. **Body** required per `commit-body-guidelines`; explains purpose, key changes, impact. **Footers** are trailers for breaking changes, issue closure, co-authors.

## Commit Types

| Type | Use For |
| --- | --- |
| `feat` | New feature or user-visible capability. |
| `fix` | Bug fix or corrected behavior. |
| `docs` | Documentation-only. |
| `style` | Formatting/whitespace, no behavior change. |
| `refactor` | Code changes, no bug fix or feature. |
| `perf` | Performance improvements. |
| `test` | Adding/updating/fixing tests. |
| `build` | Build system/packaging/dependencies. |
| `ci` | CI workflow/automation. |
| `chore` | Maintenance, no source/test behavior change. |
| `revert` | Reverting previous commit. |

## Message Rules

- **Subject:** maximum 72 characters; imperative mood; present tense; no trailing period.
- **Scope:** optional and lowercase; use a concise module, package, directory, or feature name.
- **Breaking changes:** add `!` after type or scope, and include a `BREAKING CHANGE:` footer.
- **Body:** required; use `commit-body-guidelines` to explain purpose, key changes, impact, and validation; wrap around 72 characters.
- **Footers:** use valid trailers such as `Closes #123`, `Fixes #456`, `Refs #789`, or `Co-authored-by:`.
- **Multiple concerns:** recommend multiple commits instead of a vague combined message.

## Validation

When asked to validate a commit message or PR title, apply this checklist deterministically and report each failed check by name. Run structural checks (type, scope shape, separator, length, regex) first, then semantic/audience checks (mood, casing, externally-posted content, footer/body audit); report failed nested checks by sub-check ID when a check names subcomponents (for example `5.imperative`, `5.casing`); otherwise use the top-level check ID.

Composition rules for message structure (type list, scope format, subject structure, required body) are defined earlier in Safety/Message Format/Message Rules/PR Title Use sections. This validation section provides the 11-point checklist as the canonical pass/fail surface after drafting.

**Applicability/Sequence Table (navigation aid only):**

This table shows which parts of the message each check applies to. The numbered 11-point checklist below remains the authoritative validation surface.

| Check | Commit Subject | PR Title | Body/Footer |
| --- | --- | --- | --- |
| 1. Type | ✓ | ✓ | — |
| 2. Scope shape | ✓ | ✓ | — |
| 3. Breaking marker | ✓ | ✓ | — |
| 4. Separator | ✓ | ✓ | — |
| 5. Description | ✓ | ✓ | — |
| 6. Length | ✓ | ✓ | — |
| 7. Externally-posted content audit | ✓ | ✓ | — |
| 8. Anchored regex | ✓ | ✓ | — |
| 9. Footer and body content audit | — | — | ✓ (when present) |
| 10. PR-title-only checks | — | ✓ | — |
| 11. Description character-class audit | ✓ | ✓ | ✓ (when present) |

**Validation checklist:**

1. **Type:** the message begins with a type from the canonical Commit Types table above (`feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert`). Lowercase. No other types are accepted in this pack.
2. **Scope shape (when present):** matches `\(([a-z0-9][a-z0-9-]*)\)` — lowercase alphanumeric with optional hyphens; no spaces, no slashes, no underscores.
3. **Breaking marker (when present):** `!` appears immediately after the type or after the closing paren of the scope, before the colon. No space before `!`. Either `!` in the subject, a `BREAKING CHANGE:` footer, or both, signals a breaking change; downstream tooling treats any of the three forms as breaking.
4. **Separator:** the subject contains `: ` (colon + single space) exactly once between the type/scope and the description.
5. **Description (after the colon):** present (not empty); imperative mood (`add`, `fix`, `rename`, not `added`/`adds`/`adding`); first character lowercase unless it is a proper noun, acronym, or required casing; no trailing period.
6. **Length:** the entire subject line is ≤ 72 characters including type, optional scope, optional `!`, `: `, and description; warn at > 50 characters.
7. **Externally-posted content audit:** the subject contains no MCP tool names, no skill/agent names, no sentinel strings, no workflow-status diagnostics, no self-referential workflow language, per the rule in Safety Rules above.
8. **Anchored regex (machine check):** `^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9][a-z0-9-]*\))?!?: \S.*\S$` matches the subject (anchored at start and end; description must start and end with non-whitespace; multi-line input fails because `.` does not match newlines). The regex alone does not enforce checks 5, 6, 7, 9, or 10; report those as separate items.
9. **Footer and body content audit (when a body or footer is present, including externally-posted body/footer/trailer text where relevant).** Any commit body, any `BREAKING CHANGE:` footer, and any other footer trailer (`Closes #...`, `Refs ...`, `Co-authored-by:`, etc.) MUST satisfy the `workflow-safety-gates` Externally-Posted Content Gate — commit bodies are explicitly Covered Surfaces, and `BREAKING CHANGE:` footers are extracted verbatim into GitHub release notes and downstream changelog tooling (`conventional-changelog`, `semantic-release`, `release-please`). Audit the body and every footer for MCP tool names, skill/agent names, sentinel strings, workflow-status diagnostics, and self-referential workflow language. Apply the commit-body-specific forbidden list from `commit-body-guidelines` (no secrets, tokens, customer PII, internal hostnames, full log dumps, full file contents).
10. **PR-title-only checks (when validating a PR title; skip for commit-subject validation).** Apply in addition to checks 1–9: (a) the title field contains a single line — no embedded newlines, no body, no footers; (b) the type and scope describe the PR as a whole, not a single commit (when the PR contains multiple commits with different types, the title type is the dominant `feat`/`fix`/etc.); (c) issue keys appear in the title only when repository convention requires it, otherwise in the PR body. This check applies only to PR-title validation, not commit-subject validation.
11. **Description character-class audit (including externally-posted body/footer/trailer text where relevant).** The description (text after `: `) MUST NOT contain: leading or trailing whitespace; control characters (U+0000–U+001F, U+007F); bidirectional override codepoints (U+202A–U+202E, U+2066–U+2069, for example U+202E right-to-left override can reverse rendered subject appearance); zero-width characters (U+200B zero-width space, U+200C, U+200D, U+FEFF zero-width no-break space, can hide content or enable homoglyph spoofing); ASCII tab characters in the middle of the description. These can spoof rendered output on externally-posted surfaces (`git log`, GitHub UI, release notes, blame).

**Nested sub-check reporting rule:** When a check has sub-rules, report at sub-check granularity using the form `fail (check N.sub-id)`. For example, check 5 (Description) has imperative-mood, first-character-casing, and no-trailing-period sub-rules; report failures as `fail (check 5.imperative, check 5.casing)` rather than `fail (check 5)`. For checks without named sub-rules, report the top-level check ID.

Report validation results in the form `Validation: pass` or `Validation: fail (checks N, M, ...)` so downstream `## Output Format` consumers can audit which check failed.

## PR Title Use

PR titles adapt Conventional Commit subject format with modifications. The title follows the same `type(scope)!: description` structure, length, mood, and casing rules as a commit subject, but the type and scope describe the PR as a whole, not a single commit. The structured body, footers, and `BREAKING CHANGE:` trailer do NOT apply to a PR title; those live in the PR body (composed by `pull-request-description` and the PR Template Gate) and in the commits themselves. This skill returns the title only; no body or footer content appears in the title field.

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