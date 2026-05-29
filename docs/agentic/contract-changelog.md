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

## Additive Contract Changes

Use this section when a change adds capability without invalidating existing behavior.

Template:

- Date:
- Scope:
- Added contract:
- Behavior details:
- Backward compatibility:

- Date: 2026-05-29
- Scope: Phase 2 pilot output contracts
- Added contract: `agentic-engineering/shared/output-format-contract.md` owns reusable evidence packages for Broad Safe Validation Gate, pre-push adversarial review status, gate decisions, PR template status, and PR Body Audit Gate status.
- Behavior details: The PR review workflow output format now references the shared contract for these reusable packages while keeping PR-review-specific fields locally. Workflow contract tests now validate `workflow-safety-gates` Gate/Allowlist references against canonical headings.
- Backward compatibility: Additive contract documentation change only; no behavior or safety weakening is intended.

## Migration Notes

Use this section for operator-facing migration guidance when contract changes are introduced.

Template:

- Date:
- Version or commit reference:
- Who is affected:
- Action required:
- Verification steps:

- Date: 2026-05-29
- Version or commit reference: Phase 2 pilot contract documentation update
- Who is affected: Workflow authors maintaining output-format sections.
- Action required: Reference `agentic-engineering/shared/output-format-contract.md` for shared output fields and keep only workflow-specific output fields locally; no behavior or safety weakening is intended.
- Verification steps: Run `node scripts/lint-pack.mjs` and `node --test tests/pack-workflow-contracts.test.mjs`.
