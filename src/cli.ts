import fs from 'node:fs';
import path from 'node:path';
import { CliFlags, resolveAiConfig } from './config';
import {
  collectCandidates,
  collectTrackedDiff,
  collectUntrackedPreviews,
  currentRepo,
  ensureIndexEmpty,
  executePlan,
} from './git';
import { generatePlan } from './plan';
import { buildPrompt } from './prompt';
import { selfUpdate } from './update';
import { CommitSpec, fail, GaiError } from './util';
import { versionLine } from './version';

type Command = 'run' | 'update' | 'help' | 'version';

const HELP = `gai - AI-planned git add + commit (works with any OpenAI-compatible API)

Usage:
  gai [options] [dir]        plan the uncommitted changes under dir (default: .) and commit them in groups
  gai update                 self-update to the latest release
  gai -v, --version          print version
  gai -h, --help             show this help

Options:
  -token, --token <key>      API token (prefer GAI_TOKEN: argv is visible in ps and shell history)
  -model, --model <name>     model name, e.g. deepseek-chat or gpt-4o-mini
  -base-url, --base-url <url>   OpenAI-compatible API base URL (default: https://api.openai.com/v1)
  -y, --yes                  skip the confirmation prompt
  --dry-run                  print the commit plan without committing
  --config <path>            KEY=VALUE config file (default: ~/.config/gai/config.env)

Configuration (flag > env > config file):
  token   GAI_TOKEN    (legacy: AI_API_KEY)
  model   GAI_MODEL    (legacy: AI_MODEL)
  base    GAI_BASE_URL (legacy: AI_BASE_URL)
  GAI_YES=1 is equivalent to -y.

Quick start:
  export GAI_TOKEN=sk-...
  export GAI_MODEL=deepseek-chat
  export GAI_BASE_URL=https://api.deepseek.com/v1
  gai`;

function parseCli(argv: string[]): { command: Command; flags: CliFlags } {
  const flags: CliFlags = { yes: false, dryRun: false };
  let command: Command = 'run';
  let dirCount = 0;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const eq = arg.startsWith('-') ? arg.indexOf('=') : -1;
    const name = eq === -1 ? arg : arg.slice(0, eq);
    const inlineValue = eq === -1 ? undefined : arg.slice(eq + 1);

    const nextValue = (label: string): string => {
      if (inlineValue !== undefined) {
        return inlineValue;
      }
      const value = argv[index + 1];
      if (value === undefined) {
        fail(`Option ${label} requires a value.\nRun gai -h for usage.`);
      }
      index += 1;
      return value;
    };

    switch (name) {
      case 'update':
        if (index !== 0) {
          fail(`Unexpected argument: ${arg}\nRun gai -h for usage.`);
        }
        command = 'update';
        break;
      case '-h':
      case '--help':
        command = 'help';
        break;
      case '-v':
      case '--version':
        command = 'version';
        break;
      case '-y':
      case '--yes':
        flags.yes = true;
        break;
      case '--dry-run':
        flags.dryRun = true;
        break;
      case '-token':
      case '--token':
        flags.token = nextValue(name);
        break;
      case '-model':
      case '--model':
        flags.model = nextValue(name);
        break;
      case '-base-url':
      case '--base-url':
        flags.baseUrl = nextValue(name);
        break;
      case '--config':
        flags.configPath = nextValue(name);
        break;
      default:
        if (arg.startsWith('-')) {
          fail(`Unknown option: ${arg}\nRun gai -h for usage.`);
        }
        dirCount += 1;
        if (dirCount > 1) {
          fail(`Only one directory argument is allowed: ${arg}\nRun gai -h for usage.`);
        }
        flags.dir = arg;
    }
  }

  if (
    command === 'update' &&
    (flags.token || flags.model || flags.baseUrl || flags.configPath || flags.dir || flags.yes || flags.dryRun)
  ) {
    fail('gai update takes no options.');
  }
  return { command, flags };
}

function printPlan(commits: CommitSpec[]): void {
  console.log('Commit plan:');
  commits.forEach((commit, index) => {
    console.log(`${index + 1}. ${commit.message}`);
    for (const file of commit.files) {
      console.log(`   - ${file}`);
    }
  });
  console.log();
}

function confirm(yes: boolean): boolean {
  if (yes || /^(1|true|yes|y)$/i.test(String(process.env.GAI_YES ?? '').trim())) {
    console.log('Proceed? [y/N] y');
    return true;
  }

  try {
    fs.writeFileSync('/dev/tty', 'Proceed? [y/N] ');
    const fd = fs.openSync('/dev/tty', 'r');
    try {
      const buffer = Buffer.alloc(256);
      const bytes = fs.readSync(fd, buffer, 0, buffer.length, null);
      const answer = buffer.subarray(0, bytes).toString('utf8').trim().toLowerCase();
      return answer === 'y' || answer === 'yes';
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

async function runFlow(flags: CliFlags): Promise<number> {
  if (flags.dir) {
    process.chdir(path.resolve(flags.dir));
  }

  const config = resolveAiConfig(flags);
  const { cwd, repoRoot, scopeLabel, pathspec } = currentRepo();
  ensureIndexEmpty(repoRoot);

  const { files, status } = collectCandidates(repoRoot, pathspec);
  if (files.length === 0) {
    console.log(`No changes under current directory: ${scopeLabel}`);
    return 1;
  }

  const { diff: trackedDiff, truncated: trackedDiffTruncated } = collectTrackedDiff(repoRoot, pathspec);
  const untrackedFiles = files.filter((file) => status.get(file) === 'untracked');
  const untrackedPreview = collectUntrackedPreviews(repoRoot, untrackedFiles);
  const prompt = buildPrompt({
    cwd,
    repoRoot,
    scopeLabel,
    files,
    status,
    trackedDiff,
    trackedDiffTruncated,
    untrackedPreview,
  });
  const commits = await generatePlan({ prompt, files, status, config });

  printPlan(commits);
  if (flags.dryRun) {
    console.log('Dry run: no commits created.');
    return 0;
  }
  if (!confirm(flags.yes)) {
    console.log('Aborted.');
    return 0;
  }

  ensureIndexEmpty(repoRoot);
  const { files: currentFiles } = collectCandidates(repoRoot, pathspec);
  if (JSON.stringify(currentFiles) !== JSON.stringify(files)) {
    throw new GaiError('Changed file set has changed since the plan was generated. Run gai again.');
  }

  executePlan(repoRoot, commits);
  console.log();
  console.log('Done.');
  return 0;
}

async function main(): Promise<number> {
  const { command, flags } = parseCli(process.argv.slice(2));
  try {
    if (command === 'help') {
      console.log(HELP);
      return 0;
    }
    if (command === 'version') {
      console.log(versionLine());
      return 0;
    }
    if (command === 'update') {
      return await selfUpdate();
    }
    return await runFlow(flags);
  } catch (error) {
    if (error instanceof GaiError) {
      fail(error.message);
    }
    throw error;
  }
}

process.exitCode = await main();
