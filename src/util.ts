export class GaiError extends Error {}

export interface CommitSpec {
  message: string;
  files: string[];
}

export function fail(message: string, code = 1): never {
  console.error(message);
  process.exit(code);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
