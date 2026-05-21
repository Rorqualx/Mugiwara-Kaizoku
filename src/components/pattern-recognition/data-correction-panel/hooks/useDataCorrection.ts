/**
 * Custom hook for managing data correction state and logic
 */
import { useState, useEffect, useCallback } from 'react';
import React from 'react';

import { notifications } from '@mantine/notifications';
import { } from '@tabler/icons-react';
// @ts-ignore - TypeScript has issues resolving IconBrain
import { IconBrain } from '@tabler/icons-react';

import { notify } from '@/utils/notify';

import { validateField } from '../utils';

import type { ExtractedData, CorrectionFeedback } from '../types';

interface UseDataCorrectionProps {
  originalData: ExtractedData;
  mlConfidence: number;
  patternsUsed: string[];
  url: string;
  onSubmitCorrections: (corrections: ExtractedData, feedback: unknown) => Promise<void>;
}

interface UseDataCorrectionReturn {
  correctedData: ExtractedData;
  setCorrectedData: React.Dispatch<React.SetStateAction<ExtractedData>>;
  editMode: Record<string, boolean>;
  setEditMode: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  corrections: Record<string, unknown>;
  userConfidence: number;
  setUserConfidence: React.Dispatch<React.SetStateAction<number>>;
  showDetails: boolean;
  setShowDetails: React.Dispatch<React.SetStateAction<boolean>>;
  isSubmitting: boolean;
  validationErrors: Record<string, string>;
  teachingMode: boolean;
  setTeachingMode: React.Dispatch<React.SetStateAction<boolean>>;
  showPatternDetails: boolean;
  setShowPatternDetails: React.Dispatch<React.SetStateAction<boolean>>;
  handleFieldCorrection: (field: string, value: unknown) => void;
  handleSubmit: () => Promise<void>;
  handleAutoSuggest: () => void;
  resetData: () => void;
}

export function useDataCorrection({
  originalData,
  mlConfidence,
  patternsUsed,
  url,
  onSubmitCorrections,
}: UseDataCorrectionProps): UseDataCorrectionReturn {
  const [correctedData, setCorrectedData] = useState<ExtractedData>(originalData);
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  const [corrections, setCorrections] = useState<Record<string, unknown>>({});
  const [userConfidence, setUserConfidence] = useState(0.9);
  const [showDetails, setShowDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [teachingMode, setTeachingMode] = useState(true);
  const [showPatternDetails, setShowPatternDetails] = useState(false);

  // Track which fields have been corrected
  useEffect(() => {
    const changes: Record<string, unknown> = {};
    Object.keys(correctedData).forEach((key) => {
      if (JSON.stringify(correctedData[key]) !== JSON.stringify(originalData[key])) {
        changes[key] = {
          original: originalData[key],
          corrected: correctedData[key],
        };
      }
    });
    setCorrections(changes);
  }, [correctedData, originalData]);

  // Handle field correction
  const handleFieldCorrection = useCallback((field: string, value: unknown): void => {
    setCorrectedData((prev) => ({ ...prev, [field]: value }));
    const error = validateField(field, value);
    if (error) {
      setValidationErrors((prev) => ({ ...prev, [field]: error }));
    } else {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, []);

  // Submit corrections
  const handleSubmit = useCallback(async (): Promise<void> => {
    if (Object.keys(validationErrors).length > 0) {
      notify({ severity: 'ERROR', title: 'Validation Error', message: 'Please fix the errors before submitting' });
      return;
    }

    setIsSubmitting(true);
    try {
      const feedback: CorrectionFeedback = {
        corrections,
        userConfidence,
        teachingMode,
        url,
        patternsUsed,
        originalConfidence: mlConfidence,
      };
      await onSubmitCorrections(correctedData, feedback);
      notify({ severity: 'SUCCESS', title: 'Corrections Submitted', message: teachingMode
          ? 'Thank you! The AI will learn from your corrections.'
          : 'Data has been corrected.' });
    } catch (_error: unknown) {
      notify({ severity: 'ERROR', title: 'Error', message: 'Failed to submit corrections' });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validationErrors,
    corrections,
    userConfidence,
    teachingMode,
    url,
    patternsUsed,
    mlConfidence,
    correctedData,
    onSubmitCorrections,
  ]);

  // Auto-suggest corrections using AI
  const handleAutoSuggest = useCallback((): void => {
    notifications.show({
      title: 'AI Suggestions',
      message: 'Analyzing data for potential corrections...',
      loading: true,
      autoClose: false,
      id: 'ai-suggest',
    });

    // Simulate AI suggestions (in production, this would call the ML engine)
    setTimeout(() => {
      const suggestions: Partial<ExtractedData> = {};

      // Example suggestions based on common patterns
      const currentTitle = correctedData['title'];
      if (!currentTitle || (typeof currentTitle === 'string' && currentTitle.includes('Wiki'))) {
        if (typeof currentTitle === 'string') {
          suggestions['title'] = currentTitle.replace(' Wiki', '').replace('Wiki ', '');
        }
      }

      if (!correctedData['status'] && correctedData['chapters']) {
        suggestions['status'] = 'ONGOING';
      }

      if (correctedData.author?.length === 0) {
        suggestions.author = ['Unknown'];
      }

      setCorrectedData((prev) => ({ ...prev, ...suggestions }));

      notifications.update({
        id: 'ai-suggest',
        title: 'AI Suggestions Applied',
        message: `${Object.keys(suggestions).length} fields updated`,
        color: 'blue',
        icon: React.createElement(IconBrain),
        autoClose: 3000,
      });
    }, 1500);
  }, [correctedData]);

  // Reset data to original
  const resetData = useCallback((): void => {
    setCorrectedData(originalData);
  }, [originalData]);

  return {
    correctedData,
    setCorrectedData,
    editMode,
    setEditMode,
    corrections,
    userConfidence,
    setUserConfidence,
    showDetails,
    setShowDetails,
    isSubmitting,
    validationErrors,
    teachingMode,
    setTeachingMode,
    showPatternDetails,
    setShowPatternDetails,
    handleFieldCorrection,
    handleSubmit,
    handleAutoSuggest,
    resetData,
  };
}
