import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { GaiError, isRecord } from './util';
import { assetName, RELEASE_REPO, VERSION } from './version';

const DEFAULT_API_BASE = 'https://api.github.com';

interface ReleaseAsset {
  name: string;
  apiUrl: string;
  downloadUrl: string;
}

function parseVersion(value: string): number[] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compareVersions(a: number[], b: number[]): number {
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) {
      return a[index] - b[index];
    }
  }
  return 0;
}

function githubHeaders(accept: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    'User-Agent': `gai/${VERSION}`,
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function parseAssets(value: unknown): ReleaseAsset[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const assets: ReleaseAsset[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.name !== 'string') {
      continue;
    }
    assets.push({
      name: entry.name,
      apiUrl: typeof entry.url === 'string' ? entry.url : '',
      downloadUrl: typeof entry.browser_download_url === 'string' ? entry.browser_download_url : '',
    });
  }
  return assets;
}

function parseChecksums(text: string): Map<string, string> {
  const sums = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^([0-9a-fA-F]{64})\s+\*?(.+)$/.exec(line.trim());
    if (match) {
      sums.set(match[2].trim(), match[1].toLowerCase());
    }
  }
  return sums;
}

export async function selfUpdate(): Promise<number> {
  const fromSource = path.basename(process.execPath).startsWith('bun');
  if (fromSource) {
    console.log(`Running from source (${process.execPath}); self-update only works with a compiled gai binary.`);
    return 1;
  }

  const repo = process.env.GAI_UPDATE_REPO || RELEASE_REPO;
  if (!repo) {
    throw new GaiError(
      'Update source is not configured for this build.\n' +
        'Set GAI_UPDATE_REPO=<owner>/<repo>, or build from a checkout whose git remote origin is the GitHub repo.',
    );
  }

  const apiBase = (process.env.GAI_UPDATE_API || DEFAULT_API_BASE).replace(/\/+$/, '');
  const useToken = Boolean(process.env.GITHUB_TOKEN || process.env.GH_TOKEN);
  const fetchHeaders = githubHeaders(useToken ? 'application/octet-stream' : 'application/vnd.github+json');
  const want = assetName();
  const exePath = process.execPath;
  const exeDir = path.dirname(exePath);

  console.log(`Current: gai ${VERSION} (${want})`);
  console.log(`Checking ${repo} for updates...`);

  let release: Record<string, unknown>;
  try {
    const res = await fetch(`${apiBase}/repos/${repo}/releases/latest`, {
      headers: githubHeaders('application/vnd.github+json'),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 404) {
      throw new GaiError(
        `No releases found for ${repo}.\n` +
          `Publish a GitHub release with a ${want} asset plus checksums.txt to enable gai update.`,
      );
    }
    if (!res.ok) {
      throw new GaiError(`Release check failed (HTTP ${res.status}):\n${await res.text()}`);
    }
    const payload: unknown = await res.json();
    if (!isRecord(payload)) {
      throw new GaiError('Release API returned an unexpected payload.');
    }
    release = payload;
  } catch (error) {
    if (error instanceof GaiError) {
      throw error;
    }
    throw new GaiError(`Release check failed: ${(error as Error).message}`);
  }

  const tag = typeof release.tag_name === 'string' ? release.tag_name : '';
  const latest = parseVersion(tag);
  const current = parseVersion(VERSION);
  if (!latest) {
    throw new GaiError(`Cannot parse release tag: ${tag || '[empty]'}`);
  }
  if (current && compareVersions(latest, current) <= 0) {
    console.log(`Already up to date (gai ${VERSION}, latest ${tag}).`);
    return 0;
  }

  const assets = parseAssets(release.assets);
  const binary = assets.find((asset) => asset.name === want);
  const sumsAsset = assets.find((asset) => asset.name === 'checksums.txt');
  if (!binary) {
    throw new GaiError(
      `Release ${tag} has no asset named ${want}.\n` +
        `Available: ${assets.map((asset) => asset.name).join(', ') || '[none]'}`,
    );
  }
  if (!sumsAsset) {
    throw new GaiError(`Release ${tag} has no checksums.txt; refusing to install an unverified binary.`);
  }

  const binaryUrl = useToken ? binary.apiUrl : binary.downloadUrl;
  const sumsUrl = useToken ? sumsAsset.apiUrl : sumsAsset.downloadUrl;

  let expected = '';
  try {
    const res = await fetch(sumsUrl, { headers: fetchHeaders, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      throw new GaiError(`Failed to download checksums.txt (HTTP ${res.status}).`);
    }
    expected = parseChecksums(await res.text()).get(want) ?? '';
  } catch (error) {
    if (error instanceof GaiError) {
      throw error;
    }
    throw new GaiError(`Failed to download checksums.txt: ${(error as Error).message}`);
  }
  if (!expected) {
    throw new GaiError(`checksums.txt has no entry for ${want}.`);
  }

  try {
    fs.accessSync(exeDir, fs.constants.W_OK);
  } catch {
    throw new GaiError(`No write permission for ${exeDir}.\nRe-run with sudo or install manually.`);
  }

  const tmpPath = path.join(exeDir, `.gai-update-${process.pid}${path.extname(exePath)}`);
  console.log(`Downloading gai ${tag} (${want})...`);

  let actual = '';
  try {
    const res = await fetch(binaryUrl, { headers: fetchHeaders, signal: AbortSignal.timeout(600_000) });
    if (!res.ok || !res.body) {
      throw new GaiError(`Download failed (HTTP ${res.status}).`);
    }
    const hasher = createHash('sha256');
    const fd = fs.openSync(tmpPath, 'w');
    try {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        const buf = Buffer.from(value);
        hasher.update(buf);
        fs.writeSync(fd, buf);
      }
    } finally {
      fs.closeSync(fd);
    }
    actual = hasher.digest('hex');
  } catch (error) {
    fs.rmSync(tmpPath, { force: true });
    if (error instanceof GaiError) {
      throw error;
    }
    throw new GaiError(`Download failed: ${(error as Error).message}`);
  }

  if (actual !== expected) {
    fs.rmSync(tmpPath, { force: true });
    throw new GaiError(`Checksum mismatch for ${want}: expected ${expected}, got ${actual}.`);
  }
  fs.chmodSync(tmpPath, 0o755);

  try {
    fs.renameSync(tmpPath, exePath);
  } catch {
    // Windows cannot replace a running executable in place: park the old binary, move the new one in.
    try {
      fs.renameSync(exePath, `${exePath}.old`);
      fs.renameSync(tmpPath, exePath);
      console.log(`Previous binary kept at ${exePath}.old; delete it once verified.`);
    } catch (fallbackError) {
      fs.rmSync(tmpPath, { force: true });
      throw new GaiError(
        `Cannot replace ${exePath}: ${(fallbackError as Error).message}\n` +
          'If it lives in a system directory, re-run with sudo or install manually.',
      );
    }
  }

  console.log(`Updated gai ${VERSION} -> ${tag}.`);
  return 0;
}
