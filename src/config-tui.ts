import { DEFAULT_TYPES, LoadedSettings, saveSettings, Settings } from './config';
import { setLang, t } from './i18n';
import { GaiError } from './util';

type SettingKey =
  | 'lang'
  | 'commitLang'
  | 'model'
  | 'token'
  | 'baseUrl'
  | 'types'
  | 'scope'
  | 'body'
  | 'subjectMax'
  | 'ticketPattern'
  | 'ticketRequired';

interface RowSpec {
  key: SettingKey;
  kind: 'choice' | 'text' | 'types';
  labelKey: string;
  envKey: string;
  values?: string[];
}

interface TuiState {
  settings: Settings;
  configPath: string;
  envKeys: string[];
  cursor: number;
  mode: 'nav' | 'edit' | 'types';
  editBuf: string;
  typesCursor: number;
  status: string;
  statusError: boolean;
}

// Choice rows cycle their values left-to-right; every change is saved and applied at once.
const ROWS: RowSpec[] = [
  { key: 'lang', kind: 'choice', labelKey: 'cfg_row_lang', envKey: 'GAI_LANG', values: ['en', 'zh'] },
  {
    key: 'commitLang',
    kind: 'choice',
    labelKey: 'cfg_row_commit_lang',
    envKey: 'GAI_COMMIT_LANG',
    values: ['zh', 'en'],
  },
  { key: 'model', kind: 'text', labelKey: 'cfg_row_model', envKey: 'GAI_MODEL' },
  { key: 'token', kind: 'text', labelKey: 'cfg_row_token', envKey: 'GAI_TOKEN' },
  { key: 'baseUrl', kind: 'text', labelKey: 'cfg_row_base_url', envKey: 'GAI_BASE_URL' },
  { key: 'types', kind: 'types', labelKey: 'cfg_row_types', envKey: 'GAI_COMMIT_TYPES' },
  { key: 'scope', kind: 'choice', labelKey: 'cfg_row_scope', envKey: 'GAI_COMMIT_SCOPE', values: ['1', '0'] },
  { key: 'body', kind: 'choice', labelKey: 'cfg_row_body', envKey: 'GAI_COMMIT_BODY', values: ['0', '1'] },
  {
    key: 'subjectMax',
    kind: 'choice',
    labelKey: 'cfg_row_subject_max',
    envKey: 'GAI_COMMIT_SUBJECT_MAX',
    values: ['50', '72', '100'],
  },
  { key: 'ticketPattern', kind: 'text', labelKey: 'cfg_row_ticket', envKey: 'GAI_COMMIT_TICKET' },
  {
    key: 'ticketRequired',
    kind: 'choice',
    labelKey: 'cfg_row_ticket_required',
    envKey: 'GAI_COMMIT_TICKET_REQUIRED',
    values: ['0', '1'],
  },
];

function readValue(settings: Settings, key: SettingKey): string {
  switch (key) {
    case 'lang':
      return settings.lang;
    case 'commitLang':
      return settings.commitLang;
    case 'model':
      return settings.model;
    case 'token':
      return settings.token;
    case 'baseUrl':
      return settings.baseUrl;
    case 'types':
      return settings.convention.types.join(',');
    case 'scope':
      return settings.convention.scope ? '1' : '0';
    case 'body':
      return settings.convention.body ? '1' : '0';
    case 'subjectMax':
      return String(settings.convention.subjectMax);
    case 'ticketPattern':
      return settings.convention.ticketPattern;
    case 'ticketRequired':
      return settings.convention.ticketRequired ? '1' : '0';
  }
}

function writeValue(settings: Settings, key: SettingKey, raw: string): void {
  const value = raw.trim();
  switch (key) {
    case 'lang':
      settings.lang = value === 'zh' ? 'zh' : 'en';
      setLang(settings.lang);
      break;
    case 'commitLang':
      settings.commitLang = value === 'zh' ? 'zh' : 'en';
      break;
    case 'model':
      settings.model = value;
      break;
    case 'token':
      settings.token = value;
      break;
    case 'baseUrl':
      settings.baseUrl = value;
      break;
    case 'types':
      settings.convention.types = value.split(',').filter((entry) => entry.length > 0);
      break;
    case 'scope':
      settings.convention.scope = value === '1';
      break;
    case 'body':
      settings.convention.body = value === '1';
      break;
    case 'subjectMax':
      settings.convention.subjectMax = Number.parseInt(value, 10);
      break;
    case 'ticketPattern':
      settings.convention.ticketPattern = value;
      break;
    case 'ticketRequired':
      settings.convention.ticketRequired = value === '1';
      break;
  }
}

function displayValue(key: SettingKey, raw: string): string {
  if (key === 'token') {
    return raw ? t('cfg_masked') : t('cfg_not_set');
  }
  if (key === 'scope' || key === 'body' || key === 'ticketRequired') {
    return raw === '1' ? t('cfg_yes') : t('cfg_no');
  }
  return raw || t('cfg_not_set');
}

function typeCandidates(settings: Settings): string[] {
  const extra = settings.convention.types.filter((entry) => !DEFAULT_TYPES.includes(entry));
  return [...DEFAULT_TYPES, ...extra];
}

function padTo(label: string, width: number): string {
  let display = 0;
  for (const char of label) {
    display += (char.codePointAt(0) ?? 0) > 0x2e7f ? 2 : 1;
  }
  return label + ' '.repeat(Math.max(1, width - display));
}

function keyName(chunk: string): { name: string; text: string } {
  switch (chunk) {
    case '\x1b[A':
      return { name: 'up', text: '' };
    case '\x1b[B':
      return { name: 'down', text: '' };
    case '\x1b[C':
      return { name: 'right', text: '' };
    case '\x1b[D':
      return { name: 'left', text: '' };
    case '\r':
    case '\n':
      return { name: 'enter', text: '' };
    case '\x1b':
      return { name: 'esc', text: '' };
    case '\x03':
      return { name: 'quit', text: '' };
    case '\x7f':
    case '\b':
      return { name: 'backspace', text: '' };
    case '\x20':
      return { name: 'space', text: '' };
    default: {
      if (chunk.length > 0 && !/[\x00-\x1f]/.test(chunk)) {
        return { name: 'text', text: chunk };
      }
      return { name: 'ignore', text: '' };
    }
  }
}

// Vim-style hjkl letters become arrows outside the text editor.
function navKey(name: string, text: string): string {
  if (name !== 'text') {
    return name;
  }
  switch (text) {
    case 'k':
      return 'up';
    case 'j':
      return 'down';
    case 'l':
      return 'right';
    case 'h':
      return 'left';
    default:
      return 'ignore';
  }
}

// One terminal chunk can carry several keystrokes or a paste; split it into single key events.
function keyEvents(input: string): Array<{ name: string; text: string }> {
  const events: Array<{ name: string; text: string }> = [];
  let index = 0;
  while (index < input.length) {
    const rest = input.slice(index);
    const sequence = /^\x1b\[[0-9;?]*[A-Za-z~]?|^\x1bO[A-Za-z]/.exec(rest);
    if (sequence) {
      events.push(keyName(sequence[0]));
      index += sequence[0].length;
      continue;
    }
    const char = String.fromCodePoint(rest.codePointAt(0) ?? 0);
    if (char === ' ' || /[\x00-\x1f\x7f]/.test(char)) {
      events.push(keyName(char));
      index += char.length;
      continue;
    }
    const run = /^[^\s\x00-\x1f\x7f]+/.exec(rest);
    if (run) {
      events.push({ name: 'text', text: run[0] });
      index += run[0].length;
      continue;
    }
    events.push(keyName(char));
    index += char.length;
  }
  return events;
}

function applyValue(state: TuiState, row: RowSpec, raw: string): void {
  if (row.key === 'ticketPattern' && raw.trim()) {
    try {
      new RegExp(raw.trim());
    } catch (error) {
      state.status = t('cfg_bad_ticket', { error: (error as Error).message });
      state.statusError = true;
      return;
    }
  }
  writeValue(state.settings, row.key, raw);
  state.status = row.key === 'lang' ? t('cfg_saved_lang', { path: state.configPath }) : t('cfg_saved', { path: state.configPath });
  state.statusError = false;
  try {
    saveSettings(state.settings, state.configPath);
  } catch (error) {
    state.status = (error as Error).message;
    state.statusError = true;
  }
}

function cycle(state: TuiState, row: RowSpec, step: number): void {
  const values = row.values ?? [];
  const current = values.indexOf(readValue(state.settings, row.key));
  const index = current === -1 ? 0 : current;
  applyValue(state, row, values[(index + step + values.length) % values.length]);
}

function toggleType(state: TuiState, row: RowSpec): void {
  const candidates = typeCandidates(state.settings);
  const type = candidates[state.typesCursor];
  const enabled = state.settings.convention.types;
  if (enabled.includes(type) && enabled.length === 1) {
    state.status = t('cfg_need_one_type');
    state.statusError = true;
    return;
  }
  const next = enabled.includes(type)
    ? enabled.filter((entry) => entry !== type)
    : candidates.filter((entry) => entry === type || enabled.includes(entry));
  applyValue(state, row, next.join(','));
}

function renderRows(state: TuiState): string[] {
  const lines: string[] = [];
  ROWS.forEach((row, index) => {
    const editing = state.mode === 'edit' && index === state.cursor;
    const marker = index === state.cursor ? '>' : ' ';
    const raw = readValue(state.settings, row.key);
    let shown = displayValue(row.key, raw);
    if (editing) {
      const buf = row.key === 'token' ? '*'.repeat(state.editBuf.length) : state.editBuf;
      shown = `${buf}  ${t('cfg_edit_hint')}`;
    } else if (state.envKeys.includes(row.envKey)) {
      shown = `${shown}   ${t('cfg_env_note', { key: row.envKey })}`;
    }
    lines.push(`${marker} ${padTo(t(row.labelKey), 26)}  ${shown}`);
  });
  return lines;
}

function renderTypes(state: TuiState): string[] {
  const lines: string[] = [];
  lines.push(`${t('cfg_title')} · ${t('cfg_types_title')}`);
  lines.push('-'.repeat(72));
  const enabled = state.settings.convention.types;
  typeCandidates(state.settings).forEach((type, index) => {
    const marker = index === state.typesCursor ? '>' : ' ';
    const box = enabled.includes(type) ? '[x]' : '[ ]';
    lines.push(`${marker} ${box} ${type}`);
  });
  lines.push('');
  lines.push(t('cfg_back_hint'));
  return lines;
}

function render(state: TuiState): string {
  const lines: string[] = [];
  if (state.mode === 'types') {
    lines.push(...renderTypes(state));
  } else {
    lines.push(`${t('cfg_title')}    ${t('cfg_path')}: ${state.configPath}`);
    lines.push('-'.repeat(72));
    lines.push(...renderRows(state));
    lines.push('-'.repeat(72));
    lines.push(t('cfg_hint'));
  }
  lines.push(state.status ? (state.statusError ? `! ${state.status}` : `+ ${state.status}`) : '');
  return `\x1b[H\x1b[2J${lines.join('\n')}\n`;
}

function onKey(state: TuiState, name: string, text: string): boolean {
  if (name === 'quit') {
    return false;
  }

  if (state.mode === 'types') {
    const key = navKey(name, text);
    if (name === 'esc' || (name === 'text' && text === 'q')) {
      state.mode = 'nav';
    } else if (key === 'up') {
      state.typesCursor = Math.max(0, state.typesCursor - 1);
    } else if (key === 'down') {
      state.typesCursor = Math.min(typeCandidates(state.settings).length - 1, state.typesCursor + 1);
    } else if (name === 'space' || name === 'enter') {
      toggleType(state, ROWS[state.cursor]);
    }
    return true;
  }

  if (state.mode === 'edit') {
    const row = ROWS[state.cursor];
    if (name === 'esc') {
      state.mode = 'nav';
    } else if (name === 'enter') {
      state.mode = 'nav';
      applyValue(state, row, state.editBuf);
    } else if (name === 'backspace') {
      state.editBuf = state.editBuf.slice(0, -1);
    } else if (name === 'space') {
      state.editBuf += ' ';
    } else if (name === 'text') {
      state.editBuf += text;
    }
    return true;
  }

  const key = navKey(name, text);
  if (key === 'ignore' && name === 'text' && text === 'q') {
    return false;
  }
  const row = ROWS[state.cursor];
  if (key === 'up') {
    state.cursor = Math.max(0, state.cursor - 1);
  } else if (key === 'down') {
    state.cursor = Math.min(ROWS.length - 1, state.cursor + 1);
  } else if (key === 'left' || key === 'right') {
    if (row.kind === 'choice') {
      cycle(state, row, key === 'right' ? 1 : -1);
    }
  } else if (name === 'enter') {
    if (row.kind === 'choice') {
      cycle(state, row, 1);
    } else if (row.kind === 'types') {
      state.mode = 'types';
      const first = readValue(state.settings, row.key).split(',')[0];
      state.typesCursor = Math.max(0, typeCandidates(state.settings).indexOf(first));
    } else {
      state.mode = 'edit';
      state.editBuf = row.key === 'token' ? '' : readValue(state.settings, row.key);
    }
  }
  return true;
}

/** Interactive settings screen: every selected value is saved and applied immediately. */
export async function openConfigTui(loaded: LoadedSettings): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new GaiError(t('err_no_tty'));
  }
  const state: TuiState = {
    settings: loaded.settings,
    configPath: loaded.configPath,
    envKeys: loaded.envKeys,
    cursor: 0,
    mode: 'nav',
    editBuf: '',
    typesCursor: 0,
    status: '',
    statusError: false,
  };

  await new Promise<void>((resolve) => {
    function cleanup(): void {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
      process.stdout.write('\x1b[?25h\x1b[?1049l');
      resolve();
    }

    function onData(chunk: Buffer): void {
      let handled = false;
      for (const event of keyEvents(chunk.toString('utf8'))) {
        if (event.name === 'ignore') {
          continue;
        }
        handled = true;
        if (!onKey(state, event.name, event.text)) {
          cleanup();
          return;
        }
      }
      if (handled) {
        process.stdout.write(render(state));
      }
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
    process.stdout.write('\x1b[?1049h\x1b[?25l');
    process.stdout.write(render(state));
  });
}
