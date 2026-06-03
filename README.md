# Agentic Engineering Customization Pack

This workspace contains a v1 AI orchestration customization pack for VS Code and GitHub Copilot. All generated customization content is in English and lives at the workspace level under `.github/`.

## Guide

For a comprehensive overview of the pack, including component descriptions, workflow diagrams, handoff contracts, gates, and failure modes this design prevents, see [agentic-engineering/docs/README.md](agentic-engineering/docs/README.md). This guide contains Mermaid diagrams showing orchestration flows, Linear issue workflows, PR review comment workflows, review arbitration, and commit/PR finalization steps.

## Quick Start

```bash
# 1) Generate installable plugin bundle
node scripts/generate-copilot-plugin.mjs --clean

# 2) Lint pack contracts
node scripts/lint-pack.mjs

# 3) Run workflow contract tests
node --test tests/lint-pack.test.mjs tests/pack-workflow-contracts.test.mjs

# 4) Install plugin bundle
copilot plugin install ./dist/agentic-engineering-pack
```

## Generate an Installable Copilot Plugin

Use the generator to create an installable Copilot plugin directory.

```bash
node scripts/generate-copilot-plugin.mjs --clean
```

Install with `copilot plugin install ./dist/agentic-engineering-pack`.

By default, output is written to `dist/agentic-engineering-pack`. Prompt files in `.github/prompts/*.prompt.md` are converted into plugin command files under `commands/` because prompts are not plugin components.

The install root includes `plugin.json`, copied from `agentic-engineering/plugin.json`, so `copilot plugin install ./dist/agentic-engineering-pack` sees the manifest at the directory it installs. The nested `agentic-engineering/plugin.json` copy is retained as pack metadata for docs/tests that reference the source layout.

## Files

| Path | Purpose |
| --- | --- |
| `.github/agents/agentic-engineering-orchestrator.agent.md` | Coordinates specialist agents and owns workflow synthesis. |
| `.github/agents/linear-context-agent.agent.md` | Acquires Linear issue read-only context and returns distilled summaries with read/not-read boundaries. |
| `.github/agents/linear-update-agent.agent.md` | Applies explicitly approved Linear issue comments/status/label/assignee/metadata updates and reports partial update state. |
| `.github/agents/github-context-agent.agent.md` | Acquires all GitHub PR read-only context: PR metadata, review comments, review history, Round-N count computation, thread state, and active PR context. |
| `.github/agents/pr-creation-agent.agent.md` | Creates GitHub pull requests after implementation and verification with exact least-privilege grants. |
| `.github/agents/pr-review-agent.agent.md` | Coordinates PR review workflows, posts replies, resolves threads with orchestrator-sourced GitHub context. |
| `.github/agents/vault-context-agent.agent.md` | Retrieves narrow read-only Obsidian vault context and returns distilled summaries with provenance and read/not-read boundaries. |
| `.github/agents/research-agent.agent.md` | Gathers public external facts from docs, standards, release notes, advisories, and vendor or package documentation. |
| `.github/agents/environment-inspector-agent.agent.md` | Performs read-only local tooling, package script, dependency tree, toolchain, and repository state/history reconnaissance. |
| `.github/agents/git-operator-agent.agent.md` | Performs approved local git branch, staging, commit, cleanup, push, and local push/ref evidence mechanics. |
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
| `.github/skills/workflow-safety-gates/SKILL.md` | Centralizes shared safety gates for critical parameters, exact-tool remote mutation allowlists, Obsidian vault context, MCP context, git mutation contracts, PR templates, and PR review visibility/thread resolution. |
| `.github/skills/linear-safety-gates/SKILL.md` | Centralizes Linear-only read ownership, mutation approval, branch context/validation, partial-update, and externally-posted comment safety rules. |
| `.github/skills/commit-hygiene/SKILL.md` | Prepares branch history for push/PR; removes no-op commits; ensures atomic, meaningful commits. |
| `.github/skills/commit-body-guidelines/SKILL.md` | Enforces structured commit bodies with rationale, impact, and validation sections. |
| `.github/skills/conventional-commits/SKILL.md` | Generates, validates, revises, or applies Conventional Commit messages. |
| `.github/skills/linear-issue-workflow/SKILL.md` | Fetches Linear issues, triages, fixes, and creates GitHub PRs. |
| `.github/skills/pr-review-comments-workflow/SKILL.md` | User-invocable coordinator for PR review comments: context, validation, fix cycle, closure, reply/resolve. |
| `.github/skills/pr-review-thread-context/SKILL.md` | Internal PR review thread context and real-ID acquisition. |
| `.github/skills/pr-review-comment-validation/SKILL.md` | Internal evidence-based PR review comment classification. |
| `.github/skills/pr-review-fix-cycle/SKILL.md` | Internal Builder/Test, verification, broad safe validation, commit, push, and visibility contract. |
| `.github/skills/pr-review-round-closure/SKILL.md` | Internal gatekeeper handoff preparation for pushed-visible review rounds. |
| `.github/skills/pr-review-reply-resolve/SKILL.md` | Internal reviewer-facing reply and thread-resolution contract. |
| `.github/prompts/analyze-prompt.prompt.md` | Analyzes supplied prompts for contradictions, ambiguity, persona consistency, cognitive load, and coverage gaps. |
| `.github/prompts/audit-agent-skill.prompt.md` | Audits supplied agent or skill text for consistency, cohesion, coherence, completeness, and suitability for weaker models. |
| `.github/skills/pull-request-description/SKILL.md` | Generates copy/pasteable PR descriptions from branch commits. |

## Pull Request Description

The `pull-request-description` skill generates final, copy/pasteable Markdown from current branch commits, commit bodies, validation/review context, and any selected repository Pull Request Template after review/fix cycles are complete, or when explicitly requested. It is on-demand (not automatic for every PR create/update) and is copy/paste-only for existing PR descriptions; remote PR title/body updates are blocked unless a future exact PR-body-update workflow is added.

It invokes two internal support skills, `pr-description-template-policy` and `pr-description-body-audit`, for template selection/fallback and final body audit. They are marked `user-invocable: false` and are not primary user entry points.

## Tool Permissions

The pack uses minimal permissions per role.

| Agent | Tools |
| --- | --- |
| Orchestrator | `read`, `search`, `agent`, `todo`, `vscode/askQuestions` |
| Linear Context Agent | `read`, `search`, exact Linear read-only grants: `linear/get_issue`, `linear/list_issues`, `linear/search_issues`, `linear/get_team`, `linear/list_teams`, `linear/get_user`, `linear/list_users`, `linear/get_issue_status`, `linear/list_issue_statuses`, `linear/get_issue_label`, `linear/list_issue_labels`, `linear/get_project`, `linear/list_projects`, `linear/get_document`, `linear/list_documents`, `linear/get_comment`, `linear/list_comments`, `linear/get_customer`, `linear/list_customers`, `linear/get_initiative`, `linear/list_initiatives`, `linear/get_project_milestone`, `linear/list_project_milestones`, `linear/get_status_update`, `linear/list_status_updates`, `linear/get_cycle`, `linear/list_cycles`, `linear/get_diff`, `linear/list_diffs`, `linear/get_attachment`, `linear/list_attachments`, `linear/search_documentation`, `linear/extract_image` |
| Linear Update Agent | `read`, `search`, `vscode/askQuestions`, exact Linear update grants: `linear/get_issue`, `linear/get_issue_status`, `linear/list_issue_statuses`, `linear/list_issue_labels`, `linear/list_users`, `linear/save_issue`, `linear/save_comment` |
| GitHub Context Agent | `read`, `search`, explicit GitHub read-only frontmatter grants: `github/pull_request_read`, `github.vscode-pull-request-github/activePullRequest`, plus enumerated repository/issue/release/tag/commit/user/status reads such as `github/list_branches`, `github/list_commits`, `github/get_commit`, `github/get_file_contents`, `github/issue_read`, `github/search_code`, `github/search_pull_requests` |
| PR Creation Agent | `read`, exact GitHub PR creation grant: `github/create_pull_request` |
| PR Review Agent | `read`, `search`, `agent`, `vscode/askQuestions`, exact GitHub PR review write grants: `github/pull_request_review_write`, `github/add_reply_to_pull_request_comment`, `github.vscode-pull-request-github/resolveReviewThread` |
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

Shared safety gates are centralized in `.github/skills/workflow-safety-gates/SKILL.md`; Linear-only safety rules live in `.github/skills/linear-safety-gates/SKILL.md`. `git-operator-agent` owns local branch, staging, commit, cleanup, push, and local push/ref evidence mechanics after the shared git preflight and Local Git Mutation Delegation Contract pass; GitHub branch and PR-diff visibility evidence comes from `github-context-agent` reads. Builder/Test implement and verify but do not perform local git mutations. PR creation is delegated to `pr-creation-agent` via orchestrator coordination after readiness evidence is present. Direct-entry agents, skills, and prompts still include local hard-stop rules for missing critical parameters, unsafe git targets, broad staging, default/base pushes, pushed/shared history rewrites without approval, mutating probes, and unavailable approvals.
Linear reads are centralized in `linear-context-agent`; approved Linear updates are centralized in `linear-update-agent`. The orchestrator and non-Linear specialists receive distilled Linear context and do not self-service Linear reads or mutations.
GitHub reads are centralized in `github-context-agent`; `pr-creation-agent` and `pr-review-agent` receive orchestrator-sourced context and do not self-service GitHub reads.
The pack uses exact-tool remote mutation allowlists. GitHub mutations are limited to `mcp_github_create_pull_request` (pr-creation-agent only); MCP review-thread resolve/unresolve through exact `mcp_github_pull_request_review_write` `resolve_thread`/`unresolve_thread` methods with real thread node IDs (pr-review-agent only); VS Code PR extension thread resolution through exact `github.vscode-pull-request-github/resolveReviewThread` with real thread IDs (pr-review-agent only); and exact PR review reply/comment tools after pushed-visible changes or verified no-change rationale, including `mcp_github_add_reply_to_pull_request_comment` for direct replies to existing PR review comments with a proven numeric `commentId` (pr-review-agent only). Linear mutations are limited to `linear/save_issue` and `linear/save_comment` inside Linear workflows after explicit current-session approval, real IDs/targets/content, declared action order, and exact primary-purpose tool availability; bounded update preflight may use `linear/get_issue`, `linear/get_issue_status`, `linear/list_issue_statuses`, `linear/list_issue_labels`, and `linear/list_users`. GitHub repository file mutation tools are denied pack-wide: `mcp_github_create_or_update_file`, `mcp_github_push_files`, and `mcp_github_delete_file`.

Obsidian vault context uses an exact read-only allowlist instead of a broad namespace grant. `vault-context-agent` may use only the exact tools listed above and must keep queries narrow, prefer partial reads, avoid secrets/personal/unrelated notes, return provenance plus read/not-read boundaries, and treat vault notes as advisory below user instructions, repository code, issue/PR data, tests, and verified behavior. Broad vault grants such as `obsidian/*` are not allowed. Vault mutation and side-effect tools are denied, including `mcp_obsidian_patch_vault_file`, `mcp_obsidian_update_active_file`, `mcp_obsidian_delete_active_file`, `mcp_obsidian_execute_obsidian_command`, `mcp_obsidian_execute_template`, and any active-file, create/update/delete/patch/rename, command-execution, template-execution, attachment, or other vault mutation tool.

Public web research and local execute reconnaissance are separate by design. `research-agent` has `web` only, so it uses orchestrator-provided handoff context for repository-specific facts and must not read/search local files, run git commands, or inspect local repository history/state. `environment-inspector-agent` has `execute` but no `web` or `edit`, and owns read-only local git reconnaissance when needed. Safe local examples include `git status --short`, `git branch --show-current`, `git remote -v`, `git log --oneline ...`, `git show --stat --patch <commit-ish>`, `git diff --stat`, `git diff --name-only`, and targeted `git blame`. `git ls-remote` is an approval-bound network read because it contacts remotes without updating local refs. Git mutations are forbidden in the Environment Inspector role; `git fetch` and `git pull` are not read-only because they update refs and/or the working tree, so workflows requiring fetch, pull, branch, or commit operations must use `git-operator-agent` with approval. Commands that submit dependency/environment metadata, including `npm audit`, require explicit user approval, and `npm audit fix` is forbidden in the Environment Inspector role.

No specialist has automated VS Code workspace-folder command access. When work targets a repository outside the attached workspace folders, the workflow stops and asks the operator to open or add the correct repository folder manually. Implementation, verification, git, push, and PR work proceed only after the target workspace folder is present and explicitly confirmed.
The pack uses a three-specialist model with explicit read-write separation: `github-context-agent` for all read-only operations (`github/pull_request_read` and `github.vscode-pull-request-github/activePullRequest`), `pr-creation-agent` for PR creation only (`github/create_pull_request`), and `pr-review-agent` for review write operations only (`github/pull_request_review_write`, `github/add_reply_to_pull_request_comment`, `github.vscode-pull-request-github/resolveReviewThread`). The orchestrator calls github-context-agent for all GitHub reads (PR metadata, review comments, review history, Round-N count computation, active PR context) and passes distilled context into pr-creation-agent and pr-review-agent handoffs. Write agents do not self-service GitHub context.
Linear workflows are delegated to `linear-context-agent` for reads/readbacks and `linear-update-agent` for approved updates. `linear-context-agent` owns exact read-primary Linear grants. `linear-update-agent` owns exact bounded preflight/update grants only: `linear/get_issue`, `linear/get_issue_status`, `linear/list_issue_statuses`, `linear/list_issue_labels`, `linear/list_users`, `linear/save_issue`, and `linear/save_comment`. GitHub PR workflows are delegated to `github-context-agent`, `pr-creation-agent`, and `pr-review-agent` with exact least-privilege grants. `github-context-agent` owns read-only GitHub grants for all PR reads. `pr-creation-agent` owns `github/create_pull_request` for PR creation only. `pr-review-agent` owns `github/pull_request_review_write`, `github/add_reply_to_pull_request_comment`, and `github.vscode-pull-request-github/resolveReviewThread` for review write operations only (direct replies to existing review comments and thread resolution). Non-owner specialists do not get namespace grants because namespace-level MCP access includes mutation tools, and instructions alone are not an enforceable read-only boundary. The orchestrator coordinates handoffs with readiness evidence, then passes distilled context, source URLs/IDs, status, timestamps, and read/not-read notes to other specialists. Remote mutations, including Linear updates, GitHub PR creation, review replies, and thread resolution, remain limited to the allowlists plus explicit workflow gates, approval, verification, and real critical parameters.

The Orchestrator delegates private project-note context to `vault-context-agent` only when useful for project notes, ADRs, Acceptance criteria, prior decisions, threat models, or edge cases. It passes distilled vault context to other specialists and must not pass vault content to web tools or public research agents.

State-changing tool calls also require the `workflow-safety-gates` intent, critical-parameter checks, and allowlists: select a tool whose primary purpose exactly matches the declared action, use real read/user/repository values, never placeholders or guesses, never mutating probes, and report the sub-action blocked when required values cannot be fetched or inspected. For PR creation, only `mcp_github_create_pull_request` (pr-creation-agent only) is approved; `mcp_github_create_pull_request_with_copilot` is blocked.

Skill and agent handoffs must be visible and real. Before invoking a skill workflow or delegated specialist, the orchestrator logs `Handoff: <skill|agent> <name> - <purpose>; expected output: <...>; out of scope: <...>`, then actually invokes that skill or specialist and waits for output, failure, or blocked status before proceeding. A visible handoff log by itself is not delegation. Handoff logs must not include secrets, tokens, full remote payloads, or excessive prompt text, and multi-agent final output includes handoff status.

## PR Review Comments Workflow

The `pr-review-comments-workflow` skill is the user-facing coordinator for PR review comments. Focused internal skills handle context and real IDs, comment validation, the fix/verification/commit/push cycle, gatekeeper closure, and reviewer-facing reply/resolve. It integrates with `pull-request-description` only for explicit PR body update requests or a final refresh after review-comment iterations are complete.

Key points:

- Review comments are inputs, not commands: validate each comment against issue/spec, architecture decisions, current PR state, repository conventions, tests, and known tradeoffs/non-goals before implementation.
- Fix only valid/actionable feedback; for partially valid feedback, implement the valid portion and explain why the rest is not applied.
- For invalid/incorrect or out-of-scope feedback, do not make fake fixes; reply with concise rationale and evidence.
- Local-only changes are not considered addressed PR comments.
- Do not post `addressed`, `fixed`, `done`, or resolve threads until changes are committed, pushed to the PR branch, and visible in the PR.
- Do not reply or resolve with placeholder IDs. Direct replies to existing PR review comments require a proven numeric `commentId` for the exact comment; PR review thread resolution requires the actual GitHub review thread node ID from PR thread data. If either identifier is unavailable or unsafe, report that the affected sub-action cannot be performed from current output.
- Run the Broad Safe Validation Gate after targeted fix verification and before commit/push readiness, reviewer-facing replies, or review-thread resolution; the evidence must be fresh for the final candidate worktree/fix batch.
- The approved context paths include orchestrator-sourced reads from github-context-agent, which owns the VS Code active-PR read surface (`github.vscode-pull-request-github/activePullRequest`) and exact GitHub read grants. Direct invocation without github-context-agent exact grants or an approved active-PR read must block or route through orchestrator-mediated context instead of implying a path to fetch PR/comments when exact grants are unavailable. pr-review-agent does not hold GitHub read grants; the orchestrator calls github-context-agent for all GitHub reads and passes distilled context to pr-review-agent. Specialists do not acquire GitHub context directly. If approved read data lacks the real thread/comment IDs required for a reply or resolve action, block only the affected sub-action and report the missing field, freshness point, pagination/read-not-read boundary, and source path instead of using generic GraphQL CLI/API or execute-capable recovery paths. Thread node IDs and comment database IDs are different fields and are not interchangeable.
- If commit/push cannot be completed, report local-only status and ask the user how to proceed instead of posting addressed replies.
- Before pushing, invoke and apply `commit-hygiene`, `conventional-commits`, and `commit-body-guidelines`. If any required commit skill is unavailable or blocked, stop with local-only status instead of pushing, replying as addressed, or resolving threads.

## Linear Issue Workflow

The `Run Linear Issue Workflow` prompt integrates Linear issues with GitHub pull request creation. It:

1. Fetches Linear issue context through `linear-context-agent` and triages it for validity and scope.
2. If the target repository is outside attached workspace folders, stops and asks the operator to open or add the correct repository folder manually before branch, implementation, test, git, push, or PR work.
3. If valid, treats any Linear-provided branch name as remote context, validates branch/ref syntax and repository/upstream/history fit before branch creation/switch/reuse, rejects default/base/protected or colliding branch targets, and delegates implementation to the agentic engineering workflow (spec, architect, builder, test, and reviewers).
4. For larger or riskier changes, runs contextual and independent code review and resolves disagreements through integrator arbitration.
5. After verification and arbitration, invokes the `commit-hygiene` skill to clean and prepare commit history for PR, including invoking `conventional-commits` for subjects and `commit-body-guidelines` for structured bodies. If any required commit skill is unavailable or blocked, the workflow stops with a local-status or PR-ready summary instead of creating a PR.
6. Prepares GitHub PR titles using Conventional Commit subject style (e.g., `fix(bounds): harden serialized bounds checks`), validated with the `conventional-commits` skill. Issue links go in the PR body unless repository convention requires title issue keys.
7. Pushes to the branch via delegated local git mechanics after readiness evidence is present.
8. Checks the target repository for a Pull Request Template in standard GitHub locations, uses a single readable template as the PR body structure even if other candidates are unreadable, asks with `vscode/askQuestions` when multiple readable templates require a user choice, reports `blocked-on-template-choice` if it cannot ask for that choice, treats `selected-template-unreadable-choice-required` as ask-or-block when a chosen template is unreadable but readable alternatives exist, or falls back to the pack-generated PR body when no template is found or no readable candidates exist.
9. Applies the PR Body Audit Gate to the complete selected-template/fallback candidate body and proceeds only with `pass` or `repaired` status.
10. Delegates PR creation to `pr-creation-agent` with the audited selected-template/fallback body, issue context, validation, review notes, risks, and exact parameters: owner, repo, base, head, title, draft flag, and readiness evidence. `pr-creation-agent` owns the `github/create_pull_request` frontmatter grant, which approves the `mcp_github_create_pull_request` runtime operation.
11. Reports the outcome, operator-facing PR template status, manual workspace-preparation status, workspace scope cleanup status when applicable, and proposes Linear status/comment updates. Approved Linear updates route to `linear-update-agent`, with readback through `linear-context-agent`.

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

Requires MCP servers/tool surfaces: Linear workflows use exact read-primary Linear grants on `linear-context-agent` and exact bounded preflight/update grants on `linear-update-agent`; GitHub workflows use the exact GitHub grants listed in the Tool Permissions table for github-context-agent, pr-creation-agent, and pr-review-agent; vault context uses the exact Obsidian read-only tools listed there.

## V1 Constraints

- No hooks are included.
- No repository-specific build or test commands are hardcoded.
- Agents should preserve existing project conventions and avoid unrelated changes.
- The workflow should skip roles that do not add value for a small task.
