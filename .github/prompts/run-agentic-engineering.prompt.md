---
name: "Run Agentic Engineering"
description: "Run the workspace agentic engineering workflow with specialist agents for specification, architecture, build, test, review, and integration."
agent: "agentic-engineering-orchestrator"
tools:
  - read
  - search
  - agent
  - todo
  - vscode/askQuestions
  - linear/*
  - github/*
argument-hint: "Describe the engineering task, constraints, and desired outcome."
---

Run the agentic engineering workflow for the following task:

${input:task:Describe the engineering task, constraints, and desired outcome.}

Use the smallest effective panel of workspace agents. Keep implementation scoped, validation concrete, and final reporting concise. Do not add hooks in this v1 workflow.

For non-trivial work, apply the `expert-panel` skill as the canonical procedure: it defines panel role selection, the visible handoff log format, the dual code review + integrator arbitration pattern, and the integrated answer format. For single-specialist or trivial work, skip the panel skill and route directly to the smallest useful specialist.

If the task targets a project outside the currently attached workspace folders, first use `workspace-scope-agent` to attach and confirm the narrow target project root. After the workflow, use `workspace-scope-agent` to detach the temporary folder unless the user asks to keep it open for review.

If narrow private project-note context is useful before requirements, architecture, testing, or review, use `vault-context-agent` with a visible handoff and a narrow query. Apply the `workflow-safety-gates` Obsidian Vault Context Gate first. Pass distilled vault context, provenance, and read/not-read boundaries to other specialists. Do not pass vault content to web tools or public research agents.

If public external facts are needed before requirements or architecture, use `research-agent`. If local tooling, package scripts, dependency tree, available tool detection, or read-only git state/history inspection is needed before choosing commands, preparing commit hygiene, creating PRs, or making history-sensitive spec/architecture decisions, use `environment-inspector-agent`.

If Linear or GitHub remote context is needed, the orchestrator owns those reads and passes summarized context, source URL or ID, status/timestamps, and read/not-read notes to specialists. Do not grant or request `linear/*` or `github/*` access for specialists.

If Obsidian vault context is needed, delegate only to `vault-context-agent`. Do not grant or request `obsidian/*` broad namespace wildcards, vault mutation tools, command/template execution tools, or active-file tools for any other specialist.

Before any skill workflow or agent handoff, log `Handoff: <skill|agent> <name> - <purpose>; expected output: <...>; out of scope: <...>`. The log is not sufficient by itself: actually invoke the named skill or specialist, wait for its output or blocked status, and report that status before proceeding. If the required specialist or skill is unavailable or fails, stop blocked instead of doing that specialist-owned work directly. Keep handoff logs concise and exclude secrets, tokens, full remote payloads, MCP credentials, and excessive prompt text.

Apply `workflow-safety-gates` before any mutating, state-changing, remote, git, branch, PR, Linear, reply, or thread-resolution action, including the GitHub Remote Mutation Allowlist, Linear Remote Mutation Allowlist, and Local Git Mutation Delegation Contract when relevant. Never use placeholder, guessed, fabricated, dummy, inferred, stale, or example critical parameters; read missing values first or report the sub-action blocked.

For PR creation, use only `mcp_github_create_pull_request`. If it is unavailable, ambiguous, or fails before creation, stop with a PR-ready summary. Never use `mcp_github_create_pull_request_with_copilot` as a PR creation substitute. Never use remote GitHub branch creation or GitHub repository file mutation tools: `mcp_github_create_or_update_file`, `mcp_github_push_files`, or `mcp_github_delete_file`. Do not use GitHub-side branch or file mutation as a substitute for local source edits, local git workflow, builder/test delegation, commit hygiene, push mechanics, or unavailable/failed tooling. If local git execution/delegation is unavailable, report blocked rather than using remote file APIs. The PR title must follow Conventional Commit subject style (for example `fix(auth): refresh expired sessions before retry`); draft and validate it with the `conventional-commits` skill (subject line only — the structured body lives in the PR body composed by `pull-request-description` and the PR Template Gate).

If the task requires editing, delegate production changes to `builder-agent` and test changes to `test-agent`. Reviewer agents are always read-only; the user may choose whether to run review stages, but edits remain delegated only to `builder-agent` or `test-agent`. Before any push/PR path involving commits, invoke `commit-hygiene`, `conventional-commits`, and `commit-body-guidelines`; if any required commit skill is unavailable, stop with local-status or PR-ready output instead of creating the PR.

You may explicitly request invocation of `adversary-agent`, `test-gap-to-test-plan`, `security-reviewer-agent`, or any other review specialist on a specific diff; the orchestrator treats operator-requested invocation as a first-class path and delegates as requested under the standard handoff log and `## Delegation Prompts` rules, without requiring an orchestrator-side trigger match. Reviewer agents remain read-only; the request applies to a review or analysis pass, not an edit.

For diffs that introduce a new source file consumed by another changed file AND remove a runtime dependency from a declared-dependency manifest in the same cumulative range, the orchestrator surfaces a structured prompt before the first push asking you to choose `invoke` (run `adversary-agent` and `test-gap-to-test-plan` pre-push), `decline` (skip the pre-push pass with a one-line rationale), or `not applicable` (the syntactic match is a false positive, with a one-line reason). Your decision is recorded in the visible handoff log, in the orchestrator's final output, and as a one-line note in the PR body using the reviewer-facing template defined in the orchestrator's `## New Shared Module Prompt` section. Shared-module decline cannot override the separate First-round non-trivial pre-push adversarial-review trigger. If the prompt cannot evaluate — integration branch unresolvable, cumulative diff unavailable, or no interactive host — the orchestrator emits the canonical sentinel `shared-module prompt cannot evaluate: <step> — <reason>; operator action required out-of-band` and stops; you must act out-of-band before the next push.

When the staged or branch diff contains any `+` line that lexically matches a Security-sensitive Code Triggers signal (auth, session, or crypto surface; arbitrary code or external command execution; raw SQL with template interpolation — the full signal list and matching rules live in the orchestrator agent file's `## Security-sensitive Code Triggers` section as the canonical source), invocation of both `security-reviewer-agent` AND `adversary-agent` is mandatory before the review-fix cycle completes, additive to the standard `code-reviewer-agent` and `independent-code-reviewer-agent` routing rather than a substitute. The matched signal class is named in the visible handoff log for both specialists. If either specialist is unavailable or fails, stop with a blocked status. Synthesis-based diffs (skills, agents, prompts, docs, repo-root Markdown per the `workflow-safety-gates` Glossary) are out of scope for this gate and remain covered by the synthesis-only pre-push `adversarial-review` rule.

Before the first push/PR creation for a branch, and before a PR-branch push when Round-N count is 1, apply the First-round non-trivial pre-push adversarial-review rule from the `workflow-safety-gates` Glossary against the cumulative branch diff vs the integration branch. Evaluate non-trivial by risk shape, not line count: failure hard to notice, hard to reverse, externally visible, or likely second-order regression, and report the matched non-trivial class(es) plus skip considered/rejected/accepted evidence. For synthesis-based documentation or skill changes, run `adversarial-review` only when the cumulative diff is non-trivial; trivial synthesis skips with rationale in the operator-facing Pre-push adversarial review status and must not force a PR-body adversarial line. When the synthesis review runs and completes with a non-blocking verdict, the description may include either `Adversarial-review pre-push: no blocking findings` or `Adversarial-review pre-push findings: [summary]` followed by `How addressed: ...`; `pull-request-description` carries the canonical placement. Treat `Verdict: BLOCK`, any CRITICAL finding, and any HIGH finding without a documented compensating control or owner-accepted tradeoff as blocking until addressed. Severity labels follow the canonical vocabulary in the `workflow-safety-gates` "Severity Vocabulary" section.

After any workflow that ran one or more review-fix cycles, invoke `review-cycle-gatekeeper` before posting `addressed` replies, resolving review threads, or creating a new PR. The gatekeeper consumes reconciled findings plus pushed-visible status and emits a `pass | fail | BLOCK` gate decision under the canonical severity vocabulary; do not proceed past a `fail` or `BLOCK`. Skip the gatekeeper only for trivial single-step changes that never ran a review-fix cycle, and explicitly note "no fix cycle, gatekeeper skipped" in the final report.

When a fix is delegated in response to a reviewer finding, the implementer (`builder-agent` or `test-agent`) audits the equivalence class of the bug — sibling parameters, mirror call sites, opposite-bound checks, structurally identical code in the same module, and type-narrowness mirrors on adjacent arguments — scope-capped to the same function family in files changed in the current round. Numeric audited-versus-deferred counts are reported in the handoff; deferred equivalence-class items must be recorded in a tracked location (Linear issue, repository TODO with issue link, or PR follow-up section) and surfaced as named follow-ups in the final output.

Finish with:
- Result summary.
- Files changed or reviewed.
- PR title (Conventional Commit subject style) when PR creation was performed.
- Verification performed.
- Gate decision (`pass`/`fail`/`BLOCK`) from `review-cycle-gatekeeper` when a fix cycle ran, or explicit "no fix cycle, gatekeeper skipped".
- Research, environment, or vault findings used, when applicable.
- Workspace scope and cleanup status when external project attachment happened.
- Handoff log/status for skill and agent handoffs.
- Residual risks or follow-up work.

---

**Prompt-level tools precedence:** The `tools:` declared in this prompt's frontmatter is the maximal capability set the invoking host should expose to the orchestrator for this prompt session. Specialist agents invoked downstream still receive only what their own `.agent.md` frontmatter grants — prompt-level tools do not widen specialist tool boundaries. If a specialist needs a capability not in its agent file, route the work through the orchestrator instead of expanding the specialist's grants.
