/**
 * Types for DataCorrectionPanel components
 */

export interface ExtractedData {
  title?: string;
  alternativeTitles?: string[];
  description?: string;
  author?: string[];
  artist?: string[];
  genres?: string[];
  status?: string;
  chapters?: number;
  volumes?: number;
  coverImage?: string;
  publisher?: string;
  demographic?: string;
  releaseYear?: number;
  [key: string]: unknown;
}

export interface CorrectionPanelProps {
  originalData: ExtractedData;
  mlConfidence: number;
  patternsUsed: string[];
  url: string;
  onSubmitCorrections: (corrections: ExtractedData, feedback: unknown) => Promise<void>;
  onSkip?: () => void;
  showAdvanced?: boolean;
}

export interface CorrectionFeedback {
  corrections: Record<string, unknown>;
  userConfidence: number;
  teachingMode: boolean;
  url: string;
  patternsUsed: string[];
  originalConfidence: number;
}

export interface FieldEditorProps {
  field: string;
  value: unknown;
  originalValue: unknown;
  hasCorrection: boolean;
  error?: string | undefined;
  isEditing: boolean;
  onToggleEdit: () => void;
  onFieldChange: (field: string, value: unknown) => void;
}

export interface EditControlProps {
  field: string;
  value: unknown;
  onFieldChange: (field: string, value: unknown) => void;
}

export interface QuickActionsProps {
  onAutoSuggest: () => void;
  onReset: () => void;
  showDetails: boolean;
  onToggleDetails: () => void;
}

export interface CorrectionsSummaryProps {
  correctionsCount: number;
  teachingMode: boolean;
}

export interface PatternDetailsProps {
  patternsUsed: string[];
  url: string;
  showPatternDetails: boolean;
  onTogglePatternDetails: () => void;
}

export interface ConfidenceSliderProps {
  userConfidence: number;
  onConfidenceChange: (value: number) => void;
  getConfidenceColor: (confidence: number) => string;
}

export interface ActionButtonsProps {
  onSkip?: (() => void) | undefined;
  onReset: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  hasCorrections: boolean;
  hasErrors: boolean;
  teachingMode: boolean;
}
