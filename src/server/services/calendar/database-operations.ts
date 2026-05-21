/**
 * Database Operations Module
 *
 * Handles persistence of aggregated release schedules to the database,
 * including type mapping and upsert operations.
 *
 * Extracted from: ReleaseScheduleAggregator.ts (lines 448-505)
 */

import { Prisma } from '@prisma/client';

import { createLogger } from '@/utils/logger';



import type { AggregatedReleaseSchedule } from './calendar-utils';
import type { PrismaClient } from '@prisma/client';


const logger = createLogger('DatabaseOperations');

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Database release type enum
 */
type ReleaseType = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'IRREGULAR' | 'HIATUS' | 'REGULAR';

/**
 * Primary schedule data extracted from aggregated schedule
 */
interface PrimaryScheduleData {
  releaseType: ReleaseType;
  dayOfWeek?: number | undefined;
  dayOfMonth?: number | undefined;
  timezone: string;
  isConfirmed: boolean;
  confidence: number;
  metadata: Prisma.InputJsonValue;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely serialize data for JSON storage
 * Ensures all values are JSON-compatible types
 */
function safeSerialize(data: unknown): Prisma.InputJsonValue {
  if (data === null || data === undefined) {
    return {};
  }

  if (typeof data !== 'object') {
    return {};
  }

  try {
    // Use JSON round-trip for safe serialization
    const serialized = JSON.stringify(data);
    return JSON.parse(serialized) as Prisma.InputJsonValue;
  } catch (error) {
    logger.warn('Failed to serialize data', { error });
    return {};
  }
}

/**
 * Extract primary schedule data from aggregated schedule
 */
function extractPrimaryScheduleData(aggregated: AggregatedReleaseSchedule): PrimaryScheduleData {
  // Extract pattern
  const pattern = aggregated.primary?.pattern ?? aggregated.pattern;
  const releaseType = mapReleaseType(pattern);

  // Extract confidence
  const confidence = aggregated.primary?.confidence ?? aggregated.confidence;
  const isConfirmed = confidence > 0.8;

  // Extract day of week (safe optional access)
  const dayOfWeek = aggregated.primary?.dayOfWeek;

  // Extract day of month (safe type checking)
  let dayOfMonth: number | undefined;
  const primaryAny = aggregated.primary as unknown;
  if (primaryAny !== null && typeof primaryAny === 'object') {
    const primaryRecord = primaryAny as Record<string, unknown>;
    const dayOfMonthValue = primaryRecord['dayOfMonth'];
    dayOfMonth = typeof dayOfMonthValue === 'number' ? dayOfMonthValue : undefined;
  }

  // Safely serialize metadata
  const metadata = safeSerialize(aggregated);

  return {
    releaseType,
    dayOfWeek: dayOfWeek ?? undefined,
    dayOfMonth,
    timezone: 'UTC',
    isConfirmed,
    confidence,
    metadata
  };
}

/**
 * Build upsert payload from primary schedule data
 */
function buildUpsertPayload(data: PrimaryScheduleData): {
  create: {
    releaseType: ReleaseType;
    timezone: string;
    isConfirmed: boolean;
    confidence: number;
    metadata: Prisma.InputJsonValue;
    dayOfWeek?: number;
    dayOfMonth?: number;
  };
  update: {
    releaseType: ReleaseType;
    timezone: string;
    isConfirmed: boolean;
    confidence: number;
    metadata: Prisma.InputJsonValue;
    dayOfWeek?: number;
    dayOfMonth?: number;
    lastUpdated: Date;
  };
} {
  const basePayload = {
    releaseType: data.releaseType,
    timezone: data.timezone,
    isConfirmed: data.isConfirmed,
    confidence: data.confidence,
    metadata: data.metadata
  };

  const optionalFields = {
    ...(data.dayOfWeek !== undefined ? { dayOfWeek: data.dayOfWeek } : {}),
    ...(data.dayOfMonth !== undefined ? { dayOfMonth: data.dayOfMonth } : {})
  };

  return {
    create: {
      ...basePayload,
      ...optionalFields
    },
    update: {
      ...basePayload,
      ...optionalFields,
      lastUpdated: new Date()
    }
  };
}

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Save aggregated release schedule to database
 *
 * Performs an upsert operation to create or update the aggregated schedule
 * for a manga. Extracts and maps relevant fields from the aggregated data.
 *
 * @param prisma - Prisma client instance
 * @param mangaId - ID of the manga
 * @param aggregated - Aggregated release schedule data
 * @returns Promise that resolves when save is complete
 */
export async function saveAggregatedSchedule(
  prisma: PrismaClient,
  mangaId: number,
  aggregated: AggregatedReleaseSchedule
): Promise<void> {
  try {
    // Extract and prepare data
    const primaryData = extractPrimaryScheduleData(aggregated);
    const { create, update } = buildUpsertPayload(primaryData);

    // Perform upsert
    await prisma.releaseSchedule.upsert({
      where: {
        mangaId_source: {
          mangaId,
          source: 'aggregated'
        }
      },
      create: {
        mangaId,
        source: 'aggregated',
        ...create
      },
      update
    });
  } catch (error: unknown) {
    logger.error('Failed to save aggregated schedule', {
      mangaId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Map release type string to database enum
 *
 * Converts pattern strings to standardized database release type values.
 * Defaults to 'IRREGULAR' for unknown patterns.
 *
 * @param type - Release type pattern string
 * @returns Mapped database release type
 */
export function mapReleaseType(type: string): ReleaseType {
  const mapping: Record<string, ReleaseType> = {
    weekly: 'WEEKLY',
    biweekly: 'BIWEEKLY',
    monthly: 'MONTHLY',
    irregular: 'IRREGULAR',
    hiatus: 'HIATUS',
    regular: 'REGULAR'
  };

  return mapping[type] ?? 'IRREGULAR';
}
