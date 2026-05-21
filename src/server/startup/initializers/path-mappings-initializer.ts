/**
 * Path Mappings Initializer
 *
 * Seeds sensible default `path_mappings` entries the first time the app boots
 * without any user-configured mappings. Deployment-mode aware:
 *
 *  - In Docker: seeds an identity mapping using `DOWNLOAD_FOLDER` (or `/downloads`
 *    if the env isn't set). The compose stack is expected to mount a shared
 *    volume at that path on both the Mugiwara container and the download-client
 *    container, so client-reported paths resolve identically.
 *
 *  - On the host: probes a handful of common mount points and seeds identity
 *    mappings for each one that's actually accessible. We deliberately don't
 *    invent a `/data/completed → /Volumes/Public/data/completed` translation
 *    here — that's the kind of well-meaning guess that left the Steins;Gate
 *    chapters silently stuck. Identity mappings only.
 *
 * Idempotent: the seeder writes a `path_mappings.seeded_at` Config marker
 * (mirrors the pattern used by `transmissionCredentialsCleanupMigration.ts`)
 * and never overwrites user-set mappings. Restart-safe.
 */

import { promises as fs, constants as fsConstants } from 'fs';

import { getGlobalConfigService } from '@/server/services/config/globalConfigService';
import { type PathMapping } from '@/server/services/download/pathMapper';
import { detectDeploymentMode } from '@/server/utils/deployment-mode';
import { logger } from '@/utils/logger';

const SEEDED_MARKER_KEY = 'path_mappings.seeded_at';
const PATH_MAPPINGS_KEY = 'path_mappings';

/** Common mount-point candidates probed on host deployments. */
const HOST_PROBE_CANDIDATES = [
  '/Volumes/Public',
  '/Volumes/manga',
  '/mnt',
  '/mnt/data',
  '/mnt/downloads',
  '/data/completed',
];

async function pathIsReadable(p: string): Promise<boolean> {
  try {
    await fs.access(p, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function loadExistingMappings(): Promise<PathMapping[]> {
  const configService = getGlobalConfigService();
  const raw = await configService.get<string>(PATH_MAPPINGS_KEY, '[]');
  if (typeof raw !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as PathMapping[];
    return [];
  } catch {
    return [];
  }
}

function buildDockerSeed(): PathMapping[] {
  const dlFolder = process.env['DOWNLOAD_FOLDER'] ?? '/downloads';
  return [{
    remotePath: dlFolder,
    localPath: dlFolder,
    description: 'Docker identity mapping (auto-seeded)',
  }];
}

async function buildHostSeed(): Promise<PathMapping[]> {
  // Probe in parallel so a slow SMB mount doesn't gate the rest of the boot.
  const probes = await Promise.all(
    HOST_PROBE_CANDIDATES.map(async (candidate) => ({
      candidate,
      readable: await pathIsReadable(candidate),
    })),
  );
  return probes
    .filter(p => p.readable)
    .map(p => ({
      remotePath: p.candidate,
      localPath: p.candidate,
      description: 'Auto-seeded on host boot (identity mapping for accessible mount)',
    }));
}

/**
 * Seed path-mapping defaults the first time the app boots. No-op when the
 * user has already set mappings or when the marker is present.
 */
export async function initializePathMappings(): Promise<void> {
  const configService = getGlobalConfigService();

  const marker = await configService.get<string>(SEEDED_MARKER_KEY, '');
  if (marker && marker.length > 0) {
    logger.info('[path-mappings-initializer] Seeder marker present, skipping');
    return;
  }

  const existing = await loadExistingMappings();
  if (existing.length > 0) {
    logger.info(`[path-mappings-initializer] ${existing.length} mappings already present, skipping seed`);
    await configService.set(SEEDED_MARKER_KEY, new Date().toISOString());
    return;
  }

  const mode = detectDeploymentMode();
  const seed = mode === 'docker' ? buildDockerSeed() : await buildHostSeed();

  if (seed.length === 0) {
    logger.info(`[path-mappings-initializer] No accessible default paths to seed (mode: ${mode})`);
    await configService.set(SEEDED_MARKER_KEY, new Date().toISOString());
    return;
  }

  await configService.set(PATH_MAPPINGS_KEY, JSON.stringify(seed));
  await configService.set(SEEDED_MARKER_KEY, new Date().toISOString());
  logger.info(
    `[path-mappings-initializer] Seeded ${seed.length} default mapping${seed.length === 1 ? '' : 's'} (mode: ${mode})`,
    { seeds: seed.map(s => s.remotePath) },
  );
}
