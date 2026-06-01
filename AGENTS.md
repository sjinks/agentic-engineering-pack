# Repository Instructions

## Scope

These instructions apply to the entire repository. This repo contains the Agentic Engineering Customization Pack, with source customization content under `agentic-engineering/agents/` and `agentic-engineering/skills/`.

## Source of Truth

- Treat `agentic-engineering/agents/` as the source of truth for agent files.
- Treat `agentic-engineering/skills/` as the source of truth for skill files.
- `agentic-engineering/plugin.json` defines the generated Copilot plugin metadata for the `agentic-engineering` plugin.

## Editing Rules

- Do not edit generated or linked copies when the source file is available.
- When working on agents/skills from the `agentic-engineering` directory, do not touch files in `.github/agents` and `.github/skills` because those are symlinks to the directories inside `agentic-engineering`.
- Trust the harness to enforce restrictions specified in frontmatter: when allowed tools are listed, assume the harness grants access only to those tools.
- Keep changes focused on the requested agent, skill, script, test, or documentation surface.
- Preserve existing Markdown structure, naming conventions, and concise instruction style.
- Do not add frontmatter to `AGENTS.md` unless a local convention is introduced later.

## Validation

Use the narrowest validation that matches the change:

- Regenerate plugin artifacts when source customization content changes: `node scripts/generate-copilot-plugin.mjs --clean`
- Lint the pack: `node scripts/lint-pack.mjs`
- Run the test suite: `node --test tests/lint-pack.test.mjs tests/pack-workflow-contracts.test.mjs`

For documentation-only changes, explain why runtime validation was not needed.

## Pull Request Hygiene

- Summarize the changed agent, skill, script, test, or documentation behavior clearly.
- Mention validation commands run, or state why validation was skipped.
- Call out any intentional scope limits, especially when generated or symlinked paths were left untouched.