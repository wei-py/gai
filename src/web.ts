import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer, IncomingMessage } from 'node:http';
import { compileMessagePattern, loadSettings, saveSettings, Settings } from './config';
import { GaiError } from './util';
import { renderWebPage } from './web-page';

function validateSettings(value: unknown): Settings {
  const bad = (message: string): never => { throw new GaiError(message); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad('配置必须是对象。');
  const settings = value as Settings;
  const text = (value: unknown, label: string): string => {
    if (typeof value !== 'string' || /[\r\n\0]/.test(value) || value !== value.trim()
      || (value.length >= 2 && ['\"', "'"].includes(value[0]) && value.at(-1) === value[0])) {
      bad(`${label} 必须是单行文本，不含首尾空白或成对外层引号。`);
    }
    return value as string;
  };
  for (const key of ['lang', 'commitLang'] as const) {
    if (settings[key] !== 'en' && settings[key] !== 'zh') bad('语言必须是 en 或 zh。');
  }
  text(settings.token, 'Token');
  text(settings.model, '模型');
  const baseUrl = text(settings.baseUrl, 'API 地址');
  try {
    if (!['https:', 'http:'].includes(new URL(baseUrl).protocol)) bad('API 地址必须使用 HTTP 或 HTTPS。');
  } catch { bad('API 地址必须是完整的 HTTP 或 HTTPS URL。'); }
  const c = settings.convention;
  if (!c || typeof c !== 'object' || Array.isArray(c)) bad('缺少提交规范。');
  if (!Array.isArray(c.types) || !c.types.length || c.types.some(type => typeof type !== 'string' || !/^[a-z]+$/.test(type))) {
    bad('提交类型必须是小写英文字母，且至少包含一项。');
  }
  if (!Array.isArray(c.scopes) || c.scopes.some(scope => !text(scope, 'Scope') || scope.includes(','))) bad('Scope 不能为空或包含逗号。');
  for (const key of ['scope', 'emoji', 'body', 'ticketRequired'] as const) {
    if (typeof c[key] !== 'boolean') bad(`${key} 必须是布尔值。`);
  }
  if (!Number.isInteger(c.subjectMax) || c.subjectMax < 1 || c.subjectMax > 300) bad('标题长度必须是 1–300 的整数。');
  compileMessagePattern(text(c.pattern, '提交信息正则'));
  text(c.ticketPattern, '工单正则');
  if (c.ticketPattern) {
    try { new RegExp(c.ticketPattern); } catch { bad('工单正则无效。'); }
  }
  return settings;
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    throw new GaiError('请求必须使用 application/json。');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new GaiError('配置请求超过 64 KiB。');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new GaiError('配置 JSON 无效。'); }
}

export async function openWebConfig(configPath?: string): Promise<void> {
  const initial = loadSettings(configPath, undefined, true);
  const secret = randomBytes(32).toString('hex');
  const page = renderWebPage(secret);
  let origin = '';
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const json = (status: number, data: unknown) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(data));
    };
    if (request.headers.host !== new URL(origin).host || (request.headers.origin && request.headers.origin !== origin)
      || request.headers['sec-fetch-site'] === 'cross-site') {
      json(403, { error: '拒绝非本机同源请求。' });
      return;
    }
    if (request.url === '/' && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(page);
      return;
    }
    if (request.url !== '/api/settings') { json(404, { error: 'Not found' }); return; }
    if (request.headers['x-gai-token'] !== secret) { json(403, { error: '配置会话无效，请重新打开网页。' }); return; }
    try {
      if (request.method === 'POST') {
        const settings = validateSettings(await readBody(request));
        const loaded = loadSettings(initial.configPath, undefined, true);
        saveSettings(settings, loaded.configPath, loaded.envKeys);
      } else if (request.method !== 'GET') {
        json(405, { error: 'Method not allowed' });
        return;
      }
      json(200, loadSettings(initial.configPath, undefined, true));
    } catch (error) {
      json(error instanceof GaiError ? 400 : 500, { error: (error as Error).message });
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new GaiError('无法获取网页服务地址。');
  origin = `http://127.0.0.1:${address.port}`;
  console.log(`gai web: ${origin}\n配置文件: ${initial.configPath}\n按 Ctrl+C 停止服务。`);
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
  const child = spawn(command, [origin], { stdio: 'ignore' });
  child.on('error', () => console.log(`请在浏览器中打开 ${origin}`));
  child.unref();
  await new Promise<void>(resolve => {
    const close = () => {
      process.off('SIGINT', close);
      process.off('SIGTERM', close);
      server.close(() => resolve());
      server.closeIdleConnections();
    };
    process.on('SIGINT', close);
    process.on('SIGTERM', close);
  });
}
