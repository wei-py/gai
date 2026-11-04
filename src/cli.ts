#!/usr/bin/env bun
import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { openConfigTui } from './config-tui';
import { CliFlags, loadSettings, resolveAiConfig } from './config';
import { openWebConfig } from './web';
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
import { generatePlan, withEmoji, withTicketFooter } from './plan';
import { buildPrompt } from './prompt';
import { selfUpdate } from './update';
import { CommitSpec, fail, GaiError } from './util';
import { versionLine } from './version';

type Command = 'run' | 'update' | 'config' | 'web' | 'help' | 'version';

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
      case 'web':
        if (index !== 0) {
          fail(t('err_unexpected_arg', { arg }));
        }
        command = 'web';
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
  if ((command === 'config' || command === 'web') && (flags.token || flags.model || flags.baseUrl || flags.dir || flags.yes || flags.dryRun)) {
    fail(t('err_config_options', { command: `gai ${command}` }));
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

// Console devices that ignore stdio redirection: the Windows console, /dev/tty elsewhere.
// Both need 'r+' when opened: 'w' asks for CREATE_ALWAYS, which console devices reject.
const CONSOLE_DEVICE =
  process.platform === 'win32'
    ? { input: '\\\\.\\CONIN$', output: '\\\\.\\CONOUT$' }
    : { input: '/dev/tty', output: '/dev/tty' };

/** Shows the question on the console, falling back to stdout where no console device is reachable. */
function writeQuestion(question: string): void {
  try {
    const fd = fs.openSync(CONSOLE_DEVICE.output, 'r+');
    try {
      fs.writeSync(fd, question);
      return;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    process.stdout.write(question);
  }
}

/**
 * One confirmation line, read from the terminal rather than from whatever stdin happens to be.
 * Returns null when no terminal is reachable, which the caller reports instead of silently aborting.
 */
async function askLine(question: string): Promise<string | null> {
  if (process.stdin.isTTY && process.stdout.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      return (await rl.question(question)).trim().toLowerCase();
    } catch {
      return ''; // Ctrl+D: an unanswered prompt is a "no", not a missing terminal.
    } finally {
      rl.close();
      process.stdin.pause();
    }
  }

  // stdio is redirected (piped into a file or a script): ask the console directly.
  writeQuestion(question);
  let inputFd: number;
  try {
    inputFd = fs.openSync(CONSOLE_DEVICE.input, 'r+');
  } catch {
    return null;
  }
  try {
    const buffer = Buffer.alloc(256);
    const bytes = fs.readSync(inputFd, buffer, 0, buffer.length, null);
    return buffer.subarray(0, bytes).toString('utf8').trim().toLowerCase();
  } catch {
    return null;
  } finally {
    fs.closeSync(inputFd);
  }
}

async function confirm(yes: boolean): Promise<boolean> {
  if (yes || /^(1|true|yes|y)$/i.test(String(process.env.GAI_YES ?? '').trim())) {
    console.log(t('proceed_yes'));
    return true;
  }

  const answer = await askLine(t('proceed'));
  if (answer === null) {
    console.log(t('confirm_no_tty'));
    return false;
  }
  return answer === 'y' || answer === 'yes';
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
    commits.push({ message: withEmoji(withTicketFooter(spec.message, ticket), convention), files: spec.files });
  }

  printPlan(commits);
  if (flags.dryRun) {
    console.log(t('dry_run'));
    return 0;
  }
  if (!(await confirm(flags.yes))) {
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
    if (command === 'web') {
      await openWebConfig(flags.configPath);
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
