import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AiConfig } from './ai';
import { Lang, t } from './i18n';
import { GaiError } from './util';

export interface CliFlags {
  token?: string;
  model?: string;
  baseUrl?: string;
  configPath?: string;
  dir?: string;
  yes: boolean;
  dryRun: boolean;
}

/** Conventional Commits header; a custom GAI_COMMIT_PATTERN keeps the same named groups. */
export const DEFAULT_PATTERN = '^(?<type>[a-z]+)(?:\\((?<scope>[^)\\n]*)\\))?(?<breaking>!)?: (?<description>.+)$';

export const DEFAULT_TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
];

export interface Convention {
  types: string[];
  /** message regex source with the named groups type|scope|breaking|description (Conventional Commits by default) */
  pattern: string;
  scope: boolean;
  /** permitted scopes (GAI_COMMIT_SCOPES); empty = any scope */
  scopes: string[];
  /** gai prefixes the description with the type's emoji (not counted against subjectMax) */
  emoji: boolean;
  body: boolean;
  subjectMax: number;
  ticketPattern: string;
  ticketRequired: boolean;
}

export interface Settings {
  lang: Lang;
  commitLang: Lang;
  token: string;
  model: string;
  baseUrl: string;
  convention: Convention;
}

export interface LoadedSettings {
  settings: Settings;
  configPath: string;
  /** canonical GAI_* keys whose environment value overrides the config file */
  envKeys: string[];
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

// Legacy key names kept readable forever so old config files keep working.
const LEGACY: Record<string, string[]> = {
  GAI_TOKEN: ['AI_API_KEY'],
  GAI_MODEL: ['AI_MODEL'],
  GAI_BASE_URL: ['AI_BASE_URL'],
};

// Keys owned by gai config: saved in this order, removed when the value is empty.
const MANAGED: Record<string, true> = {
  GAI_TOKEN: true,
  GAI_MODEL: true,
  GAI_BASE_URL: true,
  GAI_LANG: true,
  GAI_COMMIT_LANG: true,
  GAI_COMMIT_TYPES: true,
  GAI_COMMIT_PATTERN: true,
  GAI_COMMIT_SCOPE: true,
  GAI_COMMIT_SCOPES: true,
  GAI_COMMIT_EMOJI: true,
  GAI_COMMIT_BODY: true,
  GAI_COMMIT_SUBJECT_MAX: true,
  GAI_COMMIT_TICKET: true,
  GAI_COMMIT_TICKET_REQUIRED: true,
};

// KEY=VALUE lines, same format as the legacy ai-models.conf.
function parseConfigFile(file: string): Map<string, string> {
  const values = new Map<string, string>();
  const text = fs.readFileSync(file, 'utf8');
  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      throw new GaiError(t('err_config_line', { file, line: index + 1, text: line }));
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.length >= 2 && (value[0] === "'" || value[0] === '"') && value.at(-1) === value[0]) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  });
  return values;
}

function parseLineKey(line: string): string {
  const match = /^\s*([^#=\s][^=]*?)\s*=/.exec(line);
  return match ? match[1].trim() : '';
}

function parseLang(raw: string, fallback: Lang): Lang {
  const value = raw.trim().toLowerCase();
  if (value === 'zh' || value === 'en') {
    return value;
  }
  return fallback;
}

function parseBool(raw: string, fallback: boolean): boolean {
  const value = raw.trim().toLowerCase();
  if (value === '1' || value === 'true' || value === 'yes' || value === 'on') {
    return true;
  }
  if (value === '0' || value === 'false' || value === 'no' || value === 'off') {
    return false;
  }
  return fallback;
}

function parseTypes(raw: string): string[] {
  const parsed = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => /^[a-z]+$/.test(entry));
  return parsed.length > 0 ? parsed : DEFAULT_TYPES.slice();
}

export function parseScopes(raw: string): string[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

// Mandatory capture groups, same contract as git-conventional-commits' commitMessageRegexPattern.
const PATTERN_GROUPS = ['type', 'scope', 'breaking', 'description'];

/** Compiles the message pattern; the `d` flag adds match spans so gai can locate the description. */
export function compileMessagePattern(source: string): RegExp {
  let regex: RegExp;
  try {
    regex = new RegExp(source, 'd');
  } catch (error) {
    throw new GaiError(t('err_pattern_invalid', { error: (error as Error).message }));
  }
  for (const group of PATTERN_GROUPS) {
    if (!regex.source.includes(`(?<${group}>`)) {
      throw new GaiError(t('err_pattern_groups', { pattern: source }));
    }
  }
  return regex;
}



export function loadSettings(explicitPath?: string, flags?: CliFlags, allowMissingExplicit = false): LoadedSettings {
  const explicit = explicitPath ?? process.env.GAI_CONFIG;
  const configPath =
    explicit ?? path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'gai', 'config.env');

  let fileValues = new Map<string, string>();
  if (fs.existsSync(configPath)) {
    fileValues = parseConfigFile(configPath);
  } else if (explicit && !allowMissingExplicit) {
    throw new GaiError(t('err_config_missing', { path: configPath }));
  }

  const envKeys: string[] = [];
  const read = (key: string): { value: string; fromEnv: boolean } => {
    for (const name of [key, ...(LEGACY[key] ?? [])]) {
      const raw = process.env[name];
      if (raw !== undefined && raw.trim() !== '') {
        return { value: raw.trim(), fromEnv: true };
      }
    }
    for (const name of [key, ...(LEGACY[key] ?? [])]) {
      const raw = fileValues.get(name);
      if (raw !== undefined && raw.trim() !== '') {
        return { value: raw.trim(), fromEnv: false };
      }
    }
    return { value: '', fromEnv: false };
  };

  const token = read('GAI_TOKEN');
  const model = read('GAI_MODEL');
  const baseUrl = read('GAI_BASE_URL');
  const lang = read('GAI_LANG');
  const commitLang = read('GAI_COMMIT_LANG');
  const types = read('GAI_COMMIT_TYPES');
  const pattern = read('GAI_COMMIT_PATTERN');
  const scope = read('GAI_COMMIT_SCOPE');
  const scopes = read('GAI_COMMIT_SCOPES');
  const emoji = read('GAI_COMMIT_EMOJI');
  const body = read('GAI_COMMIT_BODY');
  const subjectMax = read('GAI_COMMIT_SUBJECT_MAX');
  const ticket = read('GAI_COMMIT_TICKET');
  const ticketRequired = read('GAI_COMMIT_TICKET_REQUIRED');

  const sources: Array<[string, { value: string; fromEnv: boolean }]> = [
    ['GAI_TOKEN', token],
    ['GAI_MODEL', model],
    ['GAI_BASE_URL', baseUrl],
    ['GAI_LANG', lang],
    ['GAI_COMMIT_LANG', commitLang],
    ['GAI_COMMIT_TYPES', types],
    ['GAI_COMMIT_PATTERN', pattern],
    ['GAI_COMMIT_SCOPE', scope],
    ['GAI_COMMIT_SCOPES', scopes],
    ['GAI_COMMIT_EMOJI', emoji],
    ['GAI_COMMIT_BODY', body],
    ['GAI_COMMIT_SUBJECT_MAX', subjectMax],
    ['GAI_COMMIT_TICKET', ticket],
    ['GAI_COMMIT_TICKET_REQUIRED', ticketRequired],
  ];
  for (const [key, entry] of sources) {
    if (entry.fromEnv) {
      envKeys.push(key);
    }
  }

  const subjectMaxRaw = Number.parseInt(subjectMax.value, 10);
  const settings: Settings = {
    lang: parseLang(lang.value, 'en'),
    commitLang: parseLang(commitLang.value, 'zh'),
    token: flags?.token?.trim() || token.value,
    model: flags?.model?.trim() || model.value,
    baseUrl: flags?.baseUrl?.trim() || baseUrl.value || DEFAULT_BASE_URL,
    convention: {
      types: parseTypes(types.value),
      pattern: pattern.value.trim() || DEFAULT_PATTERN,
      scope: parseBool(scope.value, true),
      scopes: parseScopes(scopes.value),
      emoji: parseBool(emoji.value, false),
      body: parseBool(body.value, false),
      subjectMax: Number.isFinite(subjectMaxRaw) && subjectMaxRaw > 0 && subjectMaxRaw <= 300 ? subjectMaxRaw : 72,
      ticketPattern: ticket.value,
      ticketRequired: parseBool(ticketRequired.value, false),
    },
  };
  return { settings, configPath, envKeys };
}

function canonicalValues(settings: Settings): Record<string, string> {
  const values: Record<string, string> = {};
  const { convention } = settings;
  if (settings.token) {
    values.GAI_TOKEN = settings.token;
  }
  if (settings.model) {
    values.GAI_MODEL = settings.model;
  }
  values.GAI_BASE_URL = settings.baseUrl;
  values.GAI_LANG = settings.lang;
  values.GAI_COMMIT_LANG = settings.commitLang;
  values.GAI_COMMIT_TYPES = convention.types.join(',');
  if (convention.pattern !== DEFAULT_PATTERN) {
    values.GAI_COMMIT_PATTERN = convention.pattern;
  }
  values.GAI_COMMIT_SCOPE = convention.scope ? '1' : '0';
  if (convention.scopes.length > 0) {
    values.GAI_COMMIT_SCOPES = convention.scopes.join(',');
  }
  values.GAI_COMMIT_EMOJI = convention.emoji ? '1' : '0';
  values.GAI_COMMIT_BODY = convention.body ? '1' : '0';
  values.GAI_COMMIT_SUBJECT_MAX = String(convention.subjectMax);
  if (convention.ticketPattern) {
    values.GAI_COMMIT_TICKET = convention.ticketPattern;
  }
  values.GAI_COMMIT_TICKET_REQUIRED = convention.ticketRequired ? '1' : '0';
  return values;
}

/** Rewrites only gai-owned keys in place; comments, legacy keys, and unknown keys survive. */
export function saveSettings(settings: Settings, configPath: string): void {
  const values = canonicalValues(settings);
  const seen = new Set<string>();
  const out: string[] = [];

  const existing = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8').split(/\r?\n/) : [];
  for (const line of existing) {
    const key = parseLineKey(line);
    if (key && MANAGED[key]) {
      if (key in values && !seen.has(key)) {
        out.push(`${key}=${values[key]}`);
        seen.add(key);
      }
      continue;
    }
    out.push(line);
  }
  for (const key of Object.keys(MANAGED)) {
    if (key in values && !seen.has(key)) {
      out.push(`${key}=${values[key]}`);
      seen.add(key);
    }
  }
  while (out.length > 0 && out[out.length - 1] === '') {
    out.pop();
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${out.join('\n')}\n`);
}

export function resolveAiConfig(settings: Settings): AiConfig {
  if (!settings.token) {
    throw new GaiError(t('err_token_missing'));
  }
  if (!settings.model) {
    throw new GaiError(t('err_model_missing'));
  }
  return { token: settings.token, model: settings.model, baseUrl: settings.baseUrl };
}
