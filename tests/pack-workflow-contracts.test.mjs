import assert from 'node:assert/strict';
import { access, lstat, readdir, readFile, readlink, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const linearSkillPath = '.github/skills/linear-issue-workflow/SKILL.md';
const linearPromptPath = '.github/prompts/run-linear-issue-workflow.prompt.md';
const docsPath = 'agentic-engineering/docs/README.md';
const rootReadmePath = 'README.md';
const prReviewSkillPath = '.github/skills/pr-review-comments-workflow/SKILL.md';
const testGapSkillPath = '.github/skills/test-gap-to-test-plan/SKILL.md';
const workflowSafetyGatesPath = '.github/skills/workflow-safety-gates/SKILL.md';
const orchestratorPath = '.github/agents/agentic-engineering-orchestrator.agent.md';
const runAgenticPromptPath = '.github/prompts/run-agentic-engineering.prompt.md';
const expertPanelPath = '.github/skills/expert-panel/SKILL.md';
const pullRequestDescriptionPath = '.github/skills/pull-request-description/SKILL.md';
const prDescriptionTemplatePolicyPath = '.github/skills/pr-description-template-policy/SKILL.md';
const prDescriptionBodyAuditPath = '.github/skills/pr-description-body-audit/SKILL.md';
const adversarialReviewPath = '.github/skills/adversarial-review/SKILL.md';
const adversaryAgentPath = '.github/agents/adversary-agent.agent.md';
const independentReviewerPath = '.github/agents/independent-code-reviewer-agent.agent.md';
const reviewCycleGatekeeperPath = '.github/skills/review-cycle-gatekeeper/SKILL.md';
const testAgentPath = '.github/agents/test-agent.agent.md';
const builderAgentPath = '.github/agents/builder-agent.agent.md';

async function read(path) {
    return readFile(path, 'utf8');
}

async function exists(path) {
    try {
        await access(path);
        return true;
    }
    catch {
        return false;
    }
}

async function existingPaths(paths) {
    const resolved = [];
    for (const path of paths) {
        if (await exists(path)) {
            resolved.push(path);
        }
    }
    return resolved;
}

function frontmatterValue(text, key) {
    const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
    return frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
}

function pathWithin(root, relativePath) {
    return relativePath ? join(root, ...relativePath.split('/')) : root;
}

async function collectTree(root, relativePath = '') {
    const entries = [];
    const dirents = await readdir(pathWithin(root, relativePath), { withFileTypes: true });

    dirents.sort((left, right) => left.name.localeCompare(right.name));

    for (const dirent of dirents) {
        const childPath = relativePath ? `${relativePath}/${dirent.name}` : dirent.name;

        if (dirent.isDirectory()) {
            entries.push([childPath, 'directory']);
            entries.push(...await collectTree(root, childPath));
        }
        else if (dirent.isFile()) {
            entries.push([childPath, 'file']);
        }
        else if (dirent.isSymbolicLink()) {
            entries.push([childPath, 'symlink']);
        }
        else {
            entries.push([childPath, 'other']);
        }
    }

    return entries;
}

async function assertTreeByteIdentical(packRoot, sourceRoot) {
    const [packEntries, sourceEntries] = await Promise.all([
        collectTree(packRoot),
        collectTree(sourceRoot),
    ]);

    assert.deepEqual(packEntries, sourceEntries, `${packRoot} tree matches ${sourceRoot}`);

    for (const [relativePath, type] of packEntries) {
        if (type === 'file') {
            const [packBytes, sourceBytes] = await Promise.all([
                readFile(pathWithin(packRoot, relativePath)),
                readFile(pathWithin(sourceRoot, relativePath)),
            ]);

            assert.deepEqual(packBytes, sourceBytes, `${packRoot}/${relativePath} matches ${sourceRoot}/${relativePath}`);
        }
        else if (type === 'symlink') {
            const [packLink, sourceLink] = await Promise.all([
                readlink(pathWithin(packRoot, relativePath)),
                readlink(pathWithin(sourceRoot, relativePath)),
            ]);

            assert.equal(packLink, sourceLink, `${packRoot}/${relativePath} symlink target matches ${sourceRoot}/${relativePath}`);
        }
    }
}

test('.github agent and skill pack surfaces resolve to source or remain byte-identical', async () => {
    for (const [packRoot, sourceRoot] of [
        ['.github/agents', 'agentic-engineering/agents'],
        ['.github/skills', 'agentic-engineering/skills'],
    ]) {
        const [packStat, sourceStat, packRealPath, sourceRealPath] = await Promise.all([
            lstat(packRoot),
            lstat(sourceRoot),
            realpath(packRoot),
            realpath(sourceRoot),
        ]);

        assert.ok(packStat.isDirectory() || packStat.isSymbolicLink(), `${packRoot} is a directory or symlink`);
        assert.ok(sourceStat.isDirectory(), `${sourceRoot} is a source directory`);

        if (packRealPath === sourceRealPath) {
            continue;
        }

        await assertTreeByteIdentical(packRoot, sourceRoot);
    }
});

test('Linear skill orders commit hygiene, push visibility, gatekeeper, then PR creation', async () => {
    const text = await read(linearSkillPath);
    const commitHygiene = text.indexOf('7. **Clean commit history with commit hygiene.**');
    const push = text.indexOf('8. **Push to the PR branch via delegated local git mechanics.**');
    const gatekeeper = text.indexOf('9. **Run the review closure gatekeeper.**');
    const prCreation = text.indexOf('10. **Create a GitHub PR only after verification, history cleanup, push visibility, and gatekeeper closure.**');

    assert.ok(commitHygiene >= 0, 'commit hygiene step is present');
    assert.ok(push > commitHygiene, 'push follows commit hygiene');
    assert.ok(gatekeeper > push, 'gatekeeper follows push');
    assert.ok(prCreation > gatekeeper, 'PR creation follows gatekeeper');
    assert.doesNotMatch(text, /before push, invoke `review-cycle-gatekeeper`/);
});

test('Linear prompt orders push visibility before gatekeeper and PR creation', async (t) => {
    if (!(await exists(linearPromptPath))) {
        t.skip(`${linearPromptPath} is intentionally absent`);
        return;
    }

    const text = await read(linearPromptPath);
    const commitHygiene = text.indexOf('6. **Inspect and clean commit history**');
    const push = text.indexOf('7. **Push and confirm remote visibility**');
    const gatekeeper = text.indexOf('8. **Run the review closure gatekeeper.**');
    const prCreation = text.indexOf('9. **Create a GitHub PR**');

    assert.ok(commitHygiene >= 0, 'commit hygiene step is present');
    assert.ok(push > commitHygiene, 'push follows commit hygiene');
    assert.ok(gatekeeper > push, 'gatekeeper follows push');
    assert.ok(prCreation > gatekeeper, 'PR creation follows gatekeeper');
});

test('PR review workflow orders push visibility, fresh thread snapshot, gatekeeper, then replies and resolution', async () => {
    const text = await read(prReviewSkillPath);
    const workflow = text.slice(
        text.indexOf('## Workflow'),
        text.indexOf('## Review Comment Validation Gate'),
    );

    const pushVisibility = workflow.indexOf('9. **Commit and push to the PR branch and confirm PR visibility.**');
    const freshThreadSnapshot = workflow.indexOf('10. **Refresh unresolved/reopened review-thread state after push visibility.**');
    const gatekeeper = workflow.indexOf('11. **Round closure via `review-cycle-gatekeeper`.**');
    const replyAndResolve = workflow.indexOf('12. Only after the gatekeeper returns `pass`');

    assert.ok(pushVisibility >= 0, 'push/visibility step is present');
    assert.ok(freshThreadSnapshot > pushVisibility, 'fresh thread snapshot follows push visibility');
    assert.ok(gatekeeper > freshThreadSnapshot, 'gatekeeper follows fresh thread snapshot');
    assert.ok(replyAndResolve > gatekeeper, 'reply/resolve text follows gatekeeper pass');
    assert.match(workflow, /do not declare the round complete, recommend merge, post reviewer-facing replies, or resolve threads while it reports `fail` or `BLOCK`/);
    assert.match(workflow, /If the required real reply or resolve ID is unavailable, block only that affected reply or resolve sub-action/);
});

test('PR review workflow inserts Broad Safe Validation Gate between targeted checks and readiness', async () => {
    const text = await read(prReviewSkillPath);
    const workflow = text.slice(
        text.indexOf('## Workflow'),
        text.indexOf('## Review Comment Validation Gate'),
    );

    const targetedVerification = workflow.indexOf('5. Verify fixes locally with targeted evidence for each addressed comment.');
    const broadGate = workflow.indexOf('5a. **Broad Safe Validation Gate.**');
    const commitPush = workflow.indexOf('9. **Commit and push to the PR branch and confirm PR visibility.**');
    const gatekeeper = workflow.indexOf('11. **Round closure via `review-cycle-gatekeeper`.**');
    const replyAndResolve = workflow.indexOf('12. Only after the gatekeeper returns `pass`');

    assert.ok(targetedVerification >= 0, 'targeted verification step is present');
    assert.ok(broadGate > targetedVerification, 'broad gate follows targeted verification');
    assert.ok(commitPush > broadGate, 'commit/push readiness follows broad gate');
    assert.ok(gatekeeper > broadGate, 'gatekeeper receives broad gate evidence after the gate');
    assert.ok(replyAndResolve > broadGate, 'reviewer-facing replies and resolution follow broad gate');
    assert.match(workflow, /Targeted checks alone do not satisfy this gate when broad safe validation is available/);
    assert.match(workflow, /invoke `review-cycle-gatekeeper` with[\s\S]+targeted verification evidence per fix, Broad Safe Validation Gate evidence/);
});

test('PR review Broad Safe Validation Gate is repository-agnostic and separates output-writing validation', async () => {
    const text = await read(prReviewSkillPath);
    const section = text.slice(
        text.indexOf('## Broad Safe Validation Gate'),
        text.indexOf('## Hard Gate'),
    );

    assert.match(section, /Broad safe validation is the broadest bounded, non-mutating, locally supported validation relevant to the changed surface/);
    assert.match(section, /Discover candidate validation commands from repository-local evidence only/);
    assert.match(section, /Do not use ecosystem, framework, language, or package-manager preference order as normative behavior/);
    assert.match(section, /Classify each candidate by observed or documented behavior, not by command name or ecosystem/);
    assert.match(section, /Select the broadest bounded candidate that is relevant to the changed surface and still safe under the current workflow boundaries/);
    assert.match(section, /Mutating, package-management, dependency-changing, network-contacting, service-starting, environment-changing, and output-writing commands are not ordinary broad safe validation/);
    assert.match(section, /Output-writing validation is reported separately from ordinary broad safe validation/);
});

test('PR review Broad Safe Validation Gate requires fresh final-worktree evidence before readiness', async () => {
    const text = await read(prReviewSkillPath);
    const workflow = text.slice(
        text.indexOf('## Workflow'),
        text.indexOf('## Review Comment Validation Gate'),
    );
    const section = text.slice(
        text.indexOf('## Broad Safe Validation Gate'),
        text.indexOf('## Hard Gate'),
    );
    const hardGate = text.slice(
        text.indexOf('## Hard Gate'),
        text.indexOf('## PR Title Rule'),
    );

    assert.match(workflow, /require broad safe validation before commit\/push readiness, reviewer-facing replies, or review-thread resolution/);
    assert.match(workflow, /Broad safe validation evidence must be fresh for the final candidate worktree\/fix batch/);
    assert.match(workflow, /If contextual\/independent review, builder\/test follow-up, formatting, generated-output handling, or any other fix step changes the worktree after broad validation evidence was produced, that evidence is stale until broad validation is rerun or explicitly re-established for the final changed surface/);
    assert.match(workflow, /Broad Safe Validation Gate evidence including freshness state for the final candidate worktree\/fix batch/);
    assert.match(section, /Its evidence is valid only when fresh for the final candidate worktree\/fix batch/);
    assert.match(section, /Freshness is part of the evidence, not an optional note/);
    assert.match(section, /Later edits invalidate prior broad validation until it is rerun or explicitly re-established for the final changed surface/);
    assert.match(section, /`passed`: the selected broad safe validation completed successfully, dirty-state boundaries remained acceptable, and the evidence is fresh for the final candidate worktree\/fix batch/);
    assert.match(hardGate, /If the Broad Safe Validation Gate is missing, failed, blocked, stale, or not fresh for the final candidate worktree\/fix batch, do not push, do not post reviewer-facing replies, and do not resolve threads/);
    assert.match(text, /Broad Safe Validation Gate: targeted verification status; broad safe validation status[\s\S]+freshness evidence for the final candidate worktree\/fix batch[\s\S]+proceed\/block effect; residual risk; next operator action/);
});

test('PR review Broad Safe Validation Gate blocks failed or blocked broad validation and requires residual-risk reporting', async () => {
    const text = await read(prReviewSkillPath);
    const section = text.slice(
        text.indexOf('## Broad Safe Validation Gate'),
        text.indexOf('## Hard Gate'),
    );
    const failedStatus = section.match(/- `failed`:[^\n]+/)?.[0] ?? '';

    assert.match(failedStatus, /This blocks push, reviewer-facing replies, and thread resolution until the selected broad safe validation failure is addressed, or until the workflow is re-scoped or reclassified so that command is no longer the selected broad safe validation/);
    assert.match(failedStatus, /A failed selected broad safe validation cannot be waived through residual risk/);
    assert.doesNotMatch(failedStatus, /may proceed|proceed only|accepted residual-risk|accepted residual risk|next operator action|reroute/i);
    assert.match(text, /`blocked`: broad safe validation should run but cannot be selected or executed[\s\S]+blocks push, reviewer-facing replies, and thread resolution/);
    assert.match(text, /`skipped`: broad safe validation is available but intentionally skipped only with inspected evidence, candidate command\(s\) inspected, selected command or unavailable-command conclusion, classification basis, freshness evidence for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
    assert.match(text, /`not applicable`: no meaningful broad validation exists[\s\S]+inspected evidence, candidate command\(s\) inspected, selected command or unavailable-command conclusion, classification basis, freshness evidence for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
    assert.match(text, /`mutating-only`: only mutating, network, service-starting, package-management, or output-writing candidates exist\. This is not a pass/);
    assert.match(text, /It may proceed only with freshness evidence for the final candidate worktree\/fix batch and after either the authorized mutating\/output-writing candidate actually ran and is reported separately with dirty-state\/output boundaries, or an accepted residual-risk rationale explicitly covers not running it/);
    assert.match(text, /Classification basis for command-behavior outcomes \(`local-only`, `approval-bound`, or `forbidden`\) and status outcomes \(`skipped`, `not applicable`, `blocked`, or `mutating-only`\)/);
    assert.match(text, /If the Broad Safe Validation Gate is missing, failed, blocked, stale, or not fresh for the final candidate worktree\/fix batch, do not push, do not post reviewer-facing replies, and do not resolve threads/);
    assert.match(text, /A valid `skipped` or `not applicable` status may proceed only when the output names inspected evidence, candidate command\(s\) inspected, selected command or unavailable-command conclusion, classification basis, freshness evidence for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
    assert.match(text, /Broad Safe Validation Gate: targeted verification status; broad safe validation status \(`passed`\/`failed`\/`blocked`\/`skipped`\/`not applicable`\/`mutating-only`\); candidate command\(s\) inspected; selected command or unavailable-command conclusion; repository-local discovery evidence; command classification basis; dirty-state boundary result when executed; freshness evidence for the final candidate worktree\/fix batch; proceed\/block effect; residual risk; next operator action/);
});

test('PR review status definitions require freshness for non-passing broad validation outcomes', async () => {
    const text = await read(prReviewSkillPath);
    const section = text.slice(
        text.indexOf('## Broad Safe Validation Gate'),
        text.indexOf('## Hard Gate'),
    );

    for (const status of ['skipped', 'not applicable', 'mutating-only']) {
        const line = section.split('\n').find((candidate) => candidate.startsWith('- `' + status + '`:')) ?? '';

        assert.match(line, /freshness evidence for the final candidate worktree\/fix batch/, `${status} requires freshness evidence`);
    }
});

test('workflow safety PR readiness requires broad validation evidence for PR-review fix cycles', async () => {
    const text = await read(workflowSafetyGatesPath);
    const section = text.slice(
        text.indexOf('## PR Readiness Evidence Gate'),
        text.indexOf('## PR Review Visibility and Thread Gate'),
    );

    assert.match(section, /Before GitHub PR creation, require explicit evidence for each mandatory upstream step/);
    assert.match(section, /Broad Safe Validation Gate evidence is required when PR-review fix cycles are in scope/);
    assert.match(section, /status \(`passed`\/`failed`\/`blocked`\/`skipped`\/`not applicable`\/`mutating-only`\)/);
    assert.match(section, /repository-local discovery evidence, candidate command\(s\) inspected, selected command or unavailable-command conclusion, command classification basis, dirty-state boundary result when executed, freshness evidence for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
    assert.match(section, /Missing, failed, blocked, stale, or unknown freshness evidence blocks PR creation readiness/);
});

test('workflow safety PR readiness accepts skipped broad validation only with evidence and policy basis', async () => {
    const text = await read(workflowSafetyGatesPath);
    const section = text.slice(
        text.indexOf('## PR Readiness Evidence Gate'),
        text.indexOf('## PR Review Visibility and Thread Gate'),
    );

    assert.match(section, /`skipped` and `not applicable` Broad Safe Validation Gate statuses satisfy readiness only when the output includes the full inspected evidence package and the policy\/risk basis for accepting that status/);
    assert.match(section, /repository-local discovery, candidate command\(s\), selected or unavailable command conclusion, classification basis, freshness for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
    assert.match(section, /Valid evidence-backed `skipped` and `not applicable` statuses do not block solely because they are skips/);
});

test('workflow safety PR readiness treats mutating-only broad validation as conditional evidence, not a pass', async () => {
    const text = await read(workflowSafetyGatesPath);
    const section = text.slice(
        text.indexOf('## PR Readiness Evidence Gate'),
        text.indexOf('## PR Review Visibility and Thread Gate'),
    );

    assert.match(section, /`mutating-only` is not a pass/);
    assert.match(section, /It satisfies readiness only when the output includes the full inspected evidence package above AND either separately reported authorized mutating\/output-writing command results with dirty-state\/output boundaries, or an accepted residual-risk rationale explicitly covering not running the mutating\/output-writing candidate/);
    assert.doesNotMatch(section, /`mutating-only` satisfies readiness solely because authorization exists/i);
});

test('workflow safety PR readiness skipped-step wording blocks only missing evidence or risk basis', async () => {
    const text = await read(workflowSafetyGatesPath);
    const section = text.slice(
        text.indexOf('## PR Readiness Evidence Gate'),
        text.indexOf('## PR Review Visibility and Thread Gate'),
    );

    assert.match(section, /If any mandatory step was skipped without the required evidence, policy basis, or residual-risk basis, only logged without a real invocation, unavailable, failed, or blocked, do not create the PR/);
    assert.match(section, /Valid evidence-backed `skipped` and `not applicable` statuses do not block solely because they are skips/);
    assert.doesNotMatch(section, /If any mandatory step was skipped, only logged without a real invocation, unavailable, failed, or blocked, do not create the PR/);
});

test('orchestrator PR creation guidance preserves workflow safety broad-validation status semantics', async () => {
    const text = await read(orchestratorPath);
    const guidanceStart = text.indexOf('## PR Creation Guidance');
    assert.ok(guidanceStart >= 0, 'PR Creation Guidance section is present');
    const section = text.slice(guidanceStart);

    assert.match(section, /Apply the `workflow-safety-gates` PR Readiness Evidence Gate status semantics/);
    assert.match(section, /`skipped` and `not applicable` satisfy readiness only with the full inspected evidence package and policy\/risk basis/);
    assert.match(section, /repository-local discovery evidence, candidate command\(s\) inspected, selected command or unavailable-command conclusion, command classification basis, freshness for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
    assert.match(section, /`mutating-only` is not a pass; it satisfies readiness only with that full package plus either separately reported authorized mutating\/output-writing command results with dirty-state\/output boundaries, or an accepted residual-risk rationale explicitly covering not running it/);
});

test('test agent reports targeted versus broad safe validation with behavior-based command classification', async () => {
    const text = await read(testAgentPath);

    assert.match(text, /Distinguish targeted verification from broad safe validation in every verification report/);
    assert.match(text, /Targeted checks alone do not satisfy broad safe validation when a broad safe candidate is available/);
    assert.match(text, /Discover broad safe validation candidates from repository-local evidence only: checked-in docs, local scripts, task definitions, tool configuration, prior local inspection, and handoff-provided repository evidence/);
    assert.match(text, /Do not prefer, require, or reject commands because they belong to a particular language, framework, ecosystem, or package manager/);
    assert.match(text, /Classify candidate commands by behavior and evidence, not by name/);
    assert.match(text, /`local-only`, `approval-bound`, `forbidden`, unavailable, skipped, not applicable, or mutating-only/);
    assert.match(text, /output-writing commands are not ordinary broad safe validation[\s\S]+exact command, cwd\/root, expected dirty-state\/output paths, timeout or cleanup plan, and generated-artifact handling/);
    assert.match(text, /Broad safe validation evidence must be fresh for the final candidate worktree\/fix batch/);
    assert.match(text, /If contextual\/independent review, builder\/test follow-up, formatting, generated-output handling, or any other fix step changes the worktree after evidence was produced, report prior broad validation as stale until it is rerun or explicitly re-established for the final changed surface/);
    assert.match(text, /If broad safe validation is `failed`, `blocked`, stale, or has unknown freshness, report that downstream push\/reply\/thread-resolution readiness is blocked; failed selected broad validation cannot be waived through residual risk/);
    assert.match(text, /If it is `skipped`, `not applicable`, or `mutating-only`, include the inspected evidence, candidate command\(s\) inspected, selected command or unavailable-command conclusion, classification basis, freshness evidence for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
    assert.match(text, /For `mutating-only`, proceed only after the authorized mutating\/output-writing command ran and is reported separately with dirty-state\/output boundaries, or after an accepted residual-risk rationale explicitly covers not running it/);
    assert.match(text, /Targeted vs broad safe validation: targeted verification status and evidence; broad safe validation status \(`passed`\/`failed`\/`blocked`\/`skipped`\/`not applicable`\/`mutating-only`\); repository-local discovery evidence; candidate command\(s\) inspected; selected command or unavailable-command conclusion; command classification basis; dirty-state boundary result when executed; freshness evidence for the final candidate worktree\/fix batch; proceed\/block effect; residual risk; next operator action/);
});

test('gatekeeper consumes targeted-vs-broad evidence and blocks missing or blocking broad validation', async () => {
    const text = await read(reviewCycleGatekeeperPath);

    assert.match(text, /Verification evidence after fixes, separated into targeted verification and Broad Safe Validation Gate evidence when PR-review fixes are in scope/);
    assert.match(text, /broad evidence must include status \(`passed`\/`failed`\/`blocked`\/`skipped`\/`not applicable`\/`mutating-only`\), repository-local discovery evidence, candidate command\(s\) inspected, selected command or unavailable-command conclusion, command classification basis, dirty-state boundary result when executed, freshness evidence for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
    assert.match(text, /Targeted checks alone do not satisfy this rule when broad safe validation is available/);
    assert.match(text, /`passed` satisfies the rule only when the evidence is fresh for the final candidate worktree\/fix batch/);
    assert.match(text, /`failed`, `blocked`, stale evidence, and unknown freshness make the gate emit `BLOCK`/);
    assert.match(text, /a failed selected broad safe validation remains blocking until its failure is addressed, or until the workflow is re-scoped or reclassified so that command is no longer the selected broad safe validation/);
    assert.match(text, /`skipped` and `not applicable` are valid only when the evidence includes inspected repository-local basis, candidate command\(s\) inspected, selected command or unavailable-command conclusion, command classification basis, freshness evidence for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
    assert.match(text, /`mutating-only` is not a pass[\s\S]+either a separately reported authorized mutating\/output-writing run with dirty-state\/output boundaries, or an accepted residual-risk rationale that explicitly covers not running it/);
    assert.match(text, /Otherwise the gate emits `BLOCK` for missing evidence/);
    assert.match(text, /missing, failed, blocked, stale, or unknown freshness broad safe validation emits `BLOCK`/);
    assert.match(text, /Reject targeted-only evidence when broad safe validation is available, and emit `BLOCK` for missing, failed, blocked, stale, or unknown freshness broad validation evidence/);
    assert.match(text, /Broad Safe Validation Gate evidence: targeted verification status; broad safe validation status; repository-local discovery evidence; candidate command\(s\) inspected; selected command or unavailable-command conclusion; command classification basis; dirty-state boundary result when executed; freshness evidence for the final candidate worktree\/fix batch; proceed\/block effect; residual risk; next operator action; and whether the evidence is sufficient for this gate/);
});

test('gatekeeper requires broad-validation freshness evidence and blocks stale or unknown freshness', async () => {
    const text = await read(reviewCycleGatekeeperPath);
    const requiredInputsStart = text.indexOf('\n## Required Inputs');
    const gateRulesStart = text.indexOf('\n## Gate Rules');
    const decisionProcedureStart = text.indexOf('\n## Decision Procedure');
    const outputFormatStart = text.indexOf('\n## Output Format');
    const requiredInputs = text.slice(
        requiredInputsStart,
        text.indexOf('\n## Severity Vocabulary', requiredInputsStart),
    );
    const gateRules = text.slice(
        gateRulesStart,
        text.indexOf('\n## Waiver Rules', gateRulesStart),
    );
    const decisionProcedure = text.slice(
        decisionProcedureStart,
        text.indexOf('\n### Insufficient Input', decisionProcedureStart),
    );
    const outputFormat = text.slice(
        outputFormatStart,
        text.indexOf('\n## Anti-Patterns', outputFormatStart),
    );

    assert.match(requiredInputs, /freshness evidence for the final candidate worktree\/fix batch/);
    assert.match(requiredInputs, /If contextual\/independent review, builder\/test follow-up, formatting, generated-output handling, or any other fix step changed the worktree after broad validation evidence was produced, that evidence is stale until rerun or explicitly re-established for the final changed surface/);
    assert.match(requiredInputs, /stale or unknown freshness makes the gatekeeper emit `BLOCK`/);
    assert.match(gateRules, /`passed` satisfies the rule only when the evidence is fresh for the final candidate worktree\/fix batch/);
    assert.match(gateRules, /`failed`, `blocked`, stale evidence, and unknown freshness make the gate emit `BLOCK`/);
    assert.match(gateRules, /missing, failed, blocked, stale, or unknown freshness broad safe validation emits `BLOCK`/);
    assert.match(decisionProcedure, /emit `BLOCK` for missing, failed, blocked, stale, or unknown freshness broad validation evidence/);
    assert.match(outputFormat, /Broad Safe Validation Gate evidence: targeted verification status; broad safe validation status; repository-local discovery evidence; candidate command\(s\) inspected; selected command or unavailable-command conclusion; command classification basis; dirty-state boundary result when executed; freshness evidence for the final candidate worktree\/fix batch; proceed\/block effect; residual risk; next operator action; and whether the evidence is sufficient for this gate/);
    assert.match(outputFormat, /freshness: <fresh for final candidate worktree\/fix batch, stale, or unknown, with later-edit evidence>/);
});

test('gatekeeper Broad Safe Validation Gate sample template names candidate selection and dirty-state boundary fields', async () => {
    const text = await read(reviewCycleGatekeeperPath);
    const sample = text.slice(
        text.indexOf('Broad Safe Validation Gate evidence:'),
        text.indexOf('Waivers:', text.indexOf('Broad Safe Validation Gate evidence:')),
    );

    assert.match(sample, /- repository-local discovery evidence: <docs\/scripts\/config\/prior-local-evidence inspected>/);
    assert.match(sample, /- candidate command\(s\) inspected: <commands or None>/);
    assert.match(sample, /- selected command or unavailable-command conclusion: <selected command, or why none is selectable>/);
    assert.match(sample, /dirty-state boundary result: <before\/after result or not executed>/);
    assert.match(sample, /freshness: <fresh for final candidate worktree\/fix batch, stale, or unknown, with later-edit evidence>/);
});

test('orchestrator carries Broad Safe Validation Gate evidence through PR-review handoffs and readiness', async () => {
    const text = await read(orchestratorPath);

    assert.match(text, /require the Broad Safe Validation Gate after targeted fix verification succeeds and before push readiness, reviewer-facing replies, or review-thread resolution/);
    assert.match(text, /Targeted checks alone do not satisfy broad validation when a broad safe candidate is available/);
    assert.match(text, /Evidence must be fresh for the final candidate worktree\/fix batch/);
    assert.match(text, /contextual\/independent review, builder\/test follow-up, formatting, generated-output handling, or any other later worktree edit invalidates earlier broad validation until rerun or explicitly re-established for the final changed surface/);
    assert.match(text, /Failed, blocked, stale, or unknown freshness broad validation blocks progress; failed selected broad validation cannot be waived through residual risk/);
    assert.match(text, /`skipped`, `not applicable`, or `mutating-only` outcomes may proceed only with inspected evidence, candidate command\(s\) inspected, selected command or unavailable-command conclusion, command classification basis, freshness evidence for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
    assert.match(text, /Mutating-only evidence is not a pass; it may proceed only after the authorized mutating\/output-writing command ran with reported dirty-state\/output boundaries, or after an accepted residual-risk rationale explicitly covers not running it/);
    assert.match(text, /For PR-review fix cycles, it also consumes targeted verification and Broad Safe Validation Gate evidence with freshness state for the final candidate worktree\/fix batch/);
    assert.match(text, /Missing, failed, blocked, stale, or unknown freshness broad safe validation blocks readiness; failed selected broad validation cannot be waived through residual risk/);
    assert.match(text, /do not push, post reviewer-facing replies, or resolve threads until targeted fix verification has passed and the Broad Safe Validation Gate has a non-blocking status that is fresh for the final candidate worktree\/fix batch/);
    assert.match(text, /Broad safe validation is selected from repository-local evidence by behavior-based command classification, not by language\/framework\/ecosystem preference/);
    assert.match(text, /Broad Safe Validation Gate expectations for PR-review fixes: report targeted verification separately from broad safe validation; discover broad candidates from repository-local evidence only; classify candidates by behavior as `local-only`, `approval-bound`, `forbidden`, `unavailable`, `skipped`, `not applicable`, or `mutating-only`; report candidate command\(s\) inspected and the selected command or unavailable-command conclusion/);
    assert.match(text, /include proceed\/block effect, residual risk, and next operator action for any `failed`, `blocked`, `stale`, `skipped`, `not applicable`, or `mutating-only` result/);
    assert.match(text, /For `mutating-only`, require either a separately reported authorized mutating\/output-writing run with dirty-state\/output boundaries, or an accepted residual-risk rationale that explicitly covers not running it/);
    assert.match(text, /PR creation or preparation readiness also requires Broad Safe Validation Gate evidence when the branch carries those fixes[\s\S]+Apply the `workflow-safety-gates` PR Readiness Evidence Gate status semantics/);
    assert.match(text, /`skipped` and `not applicable` satisfy readiness only with the full inspected evidence package and policy\/risk basis/);
    assert.match(text, /`mutating-only` is not a pass; it satisfies readiness only with that full package plus either separately reported authorized mutating\/output-writing command results with dirty-state\/output boundaries, or an accepted residual-risk rationale explicitly covering not running it/);
    assert.match(text, /Broad Safe Validation Gate status when PR-review fixes are in scope: targeted verification status; broad safe validation status \(`passed`\/`failed`\/`blocked`\/`skipped`\/`not applicable`\/`mutating-only`\); repository-local discovery evidence; candidate command\(s\) inspected; selected command or unavailable-command conclusion; command classification basis; dirty-state boundary result when executed; freshness evidence for the final candidate worktree\/fix batch; proceed\/block effect; residual risk; next operator action/);
});

test('builder classifies builder-run PR-review checks or defers broad validation to test agent', async () => {
    const text = await read(builderAgentPath);

    assert.match(text, /When verification is in scope for a PR-review fix, classify builder-run checks as targeted verification or broad safe validation/);
    assert.match(text, /If broad safe validation belongs to `test-agent` or cannot be selected under the current command boundaries, report the candidate command\(s\) inspected and selected command or unavailable-command conclusion explicitly instead of treating targeted checks as broad validation/);
    assert.match(text, /Targeted vs broad safe validation when PR-review fixes are in scope:[\s\S]+candidate command\(s\) inspected; selected command or unavailable-command conclusion/);
});

test('Linear entrypoints and docs carry no-PR thread-state proof language', async () => {
    const paths = await existingPaths([linearSkillPath, linearPromptPath, docsPath]);
    assert.ok(paths.length > 0, 'at least one linear entrypoint/doc path exists');

    for (const path of paths) {
        const text = await read(path);
        assert.match(text, /thread state: not applicable - no PR exists yet/, `${path} has the no-PR thread-state phrase`);
        assert.match(text, /no PR number|no linked PR|PR creation (?:has )?not yet run/, `${path} includes concrete no-PR proof language`);
    }
});

test('Linear entrypoints and docs propagate high-risk agent-pack dual review rule or deference', async () => {
    const paths = await existingPaths([linearSkillPath, linearPromptPath, docsPath]);
    assert.ok(paths.length > 0, 'at least one linear entrypoint/doc path exists');

    for (const path of paths) {
        const text = await read(path);
        assert.match(text, /high-risk agent-pack changes? touching orchestrator workflow rules, tool grants, security boundaries, security-tester authorization, or multiple agent files/i, `${path} names high-risk agent-pack surfaces`);
        assert.match(text, /contextual plus independent review|contextual and independent review/i, `${path} requires dual review`);
        assert.match(text, /explicit skip rationale\/deference|explicit skip rationale/i, `${path} allows only explicit deference`);
    }
});

test('test-gap planner skip wording is separate from gatekeeper skip sentinel', async () => {
    const text = await read(testGapSkillPath);
    assert.match(text, /Test-gap plan status: skipped \(reason: <one-line rationale>\)/);
    assert.match(text, /distinct from the gatekeeper skip sentinel `no fix cycle, gatekeeper skipped`/);
    assert.doesNotMatch(text, /In any skip case, the orchestrator notes the canonical sentinel/);
});

test('canonical first-round non-trivial adversarial-review definitions are risk-shaped', async () => {
    const text = await read(workflowSafetyGatesPath);

    assert.match(text, /First-round non-trivial pre-push adversarial-review/);
    assert.match(text, /Non-trivial by risk shape/);
    assert.match(text, /failure would be hard to notice, hard to reverse, externally visible, or likely to cause second-order regressions/);
    assert.match(text, /Non-trivial wins over skip/);
    assert.match(text, /Shared-module decline cannot override this separate mandatory non-trivial trigger/);
});

test('workflow safety gates deny Copilot PR creation as fallback or substitute', async () => {
    const text = await read(workflowSafetyGatesPath);

    assert.match(text, /PR creation permits only the exact approved PR creation tool for this pack: `mcp_github_create_pull_request`/);
    assert.match(text, /Create pull request \| Approved \| `mcp_github_create_pull_request` only/);
    assert.match(text, /Create pull request \| Approved \| `mcp_github_create_pull_request` only \| [^\n|]*PR Body Audit Gate `pass` or `repaired` for the complete candidate PR body/);
    assert.match(text, /Never use `mcp_github_create_pull_request_with_copilot` for PR creation in this pack/);
    assert.match(text, /Copilot PR creation \| Blocked \| `mcp_github_create_pull_request_with_copilot` is denied/);
    assert.match(text, /Host\/tool availability, generic tool descriptions, visible tool schemas, or tool names that appear capable never override this pack allowlist/);
    assert.match(text, /If local push mechanics, branch publication, or exact PR creation is blocked, unavailable, or fails[\s\S]+stop with a blocked, local-ready, or PR-ready summary\/guidance/);
    assert.match(text, /^Copilot PR creation is not a recovery path, fallback, or substitute for failed or unavailable local push mechanics, branch publication, repository-file write tooling, or approved PR creation tooling\.$/m);
});

test('workflow safety create-PR allowlist row requires audited PR body', async () => {
    const text = await read(workflowSafetyGatesPath);
    const row = text.split('\n').find((line) => line.startsWith('| Create pull request |')) ?? '';

    assert.match(row, /`mcp_github_create_pull_request` only/);
    assert.match(row, /PR Body Audit Gate/);
    assert.match(row, /`pass` or `repaired`/);
    assert.match(row, /complete candidate PR body/);
});

test('orchestrator and prompt require first-round pre-push adversarial status with split verdict', async () => {
    const paths = await existingPaths([orchestratorPath, runAgenticPromptPath]);
    assert.ok(paths.length > 0, 'at least one orchestrator/prompt path exists');

    for (const path of paths) {
        const text = await read(path);
        assert.match(text, /First-round non-trivial pre-push adversarial-review/, `${path} names first-round non-trivial rule`);
        assert.match(text, /non-trivial by risk shape/i, `${path} uses risk-shape trigger language`);
        assert.match(text, /Pre-push adversarial review status/, `${path} exposes operator-facing status`);
    }

    const orchestrator = await read(orchestratorPath);
    assert.match(orchestrator, /`Execution status`: one of `completed`, `skipped`, `blocked`, `not applicable`/);
    assert.match(orchestrator, /`Verdict`: one of `BLOCK`, `CONCERNS`, `CLEAN`, `defer to prior adversarial review`/);
    assert.match(orchestrator, /`Verdict: BLOCK` blocks push\/PR readiness even with `Execution status: completed`/);
    assert.match(orchestrator, /Execution-status values are NEVER placed directly in the Verdict field/);
    assert.match(orchestrator, /`Verdict: not produced \(execution status: <execution-status>\)`/);
    assert.doesNotMatch(orchestrator, /verdict is (?:skipped|blocked|not applicable)/i);
    assert.doesNotMatch(orchestrator, /when verdict is `(?:skipped|blocked|not applicable)`/i);
});

test('workflow entrypoints propagate first-round non-trivial pre-push review status', async () => {
    const paths = await existingPaths([linearSkillPath, linearPromptPath, prReviewSkillPath, expertPanelPath, docsPath]);
    assert.ok(paths.length > 0, 'at least one workflow entrypoint path exists');

    for (const path of paths) {
        const text = await read(path);
        assert.match(text, /First-round non-trivial pre-push adversarial-review/, `${path} names first-round rule`);
        assert.match(text, /Pre-push adversarial review status/, `${path} reports pre-push status`);
        assert.match(text, /Execution status.*Verdict|`Execution status`.*`Verdict`/s, `${path} keeps execution separate from verdict`);
        assert.match(text, /Matched non-trivial class|matched non-trivial class/i, `${path} reports matched non-trivial classes`);
        assert.match(text, /skip considered.*skip rejected.*skip accepted|skip considered\/rejected\/accepted/i, `${path} reports skip evidence`);
    }
});

test('push and PR readiness require non-blocking adversarial outcome', async () => {
    const paths = await existingPaths([workflowSafetyGatesPath, orchestratorPath, linearSkillPath, linearPromptPath, prReviewSkillPath, expertPanelPath]);
    assert.ok(paths.length > 0, 'at least one push/PR readiness path exists');

    for (const path of paths) {
        const text = await read(path);
        assert.match(text, /completed[^.\n]+non-blocking verdict|non-blocking verdict[^.\n]+completed/s, `${path} requires completed non-blocking verdict`);
        assert.match(text, /valid trivial (?:risk-shape )?(?:skip|rationale)|valid trivial skip/s, `${path} allows only valid trivial skip`);
        assert.match(text, /true not-applicable evidence|truly not applicable/s, `${path} requires true not-applicable evidence`);
        assert.match(text, /Verdict: BLOCK[^.\n]+blocks|`Verdict: BLOCK`[^.\n]+blocks/s, `${path} says BLOCK verdict blocks`);
    }
});

test('first-round adversarial baseline is cumulative branch diff vs integration branch', async () => {
    const paths = await existingPaths([workflowSafetyGatesPath, orchestratorPath, runAgenticPromptPath, prReviewSkillPath, docsPath]);
    assert.ok(paths.length > 0, 'at least one baseline path exists');

    for (const path of paths) {
        const text = await read(path);
        assert.match(text, /cumulative branch diff (?:against|vs) the integration branch/i, `${path} uses cumulative integration-branch baseline`);
    }

    const orchestrator = await read(orchestratorPath);
    assert.match(orchestrator, /Later-push delta-only optimization/);
    assert.match(orchestrator, /cannot satisfy or bypass first-round coverage/);
    assert.doesNotMatch(orchestrator, /cumulative branch diff against the PR head's prior tip/);
});

test('primary adversary path never emits defer verdict', async () => {
    const adversarialReview = await read(adversarialReviewPath);
    const adversaryAgent = await read(adversaryAgentPath);
    const orchestrator = await read(orchestratorPath);

    assert.match(adversarialReview, /primary role emits only `BLOCK \| CONCERNS \| CLEAN`/);
    assert.match(adversarialReview, /no-net-new as `CLEAN` with evidence/);
    assert.match(adversaryAgent, /Use only `BLOCK`, `CONCERNS`, or `CLEAN` for the verdict/);
    assert.match(orchestrator, /primary adversary output never emits `defer to prior adversarial review`/);
    assert.doesNotMatch(orchestrator, /`adversary-agent` reports `Verdict: defer to prior adversarial review`/);
});

test('independent secondary lens matrix is explicit and prior-gated', async () => {
    for (const path of [adversarialReviewPath, independentReviewerPath, orchestratorPath]) {
        const text = await read(path);
        assert.match(text, /CRITICAL[^.]+HIGH[^.]+(?:without|uncompensated)[^.]+`BLOCK`|`BLOCK`[^.]+CRITICAL[^.]+(?:uncompensated|without)/s, `${path} blocks net-new critical or uncompensated high`);
        assert.match(text, /HIGH[^.]+(?:compensating control|compensated|owner-accepted tradeoff)[^.]+MEDIUM[^.]+LOW[^.]+`CONCERNS`|`CONCERNS`[^.]+(?:compensated|MEDIUM\/LOW)/s, `${path} maps compensated high or medium/low to concerns`);
        assert.match(text, /empty[^.]+net-new|net-new[^.]+empty/i, `${path} requires empty net-new for defer`);
        assert.match(text, /no adversary ran|no prior adversary ran|Without a prior adversary run/i, `${path} handles no prior adversary as primary`);
    }
});

test('PR description support skills are internal and composer invokes them in order', async () => {
    const [composer, templatePolicy, bodyAudit] = await Promise.all([
        read(pullRequestDescriptionPath),
        read(prDescriptionTemplatePolicyPath),
        read(prDescriptionBodyAuditPath),
    ]);

    assert.equal(frontmatterValue(composer, 'user-invocable'), 'true', 'main composer remains user-invocable');
    assert.equal(frontmatterValue(templatePolicy, 'user-invocable'), 'false', 'template policy is internal');
    assert.equal(frontmatterValue(bodyAudit, 'user-invocable'), 'false', 'body audit is internal');
    assert.equal(frontmatterValue(templatePolicy, 'name'), 'pr-description-template-policy');
    assert.equal(frontmatterValue(bodyAudit, 'name'), 'pr-description-body-audit');

    const templateInvocation = composer.indexOf('Before candidate composition, invoke `pr-description-template-policy`');
    const composition = composer.indexOf('Generate the candidate copy/pasteable Markdown body');
    const auditInvocation = composer.indexOf('Before final fenced Markdown emission, invoke `pr-description-body-audit`');

    assert.ok(templateInvocation >= 0, 'composer invokes template policy before composition');
    assert.ok(composition > templateInvocation, 'candidate composition follows template policy');
    assert.ok(auditInvocation > composition, 'body audit follows candidate composition');
    assert.match(composer, /Do not ask users to choose internal support skills/);
    assert.match(composer, /If either support skill is unavailable or reports blocked, return blocked status and operator-facing notes instead of emitting a final fenced PR body/);
});

test('PR description composer blocks remote updates and keeps title generation conventional', async () => {
    const composer = await read(pullRequestDescriptionPath);

    assert.match(composer, /Generate copy\/pasteable Markdown only; do not edit existing PR descriptions/);
    assert.match(composer, /remote PR title\/body updates are not currently approved by `workflow-safety-gates`/);
    assert.match(composer, /Do not call GitHub MCP mutation tools for PR body updates/);
    assert.match(composer, /Update status must say copy\/paste only/);
    assert.match(composer, /PR title \(drafted by `conventional-commits` in Conventional Commit subject style\)/);
    assert.match(composer, /The PR title is generated by `conventional-commits` and must be a single Conventional Commit subject line/);
    assert.match(composer, /If `conventional-commits` is unavailable when a PR title is requested, report blocked/);
});

test('PR description template policy owns template discovery and operator-facing status', async () => {
    const text = await read(prDescriptionTemplatePolicyPath);

    assert.match(text, /aligns with the `workflow-safety-gates` PR Template Gate/);
    assert.match(text, /\.github\/pull_request_template\.md/);
    assert.match(text, /\.github\/PULL_REQUEST_TEMPLATE\/\*\.md/);
    assert.match(text, /If exactly one readable template is found/);
    assert.match(text, /If multiple templates are found and no repository convention clearly selects one/);
    assert.match(text, /If no template is found, exactly one candidate exists and is unreadable, or every candidate is unreadable/);
    assert.match(text, /Template status is for the operator-facing notes outside the fenced PR body only/);
    assert.match(text, /no-template-fallback-used/);
    assert.match(text, /unreadable-template-fallback-used/);
    assert.match(text, /The reviewer-facing PR body must not include any sentence that names the template's existence, absence, source, or fallback selection/);
});

test('selected unreadable template blocks when readable alternatives exist', async () => {
    const templatePolicy = await read(prDescriptionTemplatePolicyPath);
    const workflowSafety = await read(workflowSafetyGatesPath);
    const templateGate = workflowSafety.slice(
        workflowSafety.indexOf('## PR Template Gate'),
        workflowSafety.indexOf('### PR Body Audience'),
    );

    assert.match(templatePolicy, /selected-template-unreadable-choice-required/);
    assert.match(templatePolicy, /user-selected or repository-convention-selected template is unreadable and at least one other candidate template is readable/);
    assert.match(templatePolicy, /Do not silently use the fallback template and do not silently switch to a readable alternative/);
    assert.match(templatePolicy, /If no template is found, exactly one candidate exists and is unreadable, or every candidate is unreadable/);

    assert.match(templateGate, /selected-template-unreadable-choice-required/);
    assert.match(templateGate, /ask the user to choose a readable template or confirm fallback use/);
    assert.match(templateGate, /If the workflow cannot ask, block/);
    assert.match(templateGate, /If no template is found, exactly one candidate exists and is unreadable, or every candidate is unreadable/);
    assert.doesNotMatch(templateGate, /selected template cannot be read, use the workflow fallback body/i);
});

test('workflow safety PR Body Audit Gate is canonical for all PR body paths', async () => {
    const workflowSafety = await read(workflowSafetyGatesPath);
    const orchestrator = await read(orchestratorPath);
    const linear = await read(linearSkillPath);
    const prReview = await read(prReviewSkillPath);
    const composer = await read(pullRequestDescriptionPath);
    const auditGate = workflowSafety.slice(
        workflowSafety.indexOf('### PR Body Audit Gate'),
        workflowSafety.indexOf('## PR Readiness Evidence Gate'),
    );
    const prReviewIntegrationStart = prReview.indexOf('## Integration with Pull Request Description');
    const prReviewIntegration = prReview.slice(
        prReviewIntegrationStart,
        prReview.indexOf('\n## Output Format', prReviewIntegrationStart),
    );

    assert.match(auditGate, /Before a workflow sends a body to `mcp_github_create_pull_request`/);
    assert.match(auditGate, /publishes a PR-ready body for manual creation/);
    assert.match(auditGate, /returns a final fenced copy\/paste PR description/);
    assert.match(auditGate, /orchestrator's inline PR creation/);
    assert.match(auditGate, /direct `linear-issue-workflow` PR creation/);
    assert.match(auditGate, /`pull-request-description`/);
    assert.match(auditGate, /workflow\/template leakage/);
    assert.match(auditGate, /Hard-wrapped paragraphs or list items/);
    assert.match(auditGate, /Validation language is honest/);
    assert.match(auditGate, /Synthesis adversarial-review PR-body lines/);
    assert.match(auditGate, /The final output separates the reviewer-facing body from operator-facing notes/);
    assert.match(auditGate, /blocks `mcp_github_create_pull_request` and blocks PR-ready body publication/);

    assert.match(orchestrator, /apply the `workflow-safety-gates` PR Body Audit Gate to the complete candidate body/);
    assert.match(orchestrator, /do not create the PR and do not publish the PR-ready body until the body is repaired and re-audited/);
    assert.match(linear, /apply the `workflow-safety-gates` PR Body Audit Gate to the complete candidate body/);
    assert.match(linear, /before calling `mcp_github_create_pull_request` or publishing any PR-ready body/);
    assert.match(prReviewIntegration, /explicit PR description update requests and final PR-body refreshes as PR-body composition\/publication paths/);
    assert.match(prReviewIntegration, /Route through `pull-request-description` when available; otherwise apply the complete `workflow-safety-gates` PR Body Audit Gate checklist/);
    assert.match(prReviewIntegration, /before returning any final fenced copy\/paste PR body or PR-ready body/);
    assert.match(prReviewIntegration, /Proceed only when the PR Body Audit Gate status is `pass` or `repaired`/);
    assert.match(prReviewIntegration, /If the audit is `blocked`, unavailable, ambiguous, or missing, do not emit a final fenced PR body or PR-ready body/);
    assert.match(prReviewIntegration, /remote PR title\/body updates stay blocked by `workflow-safety-gates`/);
    assert.match(composer, /canonical `workflow-safety-gates` PR Body Audit Gate/);
});

test('operator-facing docs require PR Body Audit Gate before PR creation', async () => {
    const rootReadme = await read(rootReadmePath);
    const guideReadme = await read(docsPath);
    const rootLinear = rootReadme.slice(
        rootReadme.indexOf('## Linear Issue Workflow'),
        rootReadme.indexOf('### Invalid Triage Gate'),
    );
    const guideLinear = guideReadme.slice(
        guideReadme.indexOf('### Linear Issue Workflow Flowchart'),
        guideReadme.indexOf('### PR Review Comments Workflow Flowchart'),
    );

    for (const [path, text] of [
        [rootReadmePath, rootLinear],
        [docsPath, guideLinear],
    ]) {
        const templateCheck = text.search(/Checks? (?:the target repository for a )?Pull Request Template|Check PR Template/);
        const auditGate = text.indexOf('PR Body Audit Gate');
        const prCreation = text.indexOf('mcp_github_create_pull_request');

        assert.ok(templateCheck >= 0, `${path} checks PR template before PR creation`);
        assert.ok(auditGate > templateCheck, `${path} audits the selected-template/fallback body after template selection`);
        assert.ok(prCreation > auditGate, `${path} creates PR only after PR Body Audit Gate`);
        assert.match(text, /complete selected-template\/fallback candidate body|pass\/repaired complete body/, `${path} audits the complete candidate body`);
        assert.match(text, /`pass` or `repaired` status|pass\/repaired complete body/, `${path} requires pass or repaired audit status`);
        assert.match(text, /audited selected-template\/fallback body/, `${path} creates the PR with the audited body`);
        assert.doesNotMatch(text, /mcp_github_create_pull_request[^\n]+template status/i, `${path} keeps template status out of PR creation`);
    }

    assert.match(rootLinear, /operator-facing PR template status/);
});

test('Verified non-changes citation rules are inherited by direct PR body paths', async () => {
    const workflowSafety = await read(workflowSafetyGatesPath);
    const orchestrator = await read(orchestratorPath);
    const linear = await read(linearSkillPath);
    const auditGate = workflowSafety.slice(
        workflowSafety.indexOf('### PR Body Audit Gate'),
        workflowSafety.indexOf('## PR Readiness Evidence Gate'),
    );

    assert.match(auditGate, /`## Verified non-changes` items cite all required evidence/);
    assert.match(auditGate, /in-repo code path/);
    assert.match(auditGate, /one-sentence statement of the upstream contract or library behavior/);
    assert.match(auditGate, /in-repository machine-readable version-pin location/);
    assert.match(auditGate, /must not cite URLs, off-repo paths, dependency-tree internal source paths/);
    assert.match(auditGate, /Drop the entire invalid item and report the offending citation excerpt to the operator/);

    assert.match(orchestrator, /only when each item satisfies the canonical `workflow-safety-gates` PR Body Audit Gate citation validation/);
    assert.match(linear, /`## Verified non-changes` citation validation/);
});

test('PR description support skills hard-stop on direct invocation', async () => {
    for (const path of [prDescriptionTemplatePolicyPath, prDescriptionBodyAuditPath]) {
        const text = await read(path);
        const section = text.slice(
            text.indexOf('## Direct Invocation Hard Stop'),
            text.indexOf('## Responsibility'),
        );

        assert.equal(frontmatterValue(text, 'user-invocable'), 'false', `${path} remains internal`);
        assert.match(section, /blocked-direct-invocation/, `${path} has a direct-invocation blocker`);
        assert.match(section, /Route final copy\/paste PR descriptions to `pull-request-description`/, `${path} routes final descriptions`);
        assert.match(section, /route PR creation workflows to the orchestrator or `linear-issue-workflow`/, `${path} routes creation workflows`);
        assert.match(section, /This hard stop does not apply when `pull-request-description`, the orchestrator, or a workflow skill invokes this skill internally/, `${path} allows internal workflow use`);
    }
});

test('PR body audit section blocks support-skill leakage and partial Verified non-changes', async () => {
    const workflowSafety = await read(workflowSafetyGatesPath);
    const auditGate = workflowSafety.slice(
        workflowSafety.indexOf('### PR Body Audit Gate'),
        workflowSafety.indexOf('## PR Readiness Evidence Gate'),
    );

    assert.match(auditGate, /support-skill/);
    assert.match(auditGate, /unresolved workflow\/template leakage blocks/);
    assert.match(auditGate, /failed citation validation that leaves an incomplete `## Verified non-changes` item/);
    assert.match(auditGate, /do not ship a partial item/);
    assert.doesNotMatch(auditGate, /direct workflow paths .* do not need to repeat the full rule/i);
});

test('synthesis PR body line is emitted only after completed adversarial review', async () => {
    const paths = await existingPaths([workflowSafetyGatesPath, orchestratorPath, runAgenticPromptPath, prDescriptionBodyAuditPath, docsPath]);
    assert.ok(paths.length > 0, 'at least one synthesis path exists');

    for (const path of paths) {
        const text = await read(path);
        assert.match(text, /trivial synthesis skips? with rationale/i, `${path} preserves trivial synthesis skip rationale`);
    }

    const prDescription = await read(prDescriptionBodyAuditPath);
    assert.match(prDescription, /only when the synthesis pre-push review actually ran to completion/);
    assert.match(prDescription, /Remove the adversarial-review line if it appears in a non-synthesis PR, in a trivial synthesis skip, or after `Verdict: BLOCK`/);
    assert.match(prDescription, /Pre-push adversarial review status report, including .* is operator-facing only and MUST never appear inside the fenced PR body/s);
});

test('PR description body audit guards against hard-wrapped PR bodies and leakage', async () => {
    const prDescription = await read(prDescriptionBodyAuditPath);

    assert.match(prDescription, /candidate PR body[\s\S]+Before returning or emitting the fenced Markdown body|Before returning or emitting the fenced Markdown body[\s\S]+candidate PR body/);
    assert.match(prDescription, /hard-wrapped paragraphs? or list items?|hard-wrapped paragraphs?[\s\S]+list items?/);
    assert.match(prDescription, /Repair[\s\S]+before emitting/);
    assert.match(prDescription, /cannot confidently distinguish intentional Markdown structure[\s\S]+accidental hard wrapping[\s\S]+block and fail fast/);
    assert.match(prDescription, /~72-character body wrap from `commit-body-guidelines` and `conventional-commits` applies to commit bodies only[\s\S]+do not carry their wrap width into the PR body/);
    assert.match(prDescription, /must not name workflow specialists, MCP tools, handoff steps, skills, host plumbing, or internal readiness diagnostics/);
    assert.match(prDescription, /Verify validation language is honest, reviewer-facing, and free of workflow-specialist narration/);
    assert.match(prDescription, /Template status, validation source, omissions\/warnings, and update status remain in operator-facing notes outside the fenced PR body/);
    assert.match(prDescription, /Each item MUST cite all of the following/);
    assert.match(prDescription, /drop the entire item from the section, list the dropped item in operator-facing notes with the offending citation excerpt/);
});