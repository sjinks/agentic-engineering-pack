#!/usr/bin/env node

import { access, copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_OUT = 'dist/agentic-engineering-pack';
const DEFAULT_NAME = 'agentic-engineering-pack';
const DEFAULT_VERSION = '0.1.0';

/**
 * @typedef {object} Options
 * @property {string} out
 * @property {string} name
 * @property {string} version
 * @property {boolean} clean
 * @property {boolean} help
 */

/**
 * @typedef {object} ManifestContents
 * @property {string[]} agents
 * @property {string[]} skills
 * @property {string[]} commands
 * @property {string[]} docs
 * @property {string[]} installNotes
 */

/**
 * @typedef {object} PluginJson
 * @property {string} name
 * @property {string} description
 * @property {string} version
 * @property {{ name: string }} author
 */

function printHelp() {
  console.log(`Generate a Copilot CLI installable plugin directory from this repository.

Usage:
  node scripts/generate-copilot-plugin.mjs [options]

Options:
  --out <dir>       Output directory (default: ${DEFAULT_OUT})
  --name <name>     Plugin name (default: ${DEFAULT_NAME})
  --version <ver>   Plugin version (default: ${DEFAULT_VERSION})
  --clean           Remove output directory before generating
  --help            Show this help message
`);
}

/**
 * @param {string[]} argv
 * @returns {Options}
 */
function parseArgs(argv) {
  /** @type {Options} */
  const options = {
    out: DEFAULT_OUT,
    name: DEFAULT_NAME,
    version: DEFAULT_VERSION,
    clean: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--out') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --out');
      }
      options.out = value;
      i += 1;
      continue;
    }

    if (arg === '--name') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --name');
      }
      options.name = value;
      i += 1;
      continue;
    }

    if (arg === '--version') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --version');
      }
      options.version = value;
      i += 1;
      continue;
    }

    if (arg === '--clean') {
      options.clean = true;
      continue;
    }

    if (arg === '--help') {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

/**
 * @param {string} relativePath
 * @returns {string}
 */
function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

/**
 * @param {string} targetPath
 * @returns {Promise<boolean>}
 */
async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} sourceRoot
 * @param {string} destinationRoot
 * @param {string} outputRoot
 * @param {string[]=} collectedFiles
 * @returns {Promise<number>}
 */
async function copyRecursive(sourceRoot, destinationRoot, outputRoot, collectedFiles) {
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  let copied = 0;

  for (const entry of entries) {
    const sourcePath = path.join(sourceRoot, entry.name);
    const destinationPath = path.join(destinationRoot, entry.name);

    if (entry.isDirectory()) {
      copied += await copyRecursive(sourcePath, destinationPath, outputRoot, collectedFiles);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    await mkdir(path.dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
    copied += 1;

    if (collectedFiles) {
      collectedFiles.push(toPosix(path.relative(outputRoot, destinationPath)));
    }
  }

  return copied;
}

/**
 * @param {string} repoRoot
 * @param {string} outputRoot
 * @param {string} sourceRelative
 * @param {string} destinationRelative
 * @param {string[]=} collectedFiles
 * @returns {Promise<number>}
 */
async function copyTreeIfPresent(repoRoot, outputRoot, sourceRelative, destinationRelative, collectedFiles) {
  const sourcePath = path.join(repoRoot, sourceRelative);
  if (!(await pathExists(sourcePath))) {
    return 0;
  }

  const destinationPath = path.join(outputRoot, destinationRelative);
  await mkdir(destinationPath, { recursive: true });
  return copyRecursive(sourcePath, destinationPath, outputRoot, collectedFiles);
}

/**
 * @param {string} repoRoot
 * @param {string} outputRoot
 * @param {string} sourceRelative
 * @param {string} destinationRelative
 * @returns {Promise<number>}
 */
async function copyFileIfPresent(repoRoot, outputRoot, sourceRelative, destinationRelative) {
  const sourcePath = path.join(repoRoot, sourceRelative);
  if (!(await pathExists(sourcePath))) {
    return 0;
  }

  const destinationPath = path.join(outputRoot, destinationRelative);
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
  return 1;
}

/**
 * @param {string} markdown
 * @returns {string}
 */
function stripFrontmatter(markdown) {
  if (!markdown.startsWith('---\n') && !markdown.startsWith('---\r\n')) {
    return markdown;
  }

  const normalized = markdown.replace(/\r\n/g, '\n');
  const closingIndex = normalized.indexOf('\n---\n', 4);

  if (closingIndex < 0) {
    return markdown;
  }

  return normalized.slice(closingIndex + '\n---\n'.length);
}

/**
 * @param {string} markdown
 * @param {Set<string>} generatedCommands
 * @returns {string}
 */
function rewriteGuideLinksForPackage(markdown, generatedCommands) {
  return markdown
    .replaceAll('](../../agentic-engineering/agents/', '](../../agents/')
    .replaceAll('](../../agentic-engineering/skills/', '](../../skills/')
    .replaceAll('](../../.github/agents/', '](../../agents/')
    .replaceAll('](../../.github/skills/', '](../../skills/')
    .replace(
      /\[([^\]]+)\]\(\.\.\/\.\.\/\.github\/prompts\/([^/)#]+)\.prompt\.md(#[^)]*)?\)/g,
      (match, label, promptName, fragment = '') => {
        const commandRelative = `commands/${promptName}.md`;
        if (!generatedCommands.has(commandRelative)) {
          return label;
        }

        return `[${label}](../../${commandRelative}${fragment})`;
      },
    );
}

/**
 * @param {string} outputRoot
 * @param {Set<string>} generatedCommands
 * @returns {Promise<void>}
 */
async function rewriteGeneratedGuideIfPresent(outputRoot, generatedCommands) {
  const guidePath = path.join(outputRoot, 'agentic-engineering/docs/README.md');
  if (!(await pathExists(guidePath))) {
    return;
  }

  const markdown = await readFile(guidePath, 'utf8');
  await writeFile(guidePath, rewriteGuideLinksForPackage(markdown, generatedCommands), 'utf8');
}

/**
 * @param {string} repoRoot
 * @param {string} outputRoot
 * @param {string[]} collectedFiles
 * @returns {Promise<number>}
 */
async function convertPromptsToCommands(repoRoot, outputRoot, collectedFiles) {
  const promptsDir = path.join(repoRoot, '.github/prompts');
  if (!(await pathExists(promptsDir))) {
    return 0;
  }

  const entries = await readdir(promptsDir, { withFileTypes: true });
  let converted = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.prompt.md')) {
      continue;
    }

    const sourcePath = path.join(promptsDir, entry.name);
    const sourceRelative = toPosix(path.relative(repoRoot, sourcePath));
    const baseName = entry.name.slice(0, -'.prompt.md'.length);
    const commandRelative = path.posix.join('commands', `${baseName}.md`);
    const destinationPath = path.join(outputRoot, commandRelative);

    const rawPrompt = await readFile(sourcePath, 'utf8');
    const body = stripFrontmatter(rawPrompt).trimStart();
    const commandBody = `<!-- Generated from ${sourceRelative} -->\n\n${body}`;

    await mkdir(path.dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, `${commandBody}\n`, 'utf8');

    converted += 1;
    collectedFiles.push(commandRelative);
  }

  return converted;
}

async function main() {
  /** @type {Options} */
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }

  const repoRoot = process.cwd();
  const outputRoot = path.resolve(repoRoot, options.out);

  if (options.clean) {
    await rm(outputRoot, { recursive: true, force: true });
  }

  await mkdir(outputRoot, { recursive: true });
  await rm(path.join(outputRoot, 'docs/agentic'), { recursive: true, force: true });

  /** @type {ManifestContents} */
  const manifestContents = {
    agents: [],
    skills: [],
    commands: [],
    docs: [],
    installNotes: [
      'Install with: copilot plugin install ./dist/agentic-engineering-pack',
      'Some environments also support: /plugin install ./dist/agentic-engineering-pack',
      'commands/ content is generated from .github/prompts/*.prompt.md',
    ],
  };

  let copiedFiles = 0;

  copiedFiles += await copyTreeIfPresent(
    repoRoot,
    outputRoot,
    'agentic-engineering/agents',
    'agents',
    manifestContents.agents,
  );

  copiedFiles += await copyTreeIfPresent(
    repoRoot,
    outputRoot,
    'agentic-engineering/skills',
    'skills',
    manifestContents.skills,
  );

  copiedFiles += await convertPromptsToCommands(repoRoot, outputRoot, manifestContents.commands);

  copiedFiles += await copyTreeIfPresent(
    repoRoot,
    outputRoot,
    'agentic-engineering/docs',
    'agentic-engineering/docs',
    manifestContents.docs,
  );

  copiedFiles += await copyTreeIfPresent(
    repoRoot,
    outputRoot,
    'agentic-engineering/shared',
    'agentic-engineering/shared',
  );

  await rewriteGeneratedGuideIfPresent(outputRoot, new Set(manifestContents.commands));

  copiedFiles += await copyFileIfPresent(repoRoot, outputRoot, 'README.md', 'README.md');

  /** @type {PluginJson} */
  const pluginJson = {
    name: options.name,
    description: 'Agentic engineering workflow pack.',
    version: options.version,
    author: { name: 'Agentic Engineering Pack' },
  };

  const pluginJsonPath = path.join(outputRoot, 'plugin.json');
  await writeFile(pluginJsonPath, `${JSON.stringify(pluginJson, null, 2)}\n`, 'utf8');

  const relativeOutput = toPosix(path.relative(repoRoot, outputRoot) || '.');
  const relativePluginJson = toPosix(path.relative(repoRoot, pluginJsonPath));

  console.log(`Output: ${relativeOutput}`);
  console.log(`Files copied: ${copiedFiles}`);
  console.log(`Plugin manifest: ${relativePluginJson}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to generate bundle: ${message}`);
  process.exitCode = 1;
});
