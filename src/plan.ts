import path from 'node:path';
import { AiConfig, callAI, ChatMessage } from './ai';
import { formatGitStatusFiles } from './git';
import { buildRepairPrompt } from './prompt';
import { CommitSpec, GaiError, isRecord } from './util';

export const COMMIT_RE = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?: .+/;
const MAX_PLAN_ATTEMPTS = 3;

export function normalizeRepoPath(rawPath: unknown): string {
  if (typeof rawPath !== 'string') {
    throw new GaiError('File paths in AI output must be strings.');
  }
  let value = rawPath.trim();
  if (!value) {
    throw new GaiError('Empty file path in AI output.');
  }
  if (value.startsWith('./')) {
    value = value.slice(2);
  }
  if (value.startsWith('/')) {
    throw new GaiError(`Absolute paths are not allowed in AI output: ${value}`);
  }

  const normalized = path.posix.normalize(value);
  if (normalized === '' || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new GaiError(`Invalid file path in AI output: ${rawPath}`);
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
    throw new GaiError(`AI did not return JSON:\n${cleaned}`);
  }

  const jsonText = cleaned.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new GaiError(`Failed to parse plan JSON: ${(error as Error).message}\n\nRaw output:\n${cleaned}`);
  }
  if (!isRecord(parsed)) {
    throw new GaiError('Plan JSON must be an object.');
  }
  return parsed;
}

export function validatePlan(parsed: Record<string, unknown>, expectedFiles: string[]): CommitSpec[] {
  const commits = parsed.commits;
  if (!Array.isArray(commits) || commits.length === 0) {
    throw new GaiError('Plan JSON must contain a non-empty "commits" array.');
  }

  const expected = new Set(expectedFiles);
  const seen = new Map<string, number>();
  const normalizedCommits: CommitSpec[] = [];

  commits.forEach((entry, commitIndex) => {
    const displayIndex = commitIndex + 1;
    if (!isRecord(entry)) {
      throw new GaiError(`Commit #${displayIndex} must be an object.`);
    }

    const rawMessage = entry.message;
    if (typeof rawMessage !== 'string' || !rawMessage.trim()) {
      throw new GaiError(`Commit #${displayIndex} has an invalid message.`);
    }
    const message = rawMessage.trim().replace(/^[`'"]+|[`'"]+$/g, '');
    if (!COMMIT_RE.test(message)) {
      throw new GaiError(`Commit #${displayIndex} message is not Conventional Commit format: ${message}`);
    }

    if (!Array.isArray(entry.files) || entry.files.length === 0) {
      throw new GaiError(`Commit #${displayIndex} must contain a non-empty files array.`);
    }

    const files: string[] = [];
    for (const rawPath of entry.files) {
      const file = normalizeRepoPath(rawPath);
      if (!expected.has(file)) {
        throw new GaiError(
          `AI returned a file that is not in current git status: ${file}\n\n` +
            `Commit: #${displayIndex}\n\n` +
            `Current git status files:\n${formatGitStatusFiles(expectedFiles)}`,
        );
      }
      if (seen.has(file)) {
        throw new GaiError(
          `File appears in multiple commits: ${file} (commit #${seen.get(file)} and commit #${displayIndex})`,
        );
      }
      seen.set(file, displayIndex);
      files.push(file);
    }

    normalizedCommits.push({ message, files });
  });

  const missing = [...expected].filter((file) => !seen.has(file)).sort();
  if (missing.length > 0) {
    throw new GaiError(`Plan did not cover every changed file:\n${missing.map((file) => `  - ${file}`).join('\n')}`);
  }

  return normalizedCommits;
}

export async function generatePlan(params: {
  prompt: string;
  files: string[];
  status: Map<string, string>;
  config: AiConfig;
}): Promise<CommitSpec[]> {
  const messages: ChatMessage[] = [{ role: 'user', content: params.prompt }];
  let lastError: GaiError | undefined;

  for (let attempt = 1; attempt <= MAX_PLAN_ATTEMPTS; attempt += 1) {
    const raw = await callAI(messages, params.config);
    try {
      return validatePlan(extractJson(raw), params.files);
    } catch (error) {
      if (!(error instanceof GaiError)) {
        throw error;
      }
      lastError = error;
      if (attempt === MAX_PLAN_ATTEMPTS) {
        break;
      }
      console.error(`Commit plan validation failed (attempt ${attempt}/${MAX_PLAN_ATTEMPTS}):`);
      console.error(error.message);
      console.error('\nRequesting a corrected plan...\n');
      messages.push(
        { role: 'assistant', content: raw },
        {
          role: 'user',
          content: buildRepairPrompt({
            files: params.files,
            status: params.status,
            validationError: error.message,
          }),
        },
      );
    }
  }

  throw new GaiError(
    `AI provider failed to produce a valid commit plan after ${MAX_PLAN_ATTEMPTS} attempts.\n\n` +
      `Last validation error:\n${lastError?.message ?? 'unknown'}`,
  );
}
