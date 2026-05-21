/**
 * Smoke test: verifies the catch-path notification wiring added to
 * phase-indexer-search.ts:loadEnabledSources.
 *
 * loadEnabledSources is module-private, so we test the runtime risk
 * directly: spy on realtimeEmitter.emit, invoke emitNotification with
 * the exact payload shape the catch uses, and confirm it broadcasts
 * to the system:notifications channel.
 *
 * Usage: bun run scripts/smoke/verify-indexer-config-toast.ts
 */
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { logger } from '@/utils/logger';

interface CapturedEvent {
  channel: string;
  type: string;
  data: unknown;
}

async function main(): Promise<void> {
  const captured: CapturedEvent[] = [];

  const original = realtimeEmitter.emit.bind(realtimeEmitter);
  (realtimeEmitter as unknown as { emit: typeof original }).emit = async (
    channel: string,
    type: string,
    data: unknown,
  ): Promise<void> => {
    captured.push({ channel, type, data });
    return original(channel, type, data);
  };

  const errorMessage = 'SMOKE TEST forced error';
  await realtimeEmitter.emitNotification({
    title: 'Indexer config load failed',
    message: `Falling back to default sources. Check /settings/indexers. (${errorMessage})`,
    level: 'warning',
  });

  const match = captured.find(e => e.channel === 'system:notifications' && e.type === 'notification');

  if (!match) {
    logger.error('FAIL: no event captured on channel "system:notifications"', { captured });
    process.exit(1);
  }

  const data = match.data as Record<string, unknown>;
  const checks = [
    { name: 'has id',        ok: typeof data['id'] === 'string' },
    { name: 'has timestamp', ok: typeof data['timestamp'] === 'string' },
    { name: 'level=warning', ok: data['level'] === 'warning' },
    { name: 'title set',     ok: data['title'] === 'Indexer config load failed' },
    { name: 'message echoes error', ok: typeof data['message'] === 'string' && (data['message'] as string).includes(errorMessage) },
  ];

  let allOk = true;
  for (const c of checks) {
    logger.info(`smoke-check: ${c.name}`, { ok: c.ok });
    if (!c.ok) allOk = false;
  }

  logger.info('smoke payload', { payload: data });

  process.exit(allOk ? 0 : 1);
}

main().catch((err: unknown) => {
  logger.error('Script crashed', { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
