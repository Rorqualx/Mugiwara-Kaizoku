/**
 * Path Mapping Diagnostics Router
 *
 * Live cross-check of configured `path_mappings` against what download
 * clients actually report. This is the action that would have caught the
 * Steins;Gate failure within five seconds: Transmission says it saves to
 * /data/completed, the mapping promises that resolves to /Volumes/Public/…,
 * but the resulting local path never had the torrent's folder. Without this
 * surface the failure presents as "0 chapters imported" with no signal.
 *
 * Today this only probes Transmission. SAB and NZBGet follow the same
 * shape — extend with sibling cases when needed.
 */

import { prisma } from '@/server/db';
import { TransmissionClient } from '@/server/services/download/clients/transmission';
import { getPathMapper } from '@/server/services/download/pathMapper';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { detectDeploymentMode, type DeploymentMode } from '@/server/utils/deployment-mode';
import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

/** Single-path probe result inside a client diagnostic. */
export interface PathProbeResult {
  remotePath: string;
  resolvedPath: string;
  accessible: boolean;
  mappingUsed?: { remotePath: string; localPath: string; description?: string };
  error?: string;
}

/** Per-client diagnostic block. */
export interface ClientDiagnostic {
  client: 'transmission' | 'sabnzbd' | 'nzbget';
  enabled: boolean;
  reachable: boolean;
  rpcError?: string;
  sessionDir?: PathProbeResult;
  sampleTorrentDir?: PathProbeResult;
  /** Human-readable suggestion to surface in the UI when something is wrong. */
  suggestion?: string;
}

/** Top-level diagnostics payload. */
export interface DiagnosticsReport {
  deploymentMode: DeploymentMode;
  clients: ClientDiagnostic[];
}

async function probe(remotePath: string): Promise<PathProbeResult> {
  const pathMapper = getPathMapper();
  await pathMapper.loadFromDatabase();
  const result = await pathMapper.mapAndProbe(remotePath);
  const out: PathProbeResult = {
    remotePath,
    resolvedPath: result.localPath,
    accessible: result.accessible,
  };
  if (result.mappingUsed) {
    out.mappingUsed = {
      remotePath: result.mappingUsed.remotePath,
      localPath: result.mappingUsed.localPath,
      ...(result.mappingUsed.description !== undefined ? { description: result.mappingUsed.description } : {}),
    };
  }
  if (result.error !== undefined) out.error = result.error;
  return out;
}

function suggestionFor(
  diag: Pick<ClientDiagnostic, 'reachable' | 'sessionDir' | 'sampleTorrentDir' | 'rpcError'>,
): string | undefined {
  if (!diag.reachable) {
    return `RPC unreachable: ${diag.rpcError ?? 'unknown error'}. Verify the client is running and the host/port in Settings → Download Clients matches.`;
  }
  const probes = [diag.sessionDir, diag.sampleTorrentDir].filter((p): p is PathProbeResult => p !== undefined);
  const example = probes.find(p => !p.accessible);
  if (!example) return undefined;
  if (!example.mappingUsed) {
    return `No path-mapping rule matches '${example.remotePath}'. Add a mapping that translates this client's reported path to one this server can read.`;
  }
  return `Mapping ${example.mappingUsed.remotePath} → ${example.mappingUsed.localPath} doesn't resolve on this host: ${example.error ?? 'path not readable'}. Either the host volume isn't mounted, the mount is read-only, or the client downloads to a different path than this rule expects.`;
}

async function loadTransmissionConfig(): Promise<{ enabled: boolean; baseURL: string | null }> {
  const rows = await prisma.config.findMany({
    where: { key: { in: ['download.transmission.enabled', 'download.transmission.baseURL'] } },
    select: { key: true, value: true },
  });
  const map = new Map(rows.map(r => [r.key, r.value]));
  return {
    enabled: (map.get('download.transmission.enabled') ?? '').toLowerCase() === 'true',
    baseURL: map.get('download.transmission.baseURL') ?? null,
  };
}

/** Build a TransmissionClient from the configured baseURL, returning null
 *  when the config is incomplete or the URL won't parse. */
function buildTransmissionClient(baseURL: string): TransmissionClient | { error: string } {
  try {
    const parsed = new URL(baseURL);
    return new TransmissionClient({
      host: parsed.hostname,
      port: parseInt(parsed.port || '9091', 10),
      ssl: parsed.protocol === 'https:',
    });
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Probe the session-level download-dir reported by the RPC handshake. */
async function probeSessionDir(client: TransmissionClient): Promise<PathProbeResult | undefined> {
  const sessionInfo = await client.getSessionInfo();
  if (sessionInfo.downloadDir) return probe(sessionInfo.downloadDir);
  return undefined;
}

/** Probe one in-flight torrent's downloadDir to catch per-torrent overrides. */
async function probeSampleTorrent(client: TransmissionClient): Promise<PathProbeResult | undefined> {
  try {
    const items = await client.getAllItems();
    if (!isSuccess(items) || items.data.length === 0) return undefined;
    const first = items.data[0];
    const raw: unknown = (first as unknown as { savePath?: string; downloadDir?: string }).savePath
      ?? (first as unknown as { savePath?: string; downloadDir?: string }).downloadDir;
    if (typeof raw !== 'string' || raw.length === 0) return undefined;
    return await probe(raw);
  } catch (err: unknown) {
    logger.warn('[pathMapping/diagnostics] Failed to sample a torrent', {
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

async function runTransmissionDiagnostic(): Promise<ClientDiagnostic> {
  const config = await loadTransmissionConfig();
  if (!config.enabled || !config.baseURL) {
    return {
      client: 'transmission',
      enabled: config.enabled,
      reachable: false,
      rpcError: !config.enabled ? 'Transmission is disabled' : 'Missing baseURL in Config',
    };
  }
  const built = buildTransmissionClient(config.baseURL);
  if (!(built instanceof TransmissionClient)) {
    return { client: 'transmission', enabled: true, reachable: false, rpcError: built.error };
  }

  const diagnostic: ClientDiagnostic = { client: 'transmission', enabled: true, reachable: false };
  try {
    const sessionDir = await probeSessionDir(built);
    if (sessionDir !== undefined) diagnostic.sessionDir = sessionDir;
    diagnostic.reachable = true;
  } catch (err: unknown) {
    diagnostic.rpcError = err instanceof Error ? err.message : String(err);
    const sug = suggestionFor(diagnostic);
    if (sug !== undefined) diagnostic.suggestion = sug;
    return diagnostic;
  }
  const sample = await probeSampleTorrent(built);
  if (sample !== undefined) diagnostic.sampleTorrentDir = sample;
  const sug = suggestionFor(diagnostic);
  if (sug !== undefined) diagnostic.suggestion = sug;
  return diagnostic;
}

export const pathMappingDiagnosticsRouter = router({
  /**
   * Returns the detected deployment mode so the settings UI can show a chip
   * ("docker" / "host"). Cheap, cached for the process lifetime by the
   * detector itself.
   */
  getDeploymentMode: protectedProcedure.query((): { deploymentMode: DeploymentMode } => {
    return { deploymentMode: detectDeploymentMode() };
  }),

  /**
   * Run a live probe of every enabled download client and cross-check its
   * reported paths against the configured `path_mappings`. Read-only and
   * cheap — safe to call from a button click in the settings UI.
   */
  diagnoseLive: protectedProcedure.query(async (): Promise<DiagnosticsReport> => {
    const deploymentMode = detectDeploymentMode();
    const clients = await Promise.all([
      runTransmissionDiagnostic(),
    ]);
    return { deploymentMode, clients };
  }),
});
