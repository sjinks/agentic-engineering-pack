import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkInstalledPluginFreshness } from '../scripts/check-installed-plugin-freshness.mjs';

async function makeTempRoot() {
  return mkdtemp(path.join(os.tmpdir(), 'agentic-plugin-freshness-'));
}

/**
 * @param {string} root
 * @param {string} relativePath
 * @param {string} contents
 */
async function write(root, relativePath, contents) {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents);
}

/**
 * @param {string} root
 * @param {Record<string, string | null>} [overrides]
 */
async function writeFixture(root, overrides = {}) {
  const files = {
    'plugin.json': '{"name":"agentic"}\n',
    'README.md': '# Agentic\n',
    '.github/plugin/plugin.json': '{"name":"agentic"}\n',
    'agents/builder-agent.agent.md': 'builder\n',
    'skills/workflow-safety-gates/SKILL.md': 'safety\n',
    'commands/run-linear-issue-workflow.md': 'linear command\n',
    'docs/agentic/README.md': 'docs\n',
    ...overrides,
  };

  for (const [relativePath, contents] of Object.entries(files)) {
    if (contents === null) continue;
    await write(root, relativePath, contents);
  }
}

/** @typedef {{ dist: string, installed: string }} FixturePaths */

/**
 * @param {(paths: FixturePaths) => Promise<void>} testBody
 */
async function withFixture(testBody) {
  const tempRoot = await makeTempRoot();
  try {
    const dist = path.join(tempRoot, 'dist');
    const installed = path.join(tempRoot, 'installed');
    await writeFixture(dist);
    await writeFixture(installed);
    await testBody({ dist, installed });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

test('fresh installed plugin passes', async () => {
  await withFixture(async ({ dist, installed }) => {
    const issues = await checkInstalledPluginFreshness({ dist, installed });

    assert.deepEqual(issues, []);
  });
});

test('content mismatch fails', async () => {
  await withFixture(async ({ dist, installed }) => {
    await write(installed, 'skills/workflow-safety-gates/SKILL.md', 'stale safety\n');

    const issues = await checkInstalledPluginFreshness({ dist, installed });

    assert.ok(issues.some((issue) => issue === 'Content mismatch: skills/workflow-safety-gates/SKILL.md'));
  });
});

test('extra stale installed file fails', async () => {
  await withFixture(async ({ dist, installed }) => {
    await write(installed, 'commands/old-workflow.md', 'old command\n');

    const issues = await checkInstalledPluginFreshness({ dist, installed });

    assert.ok(issues.some((issue) => issue === 'Extra installed stale file: commands/old-workflow.md'));
  });
});

test('missing installed file fails', async () => {
  await withFixture(async ({ dist, installed }) => {
    await rm(path.join(installed, 'docs/agentic/README.md'));

    const issues = await checkInstalledPluginFreshness({ dist, installed });

    assert.ok(issues.some((issue) => issue === 'Missing installed file: docs/agentic/README.md'));
  });
});

test('missing installed root fails', async () => {
  const tempRoot = await makeTempRoot();
  try {
    const dist = path.join(tempRoot, 'dist');
    const installed = path.join(tempRoot, 'missing-installed');
    await writeFixture(dist);

    const issues = await checkInstalledPluginFreshness({ dist, installed });

    assert.equal(issues.length, 1);
    assert.match(issues[0], /^Missing installed plugin root:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});