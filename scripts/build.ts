#!/usr/bin/env bun
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import pkg from '../package.json';
import { assetName } from '../src/version';

const ROOT = path.join(import.meta.dir, '..');
const OUT_DIR = path.join(ROOT, 'dist');

const TARGETS = [
  { platform: 'darwin', arch: 'arm64' },
  { platform: 'darwin', arch: 'x64' },
  { platform: 'linux', arch: 'x64' },
  { platform: 'linux', arch: 'arm64' },
  { platform: 'win32', arch: 'x64' },
];

function capture(cmd: string[]): string {
  const result = Bun.spawnSync({ cmd, cwd: ROOT, stdout: 'pipe', stderr: 'pipe' });
  return result.exitCode === 0 && result.stdout ? Buffer.from(result.stdout).toString('utf8').trim() : '';
}

function deriveRepoFromRemote(): string {
  const url = capture(['git', 'remote', 'get-url', 'origin']);
  const match = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(url);
  return match ? match[1] : '';
}

interface BuildInfo {
  version: string;
  commit: string;
  date: string;
  releaseRepo: string;
}

function buildInfo(): BuildInfo {
  return {
    version: process.env.GAI_BUILD_VERSION || pkg.version,
    commit: capture(['git', 'rev-parse', '--short', 'HEAD']) || 'unknown',
    date: new Date().toISOString().slice(0, 10),
    releaseRepo: process.env.GAI_UPDATE_REPO || deriveRepoFromRemote(),
  };
}

/** Baked via --define: version.ts reads these at runtime instead of package.json or the environment. */
function defineArgs(info: BuildInfo): string[] {
  const args: string[] = [];
  for (const [key, value] of [
    ['process.env.GAI_VERSION', info.version],
    ['process.env.GAI_COMMIT', info.commit],
    ['process.env.GAI_BUILD_DATE', info.date],
    ['process.env.GAI_RELEASE_REPO', info.releaseRepo],
  ] as const) {
    args.push('--define', `${key}=${JSON.stringify(value)}`);
  }
  return args;
}

/** dist/cli.js: the single Node-compatible bundle that package.json's bin points at. */
function buildNpmBundle(info: BuildInfo): void {
  const out = path.join(OUT_DIR, 'cli.js');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const cmd = ['bun', 'build', 'src/cli.ts', '--target=node', '--format=esm', '--outfile', out, ...defineArgs(info)];

  console.log(`> ${path.relative(ROOT, out)} (node)`);
  const result = Bun.spawnSync({ cmd, cwd: ROOT, stdout: 'inherit', stderr: 'inherit' });
  if (result.exitCode !== 0) {
    process.exit(result.exitCode ?? 1);
  }

  // bun keeps the entry shebang (bun); the published bundle runs on node instead.
  const code = fs.readFileSync(out, 'utf8').replace(/^#![^\n]*\n/, '');
  fs.writeFileSync(out, `#!/usr/bin/env node\n${code}`);
  fs.chmodSync(out, 0o755);

  console.log(`  cli.js ${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
  console.log(`  gai ${info.version} (npm bundle, commit ${info.commit})`);
}

const all = process.argv.includes('--all');
const explicit = process.argv.find((arg) => arg.startsWith('--target='))?.slice('--target='.length);

// dist/cli.js is the npm entry point; it needs no compiled target, only a Node-compatible bundle.
if (process.argv.includes('--npm')) {
  buildNpmBundle(buildInfo());
  process.exit(0);
}

const targets = explicit
  ? TARGETS.filter((t) => `${t.platform}-${t.arch}` === explicit)
  : all
    ? TARGETS
    : TARGETS.filter((t) => t.platform === process.platform && t.arch === process.arch);
if (targets.length === 0) {
  console.error(
    `No build target for ${explicit ?? `${process.platform}-${process.arch}`}; ` +
      `use --all or one of: ${TARGETS.map((t) => `${t.platform}-${t.arch}`).join(', ')}`,
  );
  process.exit(1);
}

const info = buildInfo();

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
const built: string[] = [];
for (const target of targets) {
  const out = path.join(OUT_DIR, assetName(target.platform, target.arch));
  const bunTarget = `bun-${target.platform === 'win32' ? 'windows' : target.platform}-${target.arch}`;
  const cmd = ['bun', 'build', 'src/cli.ts', '--compile', `--target=${bunTarget}`, '--outfile', out, ...defineArgs(info)];
  console.log(`> ${path.relative(ROOT, out)} (${bunTarget})`);
  const result = Bun.spawnSync({ cmd, cwd: ROOT, stdout: 'inherit', stderr: 'inherit' });
  if (result.exitCode !== 0) {
    process.exit(result.exitCode ?? 1);
  }
  built.push(path.basename(out));
}

const lines = built.map((name) => {
  const hash = createHash('sha256').update(fs.readFileSync(path.join(OUT_DIR, name))).digest('hex');
  return `${hash}  ${name}`;
});
fs.writeFileSync(path.join(OUT_DIR, 'checksums.txt'), `${lines.join('\n')}\n`);

console.log();
for (const name of built) {
  const size = fs.statSync(path.join(OUT_DIR, name)).size;
  console.log(`  ${name.padEnd(24)} ${(size / 1024 / 1024).toFixed(1)} MB`);
}
console.log('  checksums.txt');
console.log();
console.log(`gai ${info.version} (commit ${info.commit}, ${info.date})`);
console.log(`update source: ${info.releaseRepo || '[unset: add git remote origin or GAI_UPDATE_REPO]'}`);
