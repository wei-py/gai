import fs from 'node:fs';
import path from 'node:path';
import { CommitSpec, GaiError } from './util';

const MAX_TRACKED_DIFF_CHARS = 180_000;
const MAX_UNTRACKED_FILE_BYTES = 64_000;
const MAX_UNTRACKED_PREVIEW_CHARS = 8_000;
const MAX_TOTAL_UNTRACKED_PREVIEW_CHARS = 48_000;

export interface RunResult {
  stdout: string;
  stderr: string;
  status: number;
}

export function run(args: string[], options: { cwd?: string; check?: boolean } = {}): RunResult {
  const cwd = options.cwd ?? process.cwd();
  const check = options.check ?? true;

  let result;
  try {
    result = Bun.spawnSync({ cmd: args, cwd, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  } catch (error) {
    throw new GaiError(`${args[0]} failed: ${(error as Error).message}`);
  }

  const outcome: RunResult = {
    stdout: result.stdout ? Buffer.from(result.stdout).toString('utf8') : '',
    stderr: result.stderr ? Buffer.from(result.stderr).toString('utf8') : '',
    status: result.exitCode ?? 1,
  };

  if (check && !result.success) {
    const command = args.join(' ');
    const stderr = outcome.stderr.trim();
    if (stderr) {
      throw new GaiError(`${command} failed:\n${stderr}`);
    }
    throw new GaiError(`${command} failed with exit code ${outcome.status}`);
  }

  return outcome;
}

export function runGit(args: string[], options: { cwd?: string; check?: boolean } = {}): RunResult {
  return run(['git', ...args], options);
}

export function zsplit(text: string): string[] {
  if (!text) {
    return [];
  }
  const parts = text.split('\0');
  if (parts.at(-1) === '') {
    parts.pop();
  }
  return parts;
}

export interface RepoScope {
  cwd: string;
  repoRoot: string;
  scopeLabel: string;
  pathspec: string;
}

export function currentRepo(): RepoScope {
  const cwd = process.cwd();
  const inside = runGit(['rev-parse', '--is-inside-work-tree'], { cwd, check: false });
  if (inside.status !== 0 || inside.stdout.trim() !== 'true') {
    throw new GaiError('Not a git repository.');
  }
  const root = runGit(['rev-parse', '--show-toplevel'], { cwd }).stdout.trim();
  const prefix = runGit(['rev-parse', '--show-prefix'], { cwd }).stdout.trim().replace(/\/$/, '');
  return {
    cwd,
    repoRoot: root,
    scopeLabel: prefix || '.',
    pathspec: prefix ? `:(literal)${prefix}` : '.',
  };
}

export function ensureIndexEmpty(repoRoot: string): void {
  const staged = runGit(['diff', '--cached', '--name-only', '-z'], { cwd: repoRoot }).stdout;
  const stagedFiles = zsplit(staged);
  if (stagedFiles.length > 0) {
    console.log('Existing staged changes detected. Commit or unstage them before running gai.');
    for (const file of stagedFiles) {
      console.log(`  - ${file}`);
    }
    process.exit(1);
  }
}

export interface Candidates {
  files: string[];
  status: Map<string, string>;
}

export function collectCandidates(repoRoot: string, pathspec: string): Candidates {
  const statusRaw = runGit(
    ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', pathspec],
    { cwd: repoRoot },
  ).stdout;

  const status = new Map<string, string>();
  const entries = zsplit(statusRaw);
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.length < 4) {
      continue;
    }

    const code = entry.slice(0, 2);
    const file = entry.slice(3);
    if (!file) {
      continue;
    }

    status.set(file, code === '??' ? 'untracked' : 'tracked');

    if (code.includes('R') || code.includes('C')) {
      index += 1;
    }
  }

  const files = [...status.keys()].sort();
  return { files, status };
}

export function formatGitStatusFiles(files: string[]): string {
  if (files.length === 0) {
    return '  [none]';
  }
  return files.map((file) => `  - ${file}`).join('\n');
}

export function collectTrackedDiff(repoRoot: string, pathspec: string): { diff: string; truncated: boolean } {
  const diff = runGit(['diff', '--no-ext-diff', '--unified=3', '--', pathspec], { cwd: repoRoot }).stdout;
  if (diff.length <= MAX_TRACKED_DIFF_CHARS) {
    return { diff, truncated: false };
  }
  return {
    diff: `${diff.slice(0, MAX_TRACKED_DIFF_CHARS)}\n\n[tracked diff truncated]\n`,
    truncated: true,
  };
}

export function collectUntrackedPreviews(repoRoot: string, untrackedFiles: string[]): string {
  const sections: string[] = [];
  let totalChars = 0;

  for (const relPath of untrackedFiles) {
    const absPath = path.join(repoRoot, relPath);
    let section: string;
    try {
      const stat = fs.statSync(absPath);
      if (!stat.isFile()) {
        section = `--- ${relPath} ---\n[not a regular file]\n`;
      } else {
        const raw = fs.readFileSync(absPath).subarray(0, MAX_UNTRACKED_FILE_BYTES);
        if (raw.includes(0)) {
          section = `--- ${relPath} ---\n[binary file, ${stat.size} bytes]\n`;
        } else {
          let text = raw.toString('utf8');
          const truncated = stat.size > MAX_UNTRACKED_FILE_BYTES || text.length > MAX_UNTRACKED_PREVIEW_CHARS;
          text = text.slice(0, MAX_UNTRACKED_PREVIEW_CHARS);
          section = `--- ${relPath} (${stat.size} bytes) ---\n${text}`;
          if (truncated) {
            section += '\n[untracked preview truncated]';
          }
          section += '\n';
        }
      }
    } catch (error) {
      section = `--- ${relPath} ---\n[unreadable: ${(error as Error).message}]\n`;
    }

    if (totalChars + section.length > MAX_TOTAL_UNTRACKED_PREVIEW_CHARS) {
      sections.push('[remaining untracked previews omitted]\n');
      break;
    }
    sections.push(section);
    totalChars += section.length;
  }

  return sections.join('\n');
}

export function executePlan(repoRoot: string, commits: CommitSpec[]): void {
  commits.forEach((commit, index) => {
    ensureIndexEmpty(repoRoot);
    console.log();
    console.log(`[${index + 1}/${commits.length}] ${commit.message}`);

    runGit(['add', '--', ...commit.files], { cwd: repoRoot });
    const result = runGit(['commit', '-m', commit.message], { cwd: repoRoot, check: false });
    if (result.stdout.trim()) {
      console.log(result.stdout);
    }
    if (result.status !== 0) {
      if (result.stderr.trim()) {
        console.error(result.stderr);
      }
      process.exit(result.status);
    }
  });
}
