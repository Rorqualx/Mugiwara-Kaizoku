/**
 * Types for custom import rules and advanced scanning patterns
 */

export interface ImportRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number; // Higher priority rules are evaluated first
  createdAt: Date;
  updatedAt: Date;
}

export type ConditionType = 
  | 'filename_pattern' 
  | 'path_contains' 
  | 'file_size' 
  | 'metadata_match'
  | 'chapter_range'
  | 'volume_range'
  | 'language'
  | 'group';

export type ConditionOperator = 
  | 'matches' 
  | 'contains' 
  | 'starts_with'
  | 'ends_with'
  | 'greater_than' 
  | 'less_than'
  | 'equals'
  | 'not_equals'
  | 'in_range';

export interface RuleCondition {
  type: ConditionType;
  operator: ConditionOperator;
  value: string | number | [number, number]; // [min, max] for range
  caseSensitive?: boolean;
  negate?: boolean; // Invert the condition
}

export type ActionType = 
  | 'set_library' 
  | 'add_tag' 
  | 'set_status' 
  | 'skip'
  | 'set_metadata_provider'
  | 'set_priority'
  | 'apply_naming_pattern'
  | 'move_to_folder'
  | 'set_reading_direction';

export interface RuleAction {
  type: ActionType;
  value: string | number | string[]; // string[] for tags
  options?: Record<string, unknown>;
}

export interface ImportActions {
  libraryId?: number;
  tags?: string[];
  status?: string;
  skip?: boolean;
  metadataProvider?: string;
  priority?: number;
  namingPattern?: string;
  destinationFolder?: string;
  readingDirection?: 'ltr' | 'rtl';
}

export interface ImportContext {
  availableLibraries: Array<{ id: number; name: string; path: string }>;
  existingManga: Array<{ id: number; title: string; path: string }>;
  metadataProviders: string[];
  defaultLibraryId?: number;
}

export interface ParsedFileInfo {
  path: string;
  filename: string;
  size: number;
  title: string;
  group?: string;
  publisher?: string;
  language?: string;
  volume?: number;
  chapter?: number;
  year?: number;
  chapters?: number[];
}

export interface ParsedMangaInfo {
  originalFilename: string;
  cleanTitle: string;
  group?: string;
  volume?: number;
  chapter?: number;
  chapters: number[];
  language?: string;
  quality?: string;
}

// Advanced pattern matching
export interface AdvancedPattern {
  id: string;
  name: string;
  description?: string;
  pattern: string; // Regex pattern
  extractors: PatternExtractor[];
  examples?: string[]; // Example filenames that match
  priority: number;
}

export interface PatternExtractor {
  field: 'title' | 'group' | 'volume' | 'chapter' | 'language' | 'quality' | 'custom';
  groupIndex: number; // Regex capture group index
  transform?: 'lowercase' | 'uppercase' | 'capitalize' | 'number' | 'custom';
  customTransform?: string; // JavaScript expression for custom transform
}

// Rule validation
export interface RuleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Rule testing
export interface RuleTestResult {
  rule: ImportRule;
  matched: boolean;
  conditions: Array<{
    condition: RuleCondition;
    result: boolean;
    reason?: string;
  }>;
  actions: ImportActions;
}