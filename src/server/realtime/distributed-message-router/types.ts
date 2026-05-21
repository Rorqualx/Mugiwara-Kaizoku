/**
 * Distributed Message Router - Type Definitions
 *
 * Shared type definitions, interfaces, and validation schemas
 * used across all distributed message router modules.
 *
 * Extracted from: DistributedMessageRouter.ts (lines 24-58)
 *
 * @module server/realtime/distributed-message-router/types
 */

import { z } from 'zod';

// ============================================================================
// Server Information Types
// ============================================================================

/**
 * Information about a server instance in the distributed system
 *
 * @interface ServerInfo
 */
export interface ServerInfo {
  serverId: string;
  hostname: string;
  port: number;
  connectionCount: number;
  status: 'active' | 'draining' | 'stopped';
  startedAt: Date;
  lastHeartbeat: Date;
}

/**
 * Target server for message routing
 *
 * @interface RouteTarget
 */
export interface RouteTarget {
  serverId: string;
  connectionCount: number;
}

/**
 * Represents a routed message in the system
 *
 * @interface MessageRoute
 */
export interface MessageRoute {
  id: number;
  targetServer: string;
  channel: string;
  payload: Record<string, unknown>;
  publishedAt: Date;
  delivered: boolean;
  deliveryAttempts: number;
}

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Zod schema for validating routed message notifications
 */
export const RoutedMessageNotificationSchema = z.object({
  id: z.number(),
  channel: z.string()
});
