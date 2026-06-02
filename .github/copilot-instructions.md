# Copilot Review Instructions

Use `AGENTS.md` as the repository source of truth. This file exists so GitHub Copilot code review can see the core rules even if it only reads `.github/copilot-instructions.md`.

## Repository Scope

- Source agent files live in `agentic-engineering/agents/`.
- Source skill files live in `agentic-engineering/skills/`.
- Do not treat `.github/agents` or `.github/skills` as editable sources; they are generated or linked copies.
- Keep changes focused on the requested agent, skill, script, test, or documentation surface.

## Agent and Skill Review Bar

When reviewing agent or skill changes, check that the artifact is token-efficient and clear enough for weaker models such as GPT 5 mini and Haiku 4.5.

Evaluate:

- Consistency: contradictions, incompatible constraints, and unstable priority ordering.
- Cohesion: sections support the same task without duplication or distracting scope creep.
- Coherence: workflows, terms, and expected behavior are understandable and logically ordered.
- Completeness: input handling, edge cases, output requirements, and target artifact scope are covered.
- Suitability for weaker models: instruction length, nesting depth, overloaded conditionals, ambiguous or conflicting priorities, missing examples, and reproducible output formats.

Also flag direct contradictions, vague or underspecified instructions, persona mismatches, cognitive-load risks, and semantic-coverage gaps where the model would otherwise have to guess.

## Validation Expectations

Use the narrowest relevant validation. For source customization changes, prefer:

- `node scripts/lint-pack.mjs`
- `node --test tests/lint-pack.test.mjs tests/pack-workflow-contracts.test.mjs`

For documentation-only changes, it is acceptable to state that runtime validation was not needed.
