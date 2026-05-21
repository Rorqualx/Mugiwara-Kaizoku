/**
 * Event Schemas
 * 
 * Zod validation schemas for event-related data.
 * Used for input validation in API routes and forms.
 * 
 * @module server/services/events/eventSchemas
 */

import { z } from 'zod';

import { EventType, EventSource, EventLevel } from './eventTypes';

/**
 * Schema for event creation inputs
 */
export const createEventSchema = z.object({
  type: z.nativeEnum(EventType),
  source: z.nativeEnum(EventSource),
  level: z.nativeEnum(EventLevel),
  message: z.string().min(1).max(255),
  details: z.record(z.unknown()).optional(),
  relatedEntityId: z.string().optional(),
  relatedEntityType: z.string().optional(),
});

/**
 * Schema for event filtering inputs
 */
export const eventFilterSchema = z.object({
  types: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  levels: z.array(z.string()).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  relatedEntityId: z.string().optional(),
  relatedEntityType: z.string().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(50),
});

/**
 * Schema for event cleanup inputs
 */
export const eventCleanupSchema = z.object({
  retentionDays: z.number().min(1).max(365).default(30),
});

/**
 * Type definitions derived from the schemas
 */
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type EventFilterInput = z.infer<typeof eventFilterSchema>;
export type EventCleanupInput = z.infer<typeof eventCleanupSchema>;
