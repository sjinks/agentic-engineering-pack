---
name: pr-description-template-policy
description: "Internal support skill for pull-request-description: resolves PR template discovery, selection, fallback, and operator-facing template status."
argument-hint: "Target repository root plus any template requirement, discovered template paths, unreadable-template errors, or user-selected template path."
user-invocable: false
---

# PR Description Template Policy

Internal support skill for `pull-request-description`. Users should not choose this directly; PR description composer invokes it before candidate PR body composition.

## Direct Invocation Hard Stop

If user/operator invokes this support skill directly, stop with `blocked-direct-invocation` before resolving templates, selecting fallback, or emitting PR body structure. Route final copy/paste PR descriptions to `pull-request-description`; route PR creation workflows to the orchestrator or `linear-issue-workflow` so full `workflow-safety-gates` PR Template Gate and PR Body Audit Gate can run.

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
- `agentic-engineering/pull_request_template.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `PULL_REQUEST_TEMPLATE.md`
- `docs/PULL_REQUEST_TEMPLATE.md`
- `.github/PULL_REQUEST_TEMPLATE/*.md`
- `agentic-engineering/PULL_REQUEST_TEMPLATE/*.md`
- root or `docs/` `PULL_REQUEST_TEMPLATE/*.md` directories when multiple templates are supported

Do not assume GitHub MCP/API PR creation tools will auto-apply repository templates. The final PR body must be composed explicitly from the selected template or fallback structure.

## Selection and Fallback Rules

- Ambiguity is based on readable templates, not total candidate count. Unreadable candidates are operator-facing evidence/status only unless user-selected or repository-convention-selected template itself is unreadable.
- If exactly one readable template is found, return it as the selected PR body structure even if other discovered candidates are unreadable; report unreadable candidates in operator-facing notes only.
- If multiple readable templates and repository convention clearly selects one readable template, return that template; include convention evidence in operator-facing notes only. Convention clearly selects when: documented selection rule exists; historical PR pattern consistently uses one template for current PR type/scope/team; single template naming matches documented org/repo standard. Otherwise choice is ambiguous.
- If multiple readable templates are found and no repository convention clearly selects one, ask user with `vscode/askQuestions`. This support skill does not grant that tool; invoking agent must already have it.
- If invoking agent lacks `vscode/askQuestions` and cannot route through orchestrator, return `blocked-on-template-choice`; in operator-facing notes only, list each readable candidate template path, include unreadable candidates as status evidence, summarize each readable template's structure in one sentence, name best-guess readable template plus one-line rationale, instruct operator to confirm by replying in plain text. Do not emit final fenced PR body until operator confirms.
- If user-selected or repository-convention-selected template is unreadable and at least one other candidate template is readable, return `selected-template-unreadable-choice-required`. Do not silently use the fallback template and do not silently switch to a readable alternative. Ask user to choose readable template or confirm fallback; if invoking agent cannot ask, block PR body generation and report selected unreadable path, read error, readable alternatives in operator-facing notes only.
- If no template is found, return the fallback Markdown Template below with operator-facing status `no-template-fallback-used`.
- If exactly one candidate exists and is unreadable, or every candidate is unreadable, return the fallback Markdown Template below with operator-facing status `unreadable-template-fallback-used` and include unreadable path/error summary in operator-facing notes.

## Operator-Facing Template Status

Template status is for the operator-facing notes outside the fenced PR body only. It must name the status as one of: `exactly-one-template-used`, `multiple-templates-user-selection-required`, `multiple-templates-selected-by-convention`, `blocked-on-template-choice`, `selected-template-unreadable-choice-required`, `no-template-fallback-used`, or `unreadable-template-fallback-used`. Include selected path, fallback reason, unreadable path/error summary, readable alternatives, and any user-choice blocker as applicable.

Do not put template status, template discovery diagnostics, or fallback narration inside the reviewer-facing PR body. The body structure is its own evidence.

## PR-Body Anti-Narration Boundary

The reviewer-facing PR body must not include any sentence that names the template's existence, absence, source, or fallback selection. Do not include: `PR template status: ...`, `No pull_request_template.md exists in the repo`, `Body follows the de-facto template observed in ...`, `template observed in the existing commit-body and PR history`, `fallback template used`, `template unreadable`, `multiple templates with user selection`.

When composer needs to explain template selection, fallback, unreadability, or ambiguity, return that information for operator-facing notes only.

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
- `blocked-on-template-choice`, `selected-template-unreadable-choice-required`, or `blocked-direct-invocation` status when needed.
- Any unreadable-template evidence or multiple-template candidates for operator-facing notes only.