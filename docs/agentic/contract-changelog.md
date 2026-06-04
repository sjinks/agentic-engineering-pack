# Workflow Contract Changelog

This document tracks behavior changes to workflow contracts, gates, and required output fields.

## Breaking Contract Changes

Use this section when a change can break existing workflows, automation, or operator expectations.

Template:

- Date:
- Scope:
- Changed contract:
- Old behavior:
- New behavior:
- Impact:
- Required migration:

- Date: 2026-06-03
- Scope: Linear MCP ownership and Linear issue workflow
- Changed contract: Linear reads and approved Linear mutations move out of the orchestrator into `linear-context-agent` and `linear-update-agent`; Linear-only safety details move to `linear-safety-gates`.
- Old behavior: The orchestrator held broad Linear namespace access, performed Linear reads/mutations directly, and shared `workflow-safety-gates` owned Linear-specific allowlists, branch-context, and comment mechanics.
- New behavior: The orchestrator has no Linear frontmatter grant. It delegates Linear reads/readbacks to `linear-context-agent` and approved updates to `linear-update-agent`; `linear-safety-gates` owns Linear read ownership, mutation allowlist, approval/critical-parameter details, partial-update handling, branch context, and Linear externally-posted comment safety.
- Impact: Workflows and docs must no longer say the orchestrator owns broad Linear namespace access; Linear updates require explicit current-session approval, real IDs/targets/content, declared action order, and Linear-agent partial-update reporting.
- Required migration: Route Linear context/update handoffs through the two Linear agents and use the shared Linear Context and Update Status output package.

## Additive Contract Changes

Use this section when a change adds capability without invalidating existing behavior.

Template:

- Date:
- Scope:
- Added contract:
- Behavior details:
- Backward compatibility:

- Date: 2026-05-31
- Scope: Expert panel output schema normalization
- Added contract: `expert-panel` references `agentic-engineering/shared/output-format-contract.md` for shared Handoff log/status, Verification, Pre-push adversarial review status, Residual risks, and Follow-up fields.
- Behavior details: Panel-specific fields remain local: panel roles, key findings by role, decisions made, and required actions.
- Backward compatibility: Additive documentation and contract-test normalization only; existing panel semantics are preserved.

- Date: 2026-05-29
- Scope: Phase 2 pilot output contracts
- Added contract: `agentic-engineering/shared/output-format-contract.md` owns reusable evidence packages for Broad Safe Validation Gate, pre-push adversarial review status, gate decisions, PR template status, and PR Body Audit Gate status.
- Behavior details: The PR review workflow output format now references the shared contract for these reusable packages while keeping PR-review-specific fields locally. Workflow contract tests now validate `workflow-safety-gates` Gate/Allowlist references against canonical headings.
- Backward compatibility: Additive contract documentation change only; no behavior or safety weakening is intended.

- Date: 2026-05-29
- Scope: Pull request description output schema normalization
- Added contract: `pull-request-description` references `agentic-engineering/shared/output-format-contract.md` for shared core fields and PR Template/Body status vocabulary.
- Behavior details: Fenced PR body output, optional fenced title output, operator-facing notes, copy/paste-only update status, and blocked remote title/body updates remain local to the composer.
- Backward compatibility: Additive documentation and test normalization only; existing copy/paste behavior is unchanged.

## Migration Notes

Use this section for operator-facing migration guidance when contract changes are introduced.

Template:

- Date:
- Version or commit reference:
- Who is affected:
- Action required:
- Verification steps:

- Date: 2026-05-31
- Version or commit reference: Phase 2 expert-panel output contract update
- Who is affected: Workflow authors maintaining expert-panel output expectations.
- Action required: Reference `agentic-engineering/shared/output-format-contract.md` for shared output fields while keeping panel-specific output fields local.
- Verification steps: Run `node scripts/lint-pack.mjs` and `node --test tests/lint-pack.test.mjs tests/pack-workflow-contracts.test.mjs`.

- Date: 2026-05-29
- Version or commit reference: Phase 2 pilot contract documentation update
- Who is affected: Workflow authors maintaining output-format sections.
- Action required: Reference `agentic-engineering/shared/output-format-contract.md` for shared output fields and keep only workflow-specific output fields locally; no behavior or safety weakening is intended.
- Verification steps: Run `node scripts/lint-pack.mjs` and `node --test tests/pack-workflow-contracts.test.mjs`.

- Date: 2026-05-29
- Version or commit reference: Phase 2 pull-request-description output contract update
- Who is affected: Workflow authors maintaining PR-description output expectations.
- Action required: Use `agentic-engineering/shared/output-format-contract.md` for shared core and PR Template/Body status vocabulary, while keeping fenced body/title and update-status notes local.
- Verification steps: Run `node scripts/lint-pack.mjs` and `node --test tests/lint-pack.test.mjs tests/pack-workflow-contracts.test.mjs`.
