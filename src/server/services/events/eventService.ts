/**
 * Event Service
 *
 * Service for managing system events. Provides methods for creating, retrieving,
 * and filtering events. Events are stored in the database and can be accessed
 * through this service.
 *
 * @module server/services/events/eventService
 */
import { randomUUID } from 'crypto';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { EventSource, EventType, EventLevel } from './eventTypes';
import type { SystemEvent } from '@prisma/client';
export interface EventFilters {
  types?: EventType[];
  sources?: EventSource[];
  levels?: EventLevel[];
  startDate?: Date;
  endDate?: Date;
  relatedEntityId?: string;
  relatedEntityType?: string;
  search?: string;
}
export interface PaginatedEvents {
  events: SystemEvent[];
  total: number;
}
// Type for JSON-compatible values
export type JsonValue = string | number | boolean | null | {
  [key: string]: JsonValue;
} | JsonValue[];

// Type for Prisma where clause
type WhereClause = {
  type?: {
    in: EventType[];
  };
  source?: {
    in: EventSource[];
  };
  level?: {
    in: EventLevel[];
  };
  relatedEntityId?: string;
  relatedEntityType?: string;
  timestamp?: {
    gte?: Date;
    lte?: Date;
  };
  OR?: {
    message: {
      contains: string;
      mode: 'insensitive';
    };
  }[];
};

/**
 * Builds basic filter conditions (type, source, level)
 */
function buildBasicFilters(filters: EventFilters | undefined): Partial<WhereClause> {
  const result: Partial<WhereClause> = {};

  if (filters?.types?.length) {
    result.type = { in: filters.types };
  }
  if (filters?.sources?.length) {
    result.source = { in: filters.sources };
  }
  if (filters?.levels?.length) {
    result.level = { in: filters.levels };
  }

  return result;
}

/**
 * Builds entity-related filter conditions
 */
function buildEntityFilters(filters: EventFilters | undefined): Partial<WhereClause> {
  const result: Partial<WhereClause> = {};

  if (filters?.relatedEntityId) {
    result.relatedEntityId = filters.relatedEntityId;
  }
  if (filters?.relatedEntityType) {
    result.relatedEntityType = filters.relatedEntityType;
  }

  return result;
}

/**
 * Builds timestamp filter conditions
 */
function buildTimestampFilters(filters: EventFilters | undefined): Partial<WhereClause> {
  const result: Partial<WhereClause> = {};

  if (filters?.startDate ?? filters?.endDate) {
    result.timestamp = {};
    if (filters.startDate) {
      result.timestamp.gte = filters.startDate;
    }
    if (filters.endDate) {
      result.timestamp.lte = filters.endDate;
    }
  }

  return result;
}

/**
 * Builds search filter conditions
 */
function buildSearchFilters(filters: EventFilters | undefined): Partial<WhereClause> {
  const result: Partial<WhereClause> = {};

  if (filters?.search) {
    result.OR = [
      { message: { contains: filters.search, mode: 'insensitive' } }
    ];
  }

  return result;
}

/**
 * Builds the complete where clause from filters
 */
function buildWhereClause(filters: EventFilters | undefined): WhereClause {
  return {
    ...buildBasicFilters(filters),
    ...buildEntityFilters(filters),
    ...buildTimestampFilters(filters),
    ...buildSearchFilters(filters)
  };
}

/**
 * Class providing methods for system event management
 */
export class EventService {
  /**
   * Creates a new system event
   *
   * @param {EventType} type - Type of event
   * @param {EventSource} source - Source of the event
   * @param {EventLevel} level - Severity level of the event
   * @param {string} message - Human-readable message describing the event
   * @param {Object} options - Additional event options
   * @returns {Promise<SystemEvent>} The created event
   */
  async createEvent(type: EventType, source: EventSource, level: EventLevel, message: string, options?: {
    details?: Record<string, JsonValue>;
    relatedEntityId?: string;
    relatedEntityType?: string;
  }): Promise<SystemEvent> {
    // Log to console for debugging
    logger.info(`[${level}] ${source} (${type}): ${message}`);

    // Build data object with proper typing
    const event = await prisma.systemEvent.create({
      data: {
        id: randomUUID(),
        type,
        source,
        level,
        message,
        details: options?.details ?? {},
        ...(options?.relatedEntityId !== undefined ? { relatedEntityId: options.relatedEntityId } : {}),
        ...(options?.relatedEntityType !== undefined ? { relatedEntityType: options.relatedEntityType } : {})
      }
    });
    return event;
  }
  /**
   * Retrieves events with optional filtering and pagination
   *
   * @param {EventFilters} filters - Optional filters to apply
   * @param {number} page - Page number for pagination
   * @param {number} pageSize - Number of events per page
   * @returns {Promise<PaginatedEvents>} Paginated events and total count
   */
  /**
   * @param ownerUserId - Owner scope for the events log. Pass the caller's id
   *   to restrict to their own events (non-admins); pass `undefined` for the
   *   unfiltered admin view. NULL-owned (system) events are admin-only.
   */
  async getEvents(
    filters?: EventFilters,
    page: number = 1,
    pageSize: number = 50,
    ownerUserId?: string,
  ): Promise<PaginatedEvents> {
    // Build the where clause based on filters, then owner-scope it.
    const where = {
      ...buildWhereClause(filters),
      ...(ownerUserId !== undefined ? { userId: ownerUserId } : {}),
    };

    // Execute the queries in parallel for better performance
    const [events, total] = await Promise.all([
      prisma.systemEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.systemEvent.count({ where })
    ]);

    return { events, total };
  }
  /**
   * Clears events older than the specified retention period
   *
   * @param {number} retentionDays - Number of days to retain events
   * @returns {Promise<number>} Number of events deleted
   */
  async cleanupEvents(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const result = await prisma.systemEvent.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate
        }
      }
    });
    return result.count;
  }
}
// Export a singleton instance of the event service
export const eventService = new EventService();