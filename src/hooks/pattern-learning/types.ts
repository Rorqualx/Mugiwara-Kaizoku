/**
 * Shared types for pattern learning hooks
 */

export interface ExtractedData {
  title?: string;
  description?: string;
  author?: string[];
  chapters?: number;
  volumes?: number;
  status?: string;
  [key: string]: unknown;
}

export interface CorrectionFeedback {
  corrections: Record<string, unknown>;
  userConfidence: number;
  teachingMode: boolean;
  url: string;
  patternsUsed: string[];
  originalConfidence: number;
}

export interface LearningMetrics {
  totalCorrections: number;
  improvementRate: number;
  averageConfidence: number;
  patternsLearned: number;
  lastTrainingDate: Date | null;
}

export interface PatternSuggestion {
  field: string;
  suggestedValue: unknown;
  confidence: number;
  reason: string;
}

export interface MetricsResponse {
  metrics: LearningMetrics;
  timestamp: Date;
}

export interface ConfidenceResponse {
  confidence: number;
}

// Type guard functions
export function isConfidenceResponse(data: unknown): data is ConfidenceResponse {
  return typeof data === 'object' && data !== null && 'confidence' in data && typeof (data as ConfidenceResponse).confidence === 'number';
}

export function isMetricsResponse(data: unknown): data is MetricsResponse {
  return typeof data === 'object' && data !== null && 'metrics' in data && 'timestamp' in data;
}
