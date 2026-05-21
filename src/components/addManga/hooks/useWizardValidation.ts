import { useState, useCallback } from 'react';

import type { WizardFormData } from '@/types/universalImportWizard.types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface UseWizardValidationReturn {
  validationErrors: Record<string, string>;
  validationWarnings: Record<string, string>;
  validateStep: (
    step: number,
    data: Partial<WizardFormData>,
    additionalData?: Record<string, unknown>
  ) => ValidationResult;
  checkCanProceed: (
    currentStep: number,
    data: Partial<WizardFormData>,
    additionalData?: Record<string, unknown>
  ) => boolean;
  getConfidenceScore: (data: Partial<WizardFormData>) => number;
  getConfidenceColor: (confidence: number) => string;
  calculateFieldConfidence: (
    fieldName: string,
    value: unknown,
    sourceProvider?: string,
    currentProvider?: string
  ) => number;
  clearValidation: () => void;
}

import {
  validateBasicInfo,
  validateMetadataStep,
  validateMediaStep,
  validateVolumesStep,
  validateIdsStep,
  validateFinalSubmission,
  canProceedToNextStep,
  calculateConfidenceScore
} from '../utils/wizard/validationHelpers';

/**
 * Custom hook for wizard validation and confidence scoring
 */
export const useWizardValidation = (): UseWizardValidationReturn => {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [validationWarnings, setValidationWarnings] = useState<Record<string, string>>({});

  /**
   * Validate a specific step
   */
  const validateStep = useCallback((
    step: number,
    data: Partial<WizardFormData>,
    additionalData?: Record<string, unknown>
  ): ValidationResult => {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    switch (step) {
      case 0: {
        // Basic Info
        const basicValidation = validateBasicInfo(data);
        result.isValid = basicValidation.isValid;
        result.errors = basicValidation.errors;
        break;
      }

      case 1: {
        // Metadata
        const metadataValidation = validateMetadataStep(data);
        result.isValid = metadataValidation.isValid;
        result.warnings = metadataValidation.warnings;
        break;
      }

      case 2: {
        // Volumes & Chapters
        const volumesValidation = validateVolumesStep({
          volumes: Array.isArray(data.volumes) ? data.volumes : [],
          chapters: Array.isArray(data["chapters"]) ? data["chapters"] : [],
          ...(data.selectedVolumes !== undefined && { selectedVolumes: data.selectedVolumes }),
          ...(data.selectedChapters !== undefined && {
            selectedChapters: data.selectedChapters.map(ch =>
              typeof ch === 'string' ? ch : ch.url ?? ''
            ).filter(Boolean)
          })
        });
        result.isValid = volumesValidation.isValid;
        result.warnings = volumesValidation.warnings;
        break;
      }

      case 3: {
        // IDs & Links
        const idsValidation = validateIdsStep(
          data.externalIds ?? {},
          data.externalLinks ?? []
        );
        result.isValid = idsValidation.isValid;
        result.warnings = idsValidation.warnings;
        break;
      }

      case 4: {
        // Media
        // Type guard for additionalData array properties
        const getStringArray = (value: unknown): string[] => {
          if (Array.isArray(value)) {
            return value.filter((item): item is string => typeof item === 'string');
          }
          return [];
        };

        const selectedVolumeCovers = additionalData !== undefined
          ? getStringArray(additionalData['selectedVolumeCovers'])
          : [];
        const selectedChapterCovers = additionalData !== undefined
          ? getStringArray(additionalData['selectedChapterCovers'])
          : [];

        const mediaValidation = validateMediaStep(
          data.coverUrl ?? '',
          selectedVolumeCovers,
          selectedChapterCovers
        );
        result.isValid = mediaValidation.isValid;
        result.warnings = mediaValidation.warnings;
        break;
      }

      case 5: {
        // Review
        const finalValidation = validateFinalSubmission(data);
        result.isValid = finalValidation.isValid;
        result.errors = finalValidation.errors;
        result.warnings = finalValidation.warnings;
        break;
      }

      default:
        throw new Error(`Unknown step: ${step}`);
    }

    // Update state
    if (result.errors.length > 0) {
      const firstError = result.errors[0];
      if (firstError !== undefined) {
        setValidationErrors({ [`step-${step}`]: firstError });
      }
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`step-${step}`];
        return newErrors;
      });
    }

    if (result.warnings && result.warnings.length > 0) {
      setValidationWarnings({ [`step-${step}`]: result.warnings.join(', ') });
    } else {
      setValidationWarnings(prev => {
        const newWarnings = { ...prev };
        delete newWarnings[`step-${step}`];
        return newWarnings;
      });
    }

    return result;
  }, []);

  /**
   * Check if can proceed to next step
   */
  const checkCanProceed = useCallback((
    currentStep: number,
    data: Partial<WizardFormData>,
    additionalData?: Record<string, unknown>
  ): boolean => {
    return canProceedToNextStep(currentStep, data, additionalData);
  }, []);

  /**
   * Calculate overall confidence score
   */
  const getConfidenceScore = useCallback((data: Partial<WizardFormData>): number => {
    return calculateConfidenceScore(data);
  }, []);

  /**
   * Get confidence color based on score
   */
  const getConfidenceColor = useCallback((confidence: number): string => {
    if (confidence >= 0.8) return 'green';
    if (confidence >= 0.6) return 'yellow';
    if (confidence >= 0.4) return 'orange';
    return 'red';
  }, []);

  /**
   * Calculate field-specific confidence
   */
  const calculateFieldConfidence = useCallback((
    fieldName: string,
    value: unknown,
    sourceProvider?: string,
    currentProvider?: string
  ): number => {
    // No value = 0 confidence
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return 0;
    }

    // Empty string = 0 confidence
    if (typeof value === 'string' && value.trim() === '') {
      return 0;
    }

    // Base confidence
    let confidence = 0.5;

    // Higher confidence for primary provider
    if (sourceProvider && currentProvider) {
      confidence = sourceProvider === currentProvider ? 0.9 : 0.7;
    }

    // Adjust based on field importance
    const importantFields = ['title', 'description', 'coverUrl', 'status', 'genres'];
    if (importantFields.includes(fieldName)) {
      confidence += 0.1;
    }

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }, []);

  /**
   * Clear all validation errors
   */
  const clearValidation = useCallback((): void => {
    setValidationErrors({});
    setValidationWarnings({});
  }, []);

  return {
    validationErrors,
    validationWarnings,
    validateStep,
    checkCanProceed,
    getConfidenceScore,
    getConfidenceColor,
    calculateFieldConfidence,
    clearValidation
  };
};

export default useWizardValidation;
