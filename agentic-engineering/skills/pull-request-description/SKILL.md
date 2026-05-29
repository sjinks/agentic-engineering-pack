---
name: pull-request-description
description: "Use when: generating final, copy/pasteable pull request descriptions after development and review/fix cycles are complete, or when the user explicitly asks for PR-body drafting or refresh guidance."
argument-hint: "Base branch, current branch, PR number or URL if any, issue key/link, and optional template requirements."
user-invocable: true
---

# Pull Request Description

This skill generates final, copy/pasteable Markdown PR descriptions from the current branch commits and verification context once development and review/fix iterations are complete, or whenever the user explicitly asks. It remains the user-invocable composer; internal support skills handle PR template policy and final PR body audit.

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
- Do not ask users to choose internal support skills. Invoke `pr-description-template-policy` and `pr-description-body-audit` as part of this composer workflow.
- Inspect commits before summarizing.
- Preserve user-provided or repository Pull Request Template sections when supplied or discovered through `pr-description-template-policy`.
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
6. Before candidate composition, invoke `pr-description-template-policy` to resolve Pull Request Template discovery, selection, fallback, blocked template-choice states, and operator-facing template status. If template choice is blocked, return the operator-facing blocker and do not emit a final fenced PR body.
7. Generate the candidate copy/pasteable Markdown body from the selected template or fallback structure, commits, issue links, validation, review notes, risks, and follow-ups.
8. Before final fenced Markdown emission, invoke `pr-description-body-audit` against the complete candidate body, selected template status, validation evidence, synthesis pre-push status, and any Verified non-changes items. Emit the repaired body only when the audit passes or repairs it; block instead of emitting when the audit reports blocked.

## Description Rules
- Use commits as source of truth but consolidate duplicate/fixup history after commit hygiene.
- Mention issue key/link when available.
- Summarize user-visible behavior and implementation highlights without dumping commit logs.
- Include testing/validation honestly: state what was run in plain reviewer-facing terms (for example "Added unit tests for X; ran the auth suite locally"). Do not name the workflow specialists, MCP tools, handoff steps, or skills that performed the verification. If no validation was run, say so in one neutral sentence (for example "No tests run; documentation-only change."), not as a workflow diagnostic.
- Include risks, follow-ups, or omitted validation when relevant.
- Use `pr-description-template-policy` for Pull Request Template discovery, selection, fallback, and operator-facing template status.
- Use `pr-description-body-audit` to apply the canonical `workflow-safety-gates` PR Body Audit Gate for source-level formatting, hard-wrap checks, workflow leakage checks, template anti-narration, validation honesty, synthesis adversarial-review line legality, Verified non-changes citation validation, and output separation.
- For synthesis-based documentation or skill PRs, compose only the adversarial-review PR-body line allowed by `pr-description-body-audit`; trivial synthesis skips with rationale belong in operator-facing notes only.
- For PRs that include intentional non-changes, compose a `## Verified non-changes` section only with items that can satisfy `pr-description-body-audit` citation validation.
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

The forbidden categories, positive rules, authorship-disclosure carve-out, and anti-pattern example are defined canonically in `workflow-safety-gates` Externally-Posted Content Gate. PR-body-specific audit details live in `pr-description-body-audit`.

PR template status, validation source, omissions/warnings, and update status remain in the operator-facing notes outside the fenced PR body code block. They do not appear inside the copy/pasteable PR body.

If the workflow has no audience-relevant content for a templated section (for example "Testing and Validation" when no tests were run and there is no honest one-line maintainer-facing statement to make), omit the section per the existing rule instead of filling it with workflow trace.

## Template and Body Audit Support

- Invoke `pr-description-template-policy` before candidate composition. It owns template discovery, exactly-one/multiple/none/unreadable behavior, fallback Markdown Template, no-template narration in the body, and operator-facing template status.
- Invoke `pr-description-body-audit` before final fenced Markdown emission. It implements the canonical `workflow-safety-gates` PR Body Audit Gate and owns workflow/tool/MCP/skill leakage checks, PR-template anti-narration, hard-wrap repair/block behavior, validation honesty, synthesis adversarial-review PR-body line legality, Verified non-changes citation validation, and fenced-body versus operator-notes separation.
- If either support skill is unavailable or reports blocked, return blocked status and operator-facing notes instead of emitting a final fenced PR body.

## Output Format
- Use `agentic-engineering/shared/output-format-contract.md` for shared core fields and PR Template/Body status vocabulary. Keep PR-description-specific fields local in this section.
- PR description markdown in a fenced `markdown` code block only for the copy/pasteable body.
- PR title in a separate fenced `text` code block when the user requested a title, in Conventional Commit subject style. The title block is separate from the PR body block and is not inserted into the body.
- Then notes outside the code block: source commits/range, validation used, PR template status, PR Body Audit Gate status, omissions or warnings, and update status. PR template status and PR Body Audit Gate status use the shared PR Template/Body status vocabulary and remain operator-facing notes.
- Update status must say copy/paste only. If the user requested an existing PR update, state blocked because remote PR title/body updates are not currently approved by `workflow-safety-gates` unless a future exact PR-body-update workflow is added.