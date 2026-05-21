import { useState, useCallback } from 'react';

import type { WizardFormData } from '@/types/universalImportWizard.types';

import { canProceedToNextStep, getStepValidationMessage } from '../utils/wizard/validationHelpers';

interface UseWizardStateOptions {
  totalSteps: number;
  initialStep?: number;
  onStepChange?: (step: number) => void;
}

interface UseWizardStateReturn {
  activeStep: number;
  setActiveStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;
  validationError: string | null;
}

/**
 * Custom hook for managing wizard navigation and step state
 */
export const useWizardState = (
  formData: Partial<WizardFormData>,
  options: UseWizardStateOptions
): UseWizardStateReturn => {
  const { totalSteps, initialStep = 0, onStepChange } = options;
  const [activeStep, setActiveStepInternal] = useState(initialStep);

  // Calculate navigation availability
  const canGoPrev = activeStep > 0;
  const isFirstStep = activeStep === 0;
  const isLastStep = activeStep === totalSteps - 1;

  // Check if can proceed to next step based on validation
  const canGoNext = canProceedToNextStep(activeStep, formData);
  const validationError = getStepValidationMessage(activeStep, formData);

  // Handle step change with callback
  const setActiveStep = useCallback((step: number) => {
    if (step >= 0 && step < totalSteps) {
      setActiveStepInternal(step);
      onStepChange?.(step);
    }
  }, [totalSteps, onStepChange]);

  // Navigate to next step
  const nextStep = useCallback(() => {
    if (activeStep < totalSteps - 1 && canGoNext) {
      const newStep = activeStep + 1;
      setActiveStep(newStep);
    }
  }, [activeStep, totalSteps, canGoNext, setActiveStep]);

  // Navigate to previous step
  const prevStep = useCallback(() => {
    if (activeStep > 0) {
      const newStep = activeStep - 1;
      setActiveStep(newStep);
    }
  }, [activeStep, setActiveStep]);

  return {
    activeStep,
    setActiveStep,
    nextStep,
    prevStep,
    canGoNext,
    canGoPrev,
    isFirstStep,
    isLastStep,
    validationError
  };
};

/**
 * Step configuration type
 */
export interface WizardStep {
  label: string;
  icon: React.ReactNode;
  content: React.ComponentType<unknown>;
}

/**
 * Hook for managing wizard steps configuration
 */
export const useWizardSteps = (steps: WizardStep[]): {
  steps: WizardStep[];
  getCurrentStep: (activeStep: number) => WizardStep | undefined;
  getStepLabel: (stepIndex: number) => string;
  getStepIcon: (stepIndex: number) => React.ReactNode | undefined;
  getTotalSteps: () => number;
} => {
  const getCurrentStep = (activeStep: number): WizardStep | undefined => {
    return steps[activeStep];
  };

  const getStepLabel = (stepIndex: number): string => {
    return steps[stepIndex]?.label ?? '';
  };

  const getStepIcon = (stepIndex: number): React.ReactNode | undefined => {
    return steps[stepIndex]?.icon;
  };

  const getTotalSteps = (): number => steps.length;

  return {
    steps,
    getCurrentStep,
    getStepLabel,
    getStepIcon,
    getTotalSteps
  };
};

/**
 * Hook for managing wizard form data state
 */
export const useWizardFormData = (initialData: Partial<WizardFormData>): {
  formData: Partial<WizardFormData>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<WizardFormData>>>;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  updateFormField: <K extends keyof WizardFormData>(field: K, value: WizardFormData[K]) => void;
  resetFormData: () => void;
} => {
  const [formData, setFormData] = useState<Partial<WizardFormData>>(initialData);

  const updateFormData = useCallback((updates: Partial<WizardFormData>): void => {
    setFormData(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  const updateFormField = useCallback(<K extends keyof WizardFormData>(
    field: K,
    value: WizardFormData[K]
  ): void => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const resetFormData = useCallback((): void => {
    setFormData(initialData);
  }, [initialData]);

  return {
    formData,
    setFormData,
    updateFormData,
    updateFormField,
    resetFormData
  };
};

/**
 * Hook for tracking which fields have been edited
 */
export const useEditedFields = (): {
  editedFields: Set<string>;
  markFieldAsEdited: (fieldName: string) => void;
  isFieldEdited: (fieldName: string) => boolean;
  clearEditedFields: () => void;
  getEditedFieldsList: () => string[];
} => {
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());

  const markFieldAsEdited = useCallback((fieldName: string): void => {
    setEditedFields(prev => new Set([...prev, fieldName]));
  }, []);

  const isFieldEdited = useCallback((fieldName: string): boolean => {
    return editedFields.has(fieldName);
  }, [editedFields]);

  const clearEditedFields = useCallback((): void => {
    setEditedFields(new Set());
  }, []);

  const getEditedFieldsList = useCallback((): string[] => {
    return Array.from(editedFields);
  }, [editedFields]);

  return {
    editedFields,
    markFieldAsEdited,
    isFieldEdited,
    clearEditedFields,
    getEditedFieldsList
  };
};

/**
 * Hook for managing loading states across the wizard
 */
export const useWizardLoading = (): {
  loadingStates: Record<string, boolean>;
  setLoading: (key: string, isLoading: boolean) => void;
  isLoading: (key: string) => boolean;
  isAnyLoading: () => boolean;
  clearAllLoading: () => void;
} => {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const setLoading = useCallback((key: string, isLoading: boolean): void => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: isLoading
    }));
  }, []);

  const isLoading = useCallback((key: string): boolean => {
    return loadingStates[key] ?? false;
  }, [loadingStates]);

  const isAnyLoading = useCallback((): boolean => {
    return Object.values(loadingStates).some(state => state);
  }, [loadingStates]);

  const clearAllLoading = useCallback((): void => {
    setLoadingStates({});
  }, []);

  return {
    loadingStates,
    setLoading,
    isLoading,
    isAnyLoading,
    clearAllLoading
  };
};

/**
 * Hook for managing error states across the wizard
 */
export const useWizardErrors = (): {
  errors: Record<string, string>;
  setError: (key: string, error: string) => void;
  clearError: (key: string) => void;
  getError: (key: string) => string | undefined;
  hasAnyError: () => boolean;
  clearAllErrors: () => void;
} => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setError = useCallback((key: string, error: string): void => {
    setErrors(prev => ({
      ...prev,
      [key]: error
    }));
  }, []);

  const clearError = useCallback((key: string): void => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const getError = useCallback((key: string): string | undefined => {
    return errors[key];
  }, [errors]);

  const hasAnyError = useCallback((): boolean => {
    return Object.keys(errors).length > 0;
  }, [errors]);

  const clearAllErrors = useCallback((): void => {
    setErrors({});
  }, []);

  return {
    errors,
    setError,
    clearError,
    getError,
    hasAnyError,
    clearAllErrors
  };
};