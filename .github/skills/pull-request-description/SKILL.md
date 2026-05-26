---
name: pull-request-description
description: "Use when: generating final, copy/pasteable pull request descriptions after development and review/fix cycles are complete, or when the user explicitly asks for PR-body drafting or refresh guidance."
argument-hint: "Base branch, current branch, PR number or URL if any, issue key/link, and optional template requirements."
user-invocable: true
---

# Pull Request Description

This skill generates final, copy/pasteable Markdown PR descriptions from the current branch commits and verification context once development and review/fix iterations are complete, or whenever the user explicitly asks. It does not edit existing PR descriptions.

## When to Use
- Finalizing a PR description after implementation, verification, and review/fix cycles are complete.
- Producing PR description Markdown when the user explicitly asks.
- Preparing refreshed PR description content after commit hygiene and final review outcomes are settled, for the user to copy and paste.
- Reviewing whether a PR description matches branch changes.

## Safety Rules
- Generate copy/pasteable Markdown only; do not edit existing PR descriptions.
- If the user asks to update an existing PR body, return the prepared body plus blocked status: remote PR title/body updates are not currently approved by `workflow-safety-gates` unless a future exact PR-body-update workflow is added.
- Do not call GitHub MCP mutation tools for PR body updates, and do not use any substitute remote mutation path for existing PR descriptions.
- Do not treat this skill as a required step before every PR creation or PR update; use it when finalizing or when explicitly requested.
- Inspect commits before summarizing.
- Preserve user-provided or repository Pull Request Template sections when supplied or discovered.
- Do not claim tests/reviews/security checks that were not run.
- Do not include secrets or sensitive data.

## Required Inputs / Context
- Base branch and current branch.
- Commit range from base to HEAD.
- Commit subjects and bodies.
- Changed files summary.
- Issue/Linear/GitHub links if available.
- Validation/test/review results.
- Accepted risks/follow-ups.
- Target repository Pull Request Template status and selected template content when PR creation or final PR-body generation is requested.
- PR title (drafted by `conventional-commits` in Conventional Commit subject style) when the workflow is preparing for PR creation or when the user asks for a title alongside the body.

## Inspection Procedure
1. Identify base branch and current branch.
2. List commits in range.
3. Inspect commit subjects and bodies, using conventional-commits and commit-body-guidelines as source quality signals.
4. Summarize changed files/high-level diff.
5. Collect validation and review evidence from workflow handoff or local checks.
6. When generating a PR body for creation or final publication, check the target repository for a Pull Request Template in standard GitHub locations: `.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `PULL_REQUEST_TEMPLATE.md`, `docs/PULL_REQUEST_TEMPLATE.md`, `.github/PULL_REQUEST_TEMPLATE/*.md`, and root/docs `PULL_REQUEST_TEMPLATE/*.md` directories when multiple templates are supported.
7. Generate copy/pasteable Markdown.
8. Before returning the body, re-read it as a PR reviewer who has no knowledge of this workflow. Remove any sentence whose meaning depends on knowing the workflow, the skill names, or the MCP tooling. Move that information to the operator-facing notes outside the fenced code block. Specifically check the end of the body for a trailing line, footnote, or separator block beginning with `PR template status:` or any sentence describing how the body itself was structured ("Body follows the de-facto template ...", "fallback template used", "template observed in the existing commit-body and PR history"); if any such content appears, delete it from the body and put the diagnostic in the operator-facing notes. The `Adversarial-review pre-push:` line is a permitted exception only when the synthesis pre-push review actually ran to completion with a non-blocking verdict; it stays in the body for synthesis-based PRs (placed per the rule below the Markdown Template), and must be removed if it appears in a non-synthesis PR or in a trivial synthesis skip. It must also be removed after `Verdict: BLOCK`.

## Description Rules
- Use commits as source of truth but consolidate duplicate/fixup history after commit hygiene.
- Mention issue key/link when available.
- Summarize user-visible behavior and implementation highlights without dumping commit logs.
- Include testing/validation honestly: state what was run in plain reviewer-facing terms (for example "Added unit tests for X; ran the auth suite locally"). Do not name the workflow specialists, MCP tools, handoff steps, or skills that performed the verification. If no validation was run, say so in one neutral sentence (for example "No tests run; documentation-only change."), not as a workflow diagnostic.
- Include risks, follow-ups, or omitted validation when relevant.
- Follow `PR Body Formatting Rules` below for source-level formatting; do not hard-wrap PR body paragraphs.
- If a single Pull Request Template is found, use it as the PR body structure and fill the workflow summary, validation, issue links, review notes, and risks into the appropriate sections.
- If multiple templates are found and no repository convention clearly selects one, ask the user with `vscode/askQuestions` before generating the final PR body. This skill does not declare `vscode/askQuestions` in its own frontmatter; the invoking agent (typically the orchestrator) must already have `vscode/askQuestions` granted.
- If the invoking agent lacks `vscode/askQuestions` and the operator cannot route through the orchestrator (for example direct invocation from a host that does not expose the tool), do not silently pick a template. Instead, in the operator-facing notes OUTSIDE the fenced PR body, list each candidate template path, summarize each template's structure in one sentence, name the best-guess template plus the one-line rationale (closest section overlap with the workflow summary), and instruct the operator to confirm a template by replying in plain text. Do not emit the final fenced PR body until the operator confirms; report blocked-on-template-choice in the meantime.
- If no template is found or the template cannot be read, fall back to the pack-generated Markdown Template below and state outside the body that no template was found or readable.
- Do not assume GitHub MCP/API PR creation tools will auto-apply repository templates; compose the final PR body explicitly.
- For synthesis-based documentation or skill PRs (see the `workflow-safety-gates` Glossary definition), include the pre-push adversarial-review status line verbatim in the PR body only when the synthesis pre-push review actually ran to completion with a non-blocking verdict. Use exactly one of: `Adversarial-review pre-push: no blocking findings` or `Adversarial-review pre-push findings: [summary]` followed by `How addressed: ...` on the next line. Place the line under the `Review Notes` section when the repository template/fallback exposes such a section, otherwise under a `## Pre-push Synthesis Review` heading near the end of the body. Do not include this line for PRs that are not synthesis-based, for trivial synthesis skips, or for `Verdict: BLOCK`. Trivial synthesis skips with rationale belong in operator-facing notes only.
- Only the verbatim `Adversarial-review pre-push:` / `Adversarial-review pre-push findings: ... How addressed: ...` line may appear in the PR body. The orchestrator's Pre-push adversarial review status report (Execution status, Verdict, trigger basis, Round-N count, Round-count source, diff baseline, matched non-trivial class(es), skip considered/rejected/accepted evidence, Blocking findings count, Dedup applied against, Equiv-audit fired, skip rationale, and any sentinel strings such as `Round-N-metadata-unreadable sentinel`, `Pre-push-adversary-skip sentinel`, or `Equivalence-class audit override unavailable sentinel`) is operator-facing only and MUST never appear inside the fenced PR body, per the `workflow-safety-gates` Externally-Posted Content Gate.
- For PRs that include intentional non-changes (code a reviewer might reasonably flag but that was deliberately preserved or deliberately removed), include a `## Verified non-changes` section in the PR body. The canonical rules for that section live in `agentic-engineering-orchestrator` `## PR Creation Guidance` and govern this skill's composition of the section. Each item MUST cite (a) the in-repo code path, (b) a one-sentence statement of the upstream contract or library behavior being relied on, and (c) the version-pin location — either a declared-dependency manifest entry (`package.json`, `Cargo.toml`, `go.mod`, language-equivalent) or a machine-readable vendored-pin location (`.gitmodules` commit SHA, `vendor/modules.txt`, `go.work`, a checked-in machine-readable pin file such as `third_party/<name>/VERSION` or `third_party/<name>/version.txt`, Cargo `[patch]` overrides, or the repository-convention equivalent machine-readable pin manifest). The pin-location citation MUST point to a machine-readable pin manifest path INSIDE the repository under review — no URLs, no off-repo paths. Forbidden inside `## Verified non-changes`: dependency-tree internal paths beyond the pin manifest itself (`node_modules/...`, `vendor/<library>/<source-file>:<line>`, `.venv/...`, `~/.cargo/registry/...`, language-equivalents); specific line numbers inside upstream library source; `/memories/repo/<topic>.md` paths or any other workflow-internal memory path; URLs of any form pointing at upstream library source (`https://github.com/<owner>/<repo>/blob/<sha>/<path>`, with or without `#L<n>` fragments); Codespace / `github.dev` / online-IDE URLs; package-registry deep links (`pkg.go.dev/<path>`, `crates.io/...`, `npmjs.com/...`); CI artifact URLs (Jenkins / CircleCI / Actions artifact links); absolute local filesystem paths (`/home/...`, `/Users/...`, `C:\Users\...`); lock-file interior line citations. Free-form README prose and archive filenames are NOT acceptable pin locations. When an item violates these rules, the composer drops the entire item from the section, lists the dropped item in operator-facing notes with the offending citation excerpt, and continues composing the rest of the body; do not silently strip only the forbidden text and ship a two-of-three-component item that reviewers may rely on, and do not silently drop the forbidden text into the body.
- If commit history is not clean, say PR description generation is blocked until commit hygiene is complete or mark it as draft-only.
- If review/fix cycles are still active or unresolved review comments remain, generate draft-only Markdown and state that final PR description publication should wait until review/fix completion.
- If the request is to update an existing PR body, do not perform the update. Provide the copy/pasteable body and a blocked status explaining that existing PR body updates are not approved by the current workflow gates.

## PR Title Rules

- This skill generates the PR body. The PR title is generated by `conventional-commits` and must be a single Conventional Commit subject line (for example `fix(auth): refresh expired sessions before retry`).
- When the user asks for a complete PR (title plus body), invoke `conventional-commits` for the title before returning, and include the title verbatim alongside the body in the operator-facing notes (not inside the fenced PR body code block).
- Do not embed the issue key, Linear key, or JIRA key in the PR title unless the target repository convention requires it; the key belongs in the PR body. The conventional subject must remain readable as a subject.
- If the workflow has multiple commits with different types, choose the title type that best describes the user-visible or maintenance impact of the PR as a whole.
- Do not use the structured `commit-body-guidelines` body inside the PR title; the title is a subject line only.
- If `conventional-commits` is unavailable when a PR title is requested, report blocked and provide the body only, with a one-line note that the title needs `conventional-commits` validation before the user posts the PR.

## Audience and Content

The PR description is written for human PR reviewers, mergers, and future maintainers who read the PR body in GitHub or in `git log` after merge. The workflow operator (the user who invoked this skill) is a different audience and reads the operator-facing Output Format, not the PR body.

The PR body must contain only content useful to those audiences:

- What changed in user-visible behavior, public APIs, or contracts.
- Implementation highlights that affect review or future maintenance.
- Testing and validation that was actually performed.
- Risks, follow-ups, breaking changes, and migration notes.
- Issue/Linear/GitHub links.

The forbidden categories, positive rules, authorship-disclosure carve-out, and anti-pattern example are defined canonically in `workflow-safety-gates` Externally-Posted Content Gate. This section adds PR-body-specific guidance only.

PR-body-specific anti-narration rule about the PR template itself: do not include any sentence that names the template's existence, absence, source, or fallback selection. Specifically, do not include text such as `PR template status: ...`, `No pull_request_template.md exists in the repo`, `Body follows the de-facto template observed in ...`, `template observed in the existing commit-body and PR history`, `fallback template used`, `template unreadable`, or `multiple templates with user selection`. The structure of the body is its own evidence; the operator-facing notes carry the diagnostic.

PR template status, validation source, omissions/warnings, and update status remain in the operator-facing notes OUTSIDE the fenced PR body code block (as already specified in Output Format). They do not appear inside the copy/pasteable PR body, and they do not appear as a trailing "PR template status:" line, footnote, or separator block at the bottom of the body.

If the workflow has no audience-relevant content for a templated section (for example "Testing and Validation" when no tests were run and there is no honest one-line maintainer-facing statement to make), omit the section per the existing rule instead of filling it with workflow trace.

## PR Body Formatting Rules

- do not hard-wrap PR body paragraphs or list items; one logical paragraph is one line in the Markdown source, and one list item is one line.
- use hard line breaks only for real Markdown structure: paragraph breaks via a blank line, list items, headings, fenced code blocks, tables, and intentional `<br>` where needed.
- the ~72-character body wrap from `commit-body-guidelines` and `conventional-commits` applies to commit bodies only; when consulting those skills as source quality signals, do not carry their wrap width into the PR body.
- preserve formatting of fenced code blocks and tables verbatim; do not reflow code lines or table rows.
- GitHub renders the PR body as Markdown and reflows paragraphs to the container width, so unwrapped source lines render correctly across viewports.

## Markdown Template
```markdown
## Summary

## Changes

## Testing and Validation

## Review Notes

## Risks and Follow-up
```
- Review Notes can include code review/security/adversarial/dual-review arbitration notes if present.
- For synthesis-based PRs (see the `workflow-safety-gates` Glossary "Synthesis-based documentation or skill change"), place the exact `Adversarial-review pre-push:` or `Adversarial-review pre-push findings: ... How addressed: ...` line under the `Review Notes` section only when the synthesis pre-push review actually ran to completion with a non-blocking verdict. Only when the repository's actual PR template lacks a Review Notes-equivalent section, append a `## Pre-push Synthesis Review` heading near the end of the body and place the line there. Do not add the heading when `Review Notes` is present. Do not add the heading for non-synthesis PRs, trivial synthesis skips, or `Verdict: BLOCK`.
- Omit empty sections only if truly irrelevant.

## Output Format
- PR description markdown in a fenced `markdown` code block only for the copy/pasteable body.
- PR title in a separate fenced `text` code block when the user requested a title, in Conventional Commit subject style. The title block is separate from the PR body block and is not inserted into the body.
- Then notes outside the code block: source commits/range, validation used, PR template status, omissions or warnings, and update status.
- Update status must say copy/paste only. If the user requested an existing PR update, state blocked because remote PR title/body updates are not currently approved by `workflow-safety-gates` unless a future exact PR-body-update workflow is added.