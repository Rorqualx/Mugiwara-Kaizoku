/**
 * Validation helpers for the UniversalImportWizard
 *
 * Contains functions for validating wizard step data and ensuring
 * data completeness before proceeding to the next step or final submission.
 */

import type { WizardFormData } from '@/types/universalImportWizard.types';

/**
 * Validate that required basic info fields are present
 */
export const validateBasicInfo = (data: Partial<WizardFormData>): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (!data["title"] || data["title"].trim() === '') {
    errors.push('Title is required');
  }

  if (!data.searchProvider?.trim()) {
    errors.push('Provider is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate metadata selection step
 */
export const validateMetadataStep = (data: Partial<WizardFormData>): {
  isValid: boolean;
  warnings: string[];
} => {
  const warnings: string[] = [];

  // These are warnings, not hard errors
  if (!data["description"] || data["description"].trim() === '') {
    warnings.push('No description provided');
  }

  if (!data["status"]) {
    warnings.push('No publication status selected');
  }

  if (!data["genres"] || data["genres"].length === 0) {
    warnings.push('No genres selected');
  }

  return {
    isValid: true, // Metadata step is optional, so always valid
    warnings
  };
};

/**
 * Validate media selection step
 */
export const validateMediaStep = (
  selectedCover: string,
  selectedVolumeCovers: string[],
  _selectedChapterCovers: string[]
): {
  isValid: boolean;
  warnings: string[];
} => {
  const warnings: string[] = [];

  if (!selectedCover) {
    warnings.push('No main cover image selected');
  }

  if (selectedVolumeCovers.length === 0) {
    warnings.push('No volume covers selected');
  }

  return {
    isValid: true, // Media is optional
    warnings
  };
};

/**
 * Validate volumes and chapters step
 */
export const validateVolumesStep = (data: {
  volumes?: unknown[];
  chapters?: unknown[];
  selectedVolumes?: number[] | string[];
  selectedChapters?: string[];
}): {
  isValid: boolean;
  warnings: string[];
} => {
  const warnings: string[] = [];

  if (!data.volumes || data.volumes.length === 0) {
    warnings.push('No volumes data available');
  }

  if (!data["chapters"] || data["chapters"].length === 0) {
    warnings.push('No chapters data available');
  }

  if (data.selectedVolumes?.length === 0) {
    warnings.push('No volumes selected for import');
  }

  if (data.selectedChapters?.length === 0) {
    warnings.push('No chapters selected for import');
  }

  return {
    isValid: true, // Volumes/chapters are optional
    warnings
  };
};

/**
 * Validate external IDs and links
 */
export const validateIdsStep = (
  externalIds: Record<string, string>,
  externalLinks: string[]
): {
  isValid: boolean;
  warnings: string[];
} => {
  const warnings: string[] = [];

  // Check if at least one ID is provided
  const hasAnyId = Object.values(externalIds).some(id => id && id.trim() !== '');
  if (!hasAnyId) {
    warnings.push('No external IDs provided');
  }

  // Validate URL format for external links
  const invalidUrls = externalLinks.filter(link => {
    if (!link || link.trim() === '') return false;
    try {
      new URL(link);
      return false;
    } catch {
      return true;
    }
  });

  if (invalidUrls.length > 0) {
    warnings.push(`${invalidUrls.length} invalid URL(s) in external links`);
  }

  return {
    isValid: true, // IDs are optional
    warnings
  };
};

/**
 * Validate the entire wizard data before final submission
 */
export const validateFinalSubmission = (data: Partial<WizardFormData>): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!data["title"] || data["title"].trim() === '') {
    errors.push('Title is required');
  }

  if (!data.searchProvider) {
    errors.push('Provider is required');
  }

  if (!data.selectedSource) {
    errors.push('Source is required');
  }

  // Optional but recommended fields
  if (!data["description"] || data["description"].trim() === '') {
    warnings.push('No description provided');
  }

  if (!data.coverUrl) {
    warnings.push('No cover image selected');
  }

  if (!data["status"]) {
    warnings.push('No publication status provided');
  }

  if (!data["genres"] || data["genres"].length === 0) {
    warnings.push('No genres provided');
  }

  if (!data["authors"] || data["authors"].length === 0) {
    warnings.push('No authors provided');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Check if user can proceed to the next step
 */
export const canProceedToNextStep = (
  currentStep: number,
  data: Partial<WizardFormData>,
  _additionalData?: unknown
): boolean => {
  switch (currentStep) {
    case 0: // Basic Info
      return validateBasicInfo(data).isValid;

    case 1: // Metadata Selection
      return true; // Always can proceed from metadata

    case 2: // Volumes & Chapters
      return true; // Always can proceed

    case 3: // IDs & Links
      return true; // Always can proceed

    case 4: // Media Selection
      return true; // Always can proceed

    case 5: // Review
      return validateFinalSubmission(data).isValid;

    default:
      return false;
  }
};

/**
 * Get step-specific validation message
 */
export const getStepValidationMessage = (
  currentStep: number,
  data: Partial<WizardFormData>,
  _additionalData?: unknown
): string | null => {
  switch (currentStep) {
    case 0: {
      const validation = validateBasicInfo(data);
      const firstError = validation.errors[0];
      return firstError ?? null;
    }

    case 5: {
      const validation = validateFinalSubmission(data);
      const firstError = validation.errors[0];
      return firstError ?? null;
    }

    default:
      return null;
  }
};

/**
 * Calculate confidence score based on data completeness
 */
export const calculateConfidenceScore = (data: Partial<WizardFormData>): number => {
  let score = 0;
  const weights = {
    title: 10,
    description: 8,
    status: 5,
    genres: 5,
    authors: 5,
    artists: 3,
    coverUrl: 8,
    startDate: 3,
    endDate: 3,
    volumeInfo: 5,
    alternativeTitles: 2,
    tags: 2,
    publisher: 2,
    demographic: 2,
    format: 2
  };

  // Calculate score based on field presence
  for (const [field, weight] of Object.entries(weights)) {
    const dataRecord = data as Record<string, unknown>;
    const value = dataRecord[field];
    if (value) {
      if (Array.isArray(value)) {
        if (value.length > 0) score += weight;
      } else if (typeof value === 'string') {
        if (value.trim() !== '') score += weight;
      } else {
        score += weight;
      }
    }
  }

  // Convert to percentage
  const maxScore = Object.values(weights).reduce((a, b) => a + b, 0);
  return Math.round((score / maxScore) * 100);
};

/**
 * Check if a field has been manually edited by the user
 */
export const isFieldManuallyEdited = (
  fieldName: string,
  currentValue: unknown,
  originalValue: unknown
): boolean => {
  if (currentValue === originalValue) return false;

  // Handle array comparison
  if (Array.isArray(currentValue) && Array.isArray(originalValue)) {
    if (currentValue.length !== originalValue.length) return true;
    return !currentValue.every((val, index) => val === originalValue[index]);
  }

  // Handle object comparison (for dates, etc.)
  if (typeof currentValue === 'object' && typeof originalValue === 'object') {
    return JSON.stringify(currentValue) !== JSON.stringify(originalValue);
  }

  return currentValue !== originalValue;
};

/**
 * Get a list of missing recommended fields
 */
export const getMissingRecommendedFields = (data: Partial<WizardFormData>): string[] => {
  const missing: string[] = [];
  const recommended = [
    'description',
    'coverUrl',
    'status',
    'genres',
    'authors',
    'startDate',
    'volumeInfo'
  ];

  for (const field of recommended) {
    const dataRecord = data as Record<string, unknown>;
    const value = dataRecord[field];
    if (!value || (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'string' && value.trim() === '')) {
      missing.push(field);
    }
  }

  return missing;
};