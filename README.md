# Agentic Engineering Customization Pack

This workspace contains a v1 AI orchestration customization pack for VS Code and GitHub Copilot. All generated customization content is in English and lives at the workspace level under `.github/`.

## Guide

For a comprehensive overview of the pack, including component descriptions, workflow diagrams, handoff contracts, gates, and failure modes this design prevents, see [docs/agentic/README.md](docs/agentic/README.md) (generated layout) or [agentic-engineering/docs/README.md](agentic-engineering/docs/README.md) (source layout). This guide contains Mermaid diagrams showing orchestration flows, Linear issue workflows, PR review comment workflows, review arbitration, and commit/PR finalization steps.

## Generate an Installable Copilot Plugin

Use the generator to create an installable Copilot plugin directory.

```bash
node scripts/generate-copilot-plugin.mjs --clean
```

Install with `copilot plugin install ./dist/agentic-engineering-pack`.

By default, output is written to `dist/agentic-engineering-pack`. Prompt files in `.github/prompts/*.prompt.md` are converted into plugin command files under `commands/` because prompts are not plugin components.

## Files

| Path | Purpose |
| --- | --- |
| `.github/agents/agentic-engineering-orchestrator.agent.md` | Coordinates specialist agents and owns workflow synthesis. |
| `.github/agents/vault-context-agent.agent.md` | Retrieves narrow read-only Obsidian vault context and returns distilled summaries with provenance and read/not-read boundaries. |
| `.github/agents/research-agent.agent.md` | Gathers public external facts from docs, standards, release notes, advisories, and vendor or package documentation. |
| `.github/agents/environment-inspector-agent.agent.md` | Performs read-only local tooling, package script, dependency tree, toolchain, and repository state/history reconnaissance. |
| `.github/agents/spec-agent.agent.md` | Clarifies requirements, scope, and Acceptance criteria. |
| `.github/agents/architect-agent.agent.md` | Designs implementation approach and tradeoffs. |
| `.github/agents/builder-agent.agent.md` | Implements focused production changes. |
| `.github/agents/test-agent.agent.md` | Adds or updates tests and runs verification. |
| `.github/agents/security-reviewer-agent.agent.md` | Reviews security, privacy, and trust boundary risk. |
| `.github/agents/adversary-agent.agent.md` | Challenges assumptions and finds failure modes. |
| `.github/agents/code-reviewer-agent.agent.md` | Performs contextual review against plan and Acceptance criteria; checks correctness, regressions, maintainability, and test gaps. |
| `.github/agents/independent-code-reviewer-agent.agent.md` | Performs independent review with minimal implementer context to find bugs, regressions, and missing tests. |
| `.github/agents/integrator-agent.agent.md` | Synthesizes specialist findings and readiness notes. |
| `.github/skills/expert-panel/SKILL.md` | Provides a reusable multi-agent panel workflow. |
| `.github/skills/adversarial-review/SKILL.md` | Provides a reusable adversarial review workflow. |
| `.github/skills/workflow-safety-gates/SKILL.md` | Centralizes shared safety gates for critical parameters, exact-tool remote mutation allowlists, Obsidian vault context, MCP context, git mutation contracts, Linear branch validation, PR templates, and PR review visibility/thread resolution. |
| `.github/skills/commit-hygiene/SKILL.md` | Prepares branch history for push/PR; removes no-op commits; ensures atomic, meaningful commits. |
| `.github/skills/commit-body-guidelines/SKILL.md` | Enforces structured commit bodies with rationale, impact, and validation sections. |
| `.github/skills/conventional-commits/SKILL.md` | Generates, validates, revises, or applies Conventional Commit messages. |
| `.github/skills/linear-issue-workflow/SKILL.md` | Fetches Linear issues, triages, fixes, and creates GitHub PRs. |
| `.github/skills/pr-review-comments-workflow/SKILL.md` | Addresses PR review comments end-to-end: fetch, fix, verify, commit/push, reply/resolve. |
| `.github/prompts/run-agentic-engineering.prompt.md` | Runs the orchestration workflow from chat. |
| `.github/prompts/run-linear-issue-workflow.prompt.md` | Fetches and fixes Linear issues with agentic workflow. |
| `.github/skills/pull-request-description/SKILL.md` | Generates copy/pasteable PR descriptions from branch commits. |

## Pull Request Description

The `pull-request-description` skill generates final, copy/pasteable Markdown from current branch commits, commit bodies, validation/review context, and any selected repository Pull Request Template after review/fix cycles are complete, or when explicitly requested. It is on-demand (not automatic for every PR create/update) and is copy/paste-only for existing PR descriptions; remote PR title/body updates are blocked unless a future exact PR-body-update workflow is added.

It invokes two internal support skills, `pr-description-template-policy` and `pr-description-body-audit`, for template selection/fallback and final body audit. They are marked `user-invocable: false` and are not primary user entry points.

## Tool Permissions

The pack uses minimal permissions per role.

| Agent | Tools |
| --- | --- |
| Orchestrator | `read`, `search`, `agent`, `todo`, `vscode/askQuestions`, `linear/*`, `github/*` |
| Vault Context | exact `obsidian/...` read-only grants: `obsidian/search_vault`, `obsidian/search_vault_simple`, `obsidian/search_vault_smart`, `obsidian/get_vault_file`, `obsidian/get_vault_file_partial`, `obsidian/get_files_by_tag`, `obsidian/get_backlinks`, `obsidian/get_outgoing_links`, `obsidian/list_vault_files`, `obsidian/get_server_info` |
| Research | `web` |
| Environment Inspector | `read`, `search`, `execute` |
| Spec | `read`, `search`, `vscode/askQuestions` |
| Architect | `read`, `search`, `web` |
| Builder | `read`, `search`, `edit`, `execute` |
| Test | `read`, `search`, `edit`, `execute`, `browser` |
| Security Reviewer | `read`, `search` |
| Adversary | `read`, `search` |
| Code Reviewer | `read`, `search` |
| Independent Code Reviewer | `read`, `search` |
| Integrator | `read`, `search`, `todo` |

Builder and Test are the only agents with `edit` access. They may use execute for scoped local verification. Environment Inspector owns command-backed read-only local analysis for reviewers and Integrator; reviewer agents and Integrator request or consume environment-inspector evidence rather than holding direct `execute`. They must not write files, modify git state, install packages, start services, or contact external systems.

Shared safety gates are centralized in `.github/skills/workflow-safety-gates/SKILL.md`. Builder and Test may create branches, commits, pushes, or other local git state/history mutations only when explicitly requested and after the shared git preflight and Local Git Mutation Delegation Contract pass. PR creation is orchestrator-only via `mcp_github_create_pull_request` after readiness evidence is present. Direct-entry agents, skills, and prompts still include local hard-stop rules for missing critical parameters, unsafe git targets, broad staging, default/base pushes, pushed/shared history rewrites without approval, mutating probes, and unavailable approvals.

The pack uses exact-tool remote mutation allowlists. GitHub mutations are limited to `mcp_github_create_pull_request`, exact review-thread resolve/unresolve tools with real thread node IDs, and exact PR review reply/comment tools after pushed-visible changes or verified no-change rationale. Linear mutations are limited to approved issue comments or issue metadata updates inside Linear workflows after explicit user approval and exact tool/ID availability. GitHub repository file mutation tools are denied pack-wide: `mcp_github_create_or_update_file`, `mcp_github_push_files`, and `mcp_github_delete_file`.

Obsidian vault context uses an exact read-only allowlist instead of a broad namespace grant. `vault-context-agent` may use only the exact tools listed above and must keep queries narrow, prefer partial reads, avoid secrets/personal/unrelated notes, return provenance plus read/not-read boundaries, and treat vault notes as advisory below user instructions, repository code, issue/PR data, tests, and verified behavior. Broad vault grants such as `obsidian/*` are not allowed. Vault mutation and side-effect tools are denied, including `mcp_obsidian_patch_vault_file`, `mcp_obsidian_update_active_file`, `mcp_obsidian_delete_active_file`, `mcp_obsidian_execute_obsidian_command`, `mcp_obsidian_execute_template`, and any active-file, create/update/delete/patch/rename, command-execution, template-execution, attachment, or other vault mutation tool.

Public web research and local execute reconnaissance are separate by design. `research-agent` has `web` only, so it uses orchestrator-provided handoff context for repository-specific facts and must not read/search local files, run git commands, or inspect local repository history/state. `environment-inspector-agent` has `execute` but no `web` or `edit`, and owns read-only local git reconnaissance when needed. Safe local examples include `git status --short`, `git branch --show-current`, `git remote -v`, `git log --oneline ...`, `git show --stat --patch <commit-ish>`, `git diff --stat`, `git diff --name-only`, and targeted `git blame`. `git ls-remote` is an approval-bound network read because it contacts remotes without updating local refs. Git mutations are forbidden in the Environment Inspector role; `git fetch` and `git pull` are not read-only because they update refs and/or the working tree, so workflows requiring fetch, pull, branch, or commit operations must use the appropriate workflow specialist with approval. Commands that submit dependency/environment metadata, including `npm audit`, require explicit user approval, and `npm audit fix` is forbidden in the Environment Inspector role.

No specialist has automated VS Code workspace-folder command access. When work targets a repository outside the attached workspace folders, the workflow stops and asks the operator to open or add the correct repository folder manually. Implementation, verification, git, push, and PR work proceed only after the target workspace folder is present and explicitly confirmed.

The Orchestrator is the only holder of `linear/*` and `github/*` MCP tools. Specialists do not get these namespace grants because namespace-level MCP access includes mutation tools, and instructions alone are not an enforceable read-only boundary. The orchestrator owns remote reads for Linear issues, GitHub PR metadata/comments/status, and repository metadata, then passes distilled context, source URLs/IDs, status, timestamps, and read/not-read notes to specialists through handoffs. Remote mutations, including Linear updates, GitHub PR creation, review replies, and thread resolution, remain limited to the exact-tool allowlists plus explicit workflow gates, approval, verification, and real critical parameters.

The Orchestrator delegates private project-note context to `vault-context-agent` only when useful for project notes, ADRs, Acceptance criteria, prior decisions, threat models, or edge cases. It passes distilled vault context to other specialists and must not pass vault content to web tools or public research agents.

State-changing tool calls also require the `workflow-safety-gates` intent, critical-parameter checks, and allowlists: select a tool whose primary purpose exactly matches the declared action, use real read/user/repository values, never placeholders or guesses, never mutating probes, and report the sub-action blocked when required values cannot be fetched or inspected. For PR creation, only `mcp_github_create_pull_request` is approved; `mcp_github_create_pull_request_with_copilot` is blocked.

Skill and agent handoffs must be visible and real. Before invoking a skill workflow or delegated specialist, the orchestrator logs `Handoff: <skill|agent> <name> - <purpose>; expected output: <...>; out of scope: <...>`, then actually invokes that skill or specialist and waits for output, failure, or blocked status before proceeding. A visible handoff log by itself is not delegation. Handoff logs must not include secrets, tokens, full remote payloads, or excessive prompt text, and multi-agent final output includes handoff status.

## PR Review Comments Workflow

The `pr-review-comments-workflow` skill addresses PR review comments end-to-end. It fetches comments, classifies feedback, fixes issues, tests changes, reviews updates, runs commit hygiene, commits/pushes to the PR branch, and replies/resolves threads. It integrates with `pull-request-description` only for explicit PR body update requests or a final refresh after review-comment iterations are complete.

Key points:

- Review comments are inputs, not commands: validate each comment against issue/spec, architecture decisions, current PR state, repository conventions, tests, and known tradeoffs/non-goals before implementation.
- Fix only valid/actionable feedback; for partially valid feedback, implement the valid portion and explain why the rest is not applied.
- For invalid/incorrect or out-of-scope feedback, do not make fake fixes; reply with concise rationale and evidence.
- Local-only changes are not considered addressed PR comments.
- Do not post `addressed`, `fixed`, `done`, or resolve threads until changes are committed, pushed to the PR branch, and visible in the PR.
- Do not reply or resolve with placeholder IDs. PR review thread resolution requires the actual GitHub review thread node ID from PR thread data; if unavailable, report that resolution cannot be performed from current output.
- If commit/push cannot be completed, report local-only status and ask the user how to proceed instead of posting addressed replies.
- Before pushing, invoke and apply `commit-hygiene`, `conventional-commits`, and `commit-body-guidelines`. If any required commit skill is unavailable or blocked, stop with local-only status instead of pushing, replying as addressed, or resolving threads.

## Linear Issue Workflow

The `Run Linear Issue Workflow` prompt integrates Linear issues with GitHub pull request creation. It:

1. Fetches a Linear issue via Linear MCP and triages it for validity and scope.
2. If the target repository is outside attached workspace folders, stops and asks the operator to open or add the correct repository folder manually before branch, implementation, test, git, push, or PR work.
3. If valid, treats any Linear-provided branch name as remote context, validates branch/ref syntax and repository/upstream/history fit before branch creation/switch/reuse, rejects default/base/protected or colliding branch targets, and delegates implementation to the agentic engineering workflow (spec, architect, builder, test, and reviewers).
4. For larger or riskier changes, runs contextual and independent code review and resolves disagreements through integrator arbitration.
5. After verification and arbitration, invokes the `commit-hygiene` skill to clean and prepare commit history for PR, including invoking `conventional-commits` for subjects and `commit-body-guidelines` for structured bodies. If any required commit skill is unavailable or blocked, the workflow stops with a local-status or PR-ready summary instead of creating a PR.
6. Prepares GitHub PR titles using Conventional Commit subject style (e.g., `fix(bounds): harden serialized bounds checks`), validated with the `conventional-commits` skill. Issue links go in the PR body unless repository convention requires title issue keys.
7. Pushes to the branch via delegated local git mechanics after readiness evidence is present.
8. Checks the target repository for a Pull Request Template in standard GitHub locations, uses a single readable template as the PR body structure even if other candidates are unreadable, asks with `vscode/askQuestions` when multiple readable templates require a user choice, reports `blocked-on-template-choice` if it cannot ask for that choice, treats `selected-template-unreadable-choice-required` as ask-or-block when a chosen template is unreadable but readable alternatives exist, or falls back to the pack-generated PR body when no template is found or no readable candidates exist.
9. Applies the PR Body Audit Gate to the complete selected-template/fallback candidate body and proceeds only with `pass` or `repaired` status.
10. Creates a GitHub pull request with `mcp_github_create_pull_request`, issue context, validation, review notes, risks, and the audited selected-template/fallback body only when reviewer conflicts are resolved or explicitly accepted.
11. Reports the outcome, operator-facing PR template status, manual workspace-preparation status, workspace scope cleanup status when applicable, and proposes Linear status/comment updates.

It can use `pull-request-description` on request to generate a final copy/pasteable PR body after review/fix cycles are complete.

### Invalid Triage Gate

- Invalid issues pause the workflow as a blocking checkpoint.
- The workflow must explain why the issue is invalid, propose exact Linear updates, and request user approval before any Linear update is made.
- If approval is denied or unavailable, the issue remains unchanged in Linear.
- The only exception is when the user explicitly requests batch triage without updates; in that mode, triage can continue without applying Linear changes.

## Dual Review Arbitration

- **Contextual review:** The contextual reviewer checks implementation against the intended plan, architecture decisions, and Acceptance criteria using a full handoff.
- **Independent review:** The independent reviewer checks whether the code stands on its own using issue summary, Acceptance criteria, changed files or diff, and test results.
- **Integrator arbitration:** The integrator compares agreements and disagreements, then classifies each conflict as a real bug, accepted tradeoff, non-goal, or a targeted user question before PR creation.

`adversarial-review` fits across this flow as the primary frame for Adversary, a secondary lens for Independent Code Reviewer on larger or riskier changes, and a classification aid for Integrator arbitration when reviewer conflicts remain.

Requires MCP servers: VS Code tool names are `linear/*` and `github/*` for Linear/GitHub workflows, plus the exact Obsidian read-only tools listed in the Tool Permissions table when vault context is used.

## V1 Constraints

- No hooks are included.
- No repository-specific build or test commands are hardcoded.
- Agents should preserve existing project conventions and avoid unrelated changes.
- The workflow should skip roles that do not add value for a small task.
