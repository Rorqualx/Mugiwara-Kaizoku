// Queue system type definitions
import type { jobs } from '@prisma/client';

export interface JobHandler {
  // signal aborts when the job's `hard_timeout_at` deadline passes — handlers
  // that make long-running network calls should thread it into fetch/axios.
  // Existing handlers that ignore the second arg keep the old contract.
  (job: jobs, signal?: AbortSignal): Promise<void>;
}

export interface JobContext {
  jobId: string;
  attempt: number;
  maxAttempts: number;
}

export interface JobResult {
  success: boolean;
  message?: string;
  data?: unknown;
}