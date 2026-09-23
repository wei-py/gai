#!/usr/bin/env bun
import fs from 'node:fs';
import path from 'node:path';
import { openConfigTui } from './config-tui';
import { CliFlags, loadSettings, resolveAiConfig } from './config';
import {
  collectCandidates,
  collectTrackedDiff,
  collectUntrackedPreviews,
  currentRepo,
  ensureIndexEmpty,
  executePlan,
  resolveTicket,
} from './git';
import { setLang, t } from './i18n';
import { generatePlan, withTicketFooter } from './plan';
import { buildPrompt } from './prompt';
import { selfUpdate } from './update';
import { CommitSpec, fail, GaiError } from './util';
import { versionLine } from './version';

type Command = 'run' | 'update' | 'config' | 'help' | 'version';

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
        fail(t('err_option_value', { option: label }));
      }
      index += 1;
      return value;
    };

    switch (name) {
      case 'update':
        if (index !== 0) {
          fail(t('err_unexpected_arg', { arg }));
        }
        command = 'update';
        break;
      case 'config':
        if (index !== 0) {
          fail(t('err_unexpected_arg', { arg }));
        }
        command = 'config';
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
          fail(t('err_unknown_option', { arg }));
        }
        dirCount += 1;
        if (dirCount > 1) {
          fail(t('err_one_dir', { arg }));
        }
        flags.dir = arg;
    }
  }

  if (
    command === 'update' &&
    (flags.token || flags.model || flags.baseUrl || flags.configPath || flags.dir || flags.yes || flags.dryRun)
  ) {
    fail(t('err_no_options', { command: 'gai update' }));
  }
  if (command === 'config' && (flags.token || flags.model || flags.baseUrl || flags.dir || flags.yes || flags.dryRun)) {
    fail(t('err_config_options'));
  }
  return { command, flags };
}

function printPlan(commits: CommitSpec[]): void {
  console.log(t('commit_plan'));
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
    console.log(t('proceed_yes'));
    return true;
  }

  try {
    fs.writeFileSync('/dev/tty', t('proceed'));
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

  const loaded = loadSettings(flags.configPath, flags);
  setLang(loaded.settings.lang);
  const config = resolveAiConfig(loaded.settings);
  const { settings } = loaded;
  const { convention } = settings;
  const { cwd, repoRoot, scopeLabel, pathspec } = currentRepo();
  ensureIndexEmpty(repoRoot);

  const ticket = resolveTicket(repoRoot, convention.ticketPattern);
  if (convention.ticketRequired && !ticket) {
    throw new GaiError(t('err_ticket_required'));
  }

  const { files, status } = collectCandidates(repoRoot, pathspec);
  if (files.length === 0) {
    console.log(t('no_changes', { scope: scopeLabel }));
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
    convention,
    commitLang: settings.commitLang,
  });
  const planned = await generatePlan({ prompt, files, status, config, convention, commitLang: settings.commitLang });

  const commits: CommitSpec[] = [];
  for (const spec of planned) {
    commits.push({ message: withTicketFooter(spec.message, ticket), files: spec.files });
  }

  printPlan(commits);
  if (flags.dryRun) {
    console.log(t('dry_run'));
    return 0;
  }
  if (!confirm(flags.yes)) {
    console.log(t('aborted'));
    return 0;
  }

  ensureIndexEmpty(repoRoot);
  const { files: currentFiles } = collectCandidates(repoRoot, pathspec);
  if (JSON.stringify(currentFiles) !== JSON.stringify(files)) {
    throw new GaiError(t('files_changed'));
  }

  executePlan(repoRoot, commits);
  console.log();
  console.log(t('done'));
  return 0;
}

async function main(): Promise<number> {
  try {
    // Best-effort language preload: the real load (strict about explicit paths) happens per command.
    setLang(loadSettings(undefined, undefined, true).settings.lang);
    const { command, flags } = parseCli(process.argv.slice(2));
    if (command === 'help') {
      console.log(t('help'));
      return 0;
    }
    if (command === 'version') {
      console.log(versionLine());
      return 0;
    }
    if (command === 'config') {
      // The settings screen creates the file on first save, so an absent explicit path is fine here.
      await openConfigTui(loadSettings(flags.configPath, undefined, true));
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
