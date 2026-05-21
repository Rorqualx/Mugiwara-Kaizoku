/**
 * Integration Type Definitions
 * 
 * This module defines types for external service integrations.
 * It provides type-safe definitions for:
 * - Integration service types
 * - Integration actions
 * - Task management
 * - Metadata handling
 * 
 * @module types/integration
 */

import type { IntegrationStatus } from '@prisma/client';

/**
 * Supported integration services
 * Defines available external service integrations
 *
 * @typedef {('komga' | 'kavita' | 'telegram' | 'apprise')} IntegrationType
 */
export type IntegrationType = 'komga' | 'kavita' | 'telegram' | 'apprise';

/**
 * Integration action types
 * Defines available operations for integrations
 * 
 * @typedef {('scan' | 'refresh')} IntegrationAction
 */
export type IntegrationAction = 'scan' | 'refresh';

/**
 * Integration status values
 * Re-exported from Prisma schema
 */
export { IntegrationStatus } from '@prisma/client';

/**
 * Integration configuration interface
 * Contains settings required for an integration to function
 */
export interface IntegrationConfig {
  /**
   * Base URL for the integration
   */
  baseUrl: string;
  
  /**
   * API key or authentication token
   */
  apiKey?: string;
  
  /**
   * Username for authentication
   */
  username?: string;
  
  /**
   * Password for authentication
   */
  password?: string;
  
  /**
   * Whether to validate SSL certificates
   */
  validateSSL?: boolean;
  
  /**
   * Timeout in milliseconds
   */
  timeout?: number;
  
  /**
   * Additional configuration options
   */
  [key: string]: unknown;
}

/**
 * Integration entity interface
 * Represents a fully configured integration with an external service
 */
export interface Integration {
  /**
   * Unique identifier for the integration
   */
  id: string | number;
  
  /**
   * Name of the integration
   */
  name: string;
  
  /**
   * Type of integration
   */
  type: IntegrationType;
  
  /**
   * Current status of the integration
   */
  status: IntegrationStatus;
  
  /**
   * Integration configuration
   */
  config: IntegrationConfig;
  
  /**
   * When the integration was created
   */
  createdAt?: Date | string;
  
  /**
   * When the integration was last updated
   */
  updatedAt?: Date | string;
  
  /**
   * When the integration was last used
   */
  lastUsed?: Date | string;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Integration metadata structure
 * Base metadata type with explicit undefined handling
 * 
 * @interface IntegrationMetadata
 * @property {number | undefined} mangaId - Associated manga ID
 * @property {string | undefined} title - Manga title
 * 
 * @example
 * ```ts
 * const metadata: IntegrationMetadata = {
 *   mangaId: 123,
 *   title: "One Piece"
 * };
 * ```
 */
export interface IntegrationMetadata {
  mangaId?: number;
  title?: string;
}

/**
 * Integration task definition
 * Complete task structure with required fields
 * 
 * @interface IntegrationTask
 * @property {IntegrationType} type - Integration service type
 * @property {IntegrationAction} action - Task operation type
 * @property {IntegrationMetadata} metadata - Task metadata
 * 
 * @example
 * ```ts
 * const task: IntegrationTask = {
 *   type: 'komga',
 *   action: 'scan',
 *   metadata: {
 *     mangaId: 123,
 *     title: "One Piece"
 *   }
 * };
 * ```
 */
export interface IntegrationTask {
  type: IntegrationType;
  action: IntegrationAction;
  metadata: IntegrationMetadata;
}

/**
 * Task creation interface
 * Flexible interface for creating new tasks
 * 
 * @interface CreateIntegrationTask
 * @property {IntegrationType} type - Integration service type
 * @property {IntegrationAction} action - Task operation type
 * @property {IntegrationMetadata} [metadata] - Optional task metadata
 * 
 * @example
 * ```ts
 * const newTask: CreateIntegrationTask = {
 *   type: 'kavita',
 *   action: 'refresh'
 * };
 * ```
 */
export interface CreateIntegrationTask {
  type: IntegrationType;
  action: IntegrationAction;
  metadata?: IntegrationMetadata;
}

/**
 * Type-safe task creation helper
 * Creates properly structured integration tasks
 * 
 * @param {IntegrationType} type - Integration service type
 * @param {IntegrationAction} action - Task operation type
 * @param {Partial<IntegrationMetadata>} [metadata] - Optional task metadata
 * @returns {IntegrationTask} Properly structured task
 * 
 * @example
 * ```ts
 * const task = createIntegrationTask('komga', 'scan', {
 *   mangaId: 123,
 *   title: "One Piece"
 * });
 * ```
 */
export function createIntegrationTask(
  type: IntegrationType,
  action: IntegrationAction,
  metadata?: Partial<IntegrationMetadata>
): IntegrationTask {
  return {
    type,
    action,
    metadata: {
      ...(metadata?.mangaId !== undefined ? { mangaId: metadata.mangaId } : {}),
      ...(metadata?.title !== undefined ? { title: metadata.title } : {})
    }
  };
}
