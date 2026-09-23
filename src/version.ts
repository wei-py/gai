import pkg from '../package.json';

// GAI_VERSION/GAI_COMMIT/GAI_BUILD_DATE/GAI_RELEASE_REPO are baked by scripts/build.ts via --define.
export const VERSION: string = process.env.GAI_VERSION ?? pkg.version;
export const COMMIT: string = process.env.GAI_COMMIT ?? 'dev';
export const BUILD_DATE: string = process.env.GAI_BUILD_DATE ?? '';
export const RELEASE_REPO: string = process.env.GAI_RELEASE_REPO ?? '';

export function versionLine(): string {
  const meta: string[] = [COMMIT === 'dev' ? 'source build' : `commit ${COMMIT}`];
  if (BUILD_DATE) {
    meta.push(`built ${BUILD_DATE}`);
  }
  meta.push(`${process.platform}-${process.arch}`);
  return `gai ${VERSION} (${meta.join(', ')})`;
}

// Release artifact naming contract, shared by scripts/build.ts and gai update.
export function assetName(platform: string = process.platform, arch: string = process.arch): string {
  const family = platform === 'win32' ? 'windows' : platform;
  return `gai-${family}-${arch}${platform === 'win32' ? '.exe' : ''}`;
}
