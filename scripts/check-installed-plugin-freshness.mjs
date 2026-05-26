#!/usr/bin/env node

import { readdir, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_DIST = 'dist/agentic-engineering-pack';
const DEFAULT_INSTALLED = path.join(os.homedir(), '.copilot/installed-plugins/_direct/agentic-engineering-pack');

/** @typedef {{ rel: string, type: 'file' | 'dir' }} ControlledPath */
/** @typedef {{ dist: string, installed: string, help?: boolean }} FreshnessOptions */

/** @type {ControlledPath[]} */
const CONTROLLED_PATHS = [
  { rel: 'plugin.json', type: 'file' },
  { rel: 'README.md', type: 'file' },
  { rel: '.github/plugin/plugin.json', type: 'file' },
  { rel: 'agents', type: 'dir' },
  { rel: 'skills', type: 'dir' },
  { rel: 'commands', type: 'dir' },
  { rel: 'docs', type: 'dir' },
];

function printHelp() {
  console.log(`Check that an installed Copilot plugin matches the generated dist tree.

Usage:
  node scripts/check-installed-plugin-freshness.mjs [options]

Options:
  --dist <dir>       Generated plugin directory (default: ${DEFAULT_DIST})
  --installed <dir>  Installed plugin root (default: ${DEFAULT_INSTALLED})
  --help             Show this help message

Controlled paths:
  plugin.json, README.md, .github/plugin/plugin.json, agents/, skills/, commands/, and docs/.
`);
}

/**
 * @param {string[]} argv
 * @returns {FreshnessOptions}
 */
function parseArgs(argv) {
  const options = {
    dist: DEFAULT_DIST,
    installed: DEFAULT_INSTALLED,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dist') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing value for --dist');
      options.dist = value;
      index += 1;
      continue;
    }

    if (arg === '--installed') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing value for --installed');
      options.installed = value;
      index += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
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
 * @param {unknown} error
 * @param {string} code
 * @returns {boolean}
 */
function hasErrorCode(error, code) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

/**
 * @param {string} targetPath
 * @returns {Promise<import('node:fs').Stats | null>}
 */
async function pathInfo(targetPath) {
  try {
    const info = await stat(targetPath);
    return info;
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) return null;
    throw error;
  }
}

/**
 * @param {string} rootPath
 * @param {string} [currentPath]
 * @returns {Promise<string[]>}
 */
async function collectFiles(rootPath, currentPath = rootPath) {
  const entries = await readdir(currentPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(rootPath, entryPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(toPosix(path.relative(rootPath, entryPath)));
    }
  }

  return files.sort();
}

/**
 * @param {string} distFile
 * @param {string} installedFile
 * @returns {Promise<boolean>}
 */
async function compareFileBytes(distFile, installedFile) {
  const [distBytes, installedBytes] = await Promise.all([
    readFile(distFile),
    readFile(installedFile),
  ]);
  return distBytes.equals(installedBytes);
}

/**
 * @param {string} distRoot
 * @param {string} installedRoot
 * @param {string} rel
 * @param {string[]} issues
 * @returns {Promise<void>}
 */
async function checkControlledFile(distRoot, installedRoot, rel, issues) {
  const distPath = path.join(distRoot, rel);
  const installedPath = path.join(installedRoot, rel);
  const distInfo = await pathInfo(distPath);
  const installedInfo = await pathInfo(installedPath);

  if (!distInfo) {
    if (installedInfo) issues.push(`Extra installed controlled path absent from dist: ${rel}`);
    return;
  }

  if (!distInfo.isFile()) {
    issues.push(`Dist controlled path is not a file: ${rel}`);
    return;
  }

  if (!installedInfo) {
    issues.push(`Missing installed file: ${rel}`);
    return;
  }

  if (!installedInfo.isFile()) {
    issues.push(`Installed controlled path is not a file: ${rel}`);
    return;
  }

  if (!(await compareFileBytes(distPath, installedPath))) {
    issues.push(`Content mismatch: ${rel}`);
  }
}

/**
 * @param {string} distRoot
 * @param {string} installedRoot
 * @param {string} rel
 * @param {string[]} issues
 * @returns {Promise<void>}
 */
async function checkControlledDirectory(distRoot, installedRoot, rel, issues) {
  const distPath = path.join(distRoot, rel);
  const installedPath = path.join(installedRoot, rel);
  const distInfo = await pathInfo(distPath);
  const installedInfo = await pathInfo(installedPath);

  if (!distInfo) {
    if (installedInfo) issues.push(`Extra installed controlled path absent from dist: ${rel}/`);
    return;
  }

  if (!distInfo.isDirectory()) {
    issues.push(`Dist controlled path is not a directory: ${rel}/`);
    return;
  }

  if (!installedInfo) {
    issues.push(`Missing installed directory: ${rel}/`);
    return;
  }

  if (!installedInfo.isDirectory()) {
    issues.push(`Installed controlled path is not a directory: ${rel}/`);
    return;
  }

  const [distFiles, installedFiles] = await Promise.all([
    collectFiles(distPath),
    collectFiles(installedPath),
  ]);
  const distSet = new Set(distFiles);
  const installedSet = new Set(installedFiles);

  for (const file of distFiles) {
    const relativeFile = `${rel}/${file}`;
    if (!installedSet.has(file)) {
      issues.push(`Missing installed file: ${relativeFile}`);
      continue;
    }

    const distFile = path.join(distPath, file);
    const installedFile = path.join(installedPath, file);
    if (!(await compareFileBytes(distFile, installedFile))) {
      issues.push(`Content mismatch: ${relativeFile}`);
    }
  }

  for (const file of installedFiles) {
    if (!distSet.has(file)) {
      issues.push(`Extra installed stale file: ${rel}/${file}`);
    }
  }
}

/**
 * @param {FreshnessOptions} options
 * @returns {Promise<string[]>}
 */
async function checkInstalledPluginFreshness(options) {
  const distRoot = path.resolve(options.dist);
  const installedRoot = path.resolve(options.installed);
  /** @type {string[]} */
  const issues = [];

  const distInfo = await pathInfo(distRoot);
  if (!distInfo) {
    issues.push(`Missing dist plugin root: ${distRoot}`);
    return issues;
  }
  if (!distInfo.isDirectory()) {
    issues.push(`Dist plugin root is not a directory: ${distRoot}`);
    return issues;
  }

  const installedInfo = await pathInfo(installedRoot);
  if (!installedInfo) {
    issues.push(`Missing installed plugin root: ${installedRoot}`);
    return issues;
  }
  if (!installedInfo.isDirectory()) {
    issues.push(`Installed plugin root is not a directory: ${installedRoot}`);
    return issues;
  }

  for (const controlledPath of CONTROLLED_PATHS) {
    if (controlledPath.type === 'file') {
      await checkControlledFile(distRoot, installedRoot, controlledPath.rel, issues);
    } else {
      await checkControlledDirectory(distRoot, installedRoot, controlledPath.rel, issues);
    }
  }

  return issues;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }

  const issues = await checkInstalledPluginFreshness(options);
  if (issues.length === 0) {
    console.log(`Installed plugin is fresh: ${path.resolve(options.installed)} matches ${path.resolve(options.dist)}`);
    return;
  }

  console.error('Installed plugin freshness check failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exitCode = 1;
}

export {
  CONTROLLED_PATHS,
  checkInstalledPluginFreshness,
  parseArgs,
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(`Fatal: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}