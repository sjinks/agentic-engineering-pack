#!/usr/bin/env node

/**
 * Lint the .github/ agentic engineering pack for known regression classes.
 *
 * Five checks:
 *  1. Stale numbered cross-references — flags `Gate Rule N` references in
 *     prose outside the canonical `## Gate Rules` numbered list, and `Step N`
 *     references that do not resolve to a numbered step in the same file.
 *  2. Canonical-string drift — flags near-matches of canonical pack strings:
 *     the gatekeeper-skip sentinel, severity vocabulary (`CRITICAL`/`HIGH`/
 *     `MEDIUM`/`LOW`), and the `Adversarial-review pre-push` prefix.
 *  3. Cross-file reference resolution — flags backticked skill/agent names
 *     and frontmatter `agent:`/`agents:` entries that do not resolve to a
 *     file on disk, with a closest-match suggestion.
 *  4. Orchestrator gate anchors — flags missing or neutered spec-first gate
 *     steps (7a–7d), architecture-first gate steps (9a–9c), and the
 *     `Spec status:` / `Architecture status:` Output Format bullets in the
 *     orchestrator agent file, so future edits cannot silently drop them
 *     (also rejects anchors wrapped in HTML comments, prefixed with
 *     Deprecated:/Removed:/Replaced:, or with empty bodies).
 *  5. Producer ↔ consumer section-name consistency — flags drift in the
 *     canonical Output Format section names produced by `spec-agent` and
 *     `architect-agent` when referenced verbatim across the pack.
 *
 * Read-only: never writes files, never invokes git, never spawns external
 * processes. Walks only `.github/skills/`, `.github/agents/`, `.github/prompts/`.
 *
 * Usage:
 *   node scripts/lint-pack.mjs            # run all checks, exit 1 on any error
 *   node scripts/lint-pack.mjs --strict   # also fail on warnings
 *   node scripts/lint-pack.mjs --help     # show usage and exit 0
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACK_DIRS = ['.github/skills', '.github/agents', '.github/prompts'];
const SKILLS_DIR = '.github/skills';
const AGENTS_DIR = '.github/agents';

const GATEKEEPER_REL = '.github/skills/review-cycle-gatekeeper/SKILL.md';

// Files where backticked title-case severity (`Critical`/`High`/`Medium`/`Low`)
// is the intentional canonical format rather than drift. Check 2 skips the
// backticked-severity sub-check entirely for these files; sentinel-drift and
// adversarial-prefix rules still apply.
const TITLE_CASE_SEVERITY_FILES = new Set([
    '.github/skills/review-cycle-gatekeeper/SKILL.md',
    '.github/skills/test-gap-to-test-plan/SKILL.md',
]);

const CANONICAL_SENTINEL = 'no fix cycle, gatekeeper skipped';
const CANONICAL_ADVERSARIAL_PREFIX = 'Adversarial-review pre-push';

const REFERENCE_SUFFIX = /^[a-z][a-z0-9-]*-(agent|workflow|review|hygiene|panel|gates|commits|guidelines|description|gatekeeper|orchestrator)$/;

// Tokens matching the suffix pattern that are common nouns, not pack refs.
const REFERENCE_WHITELIST = new Set([
    'user-agent', 'dev-agent', 'someone-agent', 'sub-agent', 'multi-agent',
    'long-running-agent', 'pre-review', 'post-review', 'self-review',
    'code-review', 'peer-review', 'security-review', 'pre-push',
]);

function printHelp() {
    console.log(`Lint the .github/ agentic engineering pack for known regression classes.

Usage:
  node scripts/lint-pack.mjs [options]

Options:
  --strict    Treat warnings as errors (exit 1 if any warning is found).
  --help      Show this help message and exit.

Checks:
  1. Stale numbered cross-references (Gate Rule N, Step N in prose).
  2. Canonical-string drift (sentinel, severity vocabulary, adversarial prefix).
  3. Cross-file reference resolution (skill/agent names in backticks + frontmatter).
  4. Orchestrator gate anchors (spec 7a-7d, architecture 9a-9c, Output Format status bullets; rejects neutered anchors).
  5. Producer ↔ consumer section-name consistency (spec-agent and architect-agent Output Format names referenced verbatim across the pack).

Exit codes:
  0  No errors (warnings allowed unless --strict).
  1  Errors present, or warnings present with --strict.
`);
}

function parseArgs(argv) {
    const options = { help: false, strict: false };
    for (const arg of argv) {
        if (arg === '--help' || arg === '-h') options.help = true;
        else if (arg === '--strict') options.strict = true;
        else throw new Error(`Unknown option: ${arg}`);
    }
    return options;
}

async function findRepoRoot(startPath) {
    let current = path.resolve(startPath);
    for (; ;) {
        try {
            const info = await stat(path.join(current, '.github'));
            if (info.isDirectory()) return current;
        } catch { /* walk upward */ }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }
    throw new Error('Could not locate repo root (no .github/ found).');
}

async function walkInto(dir, rootAbs, results) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            await walkInto(full, rootAbs, results);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            results.push({ abs: full, rel: path.relative(rootAbs, full).split(path.sep).join('/') });
        }
    }
}

async function walkMarkdownFiles(rootAbs) {
    const results = [];
    const scannedRoots = [];
    const skippedRoots = [];
    for (const rel of PACK_DIRS) {
        const abs = path.join(rootAbs, rel);
        try {
            await stat(abs);
            await walkInto(abs, rootAbs, results);
            scannedRoots.push(rel);
        } catch { /* missing pack subdir — skip */ }
        if (!scannedRoots.includes(rel)) skippedRoots.push(rel);
    }
    return { files: results, scannedRoots, skippedRoots };
}

async function buildKnownEntities(rootAbs) {
    const skills = new Set();
    const agents = new Set();
    try {
        const entries = await readdir(path.join(rootAbs, SKILLS_DIR), { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            try {
                await stat(path.join(rootAbs, SKILLS_DIR, entry.name, 'SKILL.md'));
                skills.add(entry.name);
            } catch { /* no SKILL.md */ }
        }
    } catch { /* dir missing */ }
    try {
        const entries = await readdir(path.join(rootAbs, AGENTS_DIR), { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.agent.md')) {
                agents.add(entry.name.slice(0, -'.agent.md'.length));
            }
        }
    } catch { /* dir missing */ }
    return { skills, agents };
}

function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const prev = new Array(b.length + 1);
    const curr = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j += 1) prev[j] = j;
    for (let i = 1; i <= a.length; i += 1) {
        curr[0] = i;
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
    }
    return prev[b.length];
}

function closestMatch(token, candidates) {
    let best = null;
    let bestDist = Infinity;
    for (const candidate of candidates) {
        const dist = levenshtein(token, candidate);
        if (dist < bestDist) { bestDist = dist; best = candidate; }
    }
    return best ? { name: best, distance: bestDist } : null;
}

function snippet(line, idx, len, around = 25) {
    const start = Math.max(0, idx - around);
    const end = Math.min(line.length, idx + len + around);
    return `${start > 0 ? '…' : ''}${line.slice(start, end).trim()}${end < line.length ? '…' : ''}`;
}

function annotateCodeBlocks(lines) {
    const inCode = new Array(lines.length).fill(false);
    let fence = false;
    for (let i = 0; i < lines.length; i += 1) {
        if (/^```/.test(lines[i])) { fence = !fence; inCode[i] = true; continue; }
        inCode[i] = fence;
    }
    return inCode;
}

async function loadFiles(files) {
    const out = [];
    for (const f of files) {
        const text = await readFile(f.abs, 'utf8');
        const lines = text.split(/\r?\n/);
        out.push({ ...f, lines, inCodeBlock: annotateCodeBlocks(lines) });
    }
    return out;
}

function findGateRulesSection(lines) {
    let start = -1;
    let end = lines.length;
    for (let i = 0; i < lines.length; i += 1) {
        if (start < 0 && /^## Gate Rules\s*$/.test(lines[i])) { start = i + 1; continue; }
        if (start >= 0 && /^## /.test(lines[i])) { end = i; break; }
    }
    return start < 0 ? null : { start, end };
}

// H2 sections whose body is vocabulary-mapping prose; lines inside are not drift.
const MAPPING_SECTION_HEADING_PATTERNS = [
    'Severity Vocabulary',
    'Severity And Priority Mapping',
    'Mapping Notes',
    'Compatibility',
    'Mapping to',
];

function findMappingSections(lines) {
    const sections = [];
    let activeStart = -1;
    for (let i = 0; i < lines.length; i += 1) {
        if (!/^## /.test(lines[i])) continue;
        if (activeStart >= 0) {
            sections.push({ start: activeStart, end: i });
            activeStart = -1;
        }
        if (MAPPING_SECTION_HEADING_PATTERNS.some((p) => lines[i].includes(p))) {
            activeStart = i + 1;
        }
    }
    if (activeStart >= 0) sections.push({ start: activeStart, end: lines.length });
    return sections;
}

function checkStaleNumericRefs(files) {
    const findings = [];
    const gateRuleRegex = /\bGate Rule\s+(\d+)\b/gi;
    const stepRegex = /\bStep\s+(\d+)\b/gi;
    for (const file of files) {
        const isGatekeeper = file.rel === GATEKEEPER_REL;
        const gateSection = isGatekeeper ? findGateRulesSection(file.lines) : null;
        for (let i = 0; i < file.lines.length; i += 1) {
            if (file.inCodeBlock[i]) continue;
            const line = file.lines[i];
            for (const m of line.matchAll(gateRuleRegex)) {
                if (isGatekeeper && gateSection && i >= gateSection.start && i < gateSection.end) continue;
                findings.push({
                    file: file.rel, line: i + 1, snippet: snippet(line, m.index, m[0].length),
                    severity: 'warning',
                    reason: 'numeric Gate Rule reference in prose — use anchor-text instead',
                });
            }
            for (const m of line.matchAll(stepRegex)) {
                const n = m[1];
                const resolves = file.lines.some((l) => new RegExp(`^${n}\\.\\s`).test(l));
                if (resolves) continue;
                findings.push({
                    file: file.rel, line: i + 1, snippet: snippet(line, m.index, m[0].length),
                    severity: 'warning',
                    reason: `Step ${n} reference does not resolve in this file`,
                });
            }
        }
    }
    return findings;
}

function checkCanonicalDrift(files) {
    const findings = [];
    const sentinelDriftRegex = /no\s+actionable\s+findings\s*,\s*gatekeeper\s+skipped/gi;
    // Only flag backticked title-case severity; bare 'Critical', 'High', etc. are
    // legitimate English adjectives in pack prose ('Critical Tool Parameter Gate').
    const backtickedSeverityRegex = /`(Critical|High|Medium|Low)`/g;
    const adversarialDriftRegex = /\badversarial[\s-]review\s+pre[\s-]push\b/gi;

    for (const file of files) {
        const mappingSections = findMappingSections(file.lines);
        const skipBacktickedSeverity = TITLE_CASE_SEVERITY_FILES.has(file.rel);
        for (let i = 0; i < file.lines.length; i += 1) {
            if (file.inCodeBlock[i]) continue;
            const line = file.lines[i];
            for (const m of line.matchAll(sentinelDriftRegex)) {
                findings.push({
                    file: file.rel, line: i + 1, snippet: snippet(line, m.index, m[0].length),
                    severity: 'error', expected: CANONICAL_SENTINEL,
                });
            }
            if (skipBacktickedSeverity) {
                // Backticked title-case severity is canonical in this file; skip the sub-check.
            } else {
                // Title-cased severity tokens are vocabulary citations (not drift) when
                // the line sits in a mapping section, carries a mapping arrow, enumerates
                // multiple title-cased tokens, or pairs the token with its UPPERCASE form.
                const inMappingSection = mappingSections.some((s) => i >= s.start && i < s.end);
                const hasMappingArrow = line.includes('→');
                const tokenCount = (line.match(/`(Critical|High|Medium|Low)`/g) || []).length;
                const isMultiVocab = tokenCount >= 2;
                for (const m of line.matchAll(backtickedSeverityRegex)) {
                    const upper = m[1].toUpperCase();
                    const hasUppercaseCompanion = new RegExp(`\\b${upper}\\b`).test(line);
                    if (hasUppercaseCompanion || inMappingSection || hasMappingArrow || isMultiVocab) continue;
                    findings.push({
                        file: file.rel, line: i + 1, snippet: snippet(line, m.index, m[0].length),
                        severity: 'warning', expected: `\`${upper}\``,
                    });
                }
            }
            for (const m of line.matchAll(adversarialDriftRegex)) {
                if (m[0] === CANONICAL_ADVERSARIAL_PREFIX) continue;
                findings.push({
                    file: file.rel, line: i + 1, snippet: snippet(line, m.index, m[0].length),
                    severity: 'warning', expected: CANONICAL_ADVERSARIAL_PREFIX,
                });
            }
        }
    }
    return findings;
}

function extractFrontmatterAgentRefs(lines) {
    const refs = [];
    if (lines.length === 0 || lines[0].trim() !== '---') return refs;
    let end = -1;
    for (let i = 1; i < lines.length; i += 1) {
        if (lines[i].trim() === '---') { end = i; break; }
    }
    if (end < 0) return refs;
    let inAgentsList = false;
    for (let i = 1; i < end; i += 1) {
        const trimmed = lines[i].trim();
        const singular = /^agent:\s*['"]?([a-z][a-z0-9-]+)['"]?\s*$/.exec(trimmed);
        if (singular) { refs.push({ name: singular[1], line: i + 1 }); inAgentsList = false; continue; }
        if (/^agents:\s*$/.test(trimmed)) { inAgentsList = true; continue; }
        if (inAgentsList) {
            const item = /^-\s*['"]?([a-z][a-z0-9-]+)['"]?\s*$/.exec(trimmed);
            if (item) { refs.push({ name: item[1], line: i + 1 }); continue; }
            if (/^[a-z][a-z0-9-]*:/i.test(trimmed)) inAgentsList = false;
        }
    }
    return refs;
}

function checkUnresolvedRefs(files, known) {
    const findings = [];
    const allEntities = new Set([...known.skills, ...known.agents]);
    const candidateList = [...allEntities];
    const backtickRegex = /`([a-z][a-z0-9-]+)`/g;
    for (const file of files) {
        for (const ref of extractFrontmatterAgentRefs(file.lines)) {
            if (allEntities.has(ref.name)) continue;
            const suggestion = closestMatch(ref.name, candidateList);
            findings.push({
                file: file.rel, line: ref.line, severity: 'error', name: ref.name,
                suggestion: suggestion && suggestion.distance <= 5 ? suggestion.name : null,
            });
        }
        for (let i = 0; i < file.lines.length; i += 1) {
            if (file.inCodeBlock[i]) continue;
            const line = file.lines[i];
            for (const m of line.matchAll(backtickRegex)) {
                const token = m[1];
                if (allEntities.has(token)) continue;
                if (!REFERENCE_SUFFIX.test(token)) continue;
                if (REFERENCE_WHITELIST.has(token)) continue;
                // Definition-list `token`: ... — the term is being defined, not invoked.
                if (/^\s*:/.test(line.slice(m.index + m[0].length))) continue;
                const suggestion = closestMatch(token, candidateList);
                findings.push({
                    file: file.rel, line: i + 1, severity: 'error', name: token,
                    suggestion: suggestion && suggestion.distance <= 5 ? suggestion.name : null,
                });
            }
        }
    }
    return findings;
}

const ORCHESTRATOR_REL = '.github/agents/agentic-engineering-orchestrator.agent.md';

const ORCHESTRATOR_SPEC_GATE_ANCHORS = [
    { anchor: '7a. Spec-first gate.', reason: 'spec-first gate step 7a missing from orchestrator' },
    { anchor: '7b. Spec-skip carve-out.', reason: 'spec-skip carve-out step 7b missing from orchestrator' },
    { anchor: '7c. Operator-provided spec.', reason: 'operator-provided-spec step 7c missing from orchestrator' },
    { anchor: '7d. Mid-review scope-amendment.', reason: 'mid-review scope-amendment step 7d missing from orchestrator' },
    { anchor: '- Spec status:', reason: 'Output Format `Spec status:` bullet missing from orchestrator' },
    { anchor: '9a. Architecture-first gate.', reason: 'architecture-first gate step 9a missing from orchestrator' },
    { anchor: '9b. Architecture-skip carve-out.', reason: 'architecture-skip carve-out step 9b missing from orchestrator' },
    { anchor: '9c. Operator-provided design.', reason: 'operator-provided-design step 9c missing from orchestrator' },
    { anchor: '- Architecture status:', reason: 'Output Format `Architecture status:` bullet missing from orchestrator' },
];

const NEUTERED_PREFIX_REGEX = /(deprecated:|removed:|replaced:)/i;

function stripHtmlCommentLine(line, inHtmlComment = false) {
    let stripped = '';
    let cursor = 0;
    let inComment = inHtmlComment;
    while (cursor < line.length) {
        if (inComment) {
            const close = line.indexOf('-->', cursor);
            if (close < 0) return { stripped, inHtmlComment: true };
            cursor = close + 3;
            inComment = false;
            continue;
        }
        const open = line.indexOf('<!--', cursor);
        if (open < 0) {
            stripped += line.slice(cursor);
            break;
        }
        stripped += line.slice(cursor, open);
        const close = line.indexOf('-->', open + 4);
        if (close < 0) return { stripped, inHtmlComment: true };
        cursor = close + 3;
    }
    return { stripped, inHtmlComment: inComment };
}

function stripHtmlCommentsFromLines(lines, inCodeBlock = []) {
    const strippedLines = [];
    let inHtmlComment = false;
    for (let i = 0; i < lines.length; i += 1) {
        if (!inHtmlComment && inCodeBlock[i]) {
            strippedLines.push(lines[i]);
            continue;
        }
        const result = stripHtmlCommentLine(lines[i], inHtmlComment);
        strippedLines.push(result.stripped);
        inHtmlComment = result.inHtmlComment;
    }
    return strippedLines;
}

function isNeuteredLine(stripped) {
    if (NEUTERED_PREFIX_REGEX.test(stripped)) return true;
    if (stripped.trim().startsWith('~~')) return true;
    return false;
}

function measureBodyContent(file, anchorLineIdx, htmlStrippedLines) {
    // Scan forward up to 20 lines or until next ## / ### heading or EOF, accumulating
    // non-blank, non-comment-only content. Strip leading list markers and quote markers
    // before measuring length.
    const lines = file.lines;
    const limit = Math.min(lines.length, anchorLineIdx + 1 + 20);
    let content = '';
    for (let i = anchorLineIdx + 1; i < limit; i += 1) {
        const raw = lines[i];
        if (/^##\s/.test(raw) || /^###\s/.test(raw)) break;
        if (file.inCodeBlock[i]) continue;
        const stripped = htmlStrippedLines[i];
        if (!stripped.trim()) continue;
        const cleaned = stripped.replace(/^[\s>*-]+/, '').trim();
        content += cleaned;
        if (content.replace(/\s+/g, '').length >= 50) break;
    }
    return content.replace(/\s+/g, '').length;
}

function checkOrchestratorSpecGateAnchors(files) {
    const findings = [];
    const orchestrator = files.find((f) => f.rel === ORCHESTRATOR_REL);
    if (!orchestrator) return findings;
    const htmlStrippedLines = stripHtmlCommentsFromLines(orchestrator.lines, orchestrator.inCodeBlock);
    for (const { anchor, reason } of ORCHESTRATOR_SPEC_GATE_ANCHORS) {
        let foundLine = -1;
        for (let i = 0; i < orchestrator.lines.length; i += 1) {
            if (orchestrator.inCodeBlock[i]) continue;
            const stripped = htmlStrippedLines[i];
            if (!stripped.trim()) continue;
            if (!stripped.includes(anchor)) continue;
            if (isNeuteredLine(stripped)) continue;
            foundLine = i;
            break;
        }
        if (foundLine < 0) {
            findings.push({ file: orchestrator.rel, line: 0, severity: 'error', anchor, reason });
            continue;
        }
        const bodyLen = measureBodyContent(orchestrator, foundLine, htmlStrippedLines);
        if (bodyLen < 50) {
            findings.push({
                file: orchestrator.rel, line: foundLine + 1, severity: 'error', anchor,
                reason: `${reason}; body content under anchor is empty or too short`,
            });
        }
    }
    return findings;
}

const CANONICAL_SECTIONS = [
    { producer: '.github/agents/spec-agent.agent.md', section: 'Functional requirements' },
    { producer: '.github/agents/spec-agent.agent.md', section: 'Acceptance criteria' },
    { producer: '.github/agents/spec-agent.agent.md', section: 'Interfaces and data shapes' },
    { producer: '.github/agents/spec-agent.agent.md', section: 'Edge cases and error scenarios' },
    { producer: '.github/agents/spec-agent.agent.md', section: 'Inputs from upstream context' },
    { producer: '.github/agents/architect-agent.agent.md', section: 'Recommended design' },
    { producer: '.github/agents/architect-agent.agent.md', section: 'Files or modules affected' },
    { producer: '.github/agents/architect-agent.agent.md', section: 'Interfaces and data shapes' },
    { producer: '.github/agents/architect-agent.agent.md', section: 'State transitions and failure modes' },
    { producer: '.github/agents/architect-agent.agent.md', section: 'Verification plan' },
];

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSectionPatterns(sections) {
    return [...sections]
        .sort((a, b) => b.length - a.length || a.localeCompare(b))
        .map((section) => ({
            section,
            regex: new RegExp(`(?<![A-Za-z0-9-])${escapeRegExp(section)}(?![A-Za-z0-9-])`, 'gi'),
        }));
}

function overlapsRange(start, end, ranges) {
    return ranges.some((range) => start < range.end && end > range.start);
}

function checkSectionNameDrift(files) {
    const findings = [];
    const fileByRel = new Map(files.map((f) => [f.rel, f]));

    // 1. Producer presence: each canonical section name MUST appear (case-sensitive)
    //    in its producer file, outside fenced code blocks.
    const sectionsByProducer = new Map();
    for (const entry of CANONICAL_SECTIONS) {
        if (!sectionsByProducer.has(entry.producer)) sectionsByProducer.set(entry.producer, new Set());
        sectionsByProducer.get(entry.producer).add(entry.section);
    }
    for (const [producerRel, sections] of sectionsByProducer) {
        const producer = fileByRel.get(producerRel);
        if (!producer) continue;
        for (const section of sections) {
            let present = false;
            for (let i = 0; i < producer.lines.length; i += 1) {
                if (producer.inCodeBlock[i]) continue;
                if (producer.lines[i].includes(section)) { present = true; break; }
            }
            if (!present) {
                findings.push({
                    severity: 'error', file: producerRel, line: 0,
                    reason: `canonical section "${section}" missing from producer`,
                });
            }
        }
    }

    // 2. Drift: across all pack files, find boundary-aware case-insensitive
    //    matches of each canonical section name where the actual text is NOT
    //    case-sensitive-equal. Longest-match ordering and overlap tracking keep
    //    shorter names from matching inside a longer or hyphenated phrase such as
    //    "Non-functional requirements".
    const uniqueSections = new Set(CANONICAL_SECTIONS.map((e) => e.section));
    const patterns = buildSectionPatterns(uniqueSections);
    for (const file of files) {
        for (let i = 0; i < file.lines.length; i += 1) {
            if (file.inCodeBlock[i]) continue;
            const line = file.lines[i];
            const matchedRanges = [];
            for (const { section, regex } of patterns) {
                regex.lastIndex = 0;
                for (const m of line.matchAll(regex)) {
                    const start = m.index;
                    const end = start + m[0].length;
                    if (overlapsRange(start, end, matchedRanges)) continue;
                    matchedRanges.push({ start, end });
                    if (m[0] === section) continue;
                    findings.push({
                        severity: 'error', file: file.rel, line: i + 1,
                        reason: `section name drift: found "${m[0]}" expected canonical "${section}"`,
                    });
                }
            }
        }
    }
    return findings;
}

function severitySymbol(sev) {
    return sev === 'error' ? '✗' : sev === 'warning' ? '⚠' : 'ℹ';
}

function reportCheck(label, findings, formatter) {
    console.log(label);
    if (findings.length === 0) { console.log('  ✓ No issues found'); return; }
    for (const f of findings) formatter(f);
}

function printResults(check1, check2, check3, check4, check5, strict, scanStats) {
    console.log('Pack lint results');
    console.log('=================');
    console.log();
    reportCheck('Check 1: Stale numbered cross-references', check1, (f) => {
        console.log(`  ${severitySymbol(f.severity)} ${f.file}:${f.line} — ${f.snippet}`);
        console.log(`    Reason: ${f.reason}`);
    });
    console.log();
    reportCheck('Check 2: Canonical-string drift', check2, (f) => {
        console.log(`  ${severitySymbol(f.severity)} ${f.file}:${f.line} — ${f.snippet}`);
        console.log(`    Expected: ${f.expected}`);
        console.log(`    Severity: ${f.severity}`);
    });
    console.log();
    reportCheck('Check 3: Cross-file reference resolution', check3, (f) => {
        console.log(`  ${severitySymbol(f.severity)} ${f.file}:${f.line} — unresolved reference \`${f.name}\``);
        console.log(f.suggestion ? `    Suggestion: did you mean \`${f.suggestion}\`?` : '    Suggestion: (no close match found)');
    });
    console.log();
    reportCheck('Check 4: Orchestrator gate anchors', check4, (f) => {
        const loc = f.line ? `${f.file}:${f.line}` : f.file;
        console.log(`  ${severitySymbol(f.severity)} ${loc} — anchor: ${f.anchor}`);
        console.log(`    Reason: ${f.reason}`);
    });
    console.log();
    reportCheck('Check 5: Producer ↔ consumer section-name consistency', check5, (f) => {
        const loc = f.line ? `${f.file}:${f.line}` : f.file;
        console.log(`  ${severitySymbol(f.severity)} ${loc}`);
        console.log(`    Reason: ${f.reason}`);
    });
    console.log();

    const all = [...check1, ...check2, ...check3, ...check4, ...check5];
    const errors = all.filter((f) => f.severity === 'error').length;
    const warnings = all.filter((f) => f.severity === 'warning').length;
    const issueFiles = new Set(all.map((f) => f.file)).size;

    console.log('Summary');
    console.log('-------');
    console.log(`Scanned markdown files: ${scanStats.scannedFiles}`);
    console.log(`Scanned roots: ${scanStats.scannedRoots.length ? scanStats.scannedRoots.join(', ') : '(none)'}`);
    if (scanStats.skippedRoots.length) {
        console.log(`Skipped roots: ${scanStats.skippedRoots.join(', ')}`);
    }
    console.log(`${all.length} issues found across ${issueFiles} file${issueFiles === 1 ? '' : 's'}.`);
    console.log(`Errors: ${errors}, Warnings: ${warnings}`);

    let exitCode = 0;
    let exitReason = 'clean';
    if (errors > 0) { exitCode = 1; exitReason = 'errors present'; }
    else if (strict && warnings > 0) { exitCode = 1; exitReason = '--strict: warnings count as errors'; }
    console.log(`Exit: ${exitCode} (${exitReason})`);
    return exitCode;
}

async function main() {
    let options;
    try {
        options = parseArgs(process.argv.slice(2));
    } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        printHelp();
        process.exit(1);
    }
    if (options.help) { printHelp(); process.exit(0); }

    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = await findRepoRoot(scriptDir);
    const scanResult = await walkMarkdownFiles(repoRoot);
    const files = await loadFiles(scanResult.files);
    const known = await buildKnownEntities(repoRoot);

    const check1 = checkStaleNumericRefs(files);
    const check2 = checkCanonicalDrift(files);
    const check3 = checkUnresolvedRefs(files, known);
    const check4 = checkOrchestratorSpecGateAnchors(files);
    const check5 = checkSectionNameDrift(files);

    process.exit(printResults(
        check1,
        check2,
        check3,
        check4,
        check5,
        options.strict,
        {
            scannedFiles: scanResult.files.length,
            scannedRoots: scanResult.scannedRoots,
            skippedRoots: scanResult.skippedRoots,
        },
    ));
}

export {
    ORCHESTRATOR_REL,
    ORCHESTRATOR_SPEC_GATE_ANCHORS,
    annotateCodeBlocks,
    checkOrchestratorSpecGateAnchors,
    stripHtmlCommentLine,
    stripHtmlCommentsFromLines,
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    main().catch((err) => {
        console.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    });
}
