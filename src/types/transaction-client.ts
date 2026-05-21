/**
 * Transaction Client Types
 * 
 * This file provides type definitions for Prisma transaction clients
 * to provide type safety when using transactions.
 */

import type { Task} from './task-unions';

/**
 * Task client for transaction operations
 */
export interface TaskClient {
  /**
   * Find the first task matching the given criteria
   */
  findFirst: (params: {
    where: {
      status: { in: string[] };
      scheduledAt: { lte: Date };
    };
    orderBy: { createdAt: 'asc' | 'desc' };
  }) => Promise<Task | null>;

  /**
   * Update a task with the given data
   */
  update: (params: {
    where: { id: number };
    data: {
      status: string; // Use string instead of TaskStatus enum
      updatedAt: Date;
      [key: string]: unknown;
    };
  }) => Promise<Task>;
}

/**
 * Transaction client with typed operations
 */
export interface TypedTransactionClient {
  task: TaskClient;
  [key: string]: unknown;
}