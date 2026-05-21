/**
 * Extended Type Guards
 * Additional type guard utilities for runtime type checking
 */

// Note: WantedItem type removed as model doesn't exist in Prisma schema
import type { SelectorConfig } from '@/types/adapters/native-download-types';

import type { TaskPayload } from '../types/prisma-transaction';
import type { NativeDownloadConfig } from '../types/search.types';

// Define MissingItem type locally since it doesn't exist
interface MissingItem {
  id: string;
  mangaId: string;
  number: number;
}

/**
 * Helper to check if a property exists and get its value with proper typing
 */
function hasProperty<T>(obj: Record<string, unknown>, key: string): obj is Record<string, unknown> & { [K in typeof key]: T } {
  return key in obj;
}

/**
 * Helper to safely get property value
 */
function getProperty(obj: Record<string, unknown>, key: string): unknown {
  if (hasProperty(obj, key)) {
    return obj[key];
  }
  return undefined;
}
export function isNativeDownloadConfig(config: unknown): config is NativeDownloadConfig {
  if (!config || typeof config !== 'object') {
    return false;
  }
  const obj = config as Record<string, unknown>;
  return typeof getProperty(obj, 'enabled') === 'boolean' && typeof getProperty(obj, 'baseUrl') === 'string';
}

export function isSelectorConfig(config: unknown): config is SelectorConfig {
  if (!config || typeof config !== 'object') {
    return false;
  }
  const obj = config as Record<string, unknown>;
  return typeof getProperty(obj, 'selector') === 'string';
}

export function isTaskPayload(payload: unknown): payload is TaskPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const obj = payload as Record<string, unknown>;
  const type = getProperty(obj, 'type');
  const data = getProperty(obj, 'data');
  return typeof type === 'string' && typeof data === 'object' && data !== null;
}

// Commented out: WantedItem model doesn't exist in Prisma schema
// export function isWantedItem(item: unknown): item is WantedItem {
//   return !!(
//     item &&
//     typeof item === 'object' &&
//     typeof (item as Record<string, unknown>).id === 'string' &&
//     typeof (item as Record<string, unknown>).mangaId === 'string' &&
//     typeof (item as Record<string, unknown>).status === 'string' &&
//     typeof (item as Record<string, unknown>).priority === 'string'
//   );
// }

export function isMissingItem(item: unknown): item is MissingItem {
  if (!item || typeof item !== 'object') {
    return false;
  }
  const obj = item as Record<string, unknown>;
  return (
    typeof getProperty(obj, 'id') === 'string' &&
    typeof getProperty(obj, 'mangaId') === 'string' &&
    typeof getProperty(obj, 'number') === 'number'
  );
}

// Validation helpers
export function isValidReleaseIdentifier(identifier: unknown): boolean {
  if (!identifier || typeof identifier !== 'object') {
    return false;
  }
  const obj = identifier as Record<string, unknown>;
  const mangaId = getProperty(obj, 'mangaId');
  const chapterId = getProperty(obj, 'chapterId');
  const number = getProperty(obj, 'number');
  return (
    typeof mangaId === 'string' &&
    (typeof chapterId === 'string' || typeof number === 'number')
  );
}

export function isValidBlocklistReason(reason: unknown): boolean {
  return typeof reason === 'string' && reason.length > 0;
}