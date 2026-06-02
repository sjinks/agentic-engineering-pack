---
name: pr-description-body-audit
description: "Internal support skill for pull-request-description: audits candidate PR bodies before fenced Markdown emission."
argument-hint: "Candidate PR body, selected template status, validation/review evidence, synthesis pre-push status, and Verified non-changes items."
user-invocable: false
---

# PR Description Body Audit

Internal support skill for `pull-request-description`. Users should not choose this directly; PR description composer invokes it after candidate composition and before final fenced Markdown emission.

## Direct Invocation Hard Stop

If user/operator invokes this support skill directly, stop with `blocked-direct-invocation` before auditing. Route final copy/paste PR descriptions to `pull-request-description`; route PR creation workflows to orchestrator or `linear-issue-workflow` so full `workflow-safety-gates` PR Template Gate and PR Body Audit Gate can run.

This hard stop does not apply when `pull-request-description`, orchestrator, or workflow skill invokes this skill internally as part of PR body composition or PR creation preflight.

## Responsibility

Audit the reviewer-facing PR body before it is returned in a fenced `markdown` code block, published as a PR-ready body, or sent to PR creation. The body must stand on its own for human PR reviewers and future maintainers, while workflow diagnostics remain in operator-facing notes outside the code block.

## Inputs

- Complete candidate reviewer-facing PR body.
- Template status and selected template source from `pr-description-template-policy`.
- Validation/test/review evidence and omitted-validation notes.
- Synthesis pre-push adversarial-review status, if relevant.
- Candidate `## Verified non-changes` items, if any.
- Operator-facing notes drafted by the composer.

## Audit Procedure

1. Inspect the full candidate body as a PR reviewer who has no knowledge of this workflow.
2. Remove or block workflow, tool, MCP, skill, host, and template-status leakage from the body; move operator diagnostics to operator-facing notes.
3. Check for accidental hard-wrapped paragraphs or list items; repair them before emission, or block and fail fast when the audit cannot confidently distinguish intentional Markdown structure from accidental hard wrapping.
4. Verify validation language is honest, reviewer-facing, and free of workflow-specialist narration.
5. Validate synthesis adversarial-review PR-body lines for legality and placement.
6. Validate `## Verified non-changes` items, dropping invalid items with operator-facing explanation rather than shipping incomplete reviewer evidence.
7. Confirm the final answer separates fenced reviewer-facing body from operator-facing notes.

## Workflow and Tool Leakage Rules

PR body must not name workflow specialists, MCP tools, handoff steps, skills, host plumbing, or internal readiness diagnostics. Do not include: `mcp_github_*`, `mcp_linear_*`, `GitHub MCP`, `Linear MCP`, `handoff log`, `gatekeeper pass`, `commit hygiene done`, `conventional-commits`, `pull-request-description`, `pr-description-template-policy`, `pr-description-body-audit`, or similar workflow trace language.

Write validation in plain reviewer-facing terms. Example: "Added unit tests for X; ran the auth suite locally" when true. If no validation run, say so neutrally: "No tests run; documentation-only change." Do not imply tests, reviews, security checks, pushes, or approvals occurred unless evidence says they did.

## PR Template Anti-Narration Rules

Candidate body must not name template's existence, absence, source, or fallback selection. Remove or block: `PR template status: ...`, `No pull_request_template.md exists in the repo`, `Body follows the de-facto template observed in ...`, `template observed in the existing commit-body and PR history`, `fallback template used`, `template unreadable`, `multiple templates with user selection`.

Template status, validation source, omissions/warnings, update status remain in operator-facing notes outside fenced PR body. They do not appear inside copy/pasteable body, as trailing `PR template status:` line, footnote, or separator block at bottom.

## Hard-Wrap Rules

- Do not hard-wrap PR body paragraphs or list items; one logical paragraph is one line in Markdown source, one list item is one line.
- Use hard line breaks only for real Markdown structure: paragraph breaks via blank lines, list items, headings, fenced code blocks, tables, intentional `<br>`.
- ~72-character body wrap from `commit-body-guidelines` and `conventional-commits` applies to commit bodies only; do not carry their wrap width into PR body.
- Before returning/emitting fenced Markdown body, inspect candidate for accidental hard-wrapped paragraphs/list items. Repair before emitting, or block when audit cannot confidently distinguish intentional Markdown structure from accidental hard wrapping.
- Preserve formatting of fenced code blocks and tables verbatim.
- GitHub renders PR body as Markdown and reflows paragraphs to container width, so unwrapped source lines render correctly across viewports.

**Hard-wrap example:**

Accidental paragraph wrap (fix by joining): a paragraph that was split
across two lines due to commit-body 72-character wrap is repaired into one source line.

Code blocks and tables exempt: fenced code blocks, inline code, and table rows are preserved verbatim with their original line structure.

Ambiguous wraps block: if the audit cannot confidently determine whether a line break is intentional list structure or accidental paragraph wrap, block and report the ambiguity rather than emitting potentially broken Markdown.

## Synthesis Adversarial-Review PR-Body Lines

For synthesis-based documentation or skill PRs, include the pre-push adversarial-review status line verbatim in the PR body only when the synthesis pre-push review actually ran to completion with a non-blocking verdict. Use exactly one of: `Adversarial-review pre-push: no blocking findings` or `Adversarial-review pre-push findings: [summary]` followed by `How addressed: ...` on the next line.

Place the line under the `Review Notes` section when the repository template or fallback exposes such a section; otherwise place it under a `## Pre-push Synthesis Review` heading near the end of the body. Do not include this line for PRs that are not synthesis-based, for trivial synthesis skips, or for `Verdict: BLOCK`. Trivial synthesis skips with rationale belong in operator-facing notes only.

Only the verbatim `Adversarial-review pre-push:` / `Adversarial-review pre-push findings: ... How addressed: ...` line may appear in the PR body. The orchestrator's Pre-push adversarial review status report, including Execution status, Verdict, Trigger basis, Round-N count, Round-count source, Diff baseline, Matched non-trivial class(es), Skip considered, Skip rejected evidence, Skip accepted evidence, Blocking findings count, Dedup applied against, Equiv-audit fired, skip rationale, and any sentinel strings such as `Round-N-metadata-unreadable sentinel`, `Pre-push-adversary-skip sentinel`, or `Equivalence-class audit override unavailable sentinel`, is operator-facing only and MUST never appear inside the fenced PR body, per the `workflow-safety-gates` Externally-Posted Content Gate.

Remove the adversarial-review line if it appears in a non-synthesis PR, in a trivial synthesis skip, or after `Verdict: BLOCK`.

## Verified Non-Changes Validation

For PRs that include intentional non-changes, the candidate body may include a `## Verified non-changes` section. Each item MUST cite all of the following:

- The in-repo code path.
- A one-sentence statement of the upstream contract or library behavior being relied on.
- The version-pin location: either a declared-dependency manifest entry (`package.json`, `Cargo.toml`, `go.mod`, language-equivalent) or a machine-readable vendored-pin location (`.gitmodules` commit SHA, `vendor/modules.txt`, `go.work`, a checked-in machine-readable pin file such as `third_party/<name>/VERSION` or `third_party/<name>/version.txt`, Cargo `[patch]` overrides, or the repository-convention equivalent machine-readable pin manifest).

The pin-location citation MUST point to a machine-readable pin manifest path inside the repository under review. No URLs and no off-repo paths are allowed.

**Positive pin-location example:** `package.json` dependency entry `"express": "^4.18.2"`, or `.gitmodules` commit SHA `8a3e2f1c9b` for submodule `vendor/library-name`.

**Forbidden inside `## Verified non-changes`:**

- Dependency-tree internal paths beyond the pin manifest itself (`node_modules/...`, `vendor/<library>/<source-file>:<line>`, `.venv/...`, `~/.cargo/registry/...`, language-equivalents).
- Specific line numbers inside upstream library source.
- `/memories/repo/<topic>.md` paths or any other workflow-internal memory path.
- URLs of any form pointing at upstream library source (`https://github.com/<owner>/<repo>/blob/<sha>/<path>`, with or without `#L<n>` fragments).
- Codespace / `github.dev` / online-IDE URLs.
- Package-registry deep links (`pkg.go.dev/<path>`, `crates.io/...`, `npmjs.com/...`).
- CI artifact URLs.
- Absolute local filesystem paths (`/home/...`, `/Users/...`, `C:\Users\...`).
- Lock-file interior line citations.
- Free-form README prose and archive filenames.

When an item violates these rules, drop the entire item from the section, list the dropped item in operator-facing notes with the offending citation excerpt, and continue composing the rest of the body. Do not silently strip only the forbidden text and ship a two-of-three-component item that reviewers may rely on, and do not silently drop the forbidden text into the body.

## Output Separation

The final answer from `pull-request-description` must place the copy/pasteable PR body in a fenced `markdown` code block only. PR title, source commits/range, validation used, PR template status, omissions or warnings, update status, blocked status, and any dropped-item diagnostics belong outside that fenced body.

Update status must say copy/paste only. If the user requested an existing PR update, the operator-facing notes must state blocked because remote PR title/body updates are not currently approved by `workflow-safety-gates` unless a future exact PR-body-update workflow is added.

## Output

Return:

- Audit status: pass, repaired, or blocked.
- Repaired PR body when changes were needed.
- Operator-facing notes for removed workflow/template leakage, dropped Verified non-changes items, validation caveats, hard-wrap ambiguity, blocked-direct-invocation, or blocked emission.