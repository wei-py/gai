import path from 'node:path';
import { AiConfig, callAI, ChatMessage } from './ai';
import { Convention, compileMessagePattern } from './config';
import { formatGitStatusFiles } from './git';
import { Lang, t } from './i18n';
import { buildRepairPrompt } from './prompt';
import { CommitSpec, GaiError, isRecord } from './util';

const MAX_PLAN_ATTEMPTS = 3;
// gai-owned decoration: one deterministic gitmoji per commit type (gitmoji/cz-git mapping).
const EMOJI_BY_TYPE: Record<string, string> = {
  feat: '✨',
  fix: '🐛',
  docs: '📝',
  style: '💄',
  refactor: '♻️',
  perf: '⚡️',
  test: '✅',
  build: '📦',
  ci: '👷',
  chore: '🔧',
  revert: '⏪️',
};

const LEADING_EMOJI = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator})/u;

// RegExpExec with the `d` flag: named groups plus their spans (not yet in the TS lib).
interface PatternExec {
  groups: Record<string, string | undefined>;
  indices: { groups: Record<string, [number, number] | undefined> };
}

export function normalizeRepoPath(rawPath: unknown): string {
  if (typeof rawPath !== 'string') {
    throw new GaiError(t('val_path_string'));
  }
  let value = rawPath.trim();
  if (!value) {
    throw new GaiError(t('val_path_empty'));
  }
  if (value.startsWith('./')) {
    value = value.slice(2);
  }
  if (value.startsWith('/')) {
    throw new GaiError(t('val_path_abs', { path: rawPath }));
  }

  const normalized = path.posix.normalize(value);
  if (normalized === '' || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new GaiError(t('val_path_invalid', { path: rawPath }));
  }
  return normalized;
}

export function extractJson(text: unknown): Record<string, unknown> {
  let cleaned = String(text ?? '').trim();
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split(/\r?\n/);
    if (lines[0]?.startsWith('```')) {
      lines.shift();
    }
    if (lines.at(-1)?.startsWith('```')) {
      lines.pop();
    }
    cleaned = lines.join('\n').trim();
  }

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new GaiError(t('val_no_json', { raw: cleaned }));
  }

  const jsonText = cleaned.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new GaiError(t('val_parse_fail', { error: (error as Error).message, raw: cleaned }));
  }
  if (!isRecord(parsed)) {
    throw new GaiError(t('val_not_object'));
  }
  return parsed;
}

// Deterministic mirror of the configured commit convention (type-enum, scope-optional,
// subject-full-stop, header-max-length, body-leading-blank).
function checkMessage(message: string, index: number, convention: Convention): void {
  const [subject] = message.split('\n');
  const match = compileMessagePattern(convention.pattern).exec(subject) as unknown as PatternExec | null;
  if (!match) {
    throw new GaiError(t('val_bad_format', { index, message }));
  }
  const type = match.groups.type ?? '';
  const scope = match.groups.scope;
  const text = match.groups.description ?? '';
  if (!convention.types.includes(type)) {
    throw new GaiError(t('val_bad_type', { index, message }));
  }
  if (scope !== undefined && !convention.scope) {
    throw new GaiError(t('val_scope_disabled', { index, message }));
  }
  if (scope !== undefined && convention.scopes.length > 0 && !convention.scopes.includes(scope)) {
    throw new GaiError(t('val_scope_unknown', { index, message }));
  }
  if (LEADING_EMOJI.test(text.trimStart())) {
    throw new GaiError(t('val_subject_emoji', { index, message }));
  }
  if (!text.trim()) {
    throw new GaiError(t('val_commit_message', { index }));
  }
  if (text.trimEnd().endsWith('.')) {
    throw new GaiError(t('val_subject_period', { index, message }));
  }
  if (subject.length > convention.subjectMax) {
    throw new GaiError(t('val_subject_long', { index, max: convention.subjectMax, message }));
  }
  if (convention.body) {
    const split = message.indexOf('\n\n');
    if (split === -1 || !message.slice(split + 2).trim()) {
      throw new GaiError(t('val_body_missing', { index, message }));
    }
  }
}

export function validatePlan(
  parsed: Record<string, unknown>,
  expectedFiles: string[],
  convention: Convention,
): CommitSpec[] {
  const commits = parsed.commits;
  if (!Array.isArray(commits) || commits.length === 0) {
    throw new GaiError(t('val_commits_array'));
  }

  const expected = new Set(expectedFiles);
  const seen = new Map<string, number>();
  const normalizedCommits: CommitSpec[] = [];

  commits.forEach((entry, commitIndex) => {
    const displayIndex = commitIndex + 1;
    if (!isRecord(entry)) {
      throw new GaiError(t('val_commit_object', { index: displayIndex }));
    }

    const rawMessage = entry.message;
    if (typeof rawMessage !== 'string' || !rawMessage.trim()) {
      throw new GaiError(t('val_commit_message', { index: displayIndex }));
    }
    const message = rawMessage.trim().replace(/^[`'"]+|[`'"]+$/g, '');
    checkMessage(message, displayIndex, convention);

    if (!Array.isArray(entry.files) || entry.files.length === 0) {
      throw new GaiError(t('val_files_empty', { index: displayIndex }));
    }

    const files: string[] = [];
    for (const rawPath of entry.files) {
      const file = normalizeRepoPath(rawPath);
      if (!expected.has(file)) {
        throw new GaiError(
          t('val_unknown_file', { file, index: displayIndex, files: formatGitStatusFiles(expectedFiles) }),
        );
      }
      const previous = seen.get(file);
      if (previous !== undefined) {
        throw new GaiError(t('val_duplicate_file', { file, a: previous, b: displayIndex }));
      }
      seen.set(file, displayIndex);
      files.push(file);
    }

    normalizedCommits.push({ message, files });
  });

  const missing = [...expected].filter((file) => !seen.has(file)).sort();
  if (missing.length > 0) {
    throw new GaiError(t('val_missing_files', { files: missing.map((file) => `  - ${file}`).join('\n') }));
  }

  return normalizedCommits;
}

/** gai-owned decoration: the type's gitmoji before the description, e.g. "feat(ui): ✨ subject". */
export function withEmoji(message: string, convention: Convention): string {
  if (!convention.emoji) {
    return message;
  }
  const [subject, ...rest] = message.split('\n');
  const match = compileMessagePattern(convention.pattern).exec(subject) as unknown as PatternExec | null;
  const emoji = match?.groups.type ? EMOJI_BY_TYPE[match.groups.type] : undefined;
  const span = match?.indices.groups.description;
  if (!emoji || !span) {
    return message;
  }
  return [`${subject.slice(0, span[0])}${emoji} ${subject.slice(span[0])}`, ...rest].join('\n');
}

/** Enterprise trailers: gai owns the ticket footer so it is always present and never duplicated. */
export function withTicketFooter(message: string, ticket: string): string {
  if (!ticket || message.includes(`Refs: ${ticket}`)) {
    return message;
  }
  return `${message}\n\nRefs: ${ticket}`;
}

export async function generatePlan(params: {
  prompt: string;
  files: string[];
  status: Map<string, string>;
  config: AiConfig;
  convention: Convention;
  commitLang: Lang;
}): Promise<CommitSpec[]> {
  const messages: ChatMessage[] = [{ role: 'user', content: params.prompt }];
  let lastError: GaiError | undefined;

  for (let attempt = 1; attempt <= MAX_PLAN_ATTEMPTS; attempt += 1) {
    const raw = await callAI(messages, params.config);
    try {
      return validatePlan(extractJson(raw), params.files, params.convention);
    } catch (error) {
      if (!(error instanceof GaiError)) {
        throw error;
      }
      lastError = error;
      if (attempt === MAX_PLAN_ATTEMPTS) {
        break;
      }
      console.error(t('plan_attempts', { attempt, max: MAX_PLAN_ATTEMPTS }));
      console.error(error.message);
      console.error(`\n${t('plan_fixing')}\n`);
      messages.push(
        { role: 'assistant', content: raw },
        {
          role: 'user',
          content: buildRepairPrompt({
            files: params.files,
            status: params.status,
            validationError: error.message,
            convention: params.convention,
            commitLang: params.commitLang,
          }),
        },
      );
    }
  }

  throw new GaiError(t('plan_failed', { max: MAX_PLAN_ATTEMPTS, error: lastError?.message ?? 'unknown' }));
}
