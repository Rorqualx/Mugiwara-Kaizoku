/**
 * Converter System Usage Examples
 *
 * Demonstrates how to use the file converter system for manga format conversions.
 * These examples show common use cases and integration patterns.
 *
 * @module converter-usage-examples
 */

import {
  initializeConverterSystem,
  getConversionService,
  ConverterFactory
} from '../server/services/conversion';
import { logger } from '../utils/logger';

/**
 * Example 1: Initialize the converter system
 *
 * Call this once during application startup
 */
export function exampleInitializeSystem(): void {
  try {
    initializeConverterSystem();
    logger.info('Converter system initialized successfully');
  } catch (error: unknown) {
    logger.error('Failed to initialize converter system', error);
  }
}

/**
 * Example 2: Convert CBZ to PDF
 *
 * @param mangaId - Manga ID
 * @param chapterId - Chapter ID
 * @param cbzPath - Path to CBZ file
 * @param pdfPath - Output PDF path
 */
export async function exampleConvertCBZtoPDF(
  mangaId: number,
  chapterId: number,
  cbzPath: string,
  pdfPath: string
): Promise<void> {
  try {
    const conversionService = getConversionService();

    // Create conversion job
    const jobResult = await conversionService.createConversionJob({
      mangaId,
      chapterId,
      sourceFile: cbzPath,
      targetFile: pdfPath,
      sourceFormat: 'cbz',
      targetFormat: 'pdf',
      priority: 5,
      quality: 85
    });

    if (jobResult.status === 'error') {
      logger.error('Failed to create conversion job', jobResult.error);
      return;
    }

    if (jobResult.status !== 'success') {
      logger.error('Unexpected job creation status');
      return;
    }

    const jobId = jobResult.data;
    logger.info(`Conversion job created: ${jobId}`);

    // Execute the conversion
    const conversionResult = await conversionService.executeConversionJob(jobId);

    if (conversionResult.status === 'error') {
      logger.error('Conversion failed', conversionResult.error);
      return;
    }

    if (conversionResult.status !== 'success') {
      logger.error('Unexpected conversion status');
      return;
    }

    logger.info('Conversion completed successfully', {
      outputPath: conversionResult.data.outputPath,
      fileSize: conversionResult.data.fileSize,
      pageCount: conversionResult.data.pageCount,
      duration: `${conversionResult.data.duration}ms`
    });
  } catch (error: unknown) {
    logger.error('Error during CBZ to PDF conversion', error);
  }
}

/**
 * Example 3: Convert CBZ to EPUB
 *
 * @param mangaId - Manga ID
 * @param chapterId - Chapter ID
 * @param cbzPath - Path to CBZ file
 * @param epubPath - Output EPUB path
 * @param metadata - Optional metadata (title, author)
 */
export async function exampleConvertCBZtoEPUB(
  mangaId: number,
  chapterId: number,
  cbzPath: string,
  epubPath: string,
  metadata?: { title?: string; author?: string }
): Promise<void> {
  try {
    const conversionService = getConversionService();

    const jobResult = await conversionService.createConversionJob({
      mangaId,
      chapterId,
      sourceFile: cbzPath,
      targetFile: epubPath,
      sourceFormat: 'cbz',
      targetFormat: 'epub',
      priority: 5,
      ...(metadata !== undefined ? { metadata } : {})
    });

    if (jobResult.status === 'error') {
      logger.error('Failed to create conversion job', jobResult.error);
      return;
    }

    if (jobResult.status !== 'success') {
      logger.error('Unexpected job creation status');
      return;
    }

    const jobId = jobResult.data;

    // Execute conversion
    const conversionResult = await conversionService.executeConversionJob(jobId);

    if (conversionResult.status === 'success') {
      logger.info('EPUB conversion completed', conversionResult.data);
    } else if (conversionResult.status === 'error') {
      logger.error('EPUB conversion failed', conversionResult.error);
    } else {
      logger.error('Unexpected conversion status');
    }
  } catch (error: unknown) {
    logger.error('Error during CBZ to EPUB conversion', error);
  }
}

/**
 * Example 4: Check conversion status
 *
 * @param jobId - Conversion job ID
 */
export async function exampleCheckConversionStatus(jobId: string): Promise<void> {
  try {
    const conversionService = getConversionService();

    const statusResult = await conversionService.getJobStatus(jobId);

    if (statusResult.status === 'error') {
      logger.error('Failed to get job status', statusResult.error);
      return;
    }

    if (statusResult.status !== 'success') {
      logger.error('Unexpected status result');
      return;
    }

    const status = statusResult.data;

    logger.info('Conversion job status', {
      id: status.id,
      status: status.status,
      progress: `${status.progress}%`,
      attempts: status.attempts,
      errorMessage: status.errorMessage,
      createdAt: status.createdAt,
      completedAt: status.completedAt
    });
  } catch (error: unknown) {
    logger.error('Error checking conversion status', error);
  }
}

/**
 * Example 5: Get pending conversion jobs
 *
 * Useful for implementing a worker that processes conversions
 */
export async function exampleProcessPendingConversions(): Promise<void> {
  try {
    const conversionService = getConversionService();

    // Get pending jobs
    const pendingResult = await conversionService.getPendingJobs(10);

    if (pendingResult.status === 'error') {
      logger.error('Failed to get pending jobs', pendingResult.error);
      return;
    }

    if (pendingResult.status !== 'success') {
      logger.error('Unexpected pending jobs status');
      return;
    }

    const jobIds = pendingResult.data;

    logger.info(`Found ${jobIds.length} pending conversion jobs`);

    // Process each job sequentially to avoid overwhelming system resources
    // Sequential processing required: conversion jobs are resource-intensive and should not run in parallel
    for (const jobId of jobIds) {
      logger.info(`Processing conversion job: ${jobId}`);

      // eslint-disable-next-line no-await-in-loop -- Intentional sequential processing for resource-intensive operations
      const result = await conversionService.executeConversionJob(jobId);

      if (result.status === 'success') {
        logger.info(`Job ${jobId} completed successfully`);
      } else if (result.status === 'error') {
        logger.error(`Job ${jobId} failed`, result.error);
      } else {
        logger.error(`Job ${jobId} has unexpected status`);
      }
    }
  } catch (error: unknown) {
    logger.error('Error processing pending conversions', error);
  }
}

/**
 * Example 6: Check if a conversion is supported
 *
 * @param sourceFormat - Source format
 * @param targetFormat - Target format
 */
export function exampleCheckConversionSupport(
  sourceFormat: string,
  targetFormat: string
): boolean {
  const isSupported = ConverterFactory.isConversionSupported(
    sourceFormat as 'cbz' | 'pdf' | 'epub' | 'zip',
    targetFormat as 'cbz' | 'pdf' | 'epub' | 'zip'
  );

  logger.info(`Conversion ${sourceFormat} → ${targetFormat}: ${isSupported ? 'SUPPORTED' : 'NOT SUPPORTED'}`);

  return isSupported;
}

/**
 * Example 7: Get conversion statistics
 */
export async function exampleGetConversionStatistics(): Promise<void> {
  try {
    const conversionService = getConversionService();

    const stats = await conversionService.getStatistics();

    logger.info('Conversion statistics', {
      total: stats.total,
      pending: stats.pending,
      processing: stats.processing,
      completed: stats.completed,
      failed: stats.failed,
      cancelled: stats.cancelled
    });

    // Also get factory statistics
    const factoryStats = ConverterFactory.getStatistics();

    logger.info('Converter factory statistics', {
      totalConverters: factoryStats.totalConverters,
      supportedConversions: factoryStats.supportedConversions,
      converters: factoryStats.convertersByPriority
    });
  } catch (error: unknown) {
    logger.error('Error getting statistics', error);
  }
}

/**
 * Example 8: Cancel a conversion job
 *
 * @param jobId - Conversion job ID
 */
export async function exampleCancelConversion(jobId: string): Promise<void> {
  try {
    const conversionService = getConversionService();

    const cancelResult = await conversionService.cancelJob(jobId);

    if (cancelResult.status === 'success') {
      logger.info(`Conversion job ${jobId} cancelled successfully`);
    } else if (cancelResult.status === 'error') {
      logger.error(`Failed to cancel job ${jobId}`, cancelResult.error);
    } else {
      logger.error(`Unexpected cancel result status for job ${jobId}`);
    }
  } catch (error: unknown) {
    logger.error('Error cancelling conversion', error);
  }
}

/**
 * Example 9: Batch conversion with progress tracking
 *
 * @param conversions - Array of conversion requests
 */
export async function exampleBatchConversion(
  conversions: Array<{
    mangaId: number;
    chapterId: number;
    sourcePath: string;
    targetPath: string;
    sourceFormat: string;
    targetFormat: string;
  }>
): Promise<void> {
  try {
    const conversionService = getConversionService();

    logger.info(`Starting batch conversion of ${conversions.length} files`);

    // Create all jobs in parallel for better performance
    const jobResults = await Promise.all(
      conversions.map(conversion =>
        conversionService.createConversionJob({
          mangaId: conversion.mangaId,
          chapterId: conversion.chapterId,
          sourceFile: conversion.sourcePath,
          targetFile: conversion.targetPath,
          sourceFormat: conversion.sourceFormat,
          targetFormat: conversion.targetFormat,
          priority: 5
        })
      )
    );

    // Collect successful job IDs
    const jobs: string[] = [];
    for (const jobResult of jobResults) {
      if (jobResult.status === 'success') {
        jobs.push(jobResult.data);
      } else if (jobResult.status === 'error') {
        logger.error('Failed to create job', jobResult.error);
      } else {
        logger.error('Unexpected job creation status');
      }
    }

    logger.info(`Created ${jobs.length} conversion jobs`);

    // Execute all jobs
    const results = await Promise.allSettled(
      jobs.map(jobId => conversionService.executeConversionJob(jobId))
    );

    // Report results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logger.info('Batch conversion completed', {
      total: results.length,
      successful,
      failed
    });
  } catch (error: unknown) {
    logger.error('Error during batch conversion', error);
  }
}

/**
 * Example 10: Get available formats
 */
export function exampleGetAvailableFormats(): void {
  const sourceFormats = ConverterFactory.getSupportedSourceFormats();
  const targetFormats = ConverterFactory.getSupportedTargetFormats();

  logger.info('Available formats', {
    sources: sourceFormats,
    targets: targetFormats
  });

  // List all supported conversions
  logger.info('Supported conversions:');
  for (const source of sourceFormats) {
    for (const target of targetFormats) {
      if (source !== target && ConverterFactory.isConversionSupported(source, target)) {
        logger.info(`  ${source} → ${target}`);
      }
    }
  }
}
