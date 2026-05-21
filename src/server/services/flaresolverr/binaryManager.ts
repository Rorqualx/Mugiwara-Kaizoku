/**
 * FlareSolverr-Go Binary Manager
 *
 * Handles downloading and managing the flaresolverr-go binary from GitHub releases.
 * The Go version is faster and more memory-efficient than the Python version.
 *
 * @module flaresolverr/binaryManager
 */

import { spawnSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import axios from 'axios';

import { logger } from '@/utils/logger';

// =============================================================================
// Types
// =============================================================================

/** Supported platforms */
type Platform = 'darwin' | 'linux';

/** Supported architectures */
type Architecture = 'arm64' | 'amd64';

/** Platform information */
interface PlatformInfo {
  platform: Platform;
  arch: Architecture;
  binaryName: string;
}

/** GitHub release asset information */
interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

/** GitHub release information */
interface GitHubRelease {
  tag_name: string;
  name: string;
  assets: GitHubReleaseAsset[];
}

/** Binary information returned to callers */
export interface BinaryInfo {
  installed: boolean;
  path: string | null;
  version: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  platform: string;
  arch: string;
}

// =============================================================================
// Constants
// =============================================================================

/** GitHub repository for flaresolverr-go */
const GITHUB_REPO = 'Rorqualx/flaresolverr-go';

/** GitHub API URL for releases */
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/** Base directory for flaresolverr-go installation */
const INSTALL_BASE_DIR = path.join(os.homedir(), '.flaresolverr-go');

/** Binary directory */
const BIN_DIR = path.join(INSTALL_BASE_DIR, 'bin');

/** Version file path */
const VERSION_FILE = path.join(INSTALL_BASE_DIR, 'version');

/** Binary executable name */
const BINARY_NAME = process.platform === 'win32' ? 'flaresolverr-go.exe' : 'flaresolverr-go';

// =============================================================================
// Platform Detection
// =============================================================================

/**
 * Detect the current platform and architecture
 * @returns Platform information or null if unsupported
 *
 * flaresolverr-go (Rorqualx/flaresolverr-go) provides binaries for:
 * - darwin_amd64, darwin_arm64 (macOS Intel and Apple Silicon)
 * - linux_amd64, linux_arm64 (Linux x64 and ARM64)
 * - windows_amd64 (Windows x64)
 */
export function getPlatformInfo(): PlatformInfo | null {
  const platform = os.platform();
  const arch = os.arch();

  // Map Node.js platform names to release naming convention
  let mappedPlatform: Platform;
  if (platform === 'darwin') {
    mappedPlatform = 'darwin';
  } else if (platform === 'linux') {
    mappedPlatform = 'linux';
  } else {
    logger.warn('[BinaryManager] Unsupported platform', { platform });
    return null;
  }

  // Map Node.js arch names to release naming convention
  let mappedArch: Architecture;
  if (arch === 'arm64') {
    mappedArch = 'arm64';
  } else if (arch === 'x64') {
    mappedArch = 'amd64';
  } else {
    logger.warn('[BinaryManager] Unsupported architecture', { arch });
    return null;
  }

  // Construct expected asset name pattern (version will be filled in during download)
  // Format: flaresolverr-go_{version}_{platform}_{arch}.tar.gz (or .zip for windows)
  const binaryName = `${mappedPlatform}_${mappedArch}`;

  return {
    platform: mappedPlatform,
    arch: mappedArch,
    binaryName,
  };
}

// =============================================================================
// Path Helpers
// =============================================================================

/**
 * Get the path to the installed binary
 * @returns Path to binary or null if not installed
 */
export function getBinaryPath(): string | null {
  const binaryPath = path.join(BIN_DIR, BINARY_NAME);

  if (fs.existsSync(binaryPath)) {
    return binaryPath;
  }

  return null;
}

/**
 * Ensure the installation directories exist
 */
function ensureDirectories(): void {
  if (!fs.existsSync(INSTALL_BASE_DIR)) {
    fs.mkdirSync(INSTALL_BASE_DIR, { recursive: true });
  }

  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }
}

// =============================================================================
// Version Management
// =============================================================================

/**
 * Get the currently installed version from the version file
 * @returns Version string or null if not installed
 */
export function getCurrentVersion(): string | null {
  if (!fs.existsSync(VERSION_FILE)) {
    return null;
  }

  try {
    const version = fs.readFileSync(VERSION_FILE, 'utf-8').trim();
    return version.length > 0 ? version : null;
  } catch {
    return null;
  }
}

/**
 * Save the installed version to the version file
 */
function saveVersion(version: string): void {
  ensureDirectories();
  fs.writeFileSync(VERSION_FILE, version, 'utf-8');
}

/** In-memory cache for the latest GitHub release tag. */
const LATEST_VERSION_CACHE_TTL_MS = 5 * 60 * 1000;
let latestVersionCache: { tag: string; fetchedAt: number } | null = null;

/**
 * Fetch the latest release version from GitHub.
 *
 * Cached for 5 minutes to avoid burning GitHub's anonymous rate limit
 * (60/hr) when callers (settings page polling, dashboards) hit this
 * endpoint repeatedly. Failures are not cached — a transient error
 * shouldn't block the next legit request.
 *
 * @returns Latest version tag or null on error
 */
export async function getLatestVersion(): Promise<string | null> {
  if (latestVersionCache && Date.now() - latestVersionCache.fetchedAt < LATEST_VERSION_CACHE_TTL_MS) {
    return latestVersionCache.tag;
  }

  try {
    const response = await axios.get<GitHubRelease>(GITHUB_API_URL, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Mugiwara-Kaizoku',
      },
      timeout: 10000,
    });

    const tag = response.data.tag_name;
    latestVersionCache = { tag, fetchedAt: Date.now() };
    return tag;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('[BinaryManager] Failed to fetch latest version', { error: errorMessage });
    return null;
  }
}

// =============================================================================
// Binary Download Helpers
// =============================================================================

/**
 * Fetch release information from GitHub
 */
async function fetchReleaseInfo(releaseUrl: string): Promise<GitHubRelease | null> {
  try {
    const response = await axios.get<GitHubRelease>(releaseUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Mugiwara-Kaizoku',
      },
      timeout: 10000,
    });
    return response.data;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[BinaryManager] Failed to fetch release info', { error: errorMessage });
    return null;
  }
}

/**
 * Calculate download progress percentage
 */
function calculateProgressPercent(loaded: number, total: number | undefined): number {
  if (total === undefined || total === 0) {
    return 0;
  }
  return Math.round((loaded / total) * 100);
}

/**
 * Download binary file from URL
 */
async function downloadBinaryFile(
  asset: GitHubReleaseAsset
): Promise<ArrayBuffer | null> {
  try {
    const response = await axios.get<ArrayBuffer>(asset.browser_download_url, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mugiwara-Kaizoku' },
      timeout: 120000, // 2 minute timeout for download
      onDownloadProgress: (progressEvent) => {
        const percent = calculateProgressPercent(progressEvent.loaded, progressEvent.total);
        logger.debug('[BinaryManager] Download progress', { percent });
      },
    });
    return response.data;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[BinaryManager] Download failed', { error: errorMessage });
    return null;
  }
}

/**
 * Install the downloaded binary to disk.
 *
 * Takes a Node Buffer directly. The earlier signature accepted an ArrayBuffer
 * via `binaryContent.buffer as ArrayBuffer`, which leaks the entire shared
 * underlying ArrayBuffer (Node uses an 8 KB pool for small buffers) and
 * results in writing extra bytes from neighbouring allocations.
 */
function installBinaryToDisk(data: Buffer, targetVersion: string): boolean {
  try {
    ensureDirectories();
    const binaryPath = path.join(BIN_DIR, BINARY_NAME);
    fs.writeFileSync(binaryPath, data);
    fs.chmodSync(binaryPath, 0o755);
    saveVersion(targetVersion);
    logger.info('[BinaryManager] Binary installed successfully', {
      path: binaryPath,
      version: targetVersion,
      bytes: data.length,
    });
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[BinaryManager] Failed to install binary', { error: errorMessage });
    return false;
  }
}

/**
 * Try to fetch and parse the release's checksums file.
 *
 * Looks for a `checksums.txt`-style asset (sha256sum -b output: 64-hex
 * digest, optional `*` marker, filename). Returns a map keyed by asset
 * filename. Returns null if no checksums asset is present or fetching fails
 * — the caller should treat that as "verification unavailable" and decide
 * whether to proceed.
 */
async function fetchChecksums(release: GitHubRelease): Promise<Map<string, string> | null> {
  const checksumAsset = release.assets.find((a) =>
    a.name === 'checksums.txt' ||
    a.name === 'SHA256SUMS' ||
    a.name === 'sha256sums.txt' ||
    a.name.endsWith('.sha256') ||
    a.name.endsWith('.sha256sum')
  );
  if (!checksumAsset) {
    return null;
  }

  try {
    const response = await axios.get<string>(checksumAsset.browser_download_url, {
      headers: { 'User-Agent': 'Mugiwara-Kaizoku' },
      timeout: 10000,
      responseType: 'text',
      transformResponse: [(data: unknown): string => String(data)],
    });
    const map = new Map<string, string>();
    for (const line of response.data.split('\n')) {
      const match = /^([a-fA-F0-9]{64})\s+\*?(.+?)\s*$/.exec(line);
      if (match?.[1] !== undefined && match[2] !== undefined) {
        map.set(match[2], match[1].toLowerCase());
      }
    }
    return map.size > 0 ? map : null;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('[BinaryManager] Failed to fetch checksums', {
      asset: checksumAsset.name,
      error: errorMessage,
    });
    return null;
  }
}

/** Compute SHA-256 of a buffer and return it as a lowercase hex string. */
function sha256Hex(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// =============================================================================
// Binary Download
// =============================================================================

/**
 * Extract tar.gz archive and return the binary content
 */
function extractTarGz(archiveData: ArrayBuffer): Buffer | null {
  try {
    const tempDir = path.join(os.tmpdir(), `flaresolverr-go-extract-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const archivePath = path.join(tempDir, 'archive.tar.gz');
    fs.writeFileSync(archivePath, Buffer.from(archiveData));

    // Extract using tar command
    const tarResult = spawnSync('tar', ['-xzf', archivePath, '-C', tempDir], { stdio: 'pipe' });
    if (tarResult.status !== 0) {
      const stderr = tarResult.stderr.toString();
      logger.error('[BinaryManager] tar extraction failed', {
        status: tarResult.status,
        stderr: stderr.length > 0 ? stderr : undefined,
      });
      fs.rmSync(tempDir, { recursive: true, force: true });
      return null;
    }

    // Find the binary in extracted files
    // The binary is named 'flaresolverr' (not 'flaresolverr-go')
    const files = fs.readdirSync(tempDir);
    const binaryFile = files.find((f) =>
      f === 'flaresolverr' || f === 'flaresolverr.exe' ||
      f === 'flaresolverr-go' || f === 'flaresolverr-go.exe'
    );

    if (!binaryFile) {
      logger.error('[BinaryManager] Binary not found in archive', { extractedFiles: files });
      fs.rmSync(tempDir, { recursive: true, force: true });
      return null;
    }

    const binaryContent = fs.readFileSync(path.join(tempDir, binaryFile));

    // Cleanup temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });

    return binaryContent;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[BinaryManager] Failed to extract archive', { error: errorMessage });
    return null;
  }
}

/**
 * Download and install the flaresolverr-go binary
 * @param version Optional specific version to download (defaults to latest)
 * @returns True if download was successful
 */
export async function downloadBinary(version?: string): Promise<boolean> {
  const platformInfo = getPlatformInfo();

  if (!platformInfo) {
    logger.error('[BinaryManager] Cannot download binary: unsupported platform');
    return false;
  }

  // Determine version and release URL
  let targetVersion: string;
  let releaseUrl: string;

  if (version) {
    targetVersion = version;
    releaseUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${version}`;
  } else {
    const latestVersion = await getLatestVersion();
    if (!latestVersion) {
      logger.error('[BinaryManager] Failed to get latest version');
      return false;
    }
    targetVersion = latestVersion;
    releaseUrl = GITHUB_API_URL;
  }

  logger.info('[BinaryManager] Downloading flaresolverr-go', {
    version: targetVersion,
    platform: platformInfo.platform,
    arch: platformInfo.arch,
  });

  // Fetch release info
  const releaseInfo = await fetchReleaseInfo(releaseUrl);
  if (!releaseInfo) {
    return false;
  }

  // Find matching asset by platform pattern (e.g., darwin_arm64)
  // Asset format: flaresolverr-go_{version}_{platform}_{arch}.tar.gz
  const assetPattern = `${platformInfo.platform}_${platformInfo.arch}`;
  const asset = releaseInfo.assets.find((a) =>
    a.name.includes(assetPattern) && (a.name.endsWith('.tar.gz') || a.name.endsWith('.zip'))
  );

  if (!asset) {
    logger.error('[BinaryManager] Binary not found for platform', {
      expected: assetPattern,
      available: releaseInfo.assets.map((a) => a.name),
    });
    return false;
  }

  logger.info('[BinaryManager] Downloading binary archive', {
    asset: asset.name,
    url: asset.browser_download_url,
    size: asset.size,
  });

  // Download the archive
  const archiveData = await downloadBinaryFile(asset);
  if (!archiveData) {
    return false;
  }

  // Verify the archive against the release's published checksums (if any).
  // If checksums are absent we proceed with a warning — the upstream may
  // simply not publish them — but a checksum *mismatch* is fatal.
  const checksums = await fetchChecksums(releaseInfo);
  if (checksums) {
    const expected = checksums.get(asset.name);
    if (!expected) {
      logger.warn('[BinaryManager] Checksum file missing entry for asset', {
        asset: asset.name,
        knownEntries: Array.from(checksums.keys()),
      });
    } else {
      const actual = sha256Hex(Buffer.from(archiveData));
      if (actual.toLowerCase() !== expected.toLowerCase()) {
        logger.error('[BinaryManager] Archive checksum mismatch — refusing to install', {
          asset: asset.name,
          expected,
          actual,
        });
        return false;
      }
      logger.info('[BinaryManager] Archive checksum verified', {
        asset: asset.name,
        sha256: actual,
      });
    }
  } else {
    logger.warn('[BinaryManager] No checksums published for release — installing without verification', {
      version: targetVersion,
    });
  }

  // Extract the binary from the archive
  logger.info('[BinaryManager] Extracting binary...');
  const binaryContent = extractTarGz(archiveData);
  if (!binaryContent) {
    return false;
  }

  // Install the extracted binary
  return installBinaryToDisk(binaryContent, targetVersion);
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Ensure the binary exists, downloading if necessary
 * @returns Path to the binary or null if unavailable
 */
export async function ensureBinaryExists(): Promise<string | null> {
  // Check if already installed
  const existingPath = getBinaryPath();

  if (existingPath) {
    logger.debug('[BinaryManager] Binary already installed', { path: existingPath });
    return existingPath;
  }

  logger.info('[BinaryManager] Binary not found, downloading...');

  // Download latest version
  const success = await downloadBinary();

  if (!success) {
    return null;
  }

  return getBinaryPath();
}

/**
 * Get comprehensive binary information
 * @returns Binary status information
 */
export async function getBinaryInfo(): Promise<BinaryInfo> {
  const platformInfo = getPlatformInfo();
  const binaryPath = getBinaryPath();
  const currentVersion = getCurrentVersion();
  const latestVersion = await getLatestVersion();

  // Determine if update is available
  let updateAvailable = false;
  if (currentVersion && latestVersion && currentVersion !== latestVersion) {
    // Handle 'dev' or pre-release versions
    if (currentVersion !== 'dev' && latestVersion !== 'dev') {
      updateAvailable = true;
    }
  }

  return {
    installed: binaryPath !== null,
    path: binaryPath,
    version: currentVersion,
    latestVersion,
    updateAvailable,
    platform: platformInfo?.platform ?? 'unknown',
    arch: platformInfo?.arch ?? 'unknown',
  };
}

/**
 * Update the binary to the latest version
 * @returns True if update was successful
 */
export async function updateBinary(): Promise<boolean> {
  logger.info('[BinaryManager] Updating to latest version');

  // Remove existing binary
  const existingPath = getBinaryPath();
  if (existingPath) {
    try {
      fs.unlinkSync(existingPath);
    } catch {
      // Ignore removal errors
    }
  }

  // Remove version file
  if (fs.existsSync(VERSION_FILE)) {
    try {
      fs.unlinkSync(VERSION_FILE);
    } catch {
      // Ignore removal errors
    }
  }

  // Download fresh
  return downloadBinary();
}

/**
 * Remove the installed binary and clean up
 */
export function removeBinary(): void {
  const binaryPath = getBinaryPath();

  if (binaryPath) {
    try {
      fs.unlinkSync(binaryPath);
      logger.info('[BinaryManager] Binary removed', { path: binaryPath });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('[BinaryManager] Failed to remove binary', { error: errorMessage });
    }
  }

  if (fs.existsSync(VERSION_FILE)) {
    try {
      fs.unlinkSync(VERSION_FILE);
    } catch {
      // Ignore
    }
  }
}

/**
 * Verify binary is executable by running a simple test
 * @returns True if binary runs successfully
 */
export function verifyBinary(): boolean {
  const binaryPath = getBinaryPath();

  if (!binaryPath) {
    return false;
  }

  // Try running with --help — flaresolverr-go might not have a version flag,
  // so we just check it's executable.
  const result = spawnSync(binaryPath, ['--help'], {
    timeout: 5000,
    stdio: 'ignore',
  });
  if (result.status === 0) {
    return true;
  }
  // Binary exists but might not be runnable (architecture mismatch, etc.)
  logger.warn('[BinaryManager] Binary verification failed - may not be executable');
  return false;
}
