import type { ConditionType, ConditionOperator } from '@/types/import-rules';

/**
 * Generate a UUID using globalThis.crypto for browser/server compatibility
 */
export function generateUUID(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Get available operators for a given condition type
 */
export function getOperatorsForType(type: ConditionType): ConditionOperator[] {
  const operatorMap: Record<ConditionType, ConditionOperator[]> = {
    filename_pattern: ['matches'],
    path_contains: ['contains', 'starts_with', 'ends_with'],
    file_size: ['greater_than', 'less_than', 'equals'],
    metadata_match: ['contains'],
    chapter_range: ['in_range'],
    volume_range: ['in_range'],
    language: ['equals', 'not_equals', 'contains'],
    group: ['equals', 'contains']
  };

  const operators = operatorMap[type];
  return operators;
}
