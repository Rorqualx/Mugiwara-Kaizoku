/**
 * Field manipulation utilities
 *
 * @module metadata-editor/utils/field-utils
 */

/**
 * Format field value for display
 */
export function formatFieldValue(value: unknown, fieldType?: string): string {
  if (value === null || value === undefined) {
    return 'Not set';
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  if (fieldType === 'date' && typeof value === 'string') {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return String(value);
    }
  }

  return String(value);
}

/**
 * Validate field value based on field type
 */
export function validateFieldValue(value: unknown, fieldType: string): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  switch (fieldType) {
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'string':
      return typeof value === 'string' && value.trim().length > 0;
    case 'array':
      return Array.isArray(value) && value.length > 0;
    case 'boolean':
      return typeof value === 'boolean';
    case 'date':
      return typeof value === 'string' && !isNaN(Date.parse(value));
    case 'url':
      return typeof value === 'string' && isValidUrl(value);
    default:
      return true;
  }
}

/**
 * Check if string is a valid URL
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Compare two field values for equality
 */
export function compareFieldValues(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => item === b[index]);
  }

  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  return false;
}

/**
 * Convert value to appropriate type based on field
 */
export function convertFieldValue(value: unknown, field: string): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  const numberFields = ['volumes', 'chapters', 'averageScore', 'popularity'];
  const booleanFields = ['isAdult'];
  const arrayFields = ['genres', 'tags', 'alternativeTitles', 'authors'];

  if (numberFields.includes(field)) {
    return typeof value === 'number' ? value : Number(value);
  }

  if (booleanFields.includes(field)) {
    return typeof value === 'boolean' ? value : Boolean(value);
  }

  if (arrayFields.includes(field)) {
    return Array.isArray(value) ? value : [value];
  }

  return value;
}
