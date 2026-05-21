/**
 * Format Conversion Service
 *
 * High-level service for managing file format conversions.
 *
 * The class is a thin facade over free functions in `FormatConversionService/`
 * — the heavy lifting (DB writes, converter dispatch, retry/failure handling)
 * lives in those modules so this file stays small and brace-depth never
 * exceeds the project nesting cap.
 *
 * @module FormatConversionService
 */

import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import {
  createConversionJob as createConversionJobImpl,
  executeConversionJob as executeConversionJobImpl,
  type ConversionRequest
} from './FormatConversionService/job-execution';
import {
  cancelJob as cancelJobImpl,
  getJobStatus as getJobStatusImpl,
  getPendingJobs as getPendingJobsImpl,
  getStatistics as getStatisticsImpl,
  type ConversionJobStatus,
  type ConversionStatistics
} from './FormatConversionService/job-status';

import type { ConversionResult } from './BaseConverter';

export type { ConversionRequest, ConversionJobStatus, ConversionStatistics };

export class FormatConversionService {
  createConversionJob(request: ConversionRequest): Promise<AsyncResult<string, Error>> {
    return createConversionJobImpl(request);
  }

  executeConversionJob(jobId: string): Promise<AsyncResult<ConversionResult, Error>> {
    return executeConversionJobImpl(jobId);
  }

  getJobStatus(jobId: string): Promise<AsyncResult<ConversionJobStatus, Error>> {
    return getJobStatusImpl(jobId);
  }

  cancelJob(jobId: string): Promise<AsyncResult<void, Error>> {
    return cancelJobImpl(jobId);
  }

  getPendingJobs(limit: number = 10): Promise<AsyncResult<string[], Error>> {
    return getPendingJobsImpl(limit);
  }

  getStatistics(): Promise<ConversionStatistics> {
    return getStatisticsImpl();
  }
}

let conversionService: FormatConversionService | null = null;

export function getConversionService(): FormatConversionService {
  if (!conversionService) {
    conversionService = new FormatConversionService();
    logger.info('[FormatConversionService] Service initialized');
  }
  return conversionService;
}
