---
name: "Run Linear Issue Workflow"
description: "Fetch a Linear issue through Linear MCP, triage it, fix valid issues, review changes, and create a GitHub pull request."
agent: "agentic-engineering-orchestrator"
tools:
  - read
  - search
  - agent
  - todo
  - vscode/askQuestions
  - "linear/*"
  - "github/*"
argument-hint: "Linear issue ID or URL, plus optional repository, base branch, and constraints."
---

Run the Linear issue workflow for the Linear issue:

${input:linearIssue:Linear issue ID or URL}

Optional constraints:

${input:constraints:Optional repository, base branch, urgency, or scope constraints.}

Use the `linear-issue-workflow` skill first. Before any skill workflow or agent handoff, log `Handoff: <skill|agent> <name> - <purpose>; expected output: <...>; out of scope: <...>`. The log is not sufficient by itself: actually invoke the named skill or specialist, wait for its output or blocked status, and report that status before proceeding. If the required specialist or skill is unavailable or fails, stop blocked instead of doing that specialist-owned work directly. Keep handoff logs concise and exclude secrets, tokens, full remote payloads, MCP credentials, and excessive prompt text.

If private project-note context is useful for triage, Acceptance criteria, prior decisions, threat models, or edge cases, apply the `workflow-safety-gates` Obsidian Vault Context Gate and delegate to `vault-context-agent` with a narrow query. Pass only distilled vault context with provenance and read/not-read boundaries to specialists. Do not pass vault content to web tools or grant broad vault wildcards such as `obsidian/*`.

Apply `workflow-safety-gates` before any mutating or state-changing action, including the GitHub Remote Mutation Allowlist, Linear Remote Mutation Allowlist, and Local Git Mutation Delegation Contract when relevant. Never use placeholder, guessed, fabricated, dummy, inferred, stale, or example critical parameters; read missing values first or report the sub-action blocked. Treat Linear-provided branch names as remote context: validate syntax, reject default/base/protected or colliding targets, confirm repository/upstream/history fit, and stop or ask on stale, unsafe, ambiguous, or wrong-repository branch context.

For PR creation, apply the Mutation Intent Gate: explicitly select `mcp_github_create_pull_request` as the intended and only approved PR creation tool. Do not use substitute mutating tools, delegation commands, remote GitHub branch creation, GitHub-side file mutation, or `mcp_github_create_pull_request_with_copilot`. GitHub repository file mutation tools are denied pack-wide. If the exact PR tool is unavailable, ambiguous, or fails before creating the PR, stop and report a PR-ready summary.

The workflow will:

1. **Get the issue** via Linear MCP with full context (title, description, status, priority, labels, team/project, assignee, comments, attachments, relations, linked PRs, git branch name).
2. **Triage validity** against actionability, scope, information completeness, duplicates, Acceptance criteria, and external blockers.
3. **Invalid triage gate (blocking).** If invalid, stop processing that issue, explain why it is invalid, propose the exact Linear update (comment, status, label, and/or assignee), ask the user for approval, and do not update Linear until approval is granted. Do not continue to another issue unless the user explicitly requested batch triage without updates.
4. **If valid,** validate any Linear-provided branch name before branch creation/switch/reuse; otherwise derive a safe branch name from the issue key and title.
5. **Fix, test, and review** through orchestrator delegation:
   - Spec clarifies Acceptance criteria if needed.
   - Architect designs the approach if needed.
   - Builder implements production changes and branch operations.
   - Test adds or updates tests and runs verification.
   - Reviewer agents inspect security, code quality, and failure modes without editing.
   - For larger or riskier changes, run both contextual (`code-reviewer-agent`) and independent (`independent-code-reviewer-agent`) code reviews.
   - For high-risk agent-pack changes touching orchestrator workflow rules, tool grants, security boundaries, security-tester authorization, or multiple agent files, require contextual plus independent review or record an explicit skip rationale/deference before commit hygiene.
   - Before first push or PR creation, apply the `workflow-safety-gates` First-round non-trivial pre-push adversarial-review rule against the cumulative branch diff vs the integration branch and report `Pre-push adversarial review status` with separate `Execution status` and `Verdict` fields, matched non-trivial class(es), and skip considered/rejected/accepted evidence.
   - Pass summarized Linear/GitHub context, source URL or ID, status/timestamps, and read/not-read notes to specialists; do not grant specialists `linear/*` or `github/*` access.
   - Pass distilled Obsidian vault context only when useful, including provenance and read/not-read boundaries; do not grant specialists direct vault access except through `vault-context-agent`.
   - Emit visible handoff logs before each skill or agent handoff and include handoff status in the final report.
6. **Inspect and clean commit history** using the `commit-hygiene` skill before PR creation:
   - Ensure all unpushed commits are atomic and meaningful.
   - Remove accidental/no-op/debug/temporary commits.
   - Validate or revise commit messages with the `conventional-commits` skill for subjects and `commit-body-guidelines` skill for bodies before PR creation when commits are present.
   - Verify tests pass after history cleanup.
   - Report commit history/readiness summary.
7. **Push and confirm remote visibility** after commit hygiene succeeds and any mandatory pre-push adversarial review has either completed with a non-blocking verdict, been skipped with a valid trivial risk-shape rationale, or been proven truly not applicable. Apply the Local Git Mutation Delegation Contract, push via delegated local git mechanics, and confirm the pushed commits are visible on the remote before invoking the gatekeeper or creating a PR. Mandatory adversary unavailable/fails, blocked execution, or `Verdict: BLOCK` blocks the push or PR path.
8. **Run the review closure gatekeeper.** After review specialists have finished, commit hygiene is done, push has succeeded, and remote visibility is confirmed, invoke `review-cycle-gatekeeper` to consume reconciled findings, fix evidence, pushed-visible status, and thread-state evidence. If no PR exists yet, pass `thread state: not applicable - no PR exists yet` with proof that no PR number is available, no linked PR was found in read-only metadata, and PR creation has not yet run. The gatekeeper produces a `pass | fail | BLOCK` gate decision under the canonical severity vocabulary; do not proceed to PR creation while it reports `fail` or `BLOCK`. Skip only when no review-fix cycle ran on the issue, and explicitly note "no fix cycle, gatekeeper skipped" in the final report.
9. **Create a GitHub PR** with `mcp_github_create_pull_request` only after implementation, tests, reviews, commit history cleanup, push visibility, and gatekeeper closure are satisfactory:
   - Preflight: branch pushed/tracking, commit hygiene done, mandatory pre-push adversarial review completed with a non-blocking verdict or was validly skipped/proven not applicable, working tree expected, exact PR tool selected, and no accidental files in branch. `Verdict: BLOCK` blocks PR creation.
   - Apply the `workflow-safety-gates` PR Template Gate: check standard template locations, compose the PR body from the selected template or fallback, ask on multiple ambiguous templates, and report template status to the operator. Apply the gate's PR Body Audience sub-rule: keep PR template status and other workflow trace in the operator-facing report, never in the PR body.
   - GitHub PR title in Conventional Commit subject style: Draft and validate PR titles using the `conventional-commits` skill (e.g., `fix(bounds): harden serialized bounds checks`). Include the Linear issue key and link in the PR body; include the key in the title only if repository convention requires it, and do not let it obscure the conventional subject style.
   - Explicitly select and name `mcp_github_create_pull_request` before PR creation.
   - Do not use substitute mutating tools, remote GitHub branch creation, GitHub-side file mutation, or `mcp_github_create_pull_request_with_copilot` during PR creation. Do not use `mcp_github_create_or_update_file`, `mcp_github_push_files`, or `mcp_github_delete_file`; these GitHub repository file mutation tools are denied pack-wide.
   - If the exact PR creation tool is unavailable, ambiguous, or fails before creating the PR, stop and report a PR-ready summary.
9. **Report outcome** with Linear issue summary, triage decision, branch, files changed/reviewed, validation results, commit history summary, PR link/status, Linear update guidance, and residual risks.

**Boundaries:**
- Do not update Linear automatically.
- Invalid triage gate: if triage rejects the issue, stop processing that issue, explain the invalid reason, propose the exact Linear update (comment/status/label/assignee), ask for user approval before changing Linear, and do not continue to another issue unless the user explicitly requested batch triage without updates.
- Delegate file edits only to agents with `edit` in their tool list (builder, test).
- Independently verify delegated edits with read, search, or test checks before reporting.
- Do not push or create a GitHub PR with accidental/no-op/temp commits.
- Do not rewrite pushed/shared history without explicit user approval.
- Inspect and clean commit history before PR creation using the `commit-hygiene` skill.
- Validate or revise commit messages with the `conventional-commits` skill and `commit-body-guidelines` skill before PR creation when commits are present.
- Before PR creation, explicitly select and name `mcp_github_create_pull_request`; do not use substitute mutating tools, remote GitHub branch creation, GitHub-side file mutation, or `mcp_github_create_pull_request_with_copilot`. Do not use GitHub repository file mutation tools (`mcp_github_create_or_update_file`, `mcp_github_push_files`, `mcp_github_delete_file`); they are denied pack-wide.
- If the exact PR creation tool is unavailable, ambiguous, or fails before creating the PR, stop and report a PR-ready summary instead of trying substitute GitHub tools.
- If an accidental pushed mutation happens, clean it only with explicit user approval and `--force-with-lease`, then stop and re-verify branch state before any further PR attempt.
- Do not create a GitHub PR with unresolved contextual vs independent review conflicts; use integrator arbitration when they disagree.
- Include PR template status in the final report whenever PR creation happens. This is operator-facing only; it does not appear in the PR body.
- Do not add hooks in this v1 workflow.
- High-risk agent-pack changes touching orchestrator workflow rules, tool grants, security boundaries, security-tester authorization, or multiple agent files require contextual plus independent review, or an explicit skip rationale/deference recorded in the final report.

Finish with:
- Linear issue summary (key, title, status, assignee).
- Triage decision (valid/invalid and reasoning).
- Branch name and status.
- Files changed or reviewed.
- Handoff log/status for skill and agent handoffs.
- Vault context status, when used, including provenance and read/not-read boundaries.
- Verification performed (tests, reviews, security checks).
- Pre-push adversarial review status (`Execution status`, `Verdict`, trigger basis, matched non-trivial class(es), skip considered/rejected/accepted evidence, and any skip/block rationale). Use `Verdict: not produced (execution status: <status>)` when no adversary verdict exists.
- Review arbitration summary (contextual vs independent agreements/disagreements and decisions).
- Gate decision (`pass`/`fail`/`BLOCK`) from `review-cycle-gatekeeper` when a fix cycle ran, or explicit "no fix cycle, gatekeeper skipped".
- Commit history summary (commits before cleanup, cleanup actions, commits after cleanup, readiness, conventional subject readiness, structured body readiness).
- GitHub PR link or status; PR title (Conventional Commit subject style).
- PR template status (template used, user-selected template, no template found, or unreadable template with fallback used).
- Linear update guidance (optional status, comment, or assignee change).
- Invalid triage gate status and Linear update status (updated, unchanged, or waiting for user approval).
- Residual risks or follow-up work.

---

**Prompt-level tools precedence:** The `tools:` declared in this prompt's frontmatter is the maximal capability set the invoking host should expose to the orchestrator for this prompt session. Specialist agents invoked downstream still receive only what their own `.agent.md` frontmatter grants — prompt-level tools do not widen specialist tool boundaries. If a specialist needs a capability not in its agent file, route the work through the orchestrator instead of expanding the specialist's grants.
