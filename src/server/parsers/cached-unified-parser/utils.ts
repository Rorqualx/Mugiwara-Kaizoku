/**
 * Utility Functions for Cached Unified Parser
 *
 * Shared helper functions used across cached parser modules.
 * Extracted from: CachedUnifiedParser.ts
 */

/**
 * Type guard to check if value is a Record
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Helper to chunk array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Group items by namespace property
 */
export function groupByNamespace<T extends { namespace: string }>(
  items: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const group = groups.get(item.namespace) ?? [];
    group.push(item);
    groups.set(item.namespace, group);
  }

  return groups;
}
