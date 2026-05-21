import { JobStatus, Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { jobCircuitBreaker } from '@/server/queue/modules/circuit-breaker';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { adminProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

const stuckJobSelect = {
  id: true,
  job_type: true,
  status: true,
  started_at: true,
  attempt_count: true,
  max_attempts: true,
  lease_expires_at: true,
  hard_timeout_at: true,
  worker_id: true,
  payload: true,
  manga: { select: { id: true, title: true } },
} satisfies Prisma.jobsSelect;

interface StaleJobStats {
  total_stale: number;
  will_retry: number;
  will_fail: number;
  oldest_stale_job: Date | null;
}

const EMPTY_STALE_STATS: StaleJobStats = {
  total_stale: 0,
  will_retry: 0,
  will_fail: 0,
  oldest_stale_job: null,
};

interface OpenCircuitEntry {
  key: string;
  state: { failures: number; lastFailure: number };
}

function mapOpenCircuit(c: OpenCircuitEntry): { key: string; failures: number; lastFailure: Date } {
  return {
    key: c.key,
    failures: c.state.failures,
    lastFailure: new Date(c.state.lastFailure),
  };
}

function mapStatusCount(s: { status: string; count: bigint }): { status: string; count: number } {
  return { status: s.status, count: Number(s.count) };
}

export const jobsAdminRouter = router({
  /**
   * Jobs in 'active' status longer than `staleMinutes` (default 30).
   */
  getStuckJobs: adminProcedure
    .input(z.object({
      staleMinutes: z.number().min(1).default(30).optional(),
    }).optional())
    .query(async ({ input }) => {
      const staleMinutes = input?.staleMinutes ?? 30;
      const staleThreshold = new Date(Date.now() - staleMinutes * 60 * 1000);

      const jobs = await prisma.jobs.findMany({
        where: {
          status: JobStatus.active,
          started_at: { lt: staleThreshold },
        },
        orderBy: { started_at: 'asc' },
        select: stuckJobSelect,
      });

      return jobs.map(job => ({
        ...job,
        id: String(job.id),
        runningMinutes: job.started_at
          ? Math.round((Date.now() - job.started_at.getTime()) / 60000)
          : 0,
      }));
    }),

  /**
   * Forcibly fail a stuck active job via the fail_job DB function.
   */
  forceFail: adminProcedure
    .input(z.object({
      id: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const jobId = BigInt(input.id);
      const reason = input.reason ?? 'Manually failed by admin';

      const result = await prisma.$queryRaw<{ fail_job: string }[]>`
        SELECT fail_job(
          ${jobId}::BIGINT,
          ${reason}::TEXT,
          ${{ admin_action: true, timestamp: new Date().toISOString() }}::JSONB
        ) as fail_job
      `;

      const outcome = result[0]?.fail_job ?? 'failed';

      void realtimeEmitter.emitSystemEvent({
        eventType: 'job:force-failed',
        source: 'jobs-router',
        message: `Job ${input.id} force-failed: ${reason}`,
        data: { jobId: input.id, outcome },
      });

      return { jobId: input.id, outcome, reason };
    }),

  /**
   * Queue stats: status counts, stale jobs, circuit breaker state.
   */
  getQueueStats: adminProcedure
    .query(async () => {
      const statusCounts = await prisma.$queryRaw<{ status: string; count: bigint }[]>`
        SELECT status::text, COUNT(*) as count
        FROM jobs
        GROUP BY status
      `;

      const staleStats = await prisma.$queryRaw<StaleJobStats[]>`
        SELECT * FROM get_stale_job_stats()
      `;

      const circuitBreakerStats = jobCircuitBreaker.getStats();
      const openCircuits = jobCircuitBreaker.getOpenCircuits() as OpenCircuitEntry[];

      return {
        statusCounts: statusCounts.map(mapStatusCount),
        staleJobs: staleStats[0] ?? EMPTY_STALE_STATS,
        circuitBreaker: {
          ...circuitBreakerStats,
          openCircuits: openCircuits.map(mapOpenCircuit),
        },
      };
    }),

  /**
   * Reset the circuit breaker for a specific job-type pattern.
   */
  resetCircuitBreaker: adminProcedure
    .input(z.object({
      jobType: z.string(),
      payload: z.unknown().optional(),
    }))
    .mutation(({ input }) => {
      jobCircuitBreaker.reset(input.jobType, input.payload ?? {});
      return { success: true, jobType: input.jobType };
    }),

  /**
   * Reset every circuit breaker.
   */
  resetAllCircuitBreakers: adminProcedure
    .mutation(() => {
      const stats = jobCircuitBreaker.getStats();
      jobCircuitBreaker.resetAll();
      return { success: true, resetCount: stats.totalCircuits };
    }),

  /**
   * Manually run stale-job recovery.
   */
  recoverStaleJobs: adminProcedure
    .input(z.object({
      staleThresholdSeconds: z.number().min(60).default(600).optional(),
    }).optional())
    .mutation(async ({ input }) => {
      const threshold = input?.staleThresholdSeconds ?? 600;

      const result = await prisma.$queryRaw<{ recover_stale_jobs: number }[]>`
        SELECT recover_stale_jobs(${threshold}::INTEGER) as recover_stale_jobs
      `;

      const recoveredCount = result[0]?.recover_stale_jobs ?? 0;
      return { recoveredCount, threshold };
    }),
});
