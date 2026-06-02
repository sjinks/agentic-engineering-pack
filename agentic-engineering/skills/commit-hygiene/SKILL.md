---
name: commit-hygiene
description: "Use when: preparing a branch for push or pull request, inspecting commit history, removing accidental/no-op commits, squashing/fixing up local commits, and ensuring commits are atomic and meaningful."
argument-hint: "Branch name, base branch, issue key, and whether the branch has already been pushed."
user-invocable: true
---

# Commit Hygiene

Prepare branch commit history before pushing or opening a PR. Clean, atomic, meaningful commits reduce noise, improve reviewability, and prevent accidental no-op or debug commits.

## When to Use

- Before pushing a branch or creating a GitHub PR.
- After agent-created commits that may include accidental no-op, debug, or temporary commits.
- Noisy or unclear commit history needing squashing, fixing up, or removing.
- Split or rearrange commits to group related changes.
- Remove accidental commits (formatting-only, test/debug, temporary work) before push/PR.

## Safety Rules

- **Inspect before changing history.** Always review commit diffs/messages before rewriting.
- **Clean local/unpushed history only.** Never rewrite pushed/shared history without explicit user approval.
- **Preserve user changes.** Do not lose or hide real work.
- **No hard reset** unless user explicitly asks.
- **Do not hide real work** by squashing unrelated changes; keep logical separation unless consolidating single logical change.
- **Require verbatim user-approval text before rewriting shared/pushed history** per `workflow-safety-gates` Local Git Mutation Delegation Contract. Paraphrased approval insufficient. Local-only history rewrites on commits never pushed do not require verbatim approval but still require Pre-Rewrite Checks.
- **Force-push form:** When pushing rewritten branch after approval, use `git push --force-with-lease=<ref>:<expected-sha>` with explicit expected-SHA from remote read in same operator turn. Never bare `--force` or `--force-with-lease` without `=<ref>:<sha>`.
- **Open-PR consequence warning:** Before rewriting any branch with open PR, enumerate consequences: (a) GitHub marks threads "outdated" and reviewer context may be lost; (b) reviewers re-notified by force-push; (c) round-N counters/pushed-visible state may need re-validation; (d) thread node IDs may change and resolved threads can reopen. Verbatim approval text must acknowledge these.
- **Pre-Rewrite Checks:** Before any `git rebase`/`reset`/amend rewriting history: (a) confirm current branch is NOT default/base, refuse otherwise; (b) for every commit in rewrite range, run `git branch -r --contains <sha>` against every remote and confirm no remote ref contains it; if any commit reachable from any remote ref, treat as pushed-history rewrite requiring verbatim approval; (c) record pre-rewrite HEAD as backup branch with ref-safe timestamp ISO 8601 basic form (no `:`): `git branch <current>-pre-cleanup-$(date -u +%Y%m%dT%H%M%SZ)`. Verify backup via `git rev-parse refs/heads/<backup-name>`; stop with BLOCK if verification fails; (d) report backup ref AND per-commit pushed-status in Output Format.
- **Shell-safe execution:** Any commit/amend/rebase recording/rewriting message must pass message via `-F <message-file>` from file written by authorized tool. After operation, verify recorded message using byte-preserving raw extraction per `workflow-safety-gates` "Shell-Safe Local Execution".

## Git Mutation Preconditions

Apply `workflow-safety-gates` before any rewrite or cleanup. Direct-entry hard stop: confirm current branch, upstream/base branch, pushed/shared status, dirty state, and target range from read-only git inspection. If base, upstream, or range ambiguous, stop and ask/report. Preserve approval rules for pushed/shared history.

## Inspection Checklist

Before making any history cleanup, inspect and report on:

1. **Git status:** Current branch, working tree status (clean or dirty), unstaged changes.
2. **Current branch:** Confirm branch name and verify it is not the default/main branch.
3. **Upstream/base branch:** Identify the upstream remote and base branch (usually `origin/main` or `origin/master`).
4. **Unpushed commits:** List commits between the current HEAD and the configured upstream (`@{u}..HEAD` or `<upstream>..HEAD`, where `<upstream>` is the upstream remote-tracking branch for THIS branch — typically `origin/<current-branch>`, NOT `origin/main`). The upstream remote-tracking branch is the remote ref the current branch tracks, while the base branch is the PR target branch (e.g., `main`, `master`); these differ once the branch has been pushed. Use `<base-branch>..<HEAD>` only for branches that have never been pushed. For each commit in the candidate range, also run `git branch -r --contains <sha>` to classify it as local-only or pushed; treat ANY pushed commit in the cleanup set as a pushed-history rewrite per the Pre-Rewrite Checks rule.
5. **Changed files per commit:** For each unpushed commit, identify which files were changed (added, modified, deleted).
6. **Empty/no-op commits:** Identify commits that have no file changes, only formatting, or only debug statements.
7. **Commit messages:** Review each commit message for clarity, purpose, and adherence to commit message conventions.
8. **Tests/verification state:** Determine if tests pass, linting passes, and any verification has been run since the last commit.

## Cleanup Procedure

1. **Identify base branch and upstream.**
   - Determine the upstream remote (typically `origin`).
   - Identify the base branch (typically `main`, `master`, or as specified by the user).
   - Report the base branch and upstream remote.

2. **List unpushed commits.**
   - Run `git log --oneline @{u}..HEAD` (or `git log --oneline <upstream>..<HEAD>` with the explicit upstream tracking branch) to list commits between the configured upstream and HEAD. For branches that have never been pushed and have no upstream, fall back to `git log --oneline <base-branch>..<HEAD>` and treat every listed commit as local-only.
   - For each listed commit, determine pushed status:
     - Run `git branch -r --contains <sha>` against every configured remote.
     - Record the result as `local-only` (no remote ref contains it) or `pushed (remotes: <list>)` with the list of remote names.
   - Record commit hashes, messages, authors, and the local-only/pushed classification.
   - Identify the number of commits before cleanup.

3. **Classify commits.**
   - **Keep:** Real work commits with clear purpose and atomic changes.
   - **Fixup:** Commits that fix typos, formatting, or minor issues in prior commits (use `git rebase -i` with `fixup`).
   - **Squash:** Commits that are part of the same logical change and should be combined (use `git rebase -i` with `squash`).
   - **Split:** Commits that contain unrelated changes and should be separated (use `git rebase -i` with `edit`).
   - **Remove/discard:** Accidental no-op, debug, temporary, or unintended commits. Use `git rebase -i` with `drop` (preferred when there are intervening commits). Do not use `git reset --soft` here — `--soft` un-commits but preserves the change in the index, which can silently reintroduce the discarded content into the next commit. If the unwanted commit is the most recent and the working tree was clean before it, `git reset --mixed HEAD~1` followed by an explicit `git restore <paths>` is acceptable with the same Pre-Rewrite Checks as a rebase drop. `git reset --hard` remains disallowed for cleanup (use the pre-rewrite backup ref to recover instead).
   - **Needs user decision:** Unclear commits requiring user guidance before proceeding.

4. **Record rationale.**
   - For each classification decision, record the reason: commit is real work (keep), fixes prior commit (fixup), belongs to same logical change (squash), contains unrelated work (split), is accidental/no-op/debug (drop), or needs user input (needs user decision).

5. **Make history atomic and meaningful using safe local history cleanup.**
   - Use `git rebase -i <base-branch>` for interactive rebasing.
   - Apply fixup, squash, split, reorder, or drop operations as classified.
   - Ensure each commit represents one logical change.
   - For rewritten, squashed, or revised commit messages, validate or revise messages with the `conventional-commits` skill for the subject and `commit-body-guidelines` skill for the structured body.
   - Verify commit messages are clear, include issue keys when relevant, and follow repository conventions.
   - After rebase, test and verify that the changes still work correctly.

6. **Verify working tree and tests after cleanup.**
   - Run `git status` to confirm working tree is clean or expected state.
   - Run tests, linting, or build commands as appropriate for the repository.
   - Verify that all intended changes are present and accidental changes have been removed.

7. **Summarize final commit stack before push/PR.**
   - Report the number of commits after cleanup.
   - List final commits with hashes, messages, and authors.
   - Report the total diff (files changed, insertions, deletions).
   - Confirm all commits are ready for review and push.

## Commit Quality Rules

- **One logical change per commit:** Each commit should represent a single, reviewable, cohesive change.
- **Message names purpose and scope:** Commit message should clearly state what changed and why (not just "fix" or "update") and should be validated with the `conventional-commits` skill for the subject and `commit-body-guidelines` skill for the required body when messages are revised.
- **Include issue key when relevant:** If related to a Linear issue or GitHub issue, include the key/ID in the body or footer (e.g., subject `feat(scope): add feature x` with body/footer `Refs LINEAR-123`), unless repository convention requires issue keys in subjects.
- **No no-op/temp/debug commits:** Do not include commits with no functional changes, debug prints, temporary variables, or abandoned experiments.
- **Tests/docs grouped with related code:** Unless repository convention says otherwise, include test and documentation changes in the same commit as the related production code.
- **Preserve meaningful separation:** Do not squash unrelated features or fixes into a single commit for convenience.

## Output Format

Return:

- **Base branch:** The base branch (e.g., `origin/main`) and upstream remote.
- **Branch:** The current branch name and local/pushed status (e.g., `linear/ADD-123-feature` unpushed, or `linear/ADD-456-fix` pushed).
- **Pushed status:** Whether the branch has already been pushed to upstream. If pushed, note that rewriting history requires user approval.
- **Commits before:** Total number of unpushed commits and list of commit hashes/messages before cleanup.
- **Cleanup actions:** Summary of all rebase actions (keep, fixup, squash, split, drop, reorder) applied.
- **Commits after:** Total number of commits after cleanup and final list of commit hashes/messages.
- **Verification:** Test/lint/build pass status, working tree status, and any issues encountered.
- **Push/PR readiness:** Whether the branch is ready to push or open a PR without further changes.
- **Conventional subject readiness:** Whether commit subjects have been validated or revised with the `conventional-commits` skill and are ready for push/PR.
- **Structured body readiness:** Whether commit bodies have been validated or revised with the `commit-body-guidelines` skill and are ready for push/PR.
- **User approvals needed:** If rewriting pushed/shared history is required, explicitly ask for user approval before proceeding.
