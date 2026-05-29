# Agentic Pack Refactor Plan

Date: 2026-05-29
Status: In Progress
Status Note: Phase 1 completed. Phase 2 in progress.

## Feedback Assessment

Verdict: External feedback is broadly valid.

- Strengths:
  - correctly flags maintenance-cost risk from policy duplication
  - correctly flags operator-friction risk from over-prescriptive flows
  - correctly recommends clearer layering boundaries
  - correctly recommends machine-checkable gates over prose-only controls
- Caveat:
  - some operational heaviness is intentional on high-risk paths and should remain explicit

## Objectives

- Reduce cognitive load while preserving safety guarantees.
- Lower drift risk caused by duplicated policy text.
- Improve observability of quality checks.
- Keep all current contract tests passing.

## Target Architecture (3 Layers)

1. Core agents.
   - Representative components:
     - `agentic-engineering-orchestrator.agent.md`
     - `builder-agent.agent.md`
     - `test-agent.agent.md`
     - `spec-agent.agent.md`
     - `architect-agent.agent.md`
2. Safety kernel.
   - Representative components:
     - `agentic-engineering/skills/workflow-safety-gates/SKILL.md`
     - `agentic-engineering/shared/output-format-contract.md`
     - `scripts/lint-pack.mjs`
     - `tests/pack-workflow-contracts.test.mjs`
3. Workflow recipes.
   - Representative components:
     - `agentic-engineering/skills/pr-review-comments-workflow/SKILL.md`
     - `agentic-engineering/skills/linear-issue-workflow/SKILL.md`
     - `agentic-engineering/skills/pull-request-description/SKILL.md`

## Lean Mode

Use profile-gated flow depth to reduce friction while preserving critical safety controls.

1. Small local fix.
   - Example flow: classify task -> edit scoped files -> run targeted local check -> report.
2. Normal feature.
   - Example flow: spec alignment -> implement -> targeted verification + contract check -> report risks.
3. High-risk/security.
   - Example flow: full gate preflight -> implement with safety kernel checks -> broad validation -> explicit blocker/proceed decision.

## Phase 1 - Fast Wins (1-2 days)

1. Improve lint observability.
   - Update `scripts/lint-pack.mjs` summary to include:
     - scanned markdown file count
     - skipped directories or missing surfaces
     - issue-bearing file count
   - Keep existing exit-code behavior unchanged.
2. Add a quickstart section.
   - Add "Quick Start" at top of `README.md` with minimal path:
     - generate plugin
     - run lint
     - run tests
     - install plugin
3. Add workflow contract changelog scaffold.
   - Create `docs/agentic/contract-changelog.md` with sections:
     - breaking contract changes
     - additive contract changes
     - migration notes

## Phase 2 - Structural Simplification (2-4 days)

1. Reduce duplication by canonicalizing policy text.
   - Keep detailed gate definitions only in `agentic-engineering/skills/workflow-safety-gates/SKILL.md`.
   - Replace repeated rule paragraphs in other skills with short references to gate names.
2. Normalize Output Format schemas.
   - Create one shared schema document: `agentic-engineering/shared/output-format-contract.md`.
   - In workflow skills, keep only workflow-specific fields and reference shared fields.
3. Introduce policy-reference integrity tests.
   - Add tests that verify referenced gate names exist and are spelled consistently.

## Phase 3 - Orchestrator Decomposition (3-6 days)

1. Split orchestrator guidance into core and annexes.
   - Keep `agentic-engineering/agents/agentic-engineering-orchestrator.agent.md` focused on:
       - routing logic
       - mandatory gate points
       - minimal output contract
   - Move long rationale/example sections into:
     - `docs/agentic/orchestrator-annex-gates.md`
     - `docs/agentic/orchestrator-annex-edge-cases.md`
2. Preserve behavior with contract tests.
   - Add or update tests that assert critical anchors remain present after decomposition.
3. Maintain source-of-truth boundaries.
   - Keep one canonical definition per rule; all other locations reference it.

## Phase 4 - Machine-Checkable Controls (1-2 days)

1. Add forbidden tool grants checks.
   - Fail when instructions grant tools that violate role boundaries.
2. Add sentinel prefix and uniqueness checks.
   - Fail when required sentinel prefixes are missing or duplicated where uniqueness is required.
3. Add required section checks.
   - Fail when mandatory output sections are missing for defined workflows.
4. Add role/tool mismatch checks.
   - Fail when declared role constraints conflict with requested tool usage.
5. Add duplicate policy phrase detection.
   - Emit advisory warnings for repeated high-risk policy text that should be canonicalized.

## Validation Strategy

- After each phase:
  - run `node scripts/lint-pack.mjs`
  - run `node --test tests/lint-pack.test.mjs tests/pack-workflow-contracts.test.mjs`
- Gate for merge:
  - all existing tests pass
  - no regression in allowlist/denylist semantics
  - no loss of required output fields

## Risks and Mitigations

1. Risk: accidental policy weakening during deduplication.
   - Mitigation: refactor in small steps with contract tests after each step.
2. Risk: broken cross-document references.
   - Mitigation: add link/reference integrity checks in tests.
3. Risk: operator confusion during transition.
   - Mitigation: maintain changelog and add migration notes for renamed sections.

## Suggested Implementation Order

1. Lint observability update in `scripts/lint-pack.mjs`.
2. Quick Start in `README.md`.
3. Shared output-format contract doc.
   - Path: `agentic-engineering/shared/output-format-contract.md`
4. Deduplicate one workflow skill as pilot (recommended: `pr-review-comments-workflow`).
5. Orchestrator decomposition once pilot pattern is proven.
