/**
 * @quality-check-skip
 *
 * Standalone PrismaClient for maintenance scripts.
 *
 * Importing `@/server/db` also pulls in the realtime emitter, which starts the
 * WebSocket service plus presence- and rate-limit-cleanup intervals. In a
 * long-lived server that's correct; in a one-shot script it means the process
 * never exits, and the shared pool contends with those cleanup queries (a plain
 * `count()` can hang indefinitely).
 *
 * This helper builds a minimal client with its own small pool and no side
 * effects. Prisma 7 requires an explicit driver adapter, hence PrismaPg.
 *
 * Pair it with an explicit `process.exit()` — see the tail of
 * `backfill-chapter-language.ts`.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

/** Small on purpose — maintenance scripts are sequential. */
const SCRIPT_POOL_SIZE = 4;

export function createStandalonePrisma(): PrismaClient {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set; cannot open a database connection.');
  }
  const pool = new Pool({
    connectionString,
    max: SCRIPT_POOL_SIZE,
    idleTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}
