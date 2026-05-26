import assert from 'node:assert/strict';
import test from 'node:test';

import {
    ORCHESTRATOR_REL,
    ORCHESTRATOR_SPEC_GATE_ANCHORS,
    annotateCodeBlocks,
    checkOrchestratorSpecGateAnchors,
    stripHtmlCommentLine,
    stripHtmlCommentsFromLines,
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