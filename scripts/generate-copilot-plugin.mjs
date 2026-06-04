#!/usr/bin/env node

import { copyFile, lstat, mkdir, readdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const defaultOut = path.join('dist', 'agentic-engineering-pack');

function resolveOutputPath(value) {
    return path.isAbsolute(value) ? path.resolve(value) : path.resolve(repoRoot, value);
}

function usage() {
    return `Generate an installable Copilot plugin bundle.

Usage:
  node scripts/generate-copilot-plugin.mjs [--out <path>] [--clean]

Options:
  --out <path>  Output directory. Defaults to ${defaultOut}
  --clean       Remove the output directory before generation.
  --help        Show this help message.
`;
}

function parseArgs(argv) {
    const options = { clean: false, out: resolveOutputPath(defaultOut) };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--clean') {
            options.clean = true;
        }
        else if (arg === '--help' || arg === '-h') {
            options.help = true;
        }
        else if (arg === '--out') {
            const value = argv[index + 1];
            if (!value || value.startsWith('--')) {
                throw new Error('--out requires a path value.');
            }
            options.out = resolveOutputPath(value);
            index += 1;
        }
        else if (arg.startsWith('--out=')) {
            options.out = resolveOutputPath(arg.slice('--out='.length));
        }
        else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return options;
}

function generatedGuideText(text) {
    return text
        .replaceAll('All customizations live under `.github/` at the workspace level.', 'Generated package customizations live under package root directories such as `agents/`, `skills/`, and `commands/`.')
        .replaceAll('Prompt files in `.github/prompts/*.prompt.md` are converted into plugin command files under `commands/`, because prompts are not plugin components.', 'Prompt command files live under `commands/`, converted from source prompt files because prompts are not plugin components.')
        .replaceAll('../../agentic-engineering/agents/', '../../agents/')
        .replaceAll('../../agentic-engineering/skills/', '../../skills/')
        .replaceAll('../../agentic-engineering/prompts/', '../../commands/')
        .replaceAll('../../.github/agents/', '../../agents/')
        .replaceAll('../../.github/skills/', '../../skills/')
        .replaceAll('../../.github/prompts/', '../../commands/');
}

function generatedRootReadmeText(text) {
    return text
        .replaceAll('All generated customization content is in English and lives at the workspace level under `.github/`.', 'Generated customization content is in English and lives in package root directories such as `agents/`, `skills/`, and `commands/`.')
        .replaceAll('Prompt files in `.github/prompts/*.prompt.md` are converted into plugin command files under `commands/` because prompts are not plugin components.', 'Prompt command files live under `commands/`, converted from source prompt files because prompts are not plugin components.')
        .replaceAll('`.github/agents/', '`agents/')
        .replaceAll('`.github/skills/', '`skills/')
        .replaceAll('`.github/prompts/', '`commands/')
        .replaceAll('in `.github/skills/', 'in `skills/')
        .replaceAll('live in `.github/skills/', 'live in `skills/');
}

function pathContains(parent, child) {
    const relative = path.relative(parent, child);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function pathsOverlap(left, right) {
    return pathContains(left, right) || pathContains(right, left);
}

function addBroadRoot(broadRoots, rootPath, reason) {
    if (rootPath) {
        broadRoots.set(path.resolve(rootPath), reason);
    }
}

function commonBroadOutputRoots() {
    const broadRoots = new Map();

    addBroadRoot(broadRoots, tmpdir(), 'the system temporary directory');
    addBroadRoot(broadRoots, homedir(), 'the user home directory');

    const homeParent = path.dirname(homedir());
    if (homeParent && homeParent !== homedir()) {
        addBroadRoot(broadRoots, homeParent, 'the user home parent directory');
    }

    if (process.platform === 'win32') {
        for (const candidate of [
            process.env.SystemDrive,
            process.env.ProgramData,
            process.env.ProgramFiles,
            process.env['ProgramFiles(x86)'],
            process.env.PUBLIC,
            process.env.USERPROFILE,
        ]) {
            addBroadRoot(broadRoots, candidate, 'a common broad system or user directory');
        }
        return broadRoots;
    }

    for (const candidate of [
        '/tmp',
        '/var/tmp',
        '/private/tmp',
        '/home',
        '/Users',
        '/root',
        '/usr',
        '/var',
        '/etc',
        '/bin',
        '/sbin',
        '/lib',
        '/lib64',
        '/opt',
        '/dev',
        '/proc',
        '/sys',
        '/run',
        '/mnt',
        '/media',
        '/srv',
    ]) {
        addBroadRoot(broadRoots, candidate, 'a common broad system or user directory');
    }

    return broadRoots;
}

function broadOutputRootReason(outputRoot) {
    const resolvedOutputRoot = path.resolve(outputRoot);
    const filesystemRoot = path.parse(resolvedOutputRoot).root;

    if (resolvedOutputRoot === filesystemRoot) {
        return `is the filesystem root ${filesystemRoot}`;
    }

    return commonBroadOutputRoots().get(resolvedOutputRoot) ?? null;
}

async function lstatIfExists(filePath) {
    try {
        return await lstat(filePath);
    }
    catch (error) {
        if (error?.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

async function realpathIfExists(filePath) {
    try {
        return path.resolve(await realpath(filePath));
    }
    catch (error) {
        if (error?.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

const allowedInRepoOutputRoots = [
    path.join(repoRoot, 'dist'),
].map((sourcePath) => path.resolve(sourcePath));

function isAllowedInRepoOutputPath(resolvedOutputRoot) {
    return allowedInRepoOutputRoots.some((allowedRoot) => pathContains(allowedRoot, resolvedOutputRoot));
}

async function repoControlledTopLevelPaths() {
    const entries = await readdir(repoRoot, { withFileTypes: true });
    return entries
        .filter((entry) => entry.name !== '.git')
        .map((entry) => path.resolve(repoRoot, entry.name))
        .filter((sourcePath) => !allowedInRepoOutputRoots.some((allowedRoot) => pathsOverlap(sourcePath, allowedRoot)));
}

const staticProtectedSourcePaths = [
    path.join(repoRoot, 'agentic-engineering'),
    path.join(repoRoot, '.github', 'prompts'),
    path.join(repoRoot, '.github', 'plugin'),
    path.join(repoRoot, 'README.md'),
    path.join(repoRoot, 'LICENSE'),
    path.join(repoRoot, 'agentic-engineering', 'plugin.json'),
    path.join(repoRoot, 'scripts'),
].map((sourcePath) => path.resolve(sourcePath));

async function protectedSourcePaths() {
    return [...new Set([
        ...await repoControlledTopLevelPaths(),
        ...staticProtectedSourcePaths,
    ])];
}

async function protectedSourcePathAliases() {
    const aliases = new Set([repoRoot, ...await protectedSourcePaths()]);

    for (const sourcePath of [...aliases]) {
        const sourceRealPath = await realpathIfExists(sourcePath);
        if (sourceRealPath) {
            aliases.add(sourceRealPath);
        }
    }

    return [...aliases];
}

function fileIdentity(fileInfo) {
    return `${fileInfo.dev}:${fileInfo.ino}`;
}

async function collectProtectedSourceFileIdentities(sourcePath, identities, seenDirectories) {
    let sourceInfo;
    try {
        sourceInfo = await stat(sourcePath);
    }
    catch (error) {
        if (error?.code === 'ENOENT') {
            return;
        }
        throw error;
    }

    if (sourceInfo.isFile()) {
        const identity = fileIdentity(sourceInfo);
        if (!identities.has(identity)) {
            identities.set(identity, sourcePath);
        }
        return;
    }

    if (!sourceInfo.isDirectory()) {
        return;
    }

    const sourceRealPath = await realpathIfExists(sourcePath) ?? path.resolve(sourcePath);
    if (seenDirectories.has(sourceRealPath)) {
        return;
    }
    seenDirectories.add(sourceRealPath);

    const entries = await readdir(sourcePath, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
        await collectProtectedSourceFileIdentities(path.join(sourcePath, entry.name), identities, seenDirectories);
    }
}

async function protectedSourceFileIdentities() {
    const identities = new Map();
    const seenDirectories = new Set();

    for (const sourcePath of await protectedSourcePaths()) {
        await collectProtectedSourceFileIdentities(sourcePath, identities, seenDirectories);
    }

    return identities;
}

async function symlinkRealpathCandidates(resolvedOutputRoot) {
    const root = path.parse(resolvedOutputRoot).root;
    const parts = path.relative(root, resolvedOutputRoot).split(path.sep).filter(Boolean);
    const candidates = [];
    let currentPath = root;
    let deepestExistingPath = root;
    let remainingParts = [];

    for (let index = 0; index < parts.length; index += 1) {
        currentPath = path.join(currentPath, parts[index]);
        const pathInfo = await lstatIfExists(currentPath);

        if (!pathInfo) {
            remainingParts = parts.slice(index);
            break;
        }

        deepestExistingPath = currentPath;

        if (pathInfo.isSymbolicLink()) {
            candidates.push({
                sourcePath: currentPath,
                realPath: path.resolve(await realpath(currentPath)),
            });
        }
    }

    if (candidates.length === 0) {
        return [];
    }

    candidates.push({
        sourcePath: resolvedOutputRoot,
        realPath: path.resolve(await realpath(deepestExistingPath), ...remainingParts),
    });

    return candidates;
}

function assertNoProtectedOverlap(resolvedOutputRoot, candidatePath, protectedPaths, sourcePath) {
    for (const protectedPath of protectedPaths) {
        if (pathsOverlap(candidatePath, protectedPath)) {
            throw new Error(`Refusing dangerous --out path: ${resolvedOutputRoot} resolves through ${sourcePath} to ${candidatePath}, which overlaps protected source path ${protectedPath}.`);
        }
    }
}

async function assertSafeOutputRoot(outputRoot) {
    const resolvedOutputRoot = path.resolve(outputRoot);
    const broadRootReason = broadOutputRootReason(resolvedOutputRoot);

    if (broadRootReason) {
        throw new Error(`Refusing dangerous --out path: ${resolvedOutputRoot} ${broadRootReason}. Use a narrow output directory such as ${path.resolve(repoRoot, defaultOut)}.`);
    }

    if (pathContains(resolvedOutputRoot, repoRoot)) {
        throw new Error(`Refusing dangerous --out path: ${resolvedOutputRoot} would contain the repository root ${repoRoot}.`);
    }

    if (pathContains(repoRoot, resolvedOutputRoot) && !isAllowedInRepoOutputPath(resolvedOutputRoot)) {
        throw new Error(`Refusing dangerous --out path: ${resolvedOutputRoot} is inside the repository but outside the allowed generated output root ${allowedInRepoOutputRoots[0]}.`);
    }

    for (const sourcePath of await protectedSourcePaths()) {
        if (pathsOverlap(resolvedOutputRoot, sourcePath)) {
            throw new Error(`Refusing dangerous --out path: ${resolvedOutputRoot} overlaps protected source path ${sourcePath}.`);
        }
    }

    const protectedPathAliases = await protectedSourcePathAliases();
    for (const { sourcePath, realPath } of await symlinkRealpathCandidates(resolvedOutputRoot)) {
        assertNoProtectedOverlap(resolvedOutputRoot, realPath, protectedPathAliases, sourcePath);
    }

    const outputRootInfo = await lstatIfExists(resolvedOutputRoot);
    if (outputRootInfo?.isSymbolicLink()) {
        throw new Error(`Refusing dangerous --out path: ${resolvedOutputRoot} is a symlinked output root.`);
    }
}

async function copyTreeTargetPaths(source, target) {
    const sourceInfo = await stat(source);
    const targetPaths = [target];

    if (sourceInfo.isDirectory()) {
        const entries = await readdir(source, { withFileTypes: true });
        entries.sort((left, right) => left.name.localeCompare(right.name));

        for (const entry of entries) {
            targetPaths.push(...await copyTreeTargetPaths(path.join(source, entry.name), path.join(target, entry.name)));
        }
    }

    return targetPaths;
}

async function copyIfExistsTargetPaths(source, target) {
    return await exists(source) ? await copyTreeTargetPaths(source, target) : [];
}

async function commandTargetPaths(outputRoot) {
    const promptRoots = [
        path.join(repoRoot, 'agentic-engineering', 'prompts'),
        path.join(repoRoot, '.github', 'prompts'),
    ];
    const commandRoot = path.join(outputRoot, 'commands');
    const targetPaths = [commandRoot];

    for (const promptRoot of promptRoots) {
        if (!(await exists(promptRoot))) {
            continue;
        }

        const entries = await readdir(promptRoot, { withFileTypes: true });
        entries.sort((left, right) => left.name.localeCompare(right.name));

        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.prompt.md')) {
                targetPaths.push(...await copyTreeTargetPaths(path.join(promptRoot, entry.name), path.join(commandRoot, entry.name)));
            }
        }
    }

    return targetPaths;
}

async function plannedOutputTargetPaths(outputRoot) {
    return [
        path.join(outputRoot, 'docs', 'agentic'),
        path.join(outputRoot, 'README.md'),
        path.join(outputRoot, 'marketplace.json'),
        path.join(outputRoot, 'plugin.json'),
        path.join(outputRoot, 'agentic-engineering', 'plugin.json'),
        path.join(outputRoot, 'agentic-engineering', 'shared'),
        path.join(outputRoot, 'agentic-engineering', 'docs'),
        path.join(outputRoot, 'agents'),
        path.join(outputRoot, 'skills'),
        path.join(outputRoot, 'commands'),
        ...await copyTreeTargetPaths(path.join(repoRoot, 'README.md'), path.join(outputRoot, 'README.md')),
        ...await copyIfExistsTargetPaths(path.join(repoRoot, '.github', 'plugin', 'marketplace.json'), path.join(outputRoot, 'marketplace.json')),
        ...await copyTreeTargetPaths(path.join(repoRoot, 'agentic-engineering', 'plugin.json'), path.join(outputRoot, 'plugin.json')),
        ...await copyTreeTargetPaths(path.join(repoRoot, 'agentic-engineering', 'plugin.json'), path.join(outputRoot, 'agentic-engineering', 'plugin.json')),
        ...await copyTreeTargetPaths(path.join(repoRoot, 'agentic-engineering', 'shared'), path.join(outputRoot, 'agentic-engineering', 'shared')),
        ...await copyTreeTargetPaths(path.join(repoRoot, 'agentic-engineering', 'docs'), path.join(outputRoot, 'agentic-engineering', 'docs')),
        ...await copyTreeTargetPaths(path.join(repoRoot, 'agentic-engineering', 'agents'), path.join(outputRoot, 'agents')),
        ...await copyTreeTargetPaths(path.join(repoRoot, 'agentic-engineering', 'skills'), path.join(outputRoot, 'skills')),
        ...await commandTargetPaths(outputRoot),
    ];
}

async function assertNoSymlinkTargetComponent(outputRoot, targetPath) {
    const resolvedOutputRoot = path.resolve(outputRoot);
    const resolvedTargetPath = path.resolve(targetPath);

    if (!pathContains(resolvedOutputRoot, resolvedTargetPath)) {
        throw new Error(`Refusing dangerous output path: ${resolvedTargetPath} is outside output root ${resolvedOutputRoot}.`);
    }

    const relativeTargetPath = path.relative(resolvedOutputRoot, resolvedTargetPath);
    if (relativeTargetPath === '') {
        return;
    }

    let currentPath = resolvedOutputRoot;
    for (const part of relativeTargetPath.split(path.sep).filter(Boolean)) {
        currentPath = path.join(currentPath, part);
        const pathInfo = await lstatIfExists(currentPath);

        if (!pathInfo) {
            return;
        }

        if (pathInfo.isSymbolicLink()) {
            throw new Error(`Refusing dangerous output path: ${resolvedTargetPath} has symlink component ${currentPath} under output root ${resolvedOutputRoot}.`);
        }
    }
}

async function assertNoProtectedHardlinkTarget(outputRoot, targetPath, protectedFileIdentities) {
    const resolvedOutputRoot = path.resolve(outputRoot);
    const resolvedTargetPath = path.resolve(targetPath);

    if (!pathContains(resolvedOutputRoot, resolvedTargetPath)) {
        throw new Error(`Refusing dangerous output path: ${resolvedTargetPath} is outside output root ${resolvedOutputRoot}.`);
    }

    const targetInfo = await lstatIfExists(resolvedTargetPath);
    if (!targetInfo?.isFile()) {
        return;
    }

    const protectedSourcePath = protectedFileIdentities.get(fileIdentity(targetInfo));
    if (protectedSourcePath) {
        throw new Error(`Refusing dangerous output path: ${resolvedTargetPath} is hard-linked to protected source path ${protectedSourcePath}.`);
    }
}

async function assertPlannedOutputTargetsSafe(outputRoot) {
    const protectedFileIdentities = await protectedSourceFileIdentities();

    for (const targetPath of await plannedOutputTargetPaths(outputRoot)) {
        await assertNoSymlinkTargetComponent(outputRoot, targetPath);
        await assertNoProtectedHardlinkTarget(outputRoot, targetPath, protectedFileIdentities);
    }
}

async function exists(filePath) {
    try {
        await stat(filePath);
        return true;
    }
    catch {
        return false;
    }
}

async function copyTree(source, target, transform = () => null, outputRoot = null) {
    if (outputRoot) {
        await assertNoSymlinkTargetComponent(outputRoot, target);
    }

    const sourceInfo = await stat(source);

    if (sourceInfo.isDirectory()) {
        await mkdir(target, { recursive: true });
        const entries = await readdir(source, { withFileTypes: true });
        entries.sort((left, right) => left.name.localeCompare(right.name));

        for (const entry of entries) {
            await copyTree(path.join(source, entry.name), path.join(target, entry.name), transform, outputRoot);
        }
        return;
    }

    await mkdir(path.dirname(target), { recursive: true });

    const transformed = await transform(source);
    if (transformed !== null) {
        await writeFile(target, transformed, 'utf8');
        return;
    }

    await copyFile(source, target);
}

async function copyIfExists(source, target, outputRoot = null) {
    if (await exists(source)) {
        await copyTree(source, target, undefined, outputRoot);
    }
}

async function copyCommands(outputRoot) {
    const promptRoots = [
        path.join(repoRoot, 'agentic-engineering', 'prompts'),
        path.join(repoRoot, '.github', 'prompts'),
    ];
    const commandRoot = path.join(outputRoot, 'commands');

    for (const promptRoot of promptRoots) {
        if (!(await exists(promptRoot))) {
            continue;
        }

        const entries = await readdir(promptRoot, { withFileTypes: true });
        entries.sort((left, right) => left.name.localeCompare(right.name));

        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.prompt.md')) {
                await copyTree(path.join(promptRoot, entry.name), path.join(commandRoot, entry.name), undefined, outputRoot);
            }
        }
    }
}

async function generate() {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
        console.log(usage());
        return;
    }

    const outputRoot = options.out;
    await assertSafeOutputRoot(outputRoot);
    await assertPlannedOutputTargetsSafe(outputRoot);

    if (options.clean) {
        await rm(outputRoot, { recursive: true, force: true });
    }

    await mkdir(outputRoot, { recursive: true });
    await assertPlannedOutputTargetsSafe(outputRoot);

    const staleGuideOutputPath = path.join(outputRoot, 'docs', 'agentic');
    await assertNoSymlinkTargetComponent(outputRoot, staleGuideOutputPath);
    await rm(staleGuideOutputPath, { recursive: true, force: true });

    await copyTree(
        path.join(repoRoot, 'README.md'),
        path.join(outputRoot, 'README.md'),
        async (source) => generatedRootReadmeText(await readFile(source, 'utf8')),
        outputRoot,
    );
    await copyIfExists(path.join(repoRoot, '.github', 'plugin', 'marketplace.json'), path.join(outputRoot, 'marketplace.json'), outputRoot);

    await copyTree(path.join(repoRoot, 'agentic-engineering', 'plugin.json'), path.join(outputRoot, 'plugin.json'), undefined, outputRoot);
    await copyTree(path.join(repoRoot, 'agentic-engineering', 'plugin.json'), path.join(outputRoot, 'agentic-engineering', 'plugin.json'), undefined, outputRoot);
    await copyTree(path.join(repoRoot, 'agentic-engineering', 'shared'), path.join(outputRoot, 'agentic-engineering', 'shared'), undefined, outputRoot);
    await copyTree(
        path.join(repoRoot, 'agentic-engineering', 'docs'),
        path.join(outputRoot, 'agentic-engineering', 'docs'),
        async (source) => {
            if (path.relative(path.join(repoRoot, 'agentic-engineering', 'docs'), source).split(path.sep).join('/') === 'README.md') {
                return generatedGuideText(await readFile(source, 'utf8'));
            }
            return null;
        },
        outputRoot,
    );

    await copyTree(path.join(repoRoot, 'agentic-engineering', 'agents'), path.join(outputRoot, 'agents'), undefined, outputRoot);
    await copyTree(path.join(repoRoot, 'agentic-engineering', 'skills'), path.join(outputRoot, 'skills'), undefined, outputRoot);
    await copyCommands(outputRoot);
}

export { assertSafeOutputRoot, broadOutputRootReason };

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    generate().catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}