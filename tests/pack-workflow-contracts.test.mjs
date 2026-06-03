import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, lstat, mkdir, mkdtemp, readdir, readFile, readlink, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const linearSkillPath = 'agentic-engineering/skills/linear-issue-workflow/SKILL.md';
const docsPath = 'agentic-engineering/docs/README.md';
const rootReadmePath = 'README.md';
const outputFormatContractPath = 'agentic-engineering/shared/output-format-contract.md';
const prReviewSkillPath = 'agentic-engineering/skills/pr-review-comments-workflow/SKILL.md';
const prReviewThreadContextPath = 'agentic-engineering/skills/pr-review-thread-context/SKILL.md';
const prReviewCommentValidationPath = 'agentic-engineering/skills/pr-review-comment-validation/SKILL.md';
const prReviewFixCyclePath = 'agentic-engineering/skills/pr-review-fix-cycle/SKILL.md';
const prReviewRoundClosurePath = 'agentic-engineering/skills/pr-review-round-closure/SKILL.md';
const prReviewReplyResolvePath = 'agentic-engineering/skills/pr-review-reply-resolve/SKILL.md';
const testGapSkillPath = 'agentic-engineering/skills/test-gap-to-test-plan/SKILL.md';
const workflowSafetyGatesPath = 'agentic-engineering/skills/workflow-safety-gates/SKILL.md';
const orchestratorPath = 'agentic-engineering/agents/agentic-engineering-orchestrator.agent.md';
const expertPanelPath = 'agentic-engineering/skills/expert-panel/SKILL.md';
const pullRequestDescriptionPath = 'agentic-engineering/skills/pull-request-description/SKILL.md';
const prDescriptionTemplatePolicyPath = 'agentic-engineering/skills/pr-description-template-policy/SKILL.md';
const prDescriptionBodyAuditPath = 'agentic-engineering/skills/pr-description-body-audit/SKILL.md';
const adversarialReviewPath = 'agentic-engineering/skills/adversarial-review/SKILL.md';
const adversaryAgentPath = 'agentic-engineering/agents/adversary-agent.agent.md';
const independentReviewerPath = 'agentic-engineering/agents/independent-code-reviewer-agent.agent.md';
const reviewCycleGatekeeperPath = 'agentic-engineering/skills/review-cycle-gatekeeper/SKILL.md';
const testAgentPath = 'agentic-engineering/agents/test-agent.agent.md';
const builderAgentPath = 'agentic-engineering/agents/builder-agent.agent.md';
const gitOperatorAgentPath = 'agentic-engineering/agents/git-operator-agent.agent.md';
const githubContextAgentPath = 'agentic-engineering/agents/github-context-agent.agent.md';
const prCreationAgentPath = 'agentic-engineering/agents/pr-creation-agent.agent.md';
const prReviewAgentPath = 'agentic-engineering/agents/pr-review-agent.agent.md';
const prReviewFocusedSkillPaths = [
    prReviewThreadContextPath,
    prReviewCommentValidationPath,
    prReviewFixCyclePath,
    prReviewRoundClosurePath,
    prReviewReplyResolvePath,
];

const prTemplateStatuses = [
    'exactly-one-template-used',
    'multiple-templates-user-selection-required',
    'multiple-templates-selected-by-convention',
    'blocked-on-template-choice',
    'selected-template-unreadable-choice-required',
    'no-template-fallback-used',
    'unreadable-template-fallback-used',
];

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

function frontmatterListValues(text, key) {
    const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
    const keyPattern = new RegExp(`^${key}:\\s*$`);
    const values = [];
    let collecting = false;

    for (const line of frontmatter.split(/\r?\n/)) {
        if (keyPattern.test(line)) {
            collecting = true;
            continue;
        }

        if (collecting && /^[A-Za-z0-9_-]+:\s*/.test(line)) {
            break;
        }

        const item = line.match(/^\s*-\s+(.+?)\s*$/)?.[1];
        if (collecting && item) {
            values.push(item.replace(/^['"]|['"]$/g, ''));
        }
    }

    return values;
}

function pathWithin(root, relativePath) {
    return relativePath ? join(root, ...relativePath.split('/')) : root;
}

function assertPrTemplateStatuses(text, label) {
    for (const status of prTemplateStatuses) {
        assert.match(text, new RegExp('`' + status + '`'), `${status} is included in ${label}`);
    }
}

function markdownSectionByExactHeading(text, heading) {
    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const headingMatch = new RegExp('^' + escapedHeading + '$', 'm').exec(text);

    if (!headingMatch) {
        return '';
    }

    const afterHeading = headingMatch.index + headingMatch[0].length;
    const nextHeading = text.slice(afterHeading).search(/\n## /);
    return nextHeading >= 0 ? text.slice(headingMatch.index, afterHeading + nextHeading) : text.slice(headingMatch.index);
}

function prePushOutputOrReadinessContexts(text) {
    const sectionContexts = ['## Output Format', '## Output Contract']
        .map((heading) => markdownSectionByExactHeading(text, heading))
        .filter(Boolean)
        .flatMap((section) => section.split(/\n{2,}/));
    const readinessFieldLists = text.split(/\n{2,}/).filter((paragraph) => /status must include/.test(paragraph));

    return [...sectionContexts, ...readinessFieldLists].filter((paragraph) => (
        /Pre-push adversarial review status|status must include|Broad Safe Validation Gate evidence package/.test(paragraph)
        && /Skip|Matched non-trivial|Blocking findings|blocking findings|cumulative branch diff|Diff baseline|Dedup applied|shared Pre-push Adversarial Review Status package|shared Pre-push adversarial review status package/.test(paragraph)
    ));
}

const canonicalPrePushStatusLabels = [
    'Execution status',
    'Verdict',
    'Trigger basis',
    'Round-N count',
    'Round-count source',
    'Diff baseline',
    'Matched non-trivial class\\(es\\)',
    'Skip considered',
    'Skip rejected evidence',
    'Skip accepted evidence',
    'Blocking findings count',
    'Dedup applied against',
    'Equiv-audit fired',
];

function canonicalWorkflowSafetyPolicyNames(text) {
    return new Set(
        [...text.matchAll(/^#{2,3}\s+(.+?(?:Gate|Allowlist))\s*$/gm)]
            .map((match) => match[1].trim()),
    );
}

function annotateMarkdownCodeBlocks(lines) {
    const inCodeBlock = new Array(lines.length).fill(false);
    let fenced = false;

    for (let index = 0; index < lines.length; index += 1) {
        if (/^```/.test(lines[index])) {
            fenced = !fenced;
            inCodeBlock[index] = true;
            continue;
        }

        inCodeBlock[index] = fenced;
    }

    return inCodeBlock;
}

const workflowSafetyMarker = '`workflow-safety-gates`';
const workflowSafetyPolicyNamePattern = /\b((?:[A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*|[A-Z]{2,})(?:\s+(?:[A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*|[A-Z]{2,}))*\s+(?:Gate|Allowlist))\b/g;

function workflowSafetyPolicyNameCandidates(text) {
    return [...text.matchAll(workflowSafetyPolicyNamePattern)].map((match) => match[1]);
}

function isClearWorkflowSafetyGlossaryOnlyLine(line, markerIndex) {
    const beforeMarker = line.slice(0, markerIndex);
    const afterMarker = line.slice(markerIndex + workflowSafetyMarker.length).trimStart();

    return /^Glossary\b/.test(afterMarker) && workflowSafetyPolicyNameCandidates(beforeMarker).length === 0;
}

function workflowSafetyPolicyReferenceCandidates(text) {
    const lines = text.split(/\r?\n/);
    const inCodeBlock = annotateMarkdownCodeBlocks(lines);
    const candidates = [];

    for (let index = 0; index < lines.length; index += 1) {
        const markerIndex = lines[index].indexOf(workflowSafetyMarker);

        if (inCodeBlock[index] || markerIndex < 0 || isClearWorkflowSafetyGlossaryOnlyLine(lines[index], markerIndex)) {
            continue;
        }

        for (const name of workflowSafetyPolicyNameCandidates(lines[index])) {
            candidates.push({ line: index + 1, name });
        }
    }

    return candidates;
}

function unresolvedWorkflowSafetyPolicyReferences(path, text, canonicalNames) {
    return workflowSafetyPolicyReferenceCandidates(text)
        .filter((candidate) => !canonicalNames.has(candidate.name))
        .map((candidate) => ({ path, ...candidate }));
}

async function markdownPathsUnder(root) {
    const paths = [];

    if (!(await exists(root))) {
        return paths;
    }

    const entries = await collectTree(root);
    for (const [relativePath, type] of entries) {
        if (type === 'file' && relativePath.endsWith('.md')) {
            paths.push(`${root}/${relativePath}`);
        }
    }

    return paths;
}

async function workflowSafetyReferenceMarkdownPaths() {
    const directPaths = await existingPaths([rootReadmePath]);
    const roots = [
        'agentic-engineering/docs',
        'agentic-engineering/shared',
        'docs/agentic',
        'agentic-engineering/skills',
        'agentic-engineering/agents',
        'agentic-engineering/prompts',
    ];
    const paths = [...directPaths];
    for (const root of roots) {
        paths.push(...await markdownPathsUnder(root));
    }

    return [...new Set(paths)].sort();
}

async function packRuntimeGrantContractMarkdownPaths() {
    const directPaths = await existingPaths([rootReadmePath]);
    const roots = [
        'agentic-engineering/docs',
        'agentic-engineering/shared',
        'agentic-engineering/skills',
        'agentic-engineering/agents',
    ];
    const paths = [...directPaths];

    for (const root of roots) {
        paths.push(...await markdownPathsUnder(root));
    }

    return [...new Set(paths)].sort();
}

const staleGithubMcpGrantPatterns = [
    {
        label: 'owns mcp_github grant',
        pattern: /\bowns?\b[^\n.]{0,80}`mcp_github_[^`\s]+`[^\n.]{0,50}\b(?:frontmatter\s+)?grants?\b/i,
    },
    {
        label: 'mcp_github frontmatter grant',
        pattern: /`mcp_github_[^`\s]+`[^\n.]{0,60}\bfrontmatter\s+grants?\b/i,
    },
    {
        label: 'frontmatter grant names mcp_github',
        pattern: /\bfrontmatter\s+grants?\b(?:\s*(?:is|are|uses?|names?|selects?|as|:)|[^\n.`]{1,60}\b(?:is|are|:))\s*`mcp_github_[^`\s]+`/i,
    },
    {
        label: 'grant or permission names mcp_github',
        pattern: /^(?![^\n.]{0,80}\bfrontmatter\s+grants?\b)\s*[^\n.]{0,80}\b(?:grants?|permissions?)\b[^\n.]{0,80}\b(?:is|are|:)\s*`mcp_github_[^`\s]+`/i,
    },
    {
        label: 'mcp_github runtime method as grant',
        pattern: /(?:\b(?:use|uses|using|selects?|names?|specif(?:y|ies)|sets?|treats?|describes?)\b[^\n.]{0,80}`mcp_github_[^`\s]+`(?![^\n.]{0,40}\bfrontmatter\s+grants?\b)[^\n.]{0,40}\b(?:grants?|permissions?)\b|`mcp_github_[^`\s]+`[^\n.]{0,20}\b(?:is|as)\s+(?:a\s+|the\s+)?(?:grants?|permissions?)\b)/i,
    },
    {
        label: 'granted mcp_github runtime method',
        pattern: /\b(?:(?:is|are|was|were|be|been|being)\s+|(?:has|have|had)\s+been\s+)granted\b[^\n.]{0,80}`mcp_github_[^`\s]+`/i,
    },
    {
        label: 'mcp_github grant ownership',
        pattern: /`mcp_github_[^`\s]+`[^\n.]{0,40}\b(?:grants?|permissions?)\b[^\n.]{0,60}\b(?:belongs?\s+to|is\s+(?:owned|assigned)\s+to|owned\s+by|assigned\s+to)\b/i,
    },
];

function staleGithubMcpGrantPhraseViolations(path, text) {
    return text.split(/\r?\n/).flatMap((line, index) => staleGithubMcpGrantPatterns
        .filter(({ pattern }) => pattern.test(line))
        .map(({ label }) => `${path}:${index + 1}: ${label}: ${line.trim()}`));
}

function markdownLinkTargets(markdown) {
    return [...markdown.matchAll(/(?<!!)\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
}

function linkPathWithoutFragment(target) {
    return target.split('#')[0];
}

function sliceBetween(text, startBoundary, endBoundary, label = `${startBoundary} to ${endBoundary}`) {
    const start = text.indexOf(startBoundary);
    const endSearchStart = start >= 0 ? start + startBoundary.length : 0;
    const end = text.indexOf(endBoundary, endSearchStart);

    assert.ok(start >= 0, `${label} start boundary is present`);
    assert.ok(end >= 0, `${label} end boundary is present`);
    assert.ok(end > start, `${label} end boundary follows start boundary`);

    return text.slice(start, end);
}

function sliceFrom(text, startBoundary, label = startBoundary) {
    const start = text.indexOf(startBoundary);

    assert.ok(start >= 0, `${label} start boundary is present`);

    return text.slice(start);
}

function markdownTableRowContaining(text, phrase) {
    return text.split('\n').find((line) => line.startsWith('|') && line.includes(phrase)) ?? '';
}

test('sliceBetween ignores an end boundary inside the start boundary', () => {
    assert.equal(sliceBetween('abc-body-c', 'abc', 'c'), 'abc-body-');
});

async function assertGeneratedGuideLinksResolve(outputRoot, targetPattern, description) {
    const guideRelativePath = 'agentic-engineering/docs/README.md';
    const generatedGuide = await read(pathWithin(outputRoot, guideRelativePath));
    const targets = markdownLinkTargets(generatedGuide).filter((target) => targetPattern.test(target));

    assert.ok(targets.length > 0, `generated guide includes ${description} links`);

    for (const target of targets) {
        const linkedPath = join(pathWithin(outputRoot, dirname(guideRelativePath)), linkPathWithoutFragment(target));
        assert.equal(await exists(linkedPath), true, `generated guide link resolves: ${target}`);
    }

    return targets;
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

test('agentic-engineering agent and skill pack surfaces resolve to source or remain byte-identical', async () => {
    for (const [packRoot, sourceRoot] of [
        ['agentic-engineering/agents', 'agentic-engineering/agents'],
        ['agentic-engineering/skills', 'agentic-engineering/skills'],
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

test('Linear skill orders commit hygiene, push visibility, gatekeeper, then PR creation delegation', async () => {
    const text = await read(linearSkillPath);
    const commitHygiene = text.indexOf('7. **Clean history with commit hygiene.**');
    const push = text.indexOf('8. **Push via delegated local git.**');
    const gatekeeper = text.indexOf('9. **Run review closure gatekeeper.**');
    const prCreation = text.indexOf('10. **Delegate GitHub PR creation after verification/history/push/gatekeeper.**');

    assert.ok(commitHygiene >= 0, 'commit hygiene step is present');
    assert.ok(push > commitHygiene, 'push follows commit hygiene');
    assert.ok(gatekeeper > push, 'gatekeeper follows push');
    assert.ok(prCreation > gatekeeper, 'PR creation follows gatekeeper');
    assert.doesNotMatch(text, /before push, invoke `review-cycle-gatekeeper`/);
});

test('PR review workflow orders push visibility, fresh thread snapshot, gatekeeper, then replies and resolution', async () => {
    const text = await read(prReviewSkillPath);
    const workflow = sliceBetween(text, '## Workflow', '## Review Comment Validation Gate', 'PR review workflow section');

    const pushVisibility = workflow.indexOf('9. **Commit and push to the PR branch and confirm PR visibility.**');
    const freshThreadSnapshot = workflow.indexOf('10. **Refresh unresolved/reopened review-thread state after push visibility.**');
    const gatekeeper = workflow.indexOf('11. **Round closure via `review-cycle-gatekeeper`.**');
    const replyAndResolve = workflow.indexOf('12. Only after the gatekeeper returns `pass`');

    assert.ok(pushVisibility >= 0, 'push/visibility step is present');
    assert.ok(freshThreadSnapshot > pushVisibility, 'fresh thread snapshot follows push visibility');
    assert.ok(gatekeeper > freshThreadSnapshot, 'gatekeeper follows fresh thread snapshot');
    assert.ok(replyAndResolve > gatekeeper, 'reply/resolve text follows gatekeeper pass');
    assert.match(text, /^## How to obtain real thread and comment IDs$/m);
    assert.match(workflow, /applying the `workflow-safety-gates` Remote Read-Only Tool Intent Gate before the freshness read/);
    assert.match(workflow, /Comment-writing, reply, status-changing, review-write, approval, request_changes, dismiss, resolve, unresolve, delete, submit, create, update, merge, push, write, and other mutation-primary tools or methods are forbidden as sanity checks/);
    assert.match(workflow, /Read-only review comment\/thread\/status metadata reads sourced from github-context-agent are allowed when their primary purpose is freshness or metadata readback/);
    assert.match(workflow, /do not declare the round complete, recommend merge, post reviewer-facing replies, or resolve threads while it reports `fail` or `BLOCK`/);
    assert.match(workflow, /If the required real reply or resolve ID is unavailable, block only that affected reply or resolve sub-action/);
});

test('PR review workflow is split into user coordinator and internal focused skills', async () => {
    const coordinator = await read(prReviewSkillPath);
    assert.match(coordinator, /user-invocable: true/);

    for (const path of prReviewFocusedSkillPaths) {
        const text = await read(path);
        assert.match(text, /user-invocable: false/, `${path} is internal`);
        assert.match(text, /^description: "Internal use when:/m, `${path} has narrow internal discovery text`);
    }

    assert.match(coordinator, /`pr-review-thread-context`/);
    assert.match(coordinator, /`pr-review-comment-validation`/);
    assert.match(coordinator, /`pr-review-fix-cycle`/);
    assert.match(coordinator, /`pr-review-round-closure`/);
    assert.match(coordinator, /`pr-review-reply-resolve`/);
    assert.match(coordinator, /Do not use a generic GraphQL CLI, generic API CLI, remote execute, or execute-capable path to recover missing IDs/);
});

test('pack guide contract uses the real source guide path and documents broad validation flow placement', async () => {
    assert.equal(docsPath, 'agentic-engineering/docs/README.md');
    assert.equal(await exists(docsPath), true, `${docsPath} exists`);
    assert.equal(await exists('docs/agentic/README.md'), false, 'stale generated guide path is absent in this workspace');

    const readme = await read('README.md');
    const guide = await read(docsPath);
    assert.doesNotMatch(readme, /docs\/agentic\/README\.md/);

    const flowchart = sliceBetween(guide, '### PR Review Comments Workflow Flowchart', '### Dual Review Arbitration Flowchart', 'PR review guide flowchart section');
    const runTests = flowchart.indexOf('Run Tests');
    const broadGate = flowchart.indexOf('Broad Safe Validation Gate');
    const commitHygiene = flowchart.indexOf('Commit Hygiene');
    const replyResolve = flowchart.indexOf('Reply/Resolve only after');

    assert.ok(runTests >= 0, 'PR-review flowchart includes targeted test verification');
    assert.ok(broadGate > runTests, 'Broad Safe Validation Gate follows targeted tests');
    assert.ok(commitHygiene > broadGate, 'commit readiness follows Broad Safe Validation Gate');
    assert.ok(replyResolve > broadGate, 'reply/resolve remains after Broad Safe Validation Gate');
    assert.match(flowchart, /fresh final-worktree evidence/);
    assert.match(flowchart, /orchestrator-sourced github-context-agent reads<br\/>exact GitHub read grants only<br\/>missing IDs block affected sub-actions/);
    assert.doesNotMatch(flowchart, /Fetch PR & Comments<br\/>github\/\*/);
});

test('shared output format contract exists with reusable core fields', async () => {
    assert.equal(await exists(outputFormatContractPath), true, `${outputFormatContractPath} exists`);

    const text = await read(outputFormatContractPath);

    assert.match(text, /# Shared Output Format Contract/);
    assert.match(text, /## Core Shared Fields/);
    assert.match(text, /Handoff log\/status/);
    assert.match(text, /Verification/);
    assert.match(text, /Blockers/);
    assert.match(text, /Residual risks/);
    assert.match(text, /Follow-up/);
    assert.match(text, /Remote-visible head branch status\/provenance/);
    assert.match(text, /Report separately from commit\/push status and pushed-visible PR-diff visibility/);
    assert.match(text, /Pushed-visible PR-diff visibility status\/provenance/);
    assert.match(text, /Requires PR head SHA\/commit reachability and GitHub PR-diff evidence that the relevant commits are reflected in the PR/);
    assert.match(text, /Report separately from remote-visible head branch and local push\/ref evidence/);
});

test('shared output format contract owns reusable validation and PR status packages', async () => {
    const text = await read(outputFormatContractPath);
    const broadSafeValidationSection = sliceBetween(
        text,
        '### Broad Safe Validation Gate Evidence',
        '### Pre-push Adversarial Review Status',
        'shared broad safe validation gate evidence package',
    );
    const prePushSection = sliceBetween(
        text,
        '### Pre-push Adversarial Review Status',
        '### PR Template and Body Status',
        'shared pre-push adversarial review status package',
    );
    const prTemplateSection = sliceBetween(
        text,
        '### PR Template and Body Status',
        '### Test-Gap Plan Status',
        'shared PR template and body status package',
    );

    assert.match(text, /### Broad Safe Validation Gate Evidence/);
    for (const label of [
        'targeted verification status',
        'broad safe validation status',
        'repository-local discovery evidence',
        'candidate command(s) inspected',
        'selected command or unavailable-command conclusion',
        'command classification basis',
        'dirty-state boundary result when executed',
        'freshness evidence for the final candidate worktree/fix batch',
        'proceed/block effect',
        'residual risk',
        'next operator action',
    ]) {
        const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(broadSafeValidationSection, new RegExp('^- ' + escapedLabel + '$', 'm'), `${label} is an exact Broad Safe Validation field label`);
    }
    assert.match(broadSafeValidationSection, /`passed`, `failed`, `blocked`, `skipped`, `not applicable`, or `mutating-only`/);
    for (const driftedLabel of [
        'Candidate commands inspected',
        'Selected or unavailable command conclusion',
        'Dirty-state boundary',
        'Freshness for final candidate worktree/fix batch',
        'Next action',
    ]) {
        assert.doesNotMatch(broadSafeValidationSection, new RegExp('^- ' + driftedLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'm'), `${driftedLabel} is rejected in Broad Safe Validation field labels`);
    }
    assert.doesNotMatch(broadSafeValidationSection, /Repository-local evidence/);

    assert.match(prePushSection, /### Pre-push Adversarial Review Status/);
    assert.match(prePushSection, /Execution status/);
    assert.match(prePushSection, /Verdict/);
    assert.match(prePushSection, /Trigger basis/);
    for (const triggerBasis of [
        'first-round non-trivial',
        'Round-N >= 2',
        'synthesis non-trivial',
        'operator-requested',
        'New Shared Module invoke',
        'not applicable',
    ]) {
        assert.match(prePushSection, new RegExp('`' + triggerBasis + '`'), `${triggerBasis} is included in pre-push trigger vocabulary`);
    }
    assert.doesNotMatch(prePushSection, /security-sensitive/);
    assert.match(prePushSection, /Round-N count/);
    assert.match(prePushSection, /Round-count source/);
    assert.match(prePushSection, /Diff baseline/);
    assert.match(prePushSection, /Matched non-trivial class\(es\)/);
    assert.match(prePushSection, /Skip considered/);
    assert.match(prePushSection, /Skip rejected evidence/);
    assert.match(prePushSection, /Skip accepted evidence/);
    assert.match(prePushSection, /Blocking findings count/);
    assert.match(prePushSection, /Dedup applied against/);
    assert.match(prePushSection, /Equiv-audit fired/);
    assert.doesNotMatch(prePushSection, /Dedup basis/);

    assert.match(text, /Gate decision/);
    assert.match(text, /`pass`, `fail`, or `BLOCK`/);
    assertPrTemplateStatuses(prTemplateSection, 'shared PR template status package');
    for (const label of [
        'PR template status',
        'Selected template path',
        'Fallback reason',
        'Unreadable path/error summary',
        'Readable alternatives',
        'User-choice blocker',
        'PR Body Audit Gate status',
    ]) {
        assert.match(prTemplateSection, new RegExp('^- ' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'm'), `${label} is an exact PR Template and Body Status field label`);
    }
    assert.match(prTemplateSection, /selected readable template path/);
    assert.match(prTemplateSection, /selected unreadable template with confirmed fallback/);
    assert.match(prTemplateSection, /sanitized read-error summaries/);
    assert.match(prTemplateSection, /readable candidate template paths/);
    assert.match(prTemplateSection, /choosing among readable templates/);
    assert.match(prTemplateSection, /`pass`, `repaired`, `blocked`, or `not applicable`/);
});

test('shared output format contract covers orchestrator mandatory output packages', async () => {
    const text = await read(outputFormatContractPath);

    for (const heading of [
        '### Readiness Decision',
        '### Requirements and Design Status',
        '### Context and Handoff Status',
        '### Test-Gap Plan Status',
        '### Review Closure and Thread-State Evidence',
        '### Equivalence-Class Follow-ups',
        '### Verified Internals and Non-Changes',
        '### BLOCK Sentinels and Advisory Artifacts',
    ]) {
        assert.match(text, new RegExp('^' + heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'm'), `${heading} package exists`);
    }

    for (const label of [
        'Spec status',
        'Spec readiness',
        'Architecture status',
        'Design contract status',
        'Test-gap plan status',
        'Gatekeeper thread-state evidence',
        'Equivalence-class follow-ups',
        'Verified-internals notes captured this session',
        'Verified non-changes section status',
        'BLOCK sentinels fired this session',
        'Operator advisory artifacts',
        'Manual workspace-preparation status',
    ]) {
        assert.match(text, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${label} is covered by the shared contract`);
    }
});

test('orchestrator uses canonical references, routing matrix, and gate stubs', async () => {
    const text = await read(orchestratorPath);
    const references = sliceBetween(text, '## Canonical References', '## Mandatory Routing Matrix', 'orchestrator canonical references section');
    const matrix = sliceBetween(text, '## Mandatory Routing Matrix', '## Workflow', 'orchestrator mandatory routing matrix section');
    const safety = sliceBetween(text, '## Workflow Safety Gates', '## Remote MCP Context Boundaries', 'orchestrator workflow safety stubs section');
    const output = sliceFrom(text, '## Output Format', 'orchestrator output format section');

    for (const reference of [
        '`expert-panel`',
        '`workflow-safety-gates`',
        '`agentic-engineering/shared/output-format-contract.md`',
        '`review-cycle-gatekeeper`',
        '`test-gap-to-test-plan`',
        '`pull-request-description`',
        '`pr-description-template-policy`',
        '`pr-description-body-audit`',
    ]) {
        assert.match(references, new RegExp(reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${reference} is a canonical reference`);
    }

    assert.match(matrix, /\| Condition \| Specialist\/skill \| Required output \| Block behavior \|/);
    for (const route of [
        '`spec-agent`',
        '`architect-agent`',
        '`builder-agent`',
        '`test-agent`',
        '`code-reviewer-agent`',
        '`independent-code-reviewer-agent`',
        '`adversarial-review`',
        '`adversary-agent`',
        '`security-tester-agent`',
        '`pr-review-comments-workflow`',
        '`review-cycle-gatekeeper`',
        '`test-gap-to-test-plan`',
    ]) {
        assert.match(matrix, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${route} is routed in mandatory matrix`);
    }

    assert.match(safety, /\| Condensed gate \| Trigger \| Owner\/delegate \| Required evidence package \| Stop condition \| Canonical reference \|/);
    for (const stubField of ['trigger =', 'owner/delegate =', 'required evidence package =', 'stop condition =', 'canonical reference =']) {
        assert.match(text, new RegExp(stubField.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${stubField} appears in local stubs`);
    }

    assert.match(output, /use `agentic-engineering\/shared\/output-format-contract\.md`/);
    assert.doesNotMatch(output, /Broad Safe Validation Gate status when PR-review fixes are in scope: targeted verification status;/);
});

test('orchestrator mandatory routing matrix includes conditional non-discretionary review routes', async () => {
    const text = await read(orchestratorPath);
    const matrix = sliceBetween(text, '## Mandatory Routing Matrix', '## Workflow', 'orchestrator mandatory routing matrix section');

    const highRiskAgentPack = markdownTableRowContaining(matrix, 'High-risk agent-pack change rule 12e applies');
    assert.match(highRiskAgentPack, /`code-reviewer-agent`/);
    assert.match(highRiskAgentPack, /`independent-code-reviewer-agent`/);
    assert.match(highRiskAgentPack, /explicit skip rationale/);
    assert.match(highRiskAgentPack, /skipped without the required rationale/);

    const firstRoundAdversarial = markdownTableRowContaining(matrix, 'First-round or Round-N non-trivial pre-push adversarial review under Workflow 12f applies');
    assert.match(firstRoundAdversarial, /`adversarial-review` for synthesis diffs/);
    assert.match(firstRoundAdversarial, /`adversary-agent` for non-synthesis code diffs/);
    assert.match(firstRoundAdversarial, /Pre-push Adversarial Review Status/);
    assert.match(firstRoundAdversarial, /cumulative branch diff vs integration branch/);
    assert.match(firstRoundAdversarial, /non-trivial wins over skip/);

    const newSharedModuleInvoke = markdownTableRowContaining(matrix, 'New Shared Module Prompt operator chooses `invoke` under Workflow 12c');
    assert.match(newSharedModuleInvoke, /`adversary-agent`/);
    assert.match(newSharedModuleInvoke, /`test-gap-to-test-plan`/);
    assert.match(newSharedModuleInvoke, /Advisory decision artifact/);
    assert.match(newSharedModuleInvoke, /planner verdict/);
    assert.match(newSharedModuleInvoke, /must-have cases/);
});

test('PR review workflow output format references shared output format contract', async () => {
    const text = await read(prReviewSkillPath);
    const outputFormatSection = sliceFrom(text, '## Output Format', 'PR review output format section');

    assert.match(outputFormatSection, /agentic-engineering\/shared\/output-format-contract\.md/);
    assert.match(outputFormatSection, /Broad Safe Validation Gate: use the shared Broad Safe Validation Gate evidence package/);
    assert.match(outputFormatSection, /Pre-push adversarial review status[\s\S]+use the shared Pre-push adversarial review status package/);
    assert.match(outputFormatSection, /Execution status/);
    assert.match(outputFormatSection, /Verdict/);
    assert.match(outputFormatSection, /Matched non-trivial class\(es\)/);
    assert.match(outputFormatSection, /Skip considered/);
    assert.match(outputFormatSection, /Skip rejected evidence/);
    assert.match(outputFormatSection, /Skip accepted evidence/);
    assert.doesNotMatch(outputFormatSection, /`Skip rejected`, and `Skip accepted` evidence locally/);
    assert.doesNotMatch(outputFormatSection, /Broad Safe Validation Gate: targeted verification status; broad safe validation status/);
});

test('expert panel output format references shared output contract while preserving panel fields', async () => {
    const text = await read(expertPanelPath);
    const outputFormatSection = sliceFrom(text, '## Output Format', 'expert panel output format section');

    assert.match(outputFormatSection, /agentic-engineering\/shared\/output-format-contract\.md/);
    assert.match(outputFormatSection, /shared core fields and reusable evidence packages/);
    for (const label of [
        'Panel roles used',
        'Key findings by role',
        'Decisions made',
        'Required actions',
    ]) {
        assert.match(outputFormatSection, new RegExp('- ' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.'), `${label} remains local to expert-panel output`);
    }
    for (const sharedField of [
        'Handoff log/status',
        'Verification',
        'Pre-push adversarial review status',
        'Residual risks',
        'Follow-up',
    ]) {
        assert.match(outputFormatSection, new RegExp(sharedField.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${sharedField} is referenced from the expert-panel output format`);
    }
    assert.match(outputFormatSection, /use the shared Pre-push Adversarial Review Status package/);
});

test('linear workflow output format references shared output format contract', async () => {
    const text = await read(linearSkillPath);
    const outputFormatSection = sliceBetween(text, '## Output Format', '## Linear Comment Audience and Content');

    assert.match(outputFormatSection, /agentic-engineering\/shared\/output-format-contract\.md/);
});

test('PR description output format references shared output contract while preserving local output fields', async () => {
    const text = await read(pullRequestDescriptionPath);
    const outputFormatSection = sliceFrom(text, '## Output Format', 'PR description output format section');

    assert.match(outputFormatSection, /agentic-engineering\/shared\/output-format-contract\.md/);
    assert.match(outputFormatSection, /shared core fields and PR Template\/Body status vocabulary/);
    assert.match(outputFormatSection, /PR description markdown in a fenced `markdown` code block only for the copy\/pasteable body/);
    assert.match(outputFormatSection, /PR title in a separate fenced `text` code block when the user requested a title/);
    assert.match(outputFormatSection, /Then notes outside the code block/);
    assert.match(outputFormatSection, /Update status must say copy\/paste only/);
    assert.match(outputFormatSection, /remote PR title\/body updates are not currently approved by `workflow-safety-gates`/);
    assert.match(outputFormatSection, /PR template status and PR Body Audit Gate status use the shared PR Template\/Body status vocabulary/);
    assert.match(outputFormatSection, /remain operator-facing notes/);
});

test('workflow-safety-gates policy reference extraction detects drift across the whole marker line', () => {
    const canonicalNames = new Set([
        'PR Body Audit Gate',
        'Remote MCP Context Gate',
    ]);
    const text = [
        '- Apply the PR Body Audit Gate from `workflow-safety-gates` before PR body publication.',
        '- Apply `workflow-safety-gates` Remote MCP Context Gate before remote context reads.',
        '- See the `workflow-safety-gates` Glossary Imaginary Drift Gate entry for terminology only.',
        '- Apply the PR Boddy Audit Gate from `workflow-safety-gates` before PR body publication.',
    ].join('\n');

    assert.deepEqual(workflowSafetyPolicyReferenceCandidates(text), [
        { line: 1, name: 'PR Body Audit Gate' },
        { line: 2, name: 'Remote MCP Context Gate' },
        { line: 4, name: 'PR Boddy Audit Gate' },
    ]);
    assert.deepEqual(unresolvedWorkflowSafetyPolicyReferences('synthetic.md', text, canonicalNames), [
        { path: 'synthetic.md', line: 4, name: 'PR Boddy Audit Gate' },
    ]);
});

test('workflow-safety-gates policy references resolve to canonical Gate and Allowlist headings', async () => {
    const safety = await read(workflowSafetyGatesPath);
    const canonicalNames = canonicalWorkflowSafetyPolicyNames(safety);
    const checked = [];
    const unresolved = [];

    assert.ok(canonicalNames.size > 0, 'workflow-safety-gates exposes canonical Gate/Allowlist headings');

    for (const path of await workflowSafetyReferenceMarkdownPaths()) {
        if (path === workflowSafetyGatesPath) {
            continue;
        }

        const text = await read(path);
        for (const candidate of workflowSafetyPolicyReferenceCandidates(text)) {
            const reference = { path, ...candidate };

            checked.push(reference);
            if (!canonicalNames.has(candidate.name)) {
                unresolved.push(reference);
            }
        }
    }

    assert.deepEqual(
        unresolved,
        [],
        unresolved.map((reference) => `${reference.path}:${reference.line} references workflow-safety-gates policy "${reference.name}" but no matching Gate/Allowlist heading exists`).join('\n'),
    );
    assert.ok(checked.length > 0, 'operator-facing markdown contains workflow-safety-gates Gate/Allowlist references');
});

test('generated plugin includes real guide docs at the README guide link target', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'agentic-engineering-pack-'));
    const outputRoot = join(tempRoot, 'plugin');

    try {
        await execFileAsync(process.execPath, [
            'scripts/generate-copilot-plugin.mjs',
            '--out',
            outputRoot,
            '--clean',
        ]);

        const generatedReadme = await read(join(outputRoot, 'README.md'));
        const guideLink = generatedReadme.match(/\[agentic-engineering\/docs\/README\.md\]\((agentic-engineering\/docs\/README\.md)\)/);

        assert.ok(guideLink, 'generated README links to the real guide path');

        const generatedGuidePath = pathWithin(outputRoot, guideLink[1]);
        const [generatedGuide, sourceGuide, generatedAgentLinks, generatedSkillLinks] = await Promise.all([
            read(generatedGuidePath),
            read(docsPath),
            assertGeneratedGuideLinksResolve(outputRoot, /^\.\.\/\.\.\/agents\//, 'agent'),
            assertGeneratedGuideLinksResolve(outputRoot, /^\.\.\/\.\.\/skills\//, 'skill'),
        ]);

        const generatedOutputFormatContract = pathWithin(outputRoot, outputFormatContractPath);
        const generatedLinearSkill = await read(pathWithin(outputRoot, 'skills/linear-issue-workflow/SKILL.md'));

        assert.match(sourceGuide, /\]\(\.\.\/\.\.\/\agentic-engineering\/agents\//, 'source guide keeps repository-relative agent links');
        assert.match(sourceGuide, /\]\(\.\.\/\.\.\/\agentic-engineering\/skills\//, 'source guide keeps repository-relative skill links');
        assert.doesNotMatch(generatedGuide, /\]\(\.\.\/\.\.\/\agentic-engineering\/(agents|skills|prompts)\//, 'generated guide does not link to repository agentic-engineering surfaces');
        assert.ok(generatedAgentLinks.length > 0, 'generated guide has package-local agent links');
        assert.ok(generatedSkillLinks.length > 0, 'generated guide has package-local skill links');
        assert.equal(await exists(generatedOutputFormatContract), true, 'generated package includes shared output format contract');
        assert.match(generatedLinearSkill, /agentic-engineering\/shared\/output-format-contract\.md/, 'generated linear skill references shared output format contract path');
        assert.equal(await exists(pathWithin(outputRoot, outputFormatContractPath)), true, 'generated shared output format contract reference resolves');

        const generatedCommandLinks = markdownLinkTargets(generatedGuide).filter((target) => /^\.\.\/\.\.\/commands\//.test(target));
        for (const target of generatedCommandLinks) {
            const linkedPath = join(pathWithin(outputRoot, dirname(guideLink[1])), linkPathWithoutFragment(target));
            assert.equal(await exists(linkedPath), true, `generated command link resolves: ${target}`);
        }

        assert.equal(await exists(pathWithin(outputRoot, 'docs/agentic/README.md')), false, 'generated package does not include stale guide path');
    }
    finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
});

test('generated plugin removes legacy docs/agentic output without clean', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'agentic-engineering-pack-'));
    const outputRoot = join(tempRoot, 'plugin');
    const staleGuidePath = pathWithin(outputRoot, 'docs/agentic/README.md');

    try {
        await mkdir(dirname(staleGuidePath), { recursive: true });
        await writeFile(staleGuidePath, '# stale guide\n', 'utf8');

        await execFileAsync(process.execPath, [
            'scripts/generate-copilot-plugin.mjs',
            '--out',
            outputRoot,
        ]);

        assert.equal(await exists(staleGuidePath), false, 'legacy docs/agentic guide is removed without --clean');
        assert.equal(await exists(pathWithin(outputRoot, docsPath)), true, 'current generated guide remains present');
    }
    finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
});

test('README and guide permission tables list exact GitHub read grants for github-context-agent', async () => {
    for (const path of ['README.md', docsPath]) {
        const text = await read(path);
        const githubContextLine = text.split('\n').find((line) => line.includes('| GitHub Context Agent |') || line.includes('| [GitHub Context Agent](')) ?? '';

        assert.ok(githubContextLine, `${path} has GitHub Context Agent row`);
        assert.match(githubContextLine, /github\.vscode-pull-request-github\/activePullRequest/, `${path} lists activePullRequest for github-context-agent`);
        assert.match(githubContextLine, /github\/pull_request_read/, `${path} lists github/pull_request_read for github-context-agent`);
        assert.match(githubContextLine, /read-only|repository\/issue\/release|exact.*grants/i, `${path} mentions expanded read-only grant set for github-context-agent`);
    }
});

test('operator guide delegates PR creation to pr-creation-agent and rejects stale orchestrator-only GitHub wording', async () => {
    const text = await read(docsPath);
    const prCreationLine = text.split('\n').find((line) => line.includes('| [PR Creation Agent](')) ?? '';

    assert.match(text, /delegates GitHub operations to a three-specialist model with explicit read-write separation/);
    assert.match(text, /`pr-creation-agent` for PR creation only/);
    assert.match(text, /PR creation is delegated to `pr-creation-agent` via orchestrator coordination after readiness evidence is present/);
    assert.match(prCreationLine, /exact GitHub PR creation grant: `github\/create_pull_request`/);
    assert.match(text, /This pack does not grant a broad GitHub namespace/);
    assert.match(text, /GitHub access is split across exact grants owned by github-context-agent, pr-creation-agent, and pr-review-agent/);

    assert.doesNotMatch(text, /PR creation as orchestrator-only/i);
    assert.doesNotMatch(text, /orchestrator-only GitHub PR creation/i);
    assert.doesNotMatch(text, /`?github\/\*`? namespace grants stay orchestrator-only/i);
    assert.doesNotMatch(text, /orchestrator-only.*github\/\*|github\/\*.*orchestrator-only/i);
});

test('linear workflow names exact GitHub PR grant and mcp_github runtime operation distinctly', async () => {
    const text = await read(linearSkillPath);

    assert.match(text, /`pr-creation-agent` owns the `github\/create_pull_request` frontmatter grant, which approves\/backs the `mcp_github_create_pull_request` runtime operation/);
    assert.deepEqual(staleGithubMcpGrantPhraseViolations(linearSkillPath, text), []);
});

test('GitHub MCP grant phrase matcher rejects stale runtime-method grant wording', () => {
    assert.deepEqual(
        staleGithubMcpGrantPhraseViolations('sample.md', 'PR Creation Agent owns the `mcp_github_create_pull_request` grant.'),
        ['sample.md:1: owns mcp_github grant: PR Creation Agent owns the `mcp_github_create_pull_request` grant.'],
    );
    assert.deepEqual(
        staleGithubMcpGrantPhraseViolations('sample.md', 'Use the `mcp_github_create_pull_request` frontmatter grant for PR creation.'),
        ['sample.md:1: mcp_github frontmatter grant: Use the `mcp_github_create_pull_request` frontmatter grant for PR creation.'],
    );
    assert.deepEqual(
        staleGithubMcpGrantPhraseViolations('sample.md', 'The frontmatter grant is `mcp_github_create_pull_request`.'),
        ['sample.md:1: frontmatter grant names mcp_github: The frontmatter grant is `mcp_github_create_pull_request`.'],
    );
    assert.deepEqual(
        staleGithubMcpGrantPhraseViolations('sample.md', 'The frontmatter grant for PR creation is `mcp_github_create_pull_request`.'),
        ['sample.md:1: frontmatter grant names mcp_github: The frontmatter grant for PR creation is `mcp_github_create_pull_request`.'],
    );
    assert.deepEqual(
        staleGithubMcpGrantPhraseViolations('sample.md', 'The PR creation permission is `mcp_github_create_pull_request`.'),
        ['sample.md:1: grant or permission names mcp_github: The PR creation permission is `mcp_github_create_pull_request`.'],
    );
    assert.deepEqual(
        staleGithubMcpGrantPhraseViolations('sample.md', 'The approved PR creation grant is `mcp_github_create_pull_request`.'),
        ['sample.md:1: grant or permission names mcp_github: The approved PR creation grant is `mcp_github_create_pull_request`.'],
    );
    assert.deepEqual(
        staleGithubMcpGrantPhraseViolations('sample.md', 'Use the `mcp_github_create_pull_request` grant for PR creation.'),
        ['sample.md:1: mcp_github runtime method as grant: Use the `mcp_github_create_pull_request` grant for PR creation.'],
    );
    assert.deepEqual(
        staleGithubMcpGrantPhraseViolations('sample.md', 'Treat the `mcp_github_create_pull_request` as the PR creation permission.'),
        ['sample.md:1: mcp_github runtime method as grant: Treat the `mcp_github_create_pull_request` as the PR creation permission.'],
    );
    assert.deepEqual(
        staleGithubMcpGrantPhraseViolations('sample.md', 'pr-creation-agent is granted `mcp_github_create_pull_request`.'),
        ['sample.md:1: granted mcp_github runtime method: pr-creation-agent is granted `mcp_github_create_pull_request`.'],
    );
    assert.deepEqual(
        staleGithubMcpGrantPhraseViolations('sample.md', 'The `mcp_github_create_pull_request` grant belongs to pr-creation-agent.'),
        ['sample.md:1: mcp_github grant ownership: The `mcp_github_create_pull_request` grant belongs to pr-creation-agent.'],
    );
    assert.deepEqual(
        staleGithubMcpGrantPhraseViolations('sample.md', 'Pending-review inline comments (`mcp_github_add_pull_request_review_comment_to_pending_review`) are not currently granted in this pack.'),
        [],
    );
    assert.deepEqual(
        staleGithubMcpGrantPhraseViolations('sample.md', 'Use the `github/create_pull_request` frontmatter grant approving the `mcp_github_create_pull_request` runtime operation.'),
        [],
    );
});

test('pack docs skills and agents describe mcp_github names as runtime operations, not frontmatter grants', async () => {
    const paths = await packRuntimeGrantContractMarkdownPaths();
    const violations = [];

    for (const path of paths) {
        violations.push(...staleGithubMcpGrantPhraseViolations(path, await read(path)));
    }

    assert.deepEqual(violations, []);
});

test('pr-review-thread-context documents orchestrator-sourced github-context-agent reads', async () => {
    const text = await read(prReviewThreadContextPath);

    assert.match(text, /github-context-agent/i, 'mentions github-context-agent');
    assert.match(text, /orchestrator-sourced/i, 'mentions orchestrator-sourced');
    assert.match(text, /github\.vscode-pull-request-github\/activePullRequest/);
    assert.match(text, /github\/pull_request_read/);
    assert.match(text, /reviewThreads\.nodes\.id/);
    assert.match(text, /databaseId/);
    assert.match(text, /Review thread node ID:|thread node ID/i);
    assert.match(text, /Per-subaction blockers/);
    assert.match(text, /block only the affected reply or resolve sub-action/);
    assert.doesNotMatch(text, /pr-review-agent.*owns.*github\/pull_request_read/i, 'does not claim pr-review-agent owns read grants');
});

test('PR review thread context documents active PR, MCP comments, github-context-agent sourcing, and ID mapping', async () => {
    const text = await read(prReviewThreadContextPath);

    assert.match(text, /github\.vscode-pull-request-github\/activePullRequest/);
    assert.match(text, /github\/pull_request_read/);
    assert.match(text, /get_review_comments/);
    assert.match(text, /orchestrator-sourced github-context-agent reads/);
    assert.match(text, /github-context-agent/);
    assert.match(text, /reviewThreads\.nodes\.id/);
    assert.match(text, /reviewThreads\.nodes\.comments\.nodes\.databaseId/);
    assert.match(text, /Review thread node ID:[\s\S]+Use this only for thread resolution/);
    assert.match(text, /Review comment database ID:[\s\S]+Use this as the reply target/);
    assert.match(text, /Per-subaction blockers/);
    assert.match(text, /block only the affected reply or resolve sub-action/);
});

test('PR review thread context uses github-context-agent without direct GraphQL CLI fallback', async () => {
    const text = await read(prReviewThreadContextPath);

    // After github-context-agent split, pr-review-thread-context receives context from
    // orchestrator-sourced github-context-agent reads; direct GraphQL CLI fallback section removed
    assert.match(text, /Orchestrator-sourced PR metadata from github-context-agent/);
    assert.match(text, /Orchestrator-provided thread node IDs and comment reply IDs/);
    assert.match(text, /Orchestrator-sourced fresh unresolved\/reopened snapshots from github-context-agent/);
    assert.doesNotMatch(text, /Orchestrator-mediated `gh api graphql` fallback/);
    assert.doesNotMatch(text, /^3\. Orchestrator-mediated `gh api graphql` fallback/m);
    assert.match(text, /pr-review-agent does not hold/);
    assert.match(text, /github-context-agent/);
    assert.match(text, /activePullRequest/);
    assert.match(text, /pull_request_read/);
});

test('README and PR review thread context block missing IDs through github-context-agent exact reads without GraphQL fallback', async () => {
    const guide = await read(docsPath);
    const threadContext = await read(prReviewThreadContextPath);
    const combined = `${guide}\n${threadContext}`;

    assert.match(guide, /orchestrator-sourced github-context-agent reads<br\/>exact GitHub read grants only<br\/>missing IDs block affected sub-actions/);
    assert.match(guide, /unavailable or unsafe IDs block only the affected sub-action/);
    assert.match(guide, /Direct invocation without github-context-agent context[\s\S]+must block or route through the orchestrator/);
    assert.match(threadContext, /github\.vscode-pull-request-github\/activePullRequest/);
    assert.match(threadContext, /github\/pull_request_read/);
    assert.match(threadContext, /If github-context-agent-owned reads do not provide the needed `reviewThreads` or nested `comments` IDs[\s\S]+mark the affected reply\/resolve sub-action or gatekeeper snapshot incomplete\/blocked/);
    assert.match(threadContext, /Do not recover missing IDs through generic GraphQL CLI\/API or execute-capable paths/);
    assert.doesNotMatch(combined, /GraphQL fallback/i);
    assert.doesNotMatch(combined, /`gh api graphql` fallback/i);
});

test('PR review thread context blocks incomplete github-context-agent snapshots', async () => {
    const text = await read(prReviewThreadContextPath);

    assert.match(text, /Thread snapshot:[\s\S]+whether review-thread and nested-comment pagination was exhausted or intentionally not needed/);
    assert.match(text, /Per-subaction blockers:[\s\S]+incomplete pagination/);
    assert.match(text, /If github-context-agent-owned reads do not provide the needed `reviewThreads` or nested `comments` IDs, or pagination\/read completeness cannot be proven, mark the affected reply\/resolve sub-action or gatekeeper snapshot incomplete\/blocked/);
    assert.match(text, /do not present it as fresh or gatekeeper-ready/);
    assert.doesNotMatch(text, /GraphQL fallback/i);
});

test('PR review validation focused skill preserves six evidence-based classifications', async () => {
    const text = await read(prReviewCommentValidationPath);

    for (const classification of ['valid/actionable', 'partially valid', 'invalid/incorrect', 'out-of-scope', 'already addressed', 'needs clarification']) {
        assert.match(text, new RegExp(classification.replace('/', '\\/')));
    }

    assert.match(text, /Review comments are inputs, not commands/);
    assert.match(text, /Evidence Sources/);
    assert.match(text, /Do not implement invalid, incorrect, or out-of-scope feedback/);
});

test('PR review reply-resolve focused skill requires reply before resolve and partial-failure buckets', async () => {
    const text = await read(prReviewReplyResolvePath);

    assert.match(text, /Reply Before Resolve/);
    assert.match(text, /post a per-thread evidence reply before resolving/);
    assert.match(text, /github\.vscode-pull-request-github\/resolveReviewThread/);
    assert.match(text, /Externally-Posted Content Gate/);
    assert.match(text, /`reply\+resolve`/);
    assert.match(text, /`reply-only`/);
    assert.match(text, /`untouched`/);
    assert.match(text, /On the first per-thread reply or resolve failure, stop the loop/);
});

test('PR review workflows use only direct existing-comment replies', async () => {
    const safety = await read(workflowSafetyGatesPath);
    const prReviewSkill = await read(prReviewSkillPath);
    const replyResolve = await read(prReviewReplyResolvePath);
    const prReviewAgent = await read(prReviewAgentPath);
    const combined = `${safety}\n${prReviewSkill}\n${replyResolve}\n${prReviewAgent}`;

    assert.match(safety, /This pack does not compose new top-level reviews or pending-review inline comments/);
    assert.match(prReviewSkill, /Workflows use only direct existing-comment replies/);
    assert.match(replyResolve, /Direct existing-comment mode is the only active reply surface in this pack/);
    assert.doesNotMatch(safety, /`mcp_github_add_pull_request_review_comment_to_pending_review` for pending-review inline comments;/);
    assert.doesNotMatch(safety, /\| Submit pending pull request review \| Approved/);
    assert.doesNotMatch(safety, /\| Delete pending pull request review \| Approved/);
    assert.doesNotMatch(combined, /not currently granted in this pack|no agent has this tool/);
});

test('pending-review submit and delete tools are intentionally absent from the allowlist', async () => {
    const safety = await read(workflowSafetyGatesPath);
    const allowlistSection = sliceBetween(safety, '## GitHub Remote Mutation Allowlist', '## Linear Remote Mutation Allowlist', 'GitHub Remote Mutation Allowlist section');

    assert.doesNotMatch(allowlistSection, /\| Submit pending pull request review \| Approved/);
    assert.doesNotMatch(allowlistSection, /\| Delete pending pull request review \| Approved/);
    assert.doesNotMatch(allowlistSection, /submit_pending_pull_request_review/);
    assert.doesNotMatch(allowlistSection, /delete.*pending.*review/i);
    assert.match(safety, /This pack does not compose new top-level reviews or pending-review inline comments/);
});

test('pending-review failures map to active partial failure buckets', async () => {
    const replyResolve = await read(prReviewReplyResolvePath);

    assert.match(replyResolve, /These four bucket names are the active bucket set and the source of truth for reporting/);
    assert.doesNotMatch(replyResolve, /`pending-staged`|`pending-submit-failed`|`pending-submit-unconfirmed`|`abandoned`/);
    assert.match(replyResolve, /On the first per-thread reply or resolve failure, stop the loop/);
    assert.doesNotMatch(replyResolve, /On the first per-thread reply, pending-review submit, abandon\/delete, or resolve failure/);
});

test('PR review reply contract splits fix-backed SHAs from verified no-code-change evidence', async () => {
    const coordinator = await read(prReviewSkillPath);
    const replyResolve = await read(prReviewReplyResolvePath);
    const combined = `${coordinator}\n${replyResolve}`;

    assert.match(combined, /Fix-backed replies[\s\S]+name the relevant fix commit SHA/);
    assert.match(combined, /touched by the pushed fix commits[\s\S]+commit SHA plus one-line summary/);
    assert.match(combined, /Verified no-change, disagreement, and clarification replies[\s\S]+evidence citation\/provenance instead of a fix commit SHA/);
    assert.match(combined, /must not invent or require a fake fix SHA|do not require or invent a fix commit SHA/);
    assert.match(combined, /for each fix-backed or touched-file addressed thread the reply commit SHA/);
    assert.match(combined, /for each verified no-change, disagreement, or clarification thread the evidence citation\/provenance used instead of a fix SHA/);
});

test('direct PR review invocation requires orchestrator-mediated github-context-agent PR context', async () => {
    const coordinator = await read(prReviewSkillPath);
    const safety = await read(workflowSafetyGatesPath);
    const guide = await read(docsPath);
    const readme = await read('README.md');

    assert.match(coordinator, /Direct invocation is valid only when the operator provides orchestrator-mediated PR context/);
    assert.match(coordinator, /without that context, stop and route the operator through the orchestrator/);
    assert.match(coordinator, /github-context-agent/);
    assert.match(safety, /Direct invocation of a PR workflow without github-context-agent GitHub read grants and without an approved active-PR read result must block or route through orchestrator-mediated context acquisition/);
    assert.match(guide, /Direct invocation without github-context-agent context and without an approved active-PR read must block or route through the orchestrator/);
    assert.match(readme, /Direct invocation without github-context-agent exact grants or an approved active-PR read must block or route through orchestrator-mediated context/);
});

test('PR review workflow inserts Broad Safe Validation Gate between targeted checks and readiness', async () => {
    const text = await read(prReviewSkillPath);
    const workflow = sliceBetween(text, '## Workflow', '## Review Comment Validation Gate', 'PR review broad validation workflow section');

    const targetedVerification = workflow.indexOf('Verify fixes locally with targeted evidence for each addressed comment.');
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
    assert.match(workflow, /prepare the gatekeeper handoff with[\s\S]+targeted verification evidence per fix, Broad Safe Validation Gate evidence/);
});

test('PR review Broad Safe Validation Gate is repository-agnostic and separates output-writing validation', async () => {
    const text = await read(prReviewFixCyclePath);
    const section = sliceBetween(text, '## Broad Safe Validation Gate', '## Hard Gate', 'PR review fix-cycle broad validation section');

    assert.match(section, /Broad safe validation is the broadest bounded, non-mutating, locally supported validation relevant to the changed surface/);
    assert.match(section, /Discover candidate validation commands from repository-local evidence only/);
    assert.match(section, /Do not use ecosystem, framework, language, or package-manager preference order as normative behavior/);
    assert.match(section, /Classify each candidate by observed or documented behavior, not by command name or ecosystem/);
    assert.match(section, /Select the broadest bounded candidate that is relevant to the changed surface and still safe under the current workflow boundaries/);
    assert.match(section, /Mutating, package-management, dependency-changing, network-contacting, service-starting, environment-changing, and output-writing commands are not ordinary broad safe validation/);
    assert.match(section, /Output-writing validation is reported separately from ordinary broad safe validation/);
});

test('PR review Broad Safe Validation Gate requires fresh final-worktree evidence before readiness', async () => {
    const coordinator = await read(prReviewSkillPath);
    const text = await read(prReviewFixCyclePath);
    const outputContract = await read(outputFormatContractPath);
    const workflow = sliceBetween(coordinator, '## Workflow', '## Review Comment Validation Gate', 'PR review workflow freshness section');
    const section = sliceBetween(text, '## Broad Safe Validation Gate', '## Hard Gate', 'PR review fix-cycle freshness section');
    const hardGate = `${coordinator}\n${text}`;

    assert.match(workflow, /require broad safe validation before commit\/push readiness, reviewer-facing replies, or review-thread resolution/);
    assert.match(workflow, /Broad safe validation evidence must be fresh for the final candidate worktree\/fix batch/);
    assert.match(workflow, /If contextual\/independent review, builder\/test follow-up, formatting, generated-output handling, or any other fix step changes the worktree after broad validation evidence was produced, that evidence is stale until broad validation is rerun or explicitly re-established for the final changed surface/);
    assert.match(workflow, /Broad Safe Validation Gate evidence including freshness evidence for the final candidate worktree\/fix batch/);
    assert.match(section, /Its evidence is valid only when fresh for the final candidate worktree\/fix batch/);
    assert.match(section, /Freshness is part of the evidence, not an optional note/);
    assert.match(section, /Later edits invalidate prior broad validation until it is rerun or explicitly re-established for the final changed surface/);
    assert.match(section, /`passed`: the selected broad safe validation completed successfully, dirty-state boundaries remained acceptable, and the evidence is fresh for the final candidate worktree\/fix batch/);
    assert.match(hardGate, /If the Broad Safe Validation Gate is missing, failed, blocked, stale, or not fresh for the final candidate worktree\/fix batch, do not push, do not post reviewer-facing replies, and do not resolve threads/);
    assert.match(coordinator, /Broad Safe Validation Gate: use the shared Broad Safe Validation Gate evidence package/);
    assert.match(outputContract, /Broad Safe Validation Gate Evidence[\s\S]+targeted verification status[\s\S]+freshness evidence for the final candidate worktree\/fix batch[\s\S]+proceed\/block effect[\s\S]+residual risk[\s\S]+next operator action/);
});

test('PR review Broad Safe Validation Gate blocks failed or blocked broad validation and requires residual-risk reporting', async () => {
    const coordinator = await read(prReviewSkillPath);
    const text = await read(prReviewFixCyclePath);
    const outputContract = await read(outputFormatContractPath);
    const combined = `${coordinator}\n${text}`;
    const section = sliceBetween(text, '## Broad Safe Validation Gate', '## Hard Gate', 'PR review fix-cycle blocking section');
    const failedStatus = section.match(/- `failed`:[^\n]+/)?.[0] ?? '';

    assert.match(failedStatus, /This blocks push, reviewer-facing replies, and thread resolution until the selected broad safe validation failure is addressed, or until the workflow is re-scoped or reclassified so that command is no longer the selected broad safe validation/);
    assert.match(failedStatus, /A failed selected broad safe validation cannot be waived through residual risk/);
    assert.doesNotMatch(failedStatus, /may proceed|proceed only|accepted residual-risk|accepted residual risk|next operator action|reroute/i);
    assert.match(combined, /`blocked`: broad safe validation should run but cannot be selected or executed[\s\S]+blocks push, reviewer-facing replies, and thread resolution/);
    assert.match(combined, /`skipped`: broad safe validation is available but intentionally skipped only with repository-local discovery evidence, candidate command\(s\) inspected, selected command or unavailable-command conclusion, command classification basis, freshness evidence for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
    assert.match(combined, /`not applicable`: no meaningful broad validation exists[\s\S]+repository-local discovery evidence, candidate command\(s\) inspected, selected command or unavailable-command conclusion, command classification basis, freshness evidence for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
    assert.match(combined, /`mutating-only`: only mutating, network, service-starting, package-management, or output-writing candidates exist\. This is not a pass/);
    assert.match(combined, /It may proceed only with freshness evidence for the final candidate worktree\/fix batch and after either the authorized mutating\/output-writing candidate actually ran and is reported separately with dirty-state\/output boundaries, or an accepted residual-risk rationale explicitly covers not running it/);
    assert.match(combined, /Command classification basis for command-behavior outcomes \(`local-only`, `approval-bound`, or `forbidden`\) and status outcomes \(`skipped`, `not applicable`, `blocked`, or `mutating-only`\)/);
    assert.match(combined, /If the Broad Safe Validation Gate is missing, failed, blocked, stale, or not fresh for the final candidate worktree\/fix batch, do not push, do not post reviewer-facing replies, and do not resolve threads/);
    assert.match(combined, /A valid `skipped` or `not applicable` status may proceed only when the output names repository-local discovery evidence, candidate command\(s\) inspected, selected command or unavailable-command conclusion, command classification basis, freshness evidence for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
    assert.match(coordinator, /Broad Safe Validation Gate: use the shared Broad Safe Validation Gate evidence package/);
    assert.match(outputContract, /broad safe validation status[\s\S]+`passed`, `failed`, `blocked`, `skipped`, `not applicable`, or `mutating-only`/);
    assert.match(outputContract, /repository-local discovery evidence[\s\S]+candidate command\(s\) inspected[\s\S]+selected command or unavailable-command conclusion[\s\S]+command classification basis[\s\S]+dirty-state boundary result when executed[\s\S]+freshness evidence for the final candidate worktree\/fix batch[\s\S]+proceed\/block effect[\s\S]+residual risk[\s\S]+next operator action/);
});

test('PR review status definitions require freshness for non-passing broad validation outcomes', async () => {
    const text = await read(prReviewFixCyclePath);
    const section = sliceBetween(text, '## Broad Safe Validation Gate', '## Hard Gate', 'PR review broad validation status section');

    for (const status of ['skipped', 'not applicable', 'mutating-only']) {
        const line = section.split('\n').find((candidate) => candidate.startsWith('- `' + status + '`:')) ?? '';

        assert.match(line, /freshness evidence for the final candidate worktree\/fix batch/, `${status} requires freshness evidence`);
    }
});

test('workflow safety gates allow exact VS Code PR extension surfaces without broad GitHub mutation fallback', async () => {
    const text = await read(workflowSafetyGatesPath);

    assert.match(text, /github\.vscode-pull-request-github\/activePullRequest/);
    assert.match(text, /approved for read-only PR context acquisition/);
    assert.match(text, /github\.vscode-pull-request-github\/resolveReviewThread/);
    assert.match(text, /Real review thread node ID from extension\/GitHub data; pushed-visible addressed state or verified no-change rationale; gatekeeper pass or allowed skip; no mutating probe/);
    assert.match(text, /All other GitHub remote mutations require a future workflow with explicit frontmatter grants, provenance, approval, and rollback\/recovery rules/);
    assert.doesNotMatch(text, /mcp_github_create_or_update_file|mcp_github_push_files|mcp_github_delete_file/);
});

test('workflow safety gates approve direct existing-comment replies with separate params and provenance', async () => {
    const text = await read(workflowSafetyGatesPath);
    const allowlistRow = text.split('\n').find((line) => line.includes('| Reply/comment on PR review feedback |')) ?? '';
    const provenanceSection = sliceBetween(text, '### Direct Review Comment Reply ID Provenance Gate', '## Linear Remote Mutation Allowlist');

    assert.match(allowlistRow, /mcp_github_add_reply_to_pull_request_comment/);
    assert.match(allowlistRow, /`owner`/);
    assert.match(allowlistRow, /`repo`/);
    assert.match(allowlistRow, /`pullNumber`/);
    assert.match(allowlistRow, /`commentId: number`/);
    assert.match(allowlistRow, /`body`/);
    assert.match(allowlistRow, /direct replies to existing PR review comments/);
    assert.match(allowlistRow, /[Pp]ending-review inline comments/);
    assert.match(allowlistRow, /does not compose new top-level reviews/);
    assert.match(allowlistRow, /Direct Review Comment Reply ID Provenance Gate/);
    assert.doesNotMatch(allowlistRow, /mcp_github_add_issue_comment/);

    assert.match(provenanceSection, /This `commentId` is distinct from the review thread node ID used for resolution/);
    assert.match(provenanceSection, /A direct numeric field from an approved fresh GitHub or VS Code PR extension read for the exact review comment/);
    assert.match(provenanceSection, /numeric `id`, `databaseId`, or documented review-comment reply ID/);
    assert.match(provenanceSection, /exact `#discussion_r<digits>` fragment in the `html_url` field/);
    assert.match(provenanceSection, /operator-facing provenance summary/);
    assert.match(provenanceSection, /Do not include this provenance summary in reviewer-facing replies/);
});

test('direct review comment reply provenance forbids unsafe sources and fails closed', async () => {
    const safety = await read(workflowSafetyGatesPath);
    const context = await read(prReviewThreadContextPath);
    const combined = `${safety}\n${context}`;
    const provenanceSection = sliceBetween(safety, '### Direct Review Comment Reply ID Provenance Gate', '## Linear Remote Mutation Allowlist');

    for (const unsafeSource of [
        'arbitrary pasted URLs',
        'user-provided fragments',
        'file paths',
        'line numbers',
        'stale cache',
        'prior partial reads',
        'search snippets',
        'placeholders',
        'guesses',
        'dummy values',
        'review thread node IDs such as `PRRT_...`',
    ]) {
        assert.match(provenanceSection, new RegExp(unsafeSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${unsafeSource} is forbidden`);
    }

    assert.match(combined, /Reject missing, malformed, non-numeric, stale, partial, search-snippet, non-exact-comment, conflicting, or thread-node values/);
    assert.match(combined, /direct numeric field and the parsed `html_url` fallback are present, they must match; disagreement blocks the reply sub-action/);
    assert.match(combined, /missing thread node ID, missing comment database ID or direct reply `commentId`, invalid `html_url` fragment, stale or partial snapshot, exact-comment mismatch, direct\/fallback disagreement/);
    assert.match(safety, /A thread node ID, arbitrary URL, user-provided fragment, file path, line number, stale or partial read, placeholder, or guess is not a valid `commentId`/);
});

test('PR review thread context documents direct numeric commentId and narrow html_url fallback', async () => {
    const text = await read(prReviewThreadContextPath);
    const mapping = sliceBetween(text, '## ID Mapping', '## Output Contract');

    assert.match(mapping, /Direct existing-comment reply `commentId`: numeric/);
    assert.match(mapping, /Prefer a direct numeric field from an approved fresh GitHub or VS Code PR extension read for the exact review comment/);
    assert.match(mapping, /tool-returned numeric `id`, `databaseId`, or documented review-comment reply ID/);
    assert.match(mapping, /only fallback is parsing the exact `#discussion_r<digits>` fragment from that same exact comment's `html_url`/);
    assert.match(mapping, /Do not parse arbitrary pasted URLs or user-provided fragments/);
    assert.match(mapping, /It is not the thread node ID/);
    assert.match(text, /Direct reply provenance:[\s\S]+read source, freshness point, exact-comment match basis, unavailable direct numeric field, parsed `html_url` fragment, and direct-vs-fallback disagreement check/);
});

test('PR review reply-resolve restricts replies to direct existing-comment surface only', async () => {
    const replyResolve = await read(prReviewReplyResolvePath);
    const coordinator = await read(prReviewSkillPath);
    const combined = `${replyResolve}\n${coordinator}`;

    assert.match(replyResolve, /## Reply Surface Selection/);
    assert.match(replyResolve, /Direct existing-comment mode is the only active reply surface in this pack/);
    assert.match(replyResolve, /mcp_github_add_reply_to_pull_request_comment/);
    assert.match(replyResolve, /`owner`, `repo`, `pullNumber`, numeric `commentId`, and `body`/);
    assert.match(replyResolve, /Composing a new top-level review via `mcp_github_pull_request_review_write` method `create` is out of scope for this pack/);
    assert.match(combined, /Direct existing-comment replies require a numeric `commentId` with provenance accepted by `workflow-safety-gates` Direct Review Comment Reply ID Provenance Gate/);
    assert.doesNotMatch(combined, /mcp_github_add_pull_request_review_comment_to_pending_review|not currently granted in this pack/);
    assert.doesNotMatch(coordinator, /Pending-review inline comments and new review feedback remain separate surfaces and are not interchangeable with direct existing-comment replies/);
});

test('workflow safety PR readiness requires broad validation evidence for PR-review fix cycles', async () => {
    const text = await read(workflowSafetyGatesPath);
    const section = sliceBetween(text, '## PR Readiness Evidence Gate', '## PR Review Visibility and Thread Gate', 'PR readiness broad validation evidence section');

    assert.match(section, /Before GitHub PR creation, require explicit evidence for each mandatory upstream step/);
    assert.match(section, /Broad Safe Validation Gate evidence is required when PR-review fix cycles are in scope/);
    assert.match(section, /broad safe validation status \(`passed`\/`failed`\/`blocked`\/`skipped`\/`not applicable`\/`mutating-only`\)/);
    assert.doesNotMatch(section, /include: status \(/);
    assert.match(section, /repository-local discovery evidence, candidate command\(s\) inspected, selected command or unavailable-command conclusion, command classification basis, dirty-state boundary result when executed, freshness evidence for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
    assert.match(section, /Missing, failed, blocked, stale, or unknown freshness evidence blocks PR creation readiness/);
});

test('workflow safety PR readiness accepts skipped broad validation only with evidence and policy basis', async () => {
    const text = await read(workflowSafetyGatesPath);
    const section = sliceBetween(text, '## PR Readiness Evidence Gate', '## PR Review Visibility and Thread Gate', 'PR readiness skipped broad validation section');

    assert.match(section, /`skipped` and `not applicable` Broad Safe Validation Gate statuses satisfy readiness only when the output includes the full inspected evidence package and the policy\/risk basis for accepting that status/);
    assert.match(section, /repository-local discovery evidence, candidate command\(s\) inspected, selected command or unavailable-command conclusion, command classification basis, freshness evidence for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
    assert.match(section, /Valid evidence-backed `skipped` and `not applicable` statuses do not block solely because they are skips/);
});

test('workflow safety PR readiness treats mutating-only broad validation as conditional evidence, not a pass', async () => {
    const text = await read(workflowSafetyGatesPath);
    const section = sliceBetween(text, '## PR Readiness Evidence Gate', '## PR Review Visibility and Thread Gate', 'PR readiness mutating-only broad validation section');

    assert.match(section, /`mutating-only` is not a pass/);
    assert.match(section, /It satisfies readiness only when the output includes the full inspected evidence package above AND either separately reported authorized mutating\/output-writing command results with dirty-state\/output boundaries, or an accepted residual-risk rationale explicitly covering not running the mutating\/output-writing candidate/);
    assert.doesNotMatch(section, /`mutating-only` satisfies readiness solely because authorization exists/i);
});

test('workflow safety PR readiness skipped-step wording blocks only missing evidence or risk basis', async () => {
    const text = await read(workflowSafetyGatesPath);
    const section = sliceBetween(text, '## PR Readiness Evidence Gate', '## PR Review Visibility and Thread Gate', 'PR readiness skipped-step wording section');

    assert.match(section, /If any mandatory step was skipped without the required evidence, policy basis, or residual-risk basis, only logged without a real invocation, unavailable, failed, or blocked, do not create the PR/);
    assert.match(section, /Valid evidence-backed `skipped` and `not applicable` statuses do not block solely because they are skips/);
    assert.doesNotMatch(section, /If any mandatory step was skipped, only logged without a real invocation, unavailable, failed, or blocked, do not create the PR/);
});

test('orchestrator PR creation guidance preserves workflow safety broad-validation status semantics', async () => {
    const text = await read(orchestratorPath);
    const section = sliceFrom(text, '## PR Creation Guidance', 'orchestrator PR creation guidance section');

    assert.match(section, /Local enforcement stub: trigger = PR creation or PR-ready body preparation/);
    assert.match(section, /Broad Safe Validation Gate Evidence when PR-review fixes are present/);
    assert.match(section, /failed\/blocked\/stale broad validation/);
    assert.match(section, /`workflow-safety-gates` PR Template Gate, PR Body Audit Gate, PR Readiness Evidence Gate/);
    assert.match(section, /apply the shared Broad Safe Validation Gate Evidence package and `workflow-safety-gates` PR Readiness Evidence Gate status semantics/);
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
    assert.match(text, /If it is `skipped`, `not applicable`, or `mutating-only`, include repository-local discovery evidence, candidate command\(s\) inspected, selected command or unavailable-command conclusion, command classification basis, freshness evidence for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
    assert.match(text, /For `mutating-only`, proceed only after the authorized mutating\/output-writing command ran and is reported separately with dirty-state\/output boundaries, or after an accepted residual-risk rationale explicitly covers not running it/);
    assert.match(text, /Targeted vs broad safe validation: targeted verification status and evidence; broad safe validation status \(`passed`\/`failed`\/`blocked`\/`skipped`\/`not applicable`\/`mutating-only`\); repository-local discovery evidence; candidate command\(s\) inspected; selected command or unavailable-command conclusion; command classification basis; dirty-state boundary result when executed; freshness evidence for the final candidate worktree\/fix batch; proceed\/block effect; residual risk; next operator action/);
});

test('gatekeeper consumes targeted-vs-broad evidence and blocks missing or blocking broad validation', async () => {
    const text = await read(reviewCycleGatekeeperPath);

    assert.match(text, /Verification evidence after fixes, separated into targeted verification and Broad Safe Validation Gate evidence when PR-review fixes are in scope/);
    assert.match(text, /broad evidence must include broad safe validation status \(`passed`\/`failed`\/`blocked`\/`skipped`\/`not applicable`\/`mutating-only`\), repository-local discovery evidence, candidate command\(s\) inspected, selected command or unavailable-command conclusion, command classification basis, dirty-state boundary result when executed, freshness evidence for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
    assert.doesNotMatch(text, /broad evidence must include status \(/);
    assert.match(text, /Targeted checks alone do not satisfy this rule when broad safe validation is available/);
    assert.match(text, /`passed` satisfies the rule only when the evidence is fresh for the final candidate worktree\/fix batch/);
    assert.match(text, /`failed`, `blocked`, stale evidence, and unknown freshness make the gate emit `BLOCK`/);
    assert.match(text, /a failed selected broad safe validation remains blocking until its failure is addressed, or until the workflow is re-scoped or reclassified so that command is no longer the selected broad safe validation/);
    assert.match(text, /`skipped` and `not applicable` are valid only when the evidence includes repository-local discovery evidence, candidate command\(s\) inspected, selected command or unavailable-command conclusion, command classification basis, freshness evidence for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
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
    assert.ok(requiredInputsStart >= 0, 'gatekeeper required inputs heading is present');
    assert.ok(gateRulesStart >= 0, 'gatekeeper gate rules heading is present');
    assert.ok(decisionProcedureStart >= 0, 'gatekeeper decision procedure heading is present');
    assert.ok(outputFormatStart >= 0, 'gatekeeper output format heading is present');

    const requiredInputs = sliceBetween(text, '\n## Required Inputs', '\n## Severity Vocabulary', 'gatekeeper required inputs section');
    const gateRules = sliceBetween(text, '\n## Gate Rules', '\n## Waiver Rules', 'gatekeeper gate rules section');
    const decisionProcedure = sliceBetween(text, '\n## Decision Procedure', '\n### Insufficient Input', 'gatekeeper decision procedure section');
    const outputFormat = sliceBetween(text, '\n## Output Format', '\n## Anti-Patterns', 'gatekeeper output format section');

    assert.match(requiredInputs, /freshness evidence for the final candidate worktree\/fix batch/);
    assert.match(requiredInputs, /If contextual\/independent review, builder\/test follow-up, formatting, generated-output handling, or any other fix step changed the worktree after broad validation evidence was produced, that evidence is stale until rerun or explicitly re-established for the final changed surface/);
    assert.match(requiredInputs, /stale or unknown freshness makes the gatekeeper emit `BLOCK`/);
    assert.match(gateRules, /`passed` satisfies the rule only when the evidence is fresh for the final candidate worktree\/fix batch/);
    assert.match(gateRules, /`failed`, `blocked`, stale evidence, and unknown freshness make the gate emit `BLOCK`/);
    assert.match(gateRules, /missing, failed, blocked, stale, or unknown freshness broad safe validation emits `BLOCK`/);
    assert.match(decisionProcedure, /emit `BLOCK` for missing, failed, blocked, stale, or unknown freshness broad validation evidence/);
    assert.match(outputFormat, /Broad Safe Validation Gate evidence: targeted verification status; broad safe validation status; repository-local discovery evidence; candidate command\(s\) inspected; selected command or unavailable-command conclusion; command classification basis; dirty-state boundary result when executed; freshness evidence for the final candidate worktree\/fix batch; proceed\/block effect; residual risk; next operator action; and whether the evidence is sufficient for this gate/);
    assert.match(outputFormat, /freshness evidence for the final candidate worktree\/fix batch: <fresh, stale, or unknown, with later-edit evidence>/);
    assert.doesNotMatch(outputFormat, /^- targeted verification:/m);
    assert.doesNotMatch(outputFormat, /^- broad safe validation:/m);
    assert.doesNotMatch(outputFormat, /dirty-state boundary result: <before\/after result or not executed>/);
    assert.doesNotMatch(outputFormat, /freshness: <fresh for final candidate worktree\/fix batch, stale, or unknown, with later-edit evidence>/);
});

test('gatekeeper Broad Safe Validation Gate sample template names candidate selection and dirty-state boundary fields', async () => {
    const text = await read(reviewCycleGatekeeperPath);
    const sample = sliceBetween(text, 'Broad Safe Validation Gate evidence:', 'Waivers:', 'gatekeeper broad validation sample section');

    assert.match(sample, /- repository-local discovery evidence: <docs\/scripts\/config\/prior-local-evidence inspected>/);
    assert.match(sample, /- candidate command\(s\) inspected: <commands or None>/);
    assert.match(sample, /- selected command or unavailable-command conclusion: <selected command, or why none is selectable>/);
    assert.match(sample, /- targeted verification status: <status\/evidence>/);
    assert.match(sample, /- broad safe validation status: <passed\|failed\|blocked\|skipped\|not applicable\|mutating-only>/);
    assert.match(sample, /- command classification basis: <basis>/);
    assert.match(sample, /- dirty-state boundary result when executed: <before\/after result or not executed>/);
    assert.match(sample, /- freshness evidence for the final candidate worktree\/fix batch: <fresh, stale, or unknown, with later-edit evidence>/);
    assert.match(sample, /- proceed\/block effect: <effect>/);
    assert.match(sample, /- residual risk: <risk>/);
    assert.match(sample, /- next operator action: <action>/);
    assert.doesNotMatch(sample, /^- targeted verification:/m);
    assert.doesNotMatch(sample, /^- broad safe validation:/m);
    assert.doesNotMatch(sample, /dirty-state boundary result: <before\/after result or not executed>/);
    assert.doesNotMatch(sample, /freshness: <fresh for final candidate worktree\/fix batch, stale, or unknown, with later-edit evidence>/);
});

test('orchestrator carries Broad Safe Validation Gate evidence through PR-review handoffs and readiness', async () => {
    const text = await read(orchestratorPath);
    const outputFormat = sliceFrom(text, '## Output Format', 'orchestrator output format section');
    const prCreation = sliceBetween(text, '\n## PR Creation Guidance\n', '\n## Output Format\n', 'orchestrator PR creation guidance section');

    assert.match(text, /require the Broad Safe Validation Gate after targeted fix verification succeeds and before push readiness, reviewer-facing replies, or review-thread resolution/);
    assert.match(text, /Targeted checks alone do not satisfy broad validation when a broad safe candidate is available/);
    assert.match(text, /Evidence must be fresh for the final candidate worktree\/fix batch/);
    assert.match(text, /contextual\/independent review, builder\/test follow-up, formatting, generated-output handling, or any other later worktree edit invalidates earlier broad validation until rerun or explicitly re-established for the final changed surface/);
    assert.match(text, /Failed, blocked, stale, or unknown freshness broad validation blocks progress; failed selected broad validation cannot be waived through residual risk/);
    assert.match(text, /`skipped`, `not applicable`, or `mutating-only` outcomes may proceed only with repository-local discovery evidence, candidate command\(s\) inspected, selected command or unavailable-command conclusion, command classification basis, freshness evidence for the final candidate worktree\/fix batch, proceed\/block effect, residual risk, and next operator action/);
    assert.match(text, /Mutating-only evidence is not a pass; it may proceed only after the authorized mutating\/output-writing command ran with reported dirty-state\/output boundaries, or after an accepted residual-risk rationale explicitly covers not running it/);
    assert.match(text, /For PR-review fix cycles, it also consumes targeted verification and Broad Safe Validation Gate evidence with freshness evidence for the final candidate worktree\/fix batch/);
    assert.match(text, /Missing, failed, blocked, stale, or unknown freshness broad safe validation blocks readiness; failed selected broad validation cannot be waived through residual risk/);
    assert.match(text, /do not push, post reviewer-facing replies, or resolve threads until targeted fix verification has passed and the Broad Safe Validation Gate has a non-blocking status that is fresh for the final candidate worktree\/fix batch/);
    assert.match(text, /Broad safe validation is selected from repository-local evidence by behavior-based command classification, not by language\/framework\/ecosystem preference/);
    assert.match(text, /Broad Safe Validation Gate expectations for PR-review fixes: report targeted verification separately from broad safe validation; discover broad candidates from repository-local evidence only; classify candidates by behavior as `local-only`, `approval-bound`, `forbidden`, `unavailable`, `skipped`, `not applicable`, or `mutating-only`; report repository-local discovery evidence, candidate command\(s\) inspected, selected command or unavailable-command conclusion, command classification basis, and freshness evidence for the final candidate worktree\/fix batch/);
    assert.match(text, /include proceed\/block effect, residual risk, and next operator action for any `failed`, `blocked`, `stale`, `skipped`, `not applicable`, or `mutating-only` result/);
    assert.match(text, /For `mutating-only`, require either a separately reported authorized mutating\/output-writing run with dirty-state\/output boundaries, or an accepted residual-risk rationale that explicitly covers not running it/);
    assert.match(prCreation, /Broad Safe Validation Gate Evidence when PR-review fixes are present/);
    assert.match(prCreation, /failed\/blocked\/stale broad validation/);
    assert.match(prCreation, /apply the shared Broad Safe Validation Gate Evidence package and `workflow-safety-gates` PR Readiness Evidence Gate status semantics/);
    assert.match(outputFormat, /Broad Safe Validation Gate Evidence when PR-review fixes are in scope/);
});

test('builder classifies builder-run PR-review checks or defers broad validation to test agent', async () => {
    const text = await read(builderAgentPath);

    assert.match(text, /When verification is in scope for a PR-review fix, classify builder-run checks as targeted verification or broad safe validation/);
    assert.match(text, /If broad safe validation belongs to `test-agent` or cannot be selected under the current command boundaries, report the candidate command\(s\) inspected and selected command or unavailable-command conclusion explicitly instead of treating targeted checks as broad validation/);
    assert.match(text, /Targeted vs broad safe validation when PR-review fixes are in scope:[\s\S]+candidate command\(s\) inspected; selected command or unavailable-command conclusion/);
});

test('Linear entrypoints and docs carry no-PR thread-state proof language', async () => {
    const paths = await existingPaths([linearSkillPath, docsPath]);
    assert.ok(paths.length > 0, 'at least one linear entrypoint/doc path exists');

    for (const path of paths) {
        const text = await read(path);
        assert.match(text, /thread state: not applicable - no PR exists yet/, `${path} has the no-PR thread-state phrase`);
        assert.match(text, /no PR number|no linked PR|PR creation (?:has )?not yet run/, `${path} includes concrete no-PR proof language`);
    }
});

test('Linear entrypoints and docs propagate high-risk agent-pack dual review rule or deference', async () => {
    const paths = await existingPaths([linearSkillPath, docsPath]);
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

test('workflow safety gates require the exact approved PR creation path', async () => {
    const text = await read(workflowSafetyGatesPath);

    assert.match(text, /PR creation permits only the exact approved PR creation tool for this pack: `mcp_github_create_pull_request`/);
    assert.match(text, /Create pull request \| Approved \| `mcp_github_create_pull_request` only/);
    assert.match(text, /Create pull request \| Approved \| `mcp_github_create_pull_request` only \| [^\n|]*PR Body Audit Gate `pass` or `repaired` for the complete candidate PR body/);
    assert.match(text, /Host\/tool availability, generic tool descriptions, visible tool schemas, or tool names that appear capable never override this pack allowlist/);
    assert.match(text, /If one of those paths is blocked, unavailable, or fails, stop with a blocked, local-ready, or PR-ready summary\/guidance instead of attempting a recovery mutation/);
    assert.doesNotMatch(text, /mcp_github_create_pull_request_with_copilot/);
});

test('workflow safety create-PR allowlist row requires audited PR body', async () => {
    const text = await read(workflowSafetyGatesPath);
    const row = text.split('\n').find((line) => line.startsWith('| Create pull request |')) ?? '';

    assert.match(row, /`mcp_github_create_pull_request` only/);
    assert.match(row, /PR Body Audit Gate/);
    assert.match(row, /`pass` or `repaired`/);
    assert.match(row, /complete candidate PR body/);
});

test('workflow safety gates require read-only remote tools for read-only verification', async () => {
    const text = await read(workflowSafetyGatesPath);

    assert.match(text, /## Remote Read-Only Tool Intent Gate/);
    assert.match(text, /read-only remote verification, sanity check, metadata read, metadata readback, or parallel batch of remote checks, including pre-mutation and post-mutation reads/);
    assert.match(text, /select only tools or methods whose primary purpose is read-only metadata or verification/);
    assert.match(text, /when they describe the tool or method's primary action or operation/);
    assert.match(text, /Do not deny a read-primary method solely because a mutation-associated word appears inside the object being read or the metadata category being returned/);
    assert.match(text, /Read-primary tools or methods such as `get_\*`, `list_\*`, `read`, `search`, PR\/status metadata reads, `pull_request_read method=get_review_comments`, `pull_request_read method=get_reviews`, and `pull_request_read method=get_comments` are allowed when their declared purpose is read-only/);
    assert.match(text, /Mutation-primary operations remain forbidden for read-only verification/);
    assert.match(text, /Mutation-implying primary actions include comment-writing, reply, add-comment, status-changing, `approve`, `request_changes`, `dismiss`, `close`, `reopen`, `assign`, `label`, `resolve`, `unresolve`, `submit`, `delete`, `create`, `update`, `merge`, `push`, `write`/);
    assert.match(text, /Remote mutation-capable tools or methods must not be batched in parallel/);
    assert.match(text, /Parallel remote read batches are allowed only when every tool and method in the batch is read-only by primary purpose/);
    assert.match(text, /stop all remote operations immediately/);
    assert.match(text, /Do not repeat the same remote call as recovery/);
    assert.match(text, /the next remote action passes the appropriate fresh gate: Remote Read-Only Tool Intent Gate for read-only continuation, or Mutation Intent Gate plus the applicable remote mutation allowlist for mutation continuation/);
    assert.match(text, /Before any remote operation resumes, record a wrong-tool incident report that includes the intended action, actual tool or method, observed result, whether anything changed, and the guard or remediation added/);
});

test('orchestrator applies read-only remote intent gate to readbacks and parallel checks', async () => {
    const text = await read(orchestratorPath);
    const workflowSafety = sliceBetween(text, '## Workflow Safety Gates', '## Remote MCP Context Boundaries', 'orchestrator condensed workflow safety gates');

    assert.match(workflowSafety, /Remote Read-Only Tool Intent Gate/);
    assert.match(workflowSafety, /GitHub\/Linear metadata read, sanity check, readback, or parallel remote-check batch/);
    assert.match(workflowSafety, /Read-only tool\/method selection by primary purpose/);
    assert.match(workflowSafety, /`get_\*`, `list_\*`, `read`, `search`, PR\/status metadata reads, and `pull_request_read` methods such as `get_review_comments`, `get_reviews`, and `get_comments`/);
    assert.match(workflowSafety, /mixed read\/write parallel batch/);
    assert.match(text, /For PR review-comment workflow read-only remote verification, sanity checks, metadata reads\/readbacks, or remote-check batches, apply the canonical `workflow-safety-gates` Remote Read-Only Tool Intent Gate/);
    assert.match(text, /Use read-only PR review, issue, repository, status, or Linear metadata tools or methods by primary purpose for those reads; do not use mutation-primary tools or methods as sanity checks or read-only verification/);
    assert.match(workflowSafety, /Mutation-primary review-write, add\/reply\/comment, resolve\/unresolve, approve\/request_changes\/dismiss, status-changing, create\/update\/delete\/merge\/push\/write/);
});

test('orchestrator and prompt require first-round pre-push adversarial status with split verdict', async () => {
    const paths = await existingPaths([orchestratorPath]);
    assert.ok(paths.length > 0, 'at least one orchestrator/prompt path exists');

    for (const path of paths) {
        const text = await read(path);
        assert.match(text, /First-round non-trivial pre-push adversarial-review/, `${path} names first-round non-trivial rule`);
        assert.match(text, /non-trivial by risk shape/i, `${path} uses risk-shape trigger language`);
        assert.match(text, /Pre-push adversarial review status/, `${path} exposes operator-facing status`);
    }

    const outputContract = await read(outputFormatContractPath);
    assert.match(outputContract, /Execution status[\s\S]+`completed`, `skipped`, `blocked`, or `not applicable`/);
    assert.match(outputContract, /Verdict[\s\S]+`BLOCK`, `CONCERNS`, `CLEAN`, `defer to prior adversarial review`/);
    assert.match(outputContract, /Verdict: not produced \(execution status: <execution-status>\)/);
    assert.doesNotMatch(outputContract, /verdict is (?:skipped|blocked|not applicable)/i);
    assert.doesNotMatch(outputContract, /when verdict is `(?:skipped|blocked|not applicable)`/i);
});

test('workflow entrypoints propagate first-round non-trivial pre-push review status', async () => {
    const paths = await existingPaths([linearSkillPath, prReviewSkillPath, expertPanelPath, docsPath]);
    assert.ok(paths.length > 0, 'at least one workflow entrypoint path exists');

    for (const path of paths) {
        const text = await read(path);
        assert.match(text, /First-round non-trivial pre-push adversarial-review/, `${path} names first-round rule`);
        assert.match(text, /Pre-push adversarial review status/, `${path} reports pre-push status`);
        assert.match(text, /Execution status.*Verdict|`Execution status`.*`Verdict`/s, `${path} keeps execution separate from verdict`);
        assert.match(text, /Matched non-trivial class\(es\)/, `${path} reports matched non-trivial classes`);
        assert.match(text, /Skip considered[\s\S]*Skip rejected evidence[\s\S]*Skip accepted evidence/, `${path} reports skip evidence with canonical labels`);
    }
});

test('pre-push output and readiness contexts use canonical adversarial status labels', async () => {
    const paths = await existingPaths([linearSkillPath, prReviewSkillPath, prReviewFixCyclePath]);
    assert.ok(paths.includes(prReviewFixCyclePath), `${prReviewFixCyclePath} is covered by adversarial status drift checks`);

    const shorthandPatterns = [
        /skip considered\/rejected\/accepted evidence/i,
        /whether skip was considered, and skip rejected\/accepted evidence/i,
        /cumulative branch diff vs integration branch baseline/i,
        /matched non-trivial class(?:\(es\)|es)/,
        /matched non-trivial classes/,
        /blocking findings count/,
    ];

    for (const path of paths) {
        const text = await read(path);
        const contexts = prePushOutputOrReadinessContexts(text);

        assert.ok(contexts.length > 0, `${path} has pre-push output/readiness context`);

        for (const context of contexts) {
            for (const pattern of shorthandPatterns) {
                assert.doesNotMatch(context, pattern, `${path} rejects shorthand ${pattern} in output/readiness context`);
            }

            if (path !== linearSkillPath && /shared Pre-push Adversarial Review Status package|shared Pre-push adversarial review status package/.test(context)) {
                continue;
            }

            const requiredLabels = path === linearSkillPath
                ? canonicalPrePushStatusLabels
                : canonicalPrePushStatusLabels.filter((label) => [
                    'Execution status',
                    'Verdict',
                    'Matched non-trivial class\\(es\\)',
                    'Skip considered',
                    'Skip rejected evidence',
                    'Skip accepted evidence',
                    'Blocking findings count',
                ].includes(label));

            for (const label of requiredLabels) {
                assert.match(context, new RegExp(label), `${path} includes canonical ${label} label in output/readiness context`);
            }
            assert.doesNotMatch(context, /skip\/block rationale/i, `${path} does not use skip/block rationale as a field label`);
        }
    }
});

test('push and PR readiness require non-blocking adversarial outcome', async () => {
    const paths = await existingPaths([workflowSafetyGatesPath, orchestratorPath, linearSkillPath, prReviewSkillPath, expertPanelPath]);
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
    const paths = await existingPaths([workflowSafetyGatesPath, orchestratorPath, prReviewSkillPath, docsPath]);
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
    assert.match(text, /\agentic-engineering\/pull_request_template\.md/);
    assert.match(text, /\agentic-engineering\/PULL_REQUEST_TEMPLATE\/\*\.md/);
    assert.match(text, /If exactly one readable template is found/);
    assert.match(text, /Ambiguity is based on readable templates, not total candidate count/);
    assert.match(text, /If exactly one readable template is found[\s\S]+even if other discovered candidates are unreadable/);
    assert.match(text, /If multiple readable templates are found and no repository convention clearly selects one/);
    assert.match(text, /Return `blocked-on-template-choice`/);
    assert.match(text, /list each readable candidate template path, include unreadable candidates as status evidence/);
    assert.match(text, /If no template is found, return the fallback Markdown Template below with operator-facing status `no-template-fallback-used`/);
    assert.match(text, /If exactly one candidate exists and is unreadable, or every candidate is unreadable, return the fallback Markdown Template below with operator-facing status `unreadable-template-fallback-used`/);
    assert.match(text, /Template status is for the operator-facing notes outside the fenced PR body only/);
    assert.match(text, /status as one of:[^\n]+blocked-on-template-choice/);
    assertPrTemplateStatuses(text, 'PR description template policy status output');
    assert.match(text, /no-template-fallback-used/);
    assert.match(text, /unreadable-template-fallback-used/);
    assert.match(text, /The reviewer-facing PR body must not include any sentence that names the template's existence, absence, source, or fallback selection/);
});

test('Linear workflow reports canonical PR template status vocabulary', async () => {
    const text = await read(linearSkillPath);
    const output = sliceBetween(text, '## Output Format', '## Linear Comment Audience and Content', 'Linear PR template status output section');

    assert.match(output, /\*\*PR template status:\*\* One of/);
    assertPrTemplateStatuses(output, 'Linear PR template status output');
});

test('orchestrator Output Format reports canonical PR template status vocabulary', async () => {
    const text = await read(orchestratorPath);
    const output = sliceFrom(text, '## Output Format', 'orchestrator output format section');

    assert.match(output, /PR Template and Body Status when PR creation or PR-ready body preparation happens/);
    assert.match(output, /PR template status uses the shared vocabulary/);
    assertPrTemplateStatuses(output, 'orchestrator PR template status output');
});

test('workflow safety PR Template Gate reports canonical PR template status vocabulary', async () => {
    const text = await read(workflowSafetyGatesPath);
    const templateGate = sliceBetween(text, '## PR Template Gate', '### PR Body Audience', 'workflow safety PR Template Gate');

    assert.match(templateGate, /Operator-facing template status must be one of/);
    assertPrTemplateStatuses(templateGate, 'workflow safety PR Template Gate');
});

test('orchestrator PR creation guidance blocks ambiguous template choice when it cannot ask', async () => {
    const text = await read(orchestratorPath);
    const section = sliceBetween(text, '\n## PR Creation Guidance\n', '\n## Output Format\n', 'orchestrator PR creation guidance section');

    assert.match(section, /blocked-on-template-choice/);
});

test('selected unreadable template blocks when readable alternatives exist', async () => {
    const templatePolicy = await read(prDescriptionTemplatePolicyPath);
    const workflowSafety = await read(workflowSafetyGatesPath);
    const rootReadme = await read(rootReadmePath);
    const guideReadme = await read(docsPath);
    const templateGate = sliceBetween(workflowSafety, '## PR Template Gate', '### PR Body Audience', 'workflow safety selected unreadable template gate');
    const rootLinear = sliceBetween(rootReadme, '## Linear Issue Workflow', '### Invalid Triage Gate', 'root README Linear Issue Workflow section');
    const guideTemplateGate = sliceBetween(guideReadme, '### Pull Request Template Gate', '### External Project Scope Gate', 'generated guide Pull Request Template Gate section');

    assert.match(templatePolicy, /selected-template-unreadable-choice-required/);
    assert.match(templatePolicy, /Ambiguity is based on readable templates, not total candidate count/);
    assert.match(templatePolicy, /If exactly one readable template is found[\s\S]+even if other discovered candidates are unreadable/);
    assert.match(templatePolicy, /If multiple readable templates are found and no repository convention clearly selects one/);
    assert.match(templatePolicy, /best-guess readable template/);
    assert.match(templatePolicy, /user-selected or repository-convention-selected template is unreadable and at least one other candidate template is readable/);
    assert.match(templatePolicy, /Do not silently use the fallback template and do not silently switch to a readable alternative/);
    assert.match(templatePolicy, /If no template is found, return the fallback Markdown Template below with operator-facing status `no-template-fallback-used`/);
    assert.match(templatePolicy, /If exactly one candidate exists and is unreadable, or every candidate is unreadable, return the fallback Markdown Template below with operator-facing status `unreadable-template-fallback-used`/);

    assert.match(templateGate, /selected-template-unreadable-choice-required/);
    assert.match(templateGate, /blocked-on-template-choice/);
    assert.match(templateGate, /Ambiguity is based on readable templates, not total candidate count/);
    assert.match(templateGate, /If exactly one readable template is found[\s\S]+even if other discovered candidates are unreadable/);
    assert.match(templateGate, /If multiple readable templates are found and repository convention does not clearly select one, ask the user before PR creation or PR-ready body publication/);
    assert.match(templateGate, /ask the user to choose a readable template or confirm fallback use/);
    assert.match(templateGate, /If the workflow cannot ask, block/);
    assert.match(templateGate, /If no template is found, use the workflow fallback body and state operator-facing template status `no-template-fallback-used`/);
    assert.match(templateGate, /If exactly one candidate exists and is unreadable, or every candidate is unreadable, use the workflow fallback body and state operator-facing template status `unreadable-template-fallback-used`/);
    assert.doesNotMatch(templateGate, /selected template cannot be read, use the workflow fallback body/i);

    assert.match(rootLinear, /uses a single readable template as the PR body structure even if other candidates are unreadable/);
    assert.match(rootLinear, /multiple readable templates require a user choice/);
    assert.match(rootLinear, /blocked-on-template-choice/);
    assert.match(rootLinear, /selected-template-unreadable-choice-required/);
    assert.match(rootLinear, /ask-or-block when a chosen template is unreadable but readable alternatives exist/);
    assert.match(guideTemplateGate, /uses a single readable template even if other candidates are unreadable/);
    assert.match(guideTemplateGate, /multiple readable templates are ambiguous/);
    assert.match(guideTemplateGate, /blocked-on-template-choice/);
    assert.match(guideTemplateGate, /selected-template-unreadable-choice-required/);
    assert.match(guideTemplateGate, /ask-or-block when a chosen template is unreadable but readable alternatives exist/);
});

test('workflow safety PR Body Audit Gate is canonical for all PR body paths', async () => {
    const workflowSafety = await read(workflowSafetyGatesPath);
    const orchestrator = await read(orchestratorPath);
    const linear = await read(linearSkillPath);
    const prReview = await read(prReviewSkillPath);
    const composer = await read(pullRequestDescriptionPath);
    const prBodyAudience = sliceBetween(workflowSafety, '### PR Body Audience', '### PR Body Audit Gate', 'workflow safety PR Body Audience section');
    const auditGate = sliceBetween(workflowSafety, '### PR Body Audit Gate', '## PR Readiness Evidence Gate', 'workflow safety PR Body Audit Gate section');
    const prReviewIntegration = sliceBetween(prReview, '## Integration with Pull Request Description', '\n## Output Format', 'PR review integration with pull request description section');

    assert.match(prBodyAudience, /orchestrator-coordinated PR creation delegated to `pr-creation-agent`/);
    assert.doesNotMatch(prBodyAudience, /orchestrator's inline PR-creation step/);

    assert.match(auditGate, /Before a workflow sends a body to `mcp_github_create_pull_request`/);
    assert.match(auditGate, /publishes a PR-ready body for manual creation/);
    assert.match(auditGate, /returns a final fenced copy\/paste PR description/);
    assert.match(auditGate, /orchestrator-coordinated PR creation paths/);
    assert.match(auditGate, /the `linear-issue-workflow` delegated PR creation path/);
    assert.match(auditGate, /`pull-request-description`/);
    assert.match(auditGate, /workflow\/template leakage/);
    assert.match(auditGate, /Hard-wrapped paragraphs or list items/);
    assert.match(auditGate, /Validation language is honest/);
    assert.match(auditGate, /Synthesis adversarial-review PR-body lines/);
    assert.match(auditGate, /The final output separates the reviewer-facing body from operator-facing notes/);
    assert.match(auditGate, /blocks `mcp_github_create_pull_request` and blocks PR-ready body publication/);

    assert.match(orchestrator, /failed\/blocked PR Body Audit Gate/);
    assert.match(orchestrator, /`workflow-safety-gates` PR Template Gate, PR Body Audit Gate, PR Readiness Evidence Gate/);
    assert.match(linear, /apply the `workflow-safety-gates` PR Body Audit Gate to the complete candidate body/);
    assert.match(linear, /before delegating PR creation to `pr-creation-agent` or publishing any PR-ready body/);
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
    const rootLinear = sliceBetween(rootReadme, '## Linear Issue Workflow', '### Invalid Triage Gate', 'root README Linear Issue Workflow section');
    const guideLinear = sliceBetween(guideReadme, '### Linear Issue Workflow Flowchart', '### PR Review Comments Workflow Flowchart', 'generated guide Linear Issue Workflow Flowchart section');

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
        assert.match(text, /audited selected-template\/fallback body|Delegate GitHub PR creation<br\/>to pr-creation-agent<br\/>mcp_github_create_pull_request/, `${path} creates the PR with the audited body or delegates creation after audit`);
        assert.doesNotMatch(text, /mcp_github_create_pull_request[^\n]+template status/i, `${path} keeps template status out of PR creation`);
    }

    assert.match(rootLinear, /operator-facing PR template status/);
});

test('Linear Issue to PR docs summary checks template choice before PR Body Audit Gate', async () => {
    const guideReadme = await read(docsPath);
    const section = sliceBetween(guideReadme, '### Linear Issue to PR', '### Addressing PR Review Comments', 'generated guide Linear Issue to PR summary section');

    const templateCheck = section.indexOf('8. Checks the target repository for PR templates');
    const auditGate = section.indexOf('9. Applies the PR Body Audit Gate');
    const prCreation = section.indexOf('10. Delegates GitHub PR creation to `pr-creation-agent` with the `github/create_pull_request` frontmatter grant approving the `mcp_github_create_pull_request` runtime operation');

    assert.ok(templateCheck >= 0, 'Linear Issue to PR summary checks PR templates');
    assert.ok(auditGate > templateCheck, 'PR Body Audit Gate follows template choice in the summary');
    assert.ok(prCreation > auditGate, 'PR creation follows PR Body Audit Gate in the summary');
    assert.match(section, /uses a single readable template even if other candidates are unreadable/);
    assert.match(section, /asks when multiple readable templates are unresolved and ambiguous/);
    assert.match(section, /blocked-on-template-choice/);
    assert.match(section, /selected-template-unreadable-choice-required/);
    assert.match(section, /ask\/block when a chosen template is unreadable but readable alternatives exist/);
    assert.match(section, /complete selected-template\/fallback candidate body/);
});

test('Verified non-changes citation rules are inherited by direct PR body paths', async () => {
    const workflowSafety = await read(workflowSafetyGatesPath);
    const orchestrator = await read(orchestratorPath);
    const linear = await read(linearSkillPath);
    const auditGate = sliceBetween(workflowSafety, '### PR Body Audit Gate', '## PR Readiness Evidence Gate', 'workflow safety verified non-changes citation section');

    assert.match(auditGate, /`## Verified non-changes` items cite all required evidence/);
    assert.match(auditGate, /in-repo code path/);
    assert.match(auditGate, /one-sentence statement of the upstream contract or library behavior/);
    assert.match(auditGate, /in-repository machine-readable version-pin location/);
    assert.match(auditGate, /must not cite URLs, off-repo paths, dependency-tree internal source paths/);
    assert.match(auditGate, /Drop the entire invalid item and report the offending citation excerpt to the operator/);

    assert.match(orchestrator, /Verified non-changes may appear in a PR body only when each item satisfies the canonical PR Body Audit Gate citation validation/);
    assert.match(orchestrator, /Workflow-internal evidence paths, dependency-tree internals, and upstream source line numbers stay in operator-facing output only/);
    assert.match(linear, /`## Verified non-changes` citation validation/);
});

test('PR description support skills hard-stop on direct invocation', async () => {
    for (const path of [prDescriptionTemplatePolicyPath, prDescriptionBodyAuditPath]) {
        const text = await read(path);
        const section = sliceBetween(text, '## Direct Invocation Hard Stop', '## Responsibility', `${path} direct invocation hard stop section`);

        assert.equal(frontmatterValue(text, 'user-invocable'), 'false', `${path} remains internal`);
        assert.match(section, /blocked-direct-invocation/, `${path} has a direct-invocation blocker`);
        assert.match(section, /Route final copy\/paste PR descriptions to `pull-request-description`/, `${path} routes final descriptions`);
        assert.match(section, /route PR creation workflows to the orchestrator or `linear-issue-workflow`/, `${path} routes creation workflows`);
        assert.match(section, /This hard stop does not apply when `pull-request-description`, the orchestrator, or a workflow skill invokes this skill internally/, `${path} allows internal workflow use`);
    }
});

test('PR body audit section blocks support-skill leakage and partial Verified non-changes', async () => {
    const workflowSafety = await read(workflowSafetyGatesPath);
    const auditGate = sliceBetween(workflowSafety, '### PR Body Audit Gate', '## PR Readiness Evidence Gate', 'workflow safety PR Body Audit Gate leakage section');

    assert.match(auditGate, /support-skill/);
    assert.match(auditGate, /unresolved workflow\/template leakage blocks/);
    assert.match(auditGate, /failed citation validation that leaves an incomplete `## Verified non-changes` item/);
    assert.match(auditGate, /do not ship a partial item/);
    assert.doesNotMatch(auditGate, /direct workflow paths .* do not need to repeat the full rule/i);
});

test('synthesis PR body line is emitted only after completed adversarial review', async () => {
    const paths = await existingPaths([workflowSafetyGatesPath, orchestratorPath, prDescriptionBodyAuditPath, docsPath]);
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

test('orchestrator has no GitHub tools and includes github-context-agent, pr-creation-agent, and pr-review-agent', async () => {
    const orchestrator = await read(orchestratorPath);
    const frontmatter = orchestrator.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';

    assert.doesNotMatch(frontmatter, /github\/\*/i, 'orchestrator has no github/* wildcard');
    assert.doesNotMatch(frontmatter, /github\/create_pull_request/i, 'orchestrator has no github/create_pull_request');
    assert.doesNotMatch(frontmatter, /github\/pull_request_read/i, 'orchestrator has no github/pull_request_read');
    assert.doesNotMatch(frontmatter, /mcp_github_create_pull_request/i, 'orchestrator has no mcp_github_create_pull_request');
    assert.doesNotMatch(frontmatter, /mcp_github_pull_request_read/i, 'orchestrator has no mcp_github_pull_request_read');
    assert.doesNotMatch(frontmatter, /github\.vscode-pull-request-github\/activePullRequest/i, 'orchestrator has no activePullRequest');
    assert.doesNotMatch(frontmatter, /github\.vscode-pull-request-github\/resolveReviewThread/i, 'orchestrator has no resolveReviewThread');

    assert.match(orchestrator, /agents:/m, 'orchestrator has agents list');
    assert.match(orchestrator, /- github-context-agent/m, 'orchestrator includes github-context-agent');
    assert.match(orchestrator, /- git-operator-agent/m, 'orchestrator includes git-operator-agent');
    assert.match(orchestrator, /- pr-creation-agent/m, 'orchestrator includes pr-creation-agent');
    assert.match(orchestrator, /- pr-review-agent/m, 'orchestrator includes pr-review-agent');
});

test('git-operator-agent owns local git mechanics', async () => {
    const gitOperator = await read(gitOperatorAgentPath);
    const orchestrator = await read(orchestratorPath);
    const builder = await read(builderAgentPath);
    const testAgent = await read(testAgentPath);
    const prReviewFixCycle = await read(prReviewFixCyclePath);

    assert.equal(await exists(gitOperatorAgentPath), true, 'git-operator-agent exists');
    assert.equal(frontmatterValue(gitOperator, 'user-invocable'), 'false', 'git-operator-agent is not user-invocable');
    assert.equal(frontmatterValue(gitOperator, 'name'), '"git-operator-agent"');

    const frontmatter = gitOperator.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
    assert.match(frontmatter, /edit/m, 'git-operator-agent can write commit message files');
    assert.match(frontmatter, /execute/m, 'git-operator-agent can run local git commands');
    assert.match(gitOperator, /Local Git Mutation Delegation Contract/);
    assert.match(gitOperator, /Shell-Safe Local Execution/);
    assert.match(gitOperator, /local push\/ref evidence/);
    assert.match(gitOperator, /downstream pushed-visible confirmation/);
    assert.match(gitOperator, /GitHub PR-diff visibility remains owned by github-context-agent\/orchestrator handoff/);
    assert.match(gitOperator, /Cleanup means metadata-only cleanup/);
    assert.match(gitOperator, /temporary message files created for the approved action/);
    assert.match(gitOperator, /explicitly named local branches only when the delegation contract approves that exact branch deletion and required approval is present/);
    assert.match(gitOperator, /Do not delete generic local refs, tags, notes/);
    assert.match(gitOperator, /working-tree deletion and `git clean` are out of scope for this agent even with approval/);
    assert.match(gitOperator, /`git clean` and working-tree deletion are out of scope for this agent/);
    assert.match(gitOperator, /Pass commit and amend messages via `-F <message-file>`/);
    assert.doesNotMatch(gitOperator, /explicitly named local refs, branches, or tags/);
    assert.doesNotMatch(gitOperator, /branch deletion, tag deletion, `git clean`, and any command outside the exact approved scope/);
    assert.doesNotMatch(gitOperator, /tag, and notes messages/);
    assert.doesNotMatch(gitOperator, /remove generated artifacts unless the delegation contract/);
    assert.doesNotMatch(gitOperator, /pushed-visible confirmation mechanics/);

    assert.match(orchestrator, /Local git mechanics belong to `git-operator-agent`/);
    assert.match(orchestrator, /Final pushed-visible status comes from github-context-agent PR-diff visibility evidence after git-operator-agent local push\/ref evidence/);
    assert.match(builder, /If the change requires local git mutation, route that need to `git-operator-agent`/);
    assert.match(testAgent, /If local git mutation is needed, route that need to `git-operator-agent`/);
    assert.match(prReviewFixCycle, /Delegate local branch, staging, commit, amend, cleanup, push, and local push\/ref evidence for downstream pushed-visible confirmation to `git-operator-agent`/);
    assert.match(prReviewFixCycle, /separate GitHub PR-diff visibility status for pushed-visible confirmation/);
});

test('github-context-agent has exact read-only grants and no write grants', async () => {
    const agent = await read(githubContextAgentPath);

    assert.equal(await exists(githubContextAgentPath), true, 'github-context-agent exists');
    assert.equal(frontmatterValue(agent, 'user-invocable'), 'false', 'github-context-agent is not user-invocable');
    assert.equal(frontmatterValue(agent, 'name'), '"github-context-agent"');

    const frontmatter = agent.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
    // Positive assertions: must have core PR read grants
    assert.match(frontmatter, /github\/pull_request_read/m, 'has github/pull_request_read');
    assert.match(frontmatter, /github\.vscode-pull-request-github\/activePullRequest/m, 'has activePullRequest');
    // Additional exact read-only grants are allowed (e.g., github/get_commit, github/issue_read, etc.)
    // but we don't assert specific ones to avoid brittleness

    // Strong negative assertions: no write grants, no wildcards, no mutation tools
    assert.doesNotMatch(frontmatter, /mcp_github_pull_request_read\b/m, 'does not have mcp_github_pull_request_read in frontmatter');
    assert.doesNotMatch(frontmatter, /github\/\*/i, 'has no github/* wildcard');
    assert.doesNotMatch(frontmatter, /github\/create_pull_request/m, 'has no github/create_pull_request (belongs to pr-creation-agent)');
    assert.doesNotMatch(frontmatter, /github\/pull_request_review_write/m, 'has no github/pull_request_review_write (belongs to pr-review-agent)');
    assert.doesNotMatch(frontmatter, /github\/add_reply_to_pull_request_comment/m, 'has no github/add_reply_to_pull_request_comment (belongs to pr-review-agent)');
    assert.doesNotMatch(frontmatter, /github\/add_pull_request_review_comment_to_pending_review/m, 'has no github/add_pull_request_review_comment_to_pending_review (intentionally not granted to any agent)');
    assert.doesNotMatch(frontmatter, /execute/i, 'has no execute');
    assert.doesNotMatch(frontmatter, /edit/i, 'has no edit');
    assert.doesNotMatch(frontmatter, /linear\/\*/i, 'has no linear/*');
    assert.doesNotMatch(frontmatter, /web/i, 'has no web');
    assert.doesNotMatch(frontmatter, /obsidian\/\*/i, 'has no obsidian/*');
    assert.doesNotMatch(frontmatter, /mcp_github_create_or_update_file/i, 'has no repository file mutation tools');
    assert.doesNotMatch(frontmatter, /mcp_github_push_files/i, 'has no mcp_github_push_files');
    assert.doesNotMatch(frontmatter, /mcp_github_delete_file/i, 'has no mcp_github_delete_file');
    assert.doesNotMatch(frontmatter, /github\/update_file/i, 'has no github/update_file');
    assert.doesNotMatch(frontmatter, /github\/delete_file/i, 'has no github/delete_file');

    // Content checks for read-only ownership
    const description = agent.match(/description: ["'](.+?)["']/)?.[1] ?? '';
    assert.match(description, /read-only/i, 'description mentions read-only');
    assert.match(agent, /Round-N count computation/i, 'owns Round-N count computation');
    assert.match(agent, /PR metadata/i, 'owns PR metadata reads');
    assert.match(agent, /review comments/i, 'owns review comment reads');
});

test('pr-creation-agent has exact PR creation grant and delegates reads', async () => {
    const agent = await read(prCreationAgentPath);

    assert.equal(await exists(prCreationAgentPath), true, 'pr-creation-agent exists');
    assert.equal(frontmatterValue(agent, 'user-invocable'), 'false', 'pr-creation-agent is not user-invocable');
    assert.equal(frontmatterValue(agent, 'name'), '"pr-creation-agent"');

    const frontmatter = agent.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
    assert.match(frontmatter, /github\/create_pull_request/m, 'has github/create_pull_request');
    assert.doesNotMatch(frontmatter, /github\/pull_request_read/m, 'does not have github/pull_request_read (belongs to github-context-agent)');
    assert.doesNotMatch(frontmatter, /github\.vscode-pull-request-github\/activePullRequest/m, 'does not have activePullRequest (belongs to github-context-agent)');
    assert.doesNotMatch(frontmatter, /mcp_github_create_pull_request\b/m, 'does not have mcp_github_create_pull_request in frontmatter');
    assert.doesNotMatch(frontmatter, /mcp_github_pull_request_read\b/m, 'does not have mcp_github_pull_request_read in frontmatter');
    assert.doesNotMatch(frontmatter, /github\/pull_request_review_write/m, 'has no github/pull_request_review_write');
    assert.doesNotMatch(frontmatter, /github\/add_reply_to_pull_request_comment/m, 'has no github/add_reply_to_pull_request_comment');
    assert.doesNotMatch(frontmatter, /github\/add_pull_request_review_comment_to_pending_review/m, 'has no github/add_pull_request_review_comment_to_pending_review (intentionally not granted to any agent)');
    assert.doesNotMatch(frontmatter, /github\/\*/i, 'has no github/* wildcard');
    assert.doesNotMatch(frontmatter, /execute/i, 'has no execute');
    assert.doesNotMatch(frontmatter, /edit/i, 'has no edit');
    assert.doesNotMatch(frontmatter, /linear\/\*/i, 'has no linear/*');
    assert.doesNotMatch(frontmatter, /web/i, 'has no web');
    assert.doesNotMatch(frontmatter, /obsidian\/\*/i, 'has no obsidian/*');
    assert.doesNotMatch(frontmatter, /mcp_github_create_or_update_file/i, 'has no repository file mutation tools');
    assert.doesNotMatch(frontmatter, /mcp_github_push_files/i, 'has no mcp_github_push_files');
    assert.doesNotMatch(frontmatter, /mcp_github_delete_file/i, 'has no mcp_github_delete_file');

    // Content checks for github-context-agent delegation and post-create verification
    assert.match(agent, /github-context-agent/i, 'mentions github-context-agent for read delegation');
    assert.match(agent, /post-create verification|verification after creation/i, 'mentions post-create verification');
    assert.match(agent, /`Remote-visible head branch` evidence/);
    assert.match(agent, /remote\/git readiness must come from orchestrator handoff distilled from github-context-agent and\/or approved local inspection/);
    assert.match(agent, /Local `read` may only inspect explicitly named PR title, body, or template artifacts from the handoff/);
    assert.match(agent, /Do not perform local git mutations \(branch, commit, push, amend, rebase\)/);
    assert.doesNotMatch(agent, /tag, notes/);
    assert.doesNotMatch(agent, /orchestrator handoff or read results/);
});

test('workflow-safety-gates defines Remote-visible head branch distinct from Pushed-visible', async () => {
    const workflowSafety = await read(workflowSafetyGatesPath);
    const orchestrator = await read(orchestratorPath);
    const glossary = sliceBetween(workflowSafety, '## Glossary', '## Untrusted External Content', 'workflow-safety-gates Glossary section');

    assert.match(glossary, /\*\*Remote-visible head branch\*\*: The head branch exists in the intended remote owner\/repo with the referenced commits reachable/);
    assert.match(glossary, /Evidence provenance names github-context-agent handoff and\/or approved local git inspection/);
    assert.match(glossary, /Required before PR creation when no PR exists/);
    assert.match(glossary, /distinct from \*\*Pushed-visible\*\*, which requires PR-diff reflection after a PR exists/);

    const readinessGate = sliceBetween(workflowSafety, '## PR Readiness Evidence Gate', '### Broad Safe Validation Gate', 'workflow-safety-gates PR Readiness Evidence Gate section');
    assert.match(readinessGate, /Remote-visible head branch evidence present before PR creation/);
    assert.match(readinessGate, /intended remote owner\/repo, head branch, referenced commit\(s\), and provenance from github-context-agent handoff and\/or approved local git inspection/);

    const localGitContract = sliceBetween(workflowSafety, '## Local Git Mutation Delegation Contract', '## Shell-Safe Local Execution', 'workflow-safety-gates Local Git Mutation Delegation Contract section');
    assert.match(localGitContract, /Allowed command class \(branch creation, branch switch\/reuse, scoped staging, commit\/amend, rebase\/squash\/reset, push\/force-push, or metadata cleanup\/exact local branch deletion\)/);
    assert.match(localGitContract, /Verbatim user-approval text when action requires explicit approval \(force-push, history rewrite, broad staging, default-branch ops, branch deletion\)/);
    assert.match(localGitContract, /Metadata cleanup\/exact local branch deletion inherits destructive cleanup exclusions from `git-operator-agent`/);
    assert.match(localGitContract, /does not authorize `git clean`, working-tree deletion, tag deletion, generic ref deletion, or broad pruning/);

    const mutationAllowlistsRow = orchestrator
        .split('\n')
        .find((line) => line.startsWith('| GitHub and Linear mutation allowlists |')) ?? '';
    assert.doesNotMatch(mutationAllowlistsRow, /Orchestrator only; specialists receive distilled context/);
    assert.match(mutationAllowlistsRow, /PR creation delegates to `pr-creation-agent`/);
    assert.match(mutationAllowlistsRow, /PR review writes delegate to `pr-review-agent`/);
    assert.match(mutationAllowlistsRow, /Linear mutations remain orchestrator-owned/);
});

test('pr-review-agent has exact write grants and no read grants', async () => {
    const agent = await read(prReviewAgentPath);

    assert.equal(await exists(prReviewAgentPath), true, 'pr-review-agent exists');
    assert.equal(frontmatterValue(agent, 'user-invocable'), 'false', 'pr-review-agent is not user-invocable');
    assert.equal(frontmatterValue(agent, 'name'), '"pr-review-agent"');

    const frontmatter = agent.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
    assert.match(frontmatter, /github\/pull_request_review_write/m, 'has github/pull_request_review_write');
    assert.match(frontmatter, /github\/add_reply_to_pull_request_comment/m, 'has github/add_reply_to_pull_request_comment');
    assert.doesNotMatch(frontmatter, /github\/add_pull_request_review_comment_to_pending_review/m, 'does not have github/add_pull_request_review_comment_to_pending_review (intentionally not granted)');
    assert.doesNotMatch(frontmatter, /github\/pull_request_read/m, 'does not have github/pull_request_read (belongs to github-context-agent)');
    assert.doesNotMatch(frontmatter, /github\.vscode-pull-request-github\/activePullRequest/m, 'does not have activePullRequest (belongs to github-context-agent)');
    assert.doesNotMatch(frontmatter, /github\/create_pull_request/m, 'has no github/create_pull_request (belongs to pr-creation-agent)');
    assert.doesNotMatch(frontmatter, /mcp_github_pull_request_read\b/m, 'does not have mcp_github_pull_request_read in frontmatter');
    assert.doesNotMatch(frontmatter, /mcp_github_pull_request_review_write\b/m, 'does not have mcp_github_pull_request_review_write in frontmatter');
    assert.doesNotMatch(frontmatter, /mcp_github_add_reply_to_pull_request_comment\b/m, 'does not have mcp_github_add_reply_to_pull_request_comment in frontmatter');
    assert.doesNotMatch(frontmatter, /mcp_github_add_pull_request_review_comment_to_pending_review\b/m, 'does not have mcp_github_add_pull_request_review_comment_to_pending_review in frontmatter');
    assert.doesNotMatch(frontmatter, /mcp_github_create_pull_request\b/m, 'does not have mcp_github_create_pull_request in frontmatter');
    assert.doesNotMatch(frontmatter, /github\/\*/i, 'has no github/* wildcard');
    assert.doesNotMatch(frontmatter, /execute/i, 'has no execute');
    assert.doesNotMatch(frontmatter, /edit/i, 'has no edit');
    assert.doesNotMatch(frontmatter, /linear\/\*/i, 'has no linear/*');
    assert.doesNotMatch(frontmatter, /web/i, 'has no web');
    assert.doesNotMatch(frontmatter, /obsidian\/\*/i, 'has no obsidian/*');
    assert.doesNotMatch(frontmatter, /mcp_github_create_or_update_file/i, 'has no repository file mutation tools');
    assert.doesNotMatch(frontmatter, /mcp_github_push_files/i, 'has no mcp_github_push_files');
    assert.doesNotMatch(frontmatter, /mcp_github_delete_file/i, 'has no mcp_github_delete_file');

    // Content checks for github-context-agent delegation and orchestrator-sourced context
    assert.match(agent, /github-context-agent/i, 'mentions github-context-agent for read delegation');
    assert.match(agent, /orchestrator-sourced|orchestrator coordination/i, 'mentions orchestrator-sourced context');
});

test('PR review-write contract narrows resolve-only and prefers VS Code extension surface', async () => {
    const prReviewAgent = await read(prReviewAgentPath);
    const prCreationAgent = await read(prCreationAgentPath);
    const orchestrator = await read(orchestratorPath);
    const replyResolve = await read(prReviewReplyResolvePath);

    // pr-review-reply-resolve Output Contract reply-surface entry must not advertise "new-review feedback"
    assert.match(replyResolve, /Reply surface for each reply: direct existing-comment only in this pack/);
    assert.match(replyResolve, /entries include the operator-facing `commentId` provenance summary required by `workflow-safety-gates` Direct Review Comment Reply ID Provenance Gate/);
    const replyResolveOutputContractSlice = replyResolve.match(/## Output Contract[\s\S]*$/)?.[0] ?? '';
    assert.doesNotMatch(replyResolveOutputContractSlice, /new[- ]?review feedback/i);

    // pr-review-agent: owned ops narrowed to replies + resolution; no new top-level reviews; VS Code preferred, MCP fallback
    assert.match(prReviewAgent, /Own GitHub PR review write operations: direct replies to existing review comments and thread resolution\./);
    assert.match(prReviewAgent, /This pack does not compose new top-level reviews/);
    assert.match(prReviewAgent, /`github\.vscode-pull-request-github\/resolveReviewThread` is the preferred surface for thread resolution\./);
    assert.match(prReviewAgent, /`github\/pull_request_review_write` is the fallback surface for thread resolution\/unresolution/);
    assert.match(prReviewAgent, /Other methods on this grant \u2014 including `method=create` for new top-level reviews \u2014 are not used by this pack\./);
    assert.match(prReviewAgent, /Thread resolution \(preferred\): `github\.vscode-pull-request-github\/resolveReviewThread`/);
    assert.match(prReviewAgent, /Thread resolution \(fallback when the VS Code PR extension surface is unavailable\): `mcp_github_pull_request_review_write`/);
    assert.doesNotMatch(prReviewAgent, /submit reviews/i);

    // pr-creation-agent: handoff-sourced state, no self-inspection of remote/git
    assert.match(prCreationAgent, /This agent has no GitHub read or `execute` grants, so remote and git state are taken from the handoff rather than self-inspected\./);
    assert.match(prCreationAgent, /Confirm `Remote-visible head branch` status from the orchestrator handoff \(distilled from github-context-agent and\/or approved local inspection\)/);
    assert.doesNotMatch(prCreationAgent, /conflicts with current repository state/i);
    assert.doesNotMatch(prCreationAgent, /conflicts with current read-only repository state/i);

    // orchestrator: pr-review-agent ownership phrase narrowed; no "review submission" assignment
    assert.match(orchestrator, /`pr-review-agent` for PR review write operations \(direct replies to existing review threads and thread resolution; this pack does not compose new top-level reviews\)/);
    assert.doesNotMatch(orchestrator, /review replies, review submission, and thread resolution/i);
});

test('workflow-safety-gates describes three-specialist GitHub split', async () => {
    const workflowSafety = await read(workflowSafetyGatesPath);
    const prReviewAgent = await read(prReviewAgentPath);
    const expectedPrReviewAgentWriteGrants = [
        'github/pull_request_review_write',
        'github/add_reply_to_pull_request_comment',
        'github.vscode-pull-request-github/resolveReviewThread',
    ].sort();
    const prReviewAgentWriteGrants = frontmatterListValues(prReviewAgent, 'tools')
        .filter((tool) => tool.startsWith('github/') || tool.startsWith('github.vscode-pull-request-github/'))
        .sort();

    assert.deepEqual(prReviewAgentWriteGrants, expectedPrReviewAgentWriteGrants, 'pr-review-agent frontmatter grants the current exact PR review write set');

    assert.doesNotMatch(workflowSafety, /orchestrator-only.*github\/\*|github\/\*.*orchestrator-only/i, 'does not claim orchestrator-only github/* wildcard');
    assert.doesNotMatch(workflowSafety, /orchestrator holds.*github\/\*|github\/\*.*orchestrator holds/i, 'does not claim orchestrator-held github/* wildcard');

    const remoteMcpSection = sliceBetween(workflowSafety, '## Remote MCP Context Gate', '## Obsidian Vault Context Gate', 'Remote MCP Context Gate section');
    assert.match(remoteMcpSection, /github-context-agent/i, 'mentions github-context-agent');
    assert.match(remoteMcpSection, /pr-creation-agent/i, 'mentions pr-creation-agent');
    assert.match(remoteMcpSection, /pr-review-agent/i, 'mentions pr-review-agent');
    assert.match(remoteMcpSection, /read-write/i, 'mentions read-write split');
    assert.match(remoteMcpSection, /github\/pull_request_read/i, 'mentions github/pull_request_read');
    assert.match(remoteMcpSection, /github\/create_pull_request/i, 'mentions github/create_pull_request');
    for (const grant of prReviewAgentWriteGrants) {
        const escapedGrant = grant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(remoteMcpSection, new RegExp(escapedGrant, 'i'), `Remote MCP Context Gate mentions ${grant}`);
    }
});

test('pr-review-agent onward delegation re-applies orchestrator gates before builder/test handoff', async () => {
    const content = await read(prReviewAgentPath);
    const delegationSection = sliceBetween(
        content,
        '## Delegation to Implementation and Verification Specialists',
        '## Hard Gates',
        'pr-review-agent delegation section',
    );
    assert.match(
        delegationSection,
        /pr-review-fix-cycle.*Builder\/Test Contract/,
        'pr-review-agent delegation section must reference pr-review-fix-cycle Builder/Test Contract',
    );
    assert.match(
        delegationSection,
        /spec status.*architecture status|Spec status.*Architecture status/,
        'pr-review-agent delegation section must require spec status and architecture status carry-forward',
    );
    assert.match(
        delegationSection,
        /equivalence-class audit instruction/,
        'pr-review-agent delegation section must require the equivalence-class audit instruction',
    );
    assert.match(
        delegationSection,
        /block the delegation and report/,
        'pr-review-agent delegation section must require blocking the delegation when gate inputs are missing',
    );
    assert.match(
        delegationSection,
        /pre-push adversarial-review rule remain[s]? orchestrator-owned/,
        'pr-review-agent delegation section must clarify pre-push adversarial review remains orchestrator-owned',
    );

    const hardGates = sliceBetween(content, '## Hard Gates', '## Approach', 'pr-review-agent Hard Gates section');
    assert.match(
        hardGates,
        /Do not delegate review-driven fixes.*spec status.*architecture status.*equivalence-class audit instruction/s,
        'pr-review-agent Hard Gates must include the gate-carry-forward enforcement',
    );
});

test('workflow-safety-gates discloses github/pull_request_review_write tool-level residual risk', async () => {
    const content = await read(workflowSafetyGatesPath);
    const gateSection = sliceBetween(content, '## Remote MCP Context Gate', '## Obsidian Vault Context Gate', 'Remote MCP Context Gate section');
    assert.match(
        gateSection,
        /`github\/pull_request_review_write` is a tool-level MCP grant/,
        'Remote MCP Context Gate must call out github/pull_request_review_write as tool-level',
    );
    assert.match(
        gateSection,
        /method narrowing.*instruction.*not at the MCP grant layer/,
        'Remote MCP Context Gate must say method narrowing is at instruction layer, not MCP grant layer',
    );
    assert.match(
        gateSection,
        /accepted residual risk in v1/,
        'Remote MCP Context Gate must mark this as an accepted v1 residual risk',
    );
    assert.match(
        gateSection,
        /Mitigations:.*GitHub Remote Mutation Allowlist.*Untrusted External Content.*Externally-Posted Content Gate/s,
        'Remote MCP Context Gate must enumerate the mitigations parallel to the linear/* model',
    );
});

test('pr-creation-agent forbids mutating-probe remote-visible discovery', async () => {
    const content = await read(prCreationAgentPath);
    const approachSection = sliceBetween(content, '## Approach', '## Hard Gates', 'pr-creation-agent Approach section');
    assert.match(
        approachSection,
        /`Remote-visible head branch` evidence is missing.*treat the sub-action as blocked and report `commits not remote-visible; PR creation blocked`/,
        'pr-creation-agent step 2 must block rather than probe when remote-visible head branch evidence is missing',
    );
    assert.match(
        approachSection,
        /Do not call `mcp_github_create_pull_request` to discover remote-visible status from its error response/,
        'pr-creation-agent step 2 must explicitly forbid the mutating-probe reading',
    );
    assert.match(
        approachSection,
        /mutating-probe forbidden by the `workflow-safety-gates` Mutation Intent Gate and the Critical Tool Parameter Gate/,
        'pr-creation-agent step 2 must cite the canonical gates that forbid the mutating-probe pattern',
    );
    assert.doesNotMatch(
        approachSection,
        /the `mcp_github_create_pull_request` tool's own error response is the fallback failure surface/,
        'pr-creation-agent step 2 must no longer authorize the tool error as a fallback failure surface',
    );
});

test('orchestrator Output Format reflects post-split GitHub authority ownership', async () => {
    const content = await read(orchestratorPath);
    const outputFormatSection = sliceFrom(content, '## Output Format', 'orchestrator Output Format section');
    assert.match(
        outputFormatSection,
        /`linear\/\*` was used directly by the orchestrator/,
        'Output Format must say linear/* is used directly by the orchestrator',
    );
    assert.match(
        outputFormatSection,
        /`github\/\*` or VS Code PR extension authority was used by a delegated specialist/,
        'Output Format must attribute github/* to delegated specialists',
    );
    assert.match(
        outputFormatSection,
        /github-context-agent.*pr-creation-agent.*pr-review-agent/,
        'Output Format must name the three GitHub specialists',
    );
});

test('pr-review-comments-workflow references github-context-agent reads and pr-review-agent writes', async () => {
    const prReviewWorkflow = await read(prReviewSkillPath);

    assert.match(prReviewWorkflow, /github-context-agent/i, 'references github-context-agent');
    assert.match(prReviewWorkflow, /pr-review-agent/i, 'references pr-review-agent');
    assert.match(prReviewWorkflow, /orchestrator.*coordination|orchestrator.*handoff|coordination.*orchestrator|handoff.*orchestrator/i, 'mentions orchestrator coordination or handoff');
    assert.doesNotMatch(prReviewWorkflow, /no-github-grant/i, 'no longer uses no-github-grant wording');
});