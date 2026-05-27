---
name: pr-description-template-policy
description: "Internal support skill for pull-request-description: resolves PR template discovery, selection, fallback, and operator-facing template status."
argument-hint: "Target repository root plus any template requirement, discovered template paths, unreadable-template errors, or user-selected template path."
user-invocable: false
---

# PR Description Template Policy

Internal support skill for `pull-request-description`. Users should not choose this skill directly; the PR description composer invokes it before candidate PR body composition.

## Direct Invocation Hard Stop

If a user or operator invokes this support skill directly, stop with `blocked-direct-invocation` before resolving templates, selecting a fallback, or emitting PR body structure. Route final copy/paste PR descriptions to `pull-request-description`; route PR creation workflows to the orchestrator or `linear-issue-workflow` so the full `workflow-safety-gates` PR Template Gate and PR Body Audit Gate can run.

This hard stop does not apply when `pull-request-description`, the orchestrator, or a workflow skill invokes this skill internally as part of PR body composition.

## Responsibility

Own Pull Request Template discovery, selection, fallback, and operator-facing template status for PR body generation. This skill aligns with the `workflow-safety-gates` PR Template Gate and returns the selected PR body structure plus template-status notes for the operator-facing output.

## Inputs

- Target repository root and branch context.
- Any user-supplied template requirements.
- Discovered template paths and read status when already gathered by the workflow.
- User-selected template path when multiple templates were previously presented.
- Whether the invoking agent can route ambiguity through `vscode/askQuestions`.

## Template Discovery

When generating a PR body for creation or final publication, check the target repository for a Pull Request Template in standard GitHub locations:

- `.github/pull_request_template.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `PULL_REQUEST_TEMPLATE.md`
- `docs/PULL_REQUEST_TEMPLATE.md`
- `.github/PULL_REQUEST_TEMPLATE/*.md`
- root or `docs/` `PULL_REQUEST_TEMPLATE/*.md` directories when multiple templates are supported

Do not assume GitHub MCP/API PR creation tools will auto-apply repository templates. The final PR body must be composed explicitly from the selected template or fallback structure.

## Selection and Fallback Rules

- Ambiguity is based on readable templates, not total candidate count. Unreadable candidates are operator-facing evidence/status only unless the user-selected or repository-convention-selected template itself is unreadable.
- If exactly one readable template is found, return it as the selected PR body structure even if other discovered candidates are unreadable, report the unreadable candidates in operator-facing notes only, and tell `pull-request-description` to fill workflow summary, validation, issue links, review notes, risks, and follow-ups into the appropriate sections.
- If multiple readable templates are found and repository convention clearly selects a readable one, return that template and include the convention evidence in operator-facing notes only.
- If multiple readable templates are found and no repository convention clearly selects one, ask the user with `vscode/askQuestions` before final PR body generation. This support skill does not grant that tool; the invoking agent, typically the orchestrator, must already have `vscode/askQuestions` granted.
- If the invoking agent lacks `vscode/askQuestions` and the operator cannot route through the orchestrator, do not silently pick a template. Return blocked-on-template-choice; in operator-facing notes only, list each readable candidate template path, include unreadable candidates as status evidence, summarize each readable template's structure in one sentence, name the best-guess readable template plus one-line rationale based on closest section overlap with the workflow summary, and instruct the operator to confirm a template by replying in plain text. Do not emit a final fenced PR body until the operator confirms.
- If a user-selected or repository-convention-selected template is unreadable and at least one other candidate template is readable, return `selected-template-unreadable-choice-required`. Do not silently use the fallback template and do not silently switch to a readable alternative. Ask the user to choose a readable template or confirm fallback use; if the invoking agent cannot ask, block PR body generation and report the selected unreadable path, read error, and readable alternatives in operator-facing notes only.
- If no template is found, exactly one candidate exists and is unreadable, or every candidate is unreadable, return the fallback Markdown Template below and include a readable operator-facing template status that says no template was found or readable.

## Operator-Facing Template Status

Template status is for the operator-facing notes outside the fenced PR body only. It must name the status as one of: exactly-one-template-used, multiple-templates-user-selection-required, multiple-templates-selected-by-convention, selected-template-unreadable-choice-required, no-template-fallback-used, or unreadable-template-fallback-used. Include selected path, fallback reason, unreadable path/error summary, readable alternatives, and any user-choice blocker as applicable.

Do not put template status, template discovery diagnostics, or fallback narration inside the reviewer-facing PR body. The body structure is its own evidence.

## PR-Body Anti-Narration Boundary

The reviewer-facing PR body must not include any sentence that names the template's existence, absence, source, or fallback selection. Specifically, do not include text such as `PR template status: ...`, `No pull_request_template.md exists in the repo`, `Body follows the de-facto template observed in ...`, `template observed in the existing commit-body and PR history`, `fallback template used`, `template unreadable`, or `multiple templates with user selection`.

When the composer needs to explain template selection, fallback, unreadability, or ambiguity, return that information for operator-facing notes only.

## Fallback Markdown Template

```markdown
## Summary

## Changes

## Testing and Validation

## Review Notes

## Risks and Follow-up
```

- Review Notes can include code review, security, adversarial, or dual-review arbitration notes when present and reviewer-relevant.
- Omit empty sections only if truly irrelevant.

## Output

Return:

- Selected template body structure or fallback Markdown Template.
- Template status for operator-facing notes only.
- Blocked-on-template-choice, selected-template-unreadable-choice-required, or blocked-direct-invocation status when needed.
- Any unreadable-template evidence or multiple-template candidates for operator-facing notes only.