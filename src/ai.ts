import { t } from './i18n';
import { GaiError } from './util';

export interface AiConfig {
  token: string;
  model: string;
  baseUrl: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const REQUEST_TIMEOUT_MS = 120_000;

async function postChat(url: string, token: string, payload: Record<string, unknown>): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

// OpenAI-compatible shape: choices[0].message.{content,reasoning_content}.
function messageContent(container: unknown): string {
  if (!container || typeof container !== 'object' || !('message' in container)) {
    return '';
  }
  const message = container.message;
  if (!message || typeof message !== 'object') {
    return '';
  }
  if ('content' in message && typeof message.content === 'string' && message.content.trim()) {
    return message.content;
  }
  if ('reasoning_content' in message && typeof message.reasoning_content === 'string') {
    return message.reasoning_content;
  }
  return '';
}

export async function callAI(messages: ChatMessage[], config: AiConfig): Promise<string> {
  const apiModel = config.model.slice(config.model.lastIndexOf('/') + 1);
  const apiUrl = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  console.log(t('analyzing'));
  console.log(t('model_line', { model: config.model }));
  console.log();

  const payload: Record<string, unknown> = {
    model: apiModel,
    messages,
    max_tokens: 8192,
    temperature: 0,
  };

  let response: Response;
  try {
    response = await postChat(apiUrl, config.token, { ...payload, response_format: { type: 'json_object' } });
    if (response.status === 400) {
      // Not every OpenAI-compatible provider supports response_format; retry without it.
      response = await postChat(apiUrl, config.token, payload);
    }
  } catch (error) {
    throw new GaiError(t('err_ai_request', { error: (error as Error).message }));
  }

  const raw = await response.text();
  if (!response.ok) {
    throw new GaiError(t('err_ai_status', { status: response.status, body: raw }));
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new GaiError(t('err_ai_json', { body: raw }));
  }

  let content = '';
  if (data && typeof data === 'object') {
    const choices = 'choices' in data ? data.choices : undefined;
    content = messageContent(Array.isArray(choices) ? choices[0] : undefined);
    if (!content && 'content' in data && typeof data.content === 'string') {
      content = data.content;
    }
  }
  if (!content.trim()) {
    throw new GaiError(t('err_ai_empty', { body: raw }));
  }
  return content;
}
