/**
 * Utility functions for DataCorrectionPanel
 */

/**
 * Validates a field value and returns an error message if invalid
 */
export function validateField(field: string, value: unknown): string | null {
  switch (field) {
    case 'chapters':
    case 'volumes': {
      if (value !== null && typeof value === 'number' && value < 0) {
        return 'Must be a positive number';
      }
      break;
    }
    case 'title': {
      if (!value || typeof value !== 'string' || value.trim().length === 0) {
        return 'Title is required';
      }
      break;
    }
    case 'status': {
      if (typeof value === 'string' && !['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED'].includes(value)) {
        return 'Invalid status';
      }
      break;
    }
    default:
      // No validation needed for other fields
      break;
  }
  return null;
}

/**
 * Returns a color based on confidence level
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'green';
  if (confidence >= 0.6) return 'yellow';
  if (confidence >= 0.4) return 'orange';
  return 'red';
}

/**
 * Formats a value for display
 */
export function formatDisplayValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return 'Not set';
}

/**
 * Status options for the status select field
 */
export const STATUS_OPTIONS = [
  { value: 'ONGOING', label: 'Ongoing' },
  { value: 'COMPLETED', label: 'Finished' },
  { value: 'HIATUS', label: 'Hiatus' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

/**
 * Primary fields that are always shown
 */
export const PRIMARY_FIELDS = ['title', 'chapters', 'volumes', 'status'] as const;

/**
 * Confidence level presets for the confidence slider
 */
export const CONFIDENCE_PRESETS = [0.5, 0.7, 0.9, 1.0] as const;
