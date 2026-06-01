import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
    ORCHESTRATOR_REL,
    ORCHESTRATOR_SPEC_GATE_ANCHORS,
    annotateCodeBlocks,
    checkOrchestratorSpecGateAnchors,
    stripHtmlCommentLine,
    stripHtmlCommentsFromLines,
    walkMarkdownFiles,
    extractFrontmatterListValues,
    checkAgentDelegationAllowlists,
    checkDuplicateAgentFrontmatter,
} from '../scripts/lint-pack.mjs';

const longBody = 'This anchor has enough visible body content to satisfy the linter body measurement check.';

function validOrchestratorLines() {
    const lines = [];
    for (const { anchor } of ORCHESTRATOR_SPEC_GATE_ANCHORS) {
        lines.push(anchor);
        lines.push(longBody);
    }
    return lines;
}

function check(lines) {
    return checkOrchestratorSpecGateAnchors([
        {
            rel: ORCHESTRATOR_REL,
            lines,
            inCodeBlock: annotateCodeBlocks(lines),
        },
    ]);
}

test('stripHtmlCommentLine handles same-line comments while preserving visible text', () => {
    const result = stripHtmlCommentLine('before <!-- hidden anchor --> after');
    assert.equal(result.stripped, 'before  after');
    assert.equal(result.inHtmlComment, false);
});

test('stripHtmlCommentsFromLines tracks multi-line and EOF-in-comment state', () => {
    const stripped = stripHtmlCommentsFromLines([
        'visible <!-- hidden starts',
        'still hidden',
        'hidden ends --> visible again',
        'tail <!-- eof hidden',
        'never visible',
    ]);

    assert.deepEqual(stripped, [
        'visible ',
        '',
        ' visible again',
        'tail ',
        '',
    ]);
});

test('orchestrator anchor search rejects anchors hidden in multi-line HTML comments', () => {
    const lines = validOrchestratorLines();
    const hiddenAnchor = ORCHESTRATOR_SPEC_GATE_ANCHORS[0].anchor;
    lines[0] = '<!--';
    lines[1] = `${hiddenAnchor}`;
    lines[2] = '-->';

    const findings = check(lines);

    assert.ok(findings.some((finding) => finding.anchor === hiddenAnchor && finding.line === 0));
});

test('orchestrator body measurement ignores multi-line HTML comment body text', () => {
    const lines = validOrchestratorLines();
    const anchor = ORCHESTRATOR_SPEC_GATE_ANCHORS[0].anchor;
    lines.splice(1, 1, '<!--', longBody, '-->', '## Next Section');

    const findings = check(lines);

    assert.ok(findings.some((finding) => finding.anchor === anchor && /body content/.test(finding.reason)));
});

test('HTML comment state ignores comment openers inside fenced code blocks', () => {
    const lines = validOrchestratorLines();
    lines.unshift('```', '<!-- not a real markdown comment for this check', '```');

    assert.equal(check(lines).length, 0);
});

test('walkMarkdownFiles skips missing markdown roots', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'lint-pack-roots-'));

    try {
        await mkdir(join(tempRoot, '.github', 'agents'), { recursive: true });
        await writeFile(join(tempRoot, '.github', 'agents', 'sample.agent.md'), '# sample\n', 'utf8');

        const result = await walkMarkdownFiles(tempRoot);

        assert.deepEqual(result.scannedRoots, ['.github/agents']);
        assert.deepEqual(result.skippedRoots.sort(), ['.github/prompts', '.github/skills', 'agentic-engineering/shared']);
        assert.equal(result.files.length, 1);
        assert.equal(result.files[0].rel, '.github/agents/sample.agent.md');
    }
    finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
});

test('walkMarkdownFiles scans markdown files from agentic-engineering/shared', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'lint-pack-shared-'));

    try {
        await mkdir(join(tempRoot, 'agentic-engineering', 'shared'), { recursive: true });
        await writeFile(
            join(tempRoot, 'agentic-engineering', 'shared', 'output-format-contract.md'),
            '# Output Format Contract\n',
            'utf8',
        );

        const result = await walkMarkdownFiles(tempRoot);

        assert.deepEqual(result.scannedRoots, ['agentic-engineering/shared']);
        assert.equal(result.files.length, 1);
        assert.equal(result.files[0].rel, 'agentic-engineering/shared/output-format-contract.md');
    }
    finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
});

test('walkMarkdownFiles throws explicit error when an existing markdown root cannot be traversed', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'lint-pack-roots-'));
    const skillsRoot = join(tempRoot, '.github', 'skills');

    try {
        await mkdir(skillsRoot, { recursive: true });
        await chmod(skillsRoot, 0o000);

        await assert.rejects(
            walkMarkdownFiles(tempRoot),
            /Failed to traverse markdown root .*\.github\/skills:/,
        );
    }
    finally {
        await chmod(skillsRoot, 0o755).catch(() => {});
        await rm(tempRoot, { recursive: true, force: true });
    }
});

test('agent delegation allowlist check reports missing allowlist and invalid delegates', async () => {
    const sampleAgent = [
        '---',
        'name: "sample-agent"',
        'tools:',
        '  - read',
        '  - agent',
        '---',
        '',
        '# Sample agent',
    ];

    const sampleAgentNoAllow = { rel: '.github/agents/sample.agent.md', lines: sampleAgent, inCodeBlock: annotateCodeBlocks(sampleAgent) };

    const known = { agents: new Set(['builder-agent', 'test-agent']) };

    const findings = checkAgentDelegationAllowlists([sampleAgentNoAllow], known);
    assert.ok(findings.some((f) => /LINT_AGENT_MISSING_ALLOWLIST/.test(f.reason)), 'missing allowlist is reported');

    const sampleAgentBlockEmptyAllowlist = [
        '---',
        'name: "sample-agent"',
        'tools:',
        '  - read',
        '  - agent',
        'agents:',
        '---',
        '',
        '# Sample agent',
    ];
    const sampleAgentBlockEmpty = { rel: '.github/agents/sample-empty-block.agent.md', lines: sampleAgentBlockEmptyAllowlist, inCodeBlock: annotateCodeBlocks(sampleAgentBlockEmptyAllowlist) };

    const blockEmptyFindings = checkAgentDelegationAllowlists([sampleAgentBlockEmpty], known);
    assert.ok(blockEmptyFindings.some((f) => /LINT_AGENT_MISSING_ALLOWLIST/.test(f.reason)), 'block empty allowlist is reported');

    const sampleAgentInlineEmptyAllowlist = [
        '---',
        'name: "sample-agent"',
        'tools:',
        '  - read',
        '  - agent',
        'agents: []',
        '---',
        '',
        '# Sample agent',
    ];
    const sampleAgentInlineEmpty = { rel: '.github/agents/sample-empty-inline.agent.md', lines: sampleAgentInlineEmptyAllowlist, inCodeBlock: annotateCodeBlocks(sampleAgentInlineEmptyAllowlist) };

    const inlineEmptyFindings = checkAgentDelegationAllowlists([sampleAgentInlineEmpty], known);
    assert.ok(inlineEmptyFindings.some((f) => /LINT_AGENT_MISSING_ALLOWLIST/.test(f.reason)), 'inline empty allowlist is reported');

    const sampleAgentBadDelegate = [
        '---',
        'name: "sample-agent"',
        'tools:',
        '  - read',
        '  - agent',
        'agents:',
        '  - non-existent-agent',
        '---',
        '',
        '# Sample agent',
    ];
    const sampleAgentBad = { rel: '.github/agents/sample2.agent.md', lines: sampleAgentBadDelegate, inCodeBlock: annotateCodeBlocks(sampleAgentBadDelegate) };

    const findings2 = checkAgentDelegationAllowlists([sampleAgentBad], known);
    assert.ok(findings2.some((f) => /LINT_AGENT_INVALID_DELEGATE/.test(f.reason)), 'invalid delegate is reported');
});

test('agent delegation allowlist check strips inline comments from block list tool values', () => {
    const sampleAgent = [
        '---',
        'name: "sample-agent"',
        'tools:',
        '  - read',
        '  - agent # delegation',
        '---',
        '',
        '# Sample agent',
    ];
    const file = { rel: '.github/agents/sample.agent.md', lines: sampleAgent, inCodeBlock: annotateCodeBlocks(sampleAgent) };

    const findings = checkAgentDelegationAllowlists([file], { agents: new Set(['builder-agent']) });

    assert.ok(findings.some((f) => /LINT_AGENT_MISSING_ALLOWLIST/.test(f.reason)));
});

test('agent delegation allowlist check strips inline comments from known delegates', () => {
    const sampleAgent = [
        '---',
        'name: "sample-agent"',
        'tools:',
        '  - agent',
        'agents:',
        '  - builder-agent # implements fixes',
        '---',
        '',
        '# Sample agent',
    ];
    const file = { rel: '.github/agents/sample.agent.md', lines: sampleAgent, inCodeBlock: annotateCodeBlocks(sampleAgent) };

    const findings = checkAgentDelegationAllowlists([file], { agents: new Set(['builder-agent']) });

    assert.equal(findings.length, 0);
});

test('agent delegation allowlist check detects inline array tools with trailing comments', () => {
    const sampleAgent = [
        '---',
        'name: "sample-agent"',
        'tools: [read, agent] # delegation',
        '---',
        '',
        '# Sample agent',
    ];
    const file = { rel: '.github/agents/sample.agent.md', lines: sampleAgent, inCodeBlock: annotateCodeBlocks(sampleAgent) };

    const findings = checkAgentDelegationAllowlists([file], { agents: new Set(['builder-agent']) });

    assert.ok(findings.some((f) => /LINT_AGENT_MISSING_ALLOWLIST/.test(f.reason)));
});

test('duplicate agent frontmatter check ignores body delimiters inside fenced code blocks', () => {
    const lines = [
        '---',
        'name: "sample-agent"',
        'tools:',
        '  - read',
        '---',
        '',
        '# Sample agent',
        '',
        '```markdown',
        '---',
        'name: "not-frontmatter"',
        '---',
        '```',
    ];
    const file = { rel: '.github/agents/sample.agent.md', lines, inCodeBlock: annotateCodeBlocks(lines) };

    const findings = checkDuplicateAgentFrontmatter([file]);

    assert.equal(findings.length, 0);
});

test('duplicate agent frontmatter check reports a second frontmatter block after body', () => {
    const lines = [
        '---',
        'name: "sample-agent"',
        'tools:',
        '  - read',
        '---',
        '',
        '# Sample agent',
        '',
        '---',
        'name: "duplicate-agent"',
        'tools:',
        '  - read',
        '---',
    ];
    const file = { rel: '.github/agents/sample.agent.md', lines, inCodeBlock: annotateCodeBlocks(lines) };

    const findings = checkDuplicateAgentFrontmatter([file]);

    assert.ok(findings.some((f) => /LINT_AGENT_DUPLICATE_FRONTMATTER/.test(f.reason)));
});
