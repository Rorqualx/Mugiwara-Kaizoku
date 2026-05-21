/**
 * @module server/queue/integration
 * @description Integration manager for external services like Komga and Kavita
 * Handles task scheduling and execution for third-party integrations.
 *
 * Features:
 * - Type-safe integration task handling
 * - Automatic configuration validation
 * - Task queueing and execution
 * - Integration health monitoring
 *
 * @example
 * ```ts
 * // Enqueue a scan task
 * await integrationManager.enqueueIntegrationTask('komga', 'scan');
 *
 * // Refresh metadata for a specific manga
 * await integrationManager.enqueueIntegrationTask('kavita', 'refresh', {
 *   title: 'One Piece'
 * });
 * ```
 */

import { JobType } from '@prisma/client';

import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';


import { getConfig, getConfigBoolean } from '../utils/configReader';
import * as kavita from '../utils/integration/kavita';
import * as komga from '../utils/integration/komga';

import { queueManager } from './queueManager';

/** Supported integration service types */
export type IntegrationType = 'komga' | 'kavita';
/** Available actions for integration tasks */
export type IntegrationAction = 'scan' | 'refresh';
/** Metadata for queued integration tasks */
type QueueMetadata = {
  mangaId?: number;
  title?: string;
};
/**
 * Base metadata interface for integration tasks
 * @interface IntegrationMetadata
 */
export interface IntegrationMetadata {
  mangaId?: number;
  title?: string;
}
/**
 * Integration task definition
 * @interface IntegrationTask
 */
export interface IntegrationTask {
  type: IntegrationType;
  action: IntegrationAction;
  metadata: IntegrationMetadata;
}
/**
 * Integration configuration settings
 * @interface IntegrationSettings
 */
interface IntegrationSettings {
  komgaEnabled: boolean;
  komgaHost: string | null;
  komgaUser: string | null;
  komgaPassword: string | null;
  kavitaEnabled: boolean;
  kavitaHost: string | null;
  kavitaUser: string | null;
  kavitaPassword: string | null;
  kavitaLibraries: string[];
}
/**
 * Manager class for handling integration tasks
 * Implements singleton pattern for global integration management
 *
 * @class IntegrationManager
 */
export class IntegrationManager {
  private static instance: IntegrationManager | undefined;
  private constructor() {}
  static getInstance(): IntegrationManager {
    IntegrationManager.instance ??= new IntegrationManager();
    return IntegrationManager.instance;
  }
  /**
   * Enqueues a new integration task
   *
   * @param {IntegrationType} type - Type of integration service
   * @param {IntegrationAction} action - Action to perform
   * @param {Partial<QueueMetadata>} [metadata] - Optional task metadata
   * @returns {Promise<number>} ID of the created task
   * @throws {Error} When task creation fails
   *
   * @example
   * ```ts
   * // Scan library
   * const taskId = await manager.enqueueIntegrationTask('komga', 'scan');
   *
   * // Refresh specific manga
   * const taskId = await manager.enqueueIntegrationTask('kavita', 'refresh', {
   *   mangaId: 1,
   *   title: 'One Piece'
   * });
   * ```
   */
  async enqueueIntegrationTask(type: IntegrationType, action: IntegrationAction, metadata?: Partial<QueueMetadata>): Promise<number> {
    // Create payload with the correct type structure
    const payload: {
      type: IntegrationType;
      action: IntegrationAction;
      metadata?: QueueMetadata;
    } = {
      type,
      action
    };
    // Only add metadata if it exists and has properties
    if (metadata && (metadata.mangaId !== undefined || metadata["title"] !== undefined)) {
      payload["metadata"] = {
        ...(metadata.mangaId !== undefined && { mangaId: metadata.mangaId }),
        ...(metadata["title"] !== undefined && { title: metadata["title"] })
      };
    }
    const jobId = await queueManager.enqueue(JobType.notification_send, payload);
    return Number(jobId);
  }
  private async getIntegrationSettings(): Promise<IntegrationSettings> {
    // Read integration settings from Config table
    const [
      komgaEnabled,
      komgaHost,
      komgaUser,
      komgaPassword,
      kavitaEnabled,
      kavitaHost,
      kavitaUser,
      kavitaPassword
    ] = await Promise.all([
      getConfigBoolean('integration.komga.enabled', false),
      getConfig('integration.komga.host'),
      getConfig('integration.komga.user'),
      getConfig('integration.komga.password'),
      getConfigBoolean('integration.kavita.enabled', false),
      getConfig('integration.kavita.host'),
      getConfig('integration.kavita.user'),
      getConfig('integration.kavita.password')
    ]);

    return {
      komgaEnabled,
      komgaHost: komgaHost ?? null,
      komgaUser: komgaUser ?? null,
      komgaPassword: komgaPassword ?? null,
      kavitaEnabled,
      kavitaHost: kavitaHost ?? null,
      kavitaUser: kavitaUser ?? null,
      kavitaPassword: kavitaPassword ?? null,
      kavitaLibraries: [] // Not used in this file, can be fetched if needed
    };
  }
  /**
   * Processes a single integration task
   *
   * @param {IntegrationTask} task - Task to process
   * @returns {Promise<void>}
   * @throws {Error} When task processing fails or integration is not configured
   *
   * @example
   * ```ts
   * await manager.processIntegrationTask({
   *   type: 'komga',
   *   action: 'scan',
   *   metadata: { title: 'One Piece' }
   * });
   * ```
   */
  async processIntegrationTask(task: IntegrationTask): Promise<void> {
    const settings = await this.getIntegrationSettings();
    switch (task.type) {
      case 'komga':
        if (settings.komgaEnabled) {
          await this.processKomgaTask(task);
        }
        break;
      case 'kavita':
        if (settings.kavitaEnabled) {
          await this.processKavitaTask(task);
        }
        break;
      default:throw new ValidationError(`Unknown integration type: ${task.type}`);
    }
  }
  /**
   * Runs all enabled integrations
   * Enqueues scan tasks for each configured integration
   *
   * @returns {Promise<void>}
   * @throws {Error} When integration execution fails
   *
   * @example
   * ```ts
   * // Run all enabled integrations
   * await manager.runIntegrations();
   * ```
   */
  async runIntegrations(): Promise<void> {
    try {
      const settings = await this.getIntegrationSettings();
      logger.info(`Running enabled integrations - Komga: ${settings.komgaEnabled}, Kavita: ${settings.kavitaEnabled}`);
      if (settings.komgaEnabled) {
        await this.enqueueIntegrationTask('komga', 'scan');
      }
      if (settings.kavitaEnabled) {
        await this.enqueueIntegrationTask('kavita', 'scan');
      }
    }
    catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to run integrations: ${errorMessage}`);
      throw error;
    }
  }
  /**
   * Processes a Komga integration task
   *
   * @private
   * @param {IntegrationTask} task - Task to process
   * @returns {Promise<void>}
   * @throws {Error} When Komga is not configured or task fails
   */
  private async processKomgaTask(task: IntegrationTask): Promise<void> {
    const settings = await this.getIntegrationSettings();
    if (!settings.komgaHost || !settings.komgaUser || !settings.komgaPassword) {
      throw new ValidationError('Komga settings not configured');
    }
    switch (task.action) {
      case 'scan':
        await komga.scanLibrary();
        break;
      case 'refresh':
        if (task["metadata"].title) {
          await komga.refreshMetadata(task["metadata"]["title"]);
        }
        break;
      default:throw new ValidationError(`Unknown Komga action: ${task.action}`);
    }
  }
  /**
   * Processes a Kavita integration task
   *
   * @private
   * @param {IntegrationTask} task - Task to process
   * @returns {Promise<void>}
   * @throws {Error} When Kavita is not configured or task fails
   */
  private async processKavitaTask(task: IntegrationTask): Promise<void> {
    const settings = await this.getIntegrationSettings();
    if (!settings.kavitaHost || !settings.kavitaUser || !settings.kavitaPassword) {
      throw new ValidationError('Kavita settings not configured');
    }
    switch (task.action) {
      case 'scan':
        await kavita.scanLibrary();
        break;
      case 'refresh':
        if (task["metadata"].title) {
          await kavita.refreshMetadata(task["metadata"]["title"]);
        }
        break;
      default:throw new ValidationError(`Unknown Kavita action: ${task.action}`);
    }
  }
}
export const integrationManager = IntegrationManager.getInstance();