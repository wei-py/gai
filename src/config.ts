import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AiConfig } from './ai';
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

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

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
      throw new GaiError(`Invalid config line ${file}:${index + 1}: ${line}`);
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

function pick(...candidates: Array<string | undefined>): string | undefined {
  return candidates.find((value) => typeof value === 'string' && value.trim() !== '');
}

export function resolveAiConfig(flags: CliFlags): AiConfig {
  const explicit = flags.configPath ?? process.env.GAI_CONFIG;
  const configPath =
    explicit ?? path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'gai', 'config.env');

  let fileValues = new Map<string, string>();
  if (fs.existsSync(configPath)) {
    fileValues = parseConfigFile(configPath);
  } else if (explicit) {
    throw new GaiError(`Config file not found: ${configPath}`);
  }

  const fromFile = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = fileValues.get(key);
      if (value !== undefined && value.trim() !== '') {
        return value;
      }
    }
    return undefined;
  };

  const token = pick(
    flags.token,
    process.env.GAI_TOKEN,
    process.env.AI_API_KEY,
    fromFile('GAI_TOKEN', 'GAI_API_KEY', 'AI_API_KEY'),
  );
  const model = pick(flags.model, process.env.GAI_MODEL, process.env.AI_MODEL, fromFile('GAI_MODEL', 'AI_MODEL'));
  const baseUrl =
    pick(flags.baseUrl, process.env.GAI_BASE_URL, process.env.AI_BASE_URL, fromFile('GAI_BASE_URL', 'AI_BASE_URL')) ??
    DEFAULT_BASE_URL;

  if (!token) {
    throw new GaiError(
      'No API token configured.\n' +
        'Set one of (highest precedence first):\n' +
        '  gai -token <key>          (argv is visible in ps and shell history)\n' +
        '  export GAI_TOKEN=<key>\n' +
        `  GAI_TOKEN=<key> in ${configPath}`,
    );
  }
  if (!model) {
    throw new GaiError(
      'No model configured.\n' +
        'Set one of (highest precedence first):\n' +
        '  gai -model <name>\n' +
        '  export GAI_MODEL=<name>\n' +
        `  GAI_MODEL=<name> in ${configPath}`,
    );
  }

  return { token, model, baseUrl };
}
