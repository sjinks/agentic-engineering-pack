import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const linearSkillPath = '.github/skills/linear-issue-workflow/SKILL.md';
const linearPromptPath = '.github/prompts/run-linear-issue-workflow.prompt.md';
const docsPath = 'docs/agentic/README.md';
const prReviewSkillPath = '.github/skills/pr-review-comments-workflow/SKILL.md';
const testGapSkillPath = '.github/skills/test-gap-to-test-plan/SKILL.md';
const workflowSafetyGatesPath = '.github/skills/workflow-safety-gates/SKILL.md';
const orchestratorPath = '.github/agents/agentic-engineering-orchestrator.agent.md';
const runAgenticPromptPath = '.github/prompts/run-agentic-engineering.prompt.md';
const expertPanelPath = '.github/skills/expert-panel/SKILL.md';
const pullRequestDescriptionPath = '.github/skills/pull-request-description/SKILL.md';
const adversarialReviewPath = '.github/skills/adversarial-review/SKILL.md';
const adversaryAgentPath = '.github/agents/adversary-agent.agent.md';
const independentReviewerPath = '.github/agents/independent-code-reviewer-agent.agent.md';

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

test('synthesis PR body line is emitted only after completed adversarial review', async () => {
    const paths = await existingPaths([workflowSafetyGatesPath, orchestratorPath, runAgenticPromptPath, pullRequestDescriptionPath, docsPath]);
    assert.ok(paths.length > 0, 'at least one synthesis path exists');

    for (const path of paths) {
        const text = await read(path);
        assert.match(text, /trivial synthesis skips? with rationale/i, `${path} preserves trivial synthesis skip rationale`);
    }

    const prDescription = await read(pullRequestDescriptionPath);
    assert.match(prDescription, /only when the synthesis pre-push review actually ran to completion/);
    assert.match(prDescription, /must be removed if it appears in a non-synthesis PR or in a trivial synthesis skip/);
    assert.match(prDescription, /Pre-push adversarial review status report .* is operator-facing only and MUST never appear inside the fenced PR body/s);
});

test('pull request description guards against hard-wrapped PR bodies', async () => {
    const text = await read(pullRequestDescriptionPath);

    assert.match(
        text,
        /7\. Generate copy\/pasteable Markdown\.\s+8\. Before returning or emitting the fenced Markdown body, inspect the candidate PR body/s,
    );
    assert.match(text, /hard-wrapped paragraphs or list items/i);
    assert.match(text, /Repair hard-wrapped paragraphs\/list items before emitting\./);
    assert.match(
        text,
        /cannot confidently distinguish intentional Markdown structure .* from accidental hard wrapping, block and fail fast instead of returning a final body/s,
    );
    assert.match(
        text,
        /~72-character body wrap from `commit-body-guidelines` and `conventional-commits` applies to commit bodies only; .* do not carry their wrap width into the PR body/s,
    );
});
