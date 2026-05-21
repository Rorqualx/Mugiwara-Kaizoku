/**
 * Type definitions for MetadataEditor component
 *
 * @module metadata-editor/types
 */

export interface MetadataField {
  fieldName: string;
  value: unknown;
  source: string;
  customUrl?: string;
  isEdited: boolean;
  originalValue?: unknown;
  confidence?: number;
  alternatives?: unknown[];
}

export interface URLParseResult {
  success: boolean;
  data?: unknown;
  error?: string;
  parser: string;
  confidence: number;
}

export interface MetadataEditorProps {
  opened: boolean;
  onClose: () => void;
  metadata: Record<string, unknown>;
  fieldSelections: Record<string, {
    source: string;
    value: unknown;
  }>;
  allSources: Record<string, unknown>;
  onSave: (updatedFields: Record<string, {
    source: string;
    value: unknown;
    customUrl?: string;
  }>) => void;
  onUrlParse?: (url: string, field: string) => Promise<URLParseResult>;
}

export interface ProviderData {
  fandom?: Record<string, unknown>;
  anilist?: Record<string, unknown>;
  comicvine?: Record<string, unknown>;
  image?: Record<string, unknown>;
  wikipedia?: Record<string, unknown>;
  json?: Record<string, unknown>;
}

export type FieldExtractor = (field: string, data: Record<string, unknown>) => unknown;
