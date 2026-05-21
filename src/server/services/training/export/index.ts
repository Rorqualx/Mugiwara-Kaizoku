/**
 * LLM Training Data Export Module
 *
 * Unified export interface for multiple training data formats.
 * Supports JSONL, Alpaca, ShareGPT, Q&A, Markdown, and NER formats.
 *
 * @module training/export
 */

// ============================================================================
// Types
// ============================================================================

export type {
  ExtractedEntity,
  ExportContext,
  ExportOptions,
  AlpacaRecord,
  ShareGPTRecord,
  QARecord,
  NERSpanRecord,
  JSONLRecord,
  PageData,
} from './types';

export {
  extractPageData,
  extractEntitiesFromBIO,
  getContextAroundEntity,
  getFullText,
  generateQuestionForEntity,
  generateExtractionInstruction,
} from './types';

// ============================================================================
// Format Exporters
// ============================================================================

// JSONL Format
export {
  toJSONLRecord,
  exportAsJSONL,
  exportPagesToJSONL,
  exportBatchToJSONL,
} from './formats/jsonl';
export type { JSONLExportOptions, JSONLBatchResult } from './formats/jsonl';

// Alpaca Format
export {
  toAlpacaFormat,
  exportPagesToAlpaca,
  exportToAlpacaJSONL,
  exportAsAlpacaStream,
} from './formats/alpaca';
export type { AlpacaExportOptions } from './formats/alpaca';

// ShareGPT Format
export {
  toShareGPTFormat,
  exportPagesToShareGPT,
  exportToShareGPTJSONL,
  exportAsShareGPTStream,
} from './formats/sharegpt';
export type { ShareGPTExportOptions } from './formats/sharegpt';

// Q&A Format
export {
  toQAFormat,
  exportPagesToQA,
  exportToQAJSONL,
  exportToSQuADFormat,
  exportAsQAStream,
} from './formats/qa';
export type { QAExportOptions } from './formats/qa';

// Markdown Format
export {
  toMarkdownFormat,
  toMarkdownDocument,
  exportPagesToMarkdown,
  exportToMarkdownJSONL,
  exportToConcatenatedMarkdown,
  exportAsMarkdownStream,
} from './formats/markdown';
export type { MarkdownExportOptions, MarkdownExportResult } from './formats/markdown';

// NER Spans Format
export {
  toNERSpanFormat,
  toSpacyFormat,
  toHuggingFaceFormat,
  toCoNLLFormat,
  exportPagesToNERSpans,
  exportToNERJSONL,
  exportToSpacyJSONL,
  exportToCoNLL,
  exportToHuggingFaceJSONL,
  exportAsNERStream,
} from './formats/ner-spans';
export type {
  NERSpanExportOptions,
  SpacyDocBin,
  HuggingFaceNER,
} from './formats/ner-spans';

// ============================================================================
// Unified Export Interface
// ============================================================================


import { exportToAlpacaJSONL } from './formats/alpaca';
import { exportBatchToJSONL } from './formats/jsonl';
import { exportToMarkdownJSONL } from './formats/markdown';
import { exportToNERJSONL, exportToCoNLL, exportToSpacyJSONL } from './formats/ner-spans';
import { exportToQAJSONL } from './formats/qa';
import { exportToShareGPTJSONL } from './formats/sharegpt';

import type { AnnotatedPage } from '@prisma/client';

export type ExportFormat =
  | 'jsonl'
  | 'alpaca'
  | 'sharegpt'
  | 'qa'
  | 'markdown'
  | 'ner'
  | 'conll'
  | 'spacy';

export interface UnifiedExportOptions {
  format: ExportFormat;
  includeMetadata?: boolean | undefined;
  entityTypes?: string[] | undefined;
  maxInputLength?: number | undefined;
}

export interface UnifiedExportResult {
  content: string;
  format: ExportFormat;
  recordCount: number;
  mimeType: string;
  fileExtension: string;
}

/**
 * Export pages to any supported format
 */
export function exportToFormat(
  pages: AnnotatedPage[],
  options: UnifiedExportOptions
): UnifiedExportResult {
  const { format } = options;

  switch (format) {
    case 'jsonl': {
      const result = exportBatchToJSONL(pages, { includeMetadata: options.includeMetadata });
      return {
        content: result.content,
        format,
        recordCount: result.recordCount,
        mimeType: 'application/jsonl',
        fileExtension: '.jsonl',
      };
    }

    case 'alpaca': {
      const content = exportToAlpacaJSONL(pages, {
        includeMetadata: options.includeMetadata,
        maxInputLength: options.maxInputLength,
        entityTypes: options.entityTypes,
      });
      return {
        content,
        format,
        recordCount: countLines(content),
        mimeType: 'application/jsonl',
        fileExtension: '.jsonl',
      };
    }

    case 'sharegpt': {
      const content = exportToShareGPTJSONL(pages, {
        includeMetadata: options.includeMetadata,
        entityTypes: options.entityTypes,
      });
      return {
        content,
        format,
        recordCount: countLines(content),
        mimeType: 'application/jsonl',
        fileExtension: '.jsonl',
      };
    }

    case 'qa': {
      const content = exportToQAJSONL(pages, {
        includeMetadata: options.includeMetadata,
        entityTypes: options.entityTypes,
      });
      return {
        content,
        format,
        recordCount: countLines(content),
        mimeType: 'application/jsonl',
        fileExtension: '.jsonl',
      };
    }

    case 'markdown': {
      const content = exportToMarkdownJSONL(pages, {
        includeMetadata: options.includeMetadata,
      });
      return {
        content,
        format,
        recordCount: countLines(content),
        mimeType: 'application/jsonl',
        fileExtension: '.jsonl',
      };
    }

    case 'ner': {
      const content = exportToNERJSONL(pages, {
        includeMetadata: options.includeMetadata,
        entityTypes: options.entityTypes,
      });
      return {
        content,
        format,
        recordCount: countLines(content),
        mimeType: 'application/jsonl',
        fileExtension: '.jsonl',
      };
    }

    case 'conll': {
      const content = exportToCoNLL(pages, {
        entityTypes: options.entityTypes,
      });
      return {
        content,
        format,
        recordCount: pages.length,
        mimeType: 'text/plain',
        fileExtension: '.conll',
      };
    }

    case 'spacy': {
      const content = exportToSpacyJSONL(pages, {
        entityTypes: options.entityTypes,
      });
      return {
        content,
        format,
        recordCount: countLines(content),
        mimeType: 'application/jsonl',
        fileExtension: '.jsonl',
      };
    }

    default: {
      const _exhaustive: never = format;
      throw new Error(`Unsupported export format: ${_exhaustive}`);
    }
  }
}

function countLines(content: string): number {
  if (!content) return 0;
  return content.trim().split('\n').length;
}

// ============================================================================
// Format Information
// ============================================================================

export interface FormatInfo {
  id: ExportFormat;
  name: string;
  description: string;
  fileExtension: string;
  mimeType: string;
  useCase: string;
}

export const EXPORT_FORMATS: FormatInfo[] = [
  {
    id: 'jsonl',
    name: 'JSONL',
    description: 'Newline-delimited JSON with tokens and entities',
    fileExtension: '.jsonl',
    mimeType: 'application/jsonl',
    useCase: 'General-purpose streaming export',
  },
  {
    id: 'alpaca',
    name: 'Alpaca',
    description: 'Instruction-input-output format for fine-tuning',
    fileExtension: '.jsonl',
    mimeType: 'application/jsonl',
    useCase: 'Instruction tuning LLMs',
  },
  {
    id: 'sharegpt',
    name: 'ShareGPT',
    description: 'Conversational format with human/assistant turns',
    fileExtension: '.jsonl',
    mimeType: 'application/jsonl',
    useCase: 'Conversational fine-tuning',
  },
  {
    id: 'qa',
    name: 'Q&A',
    description: 'Question-answer pairs with context',
    fileExtension: '.jsonl',
    mimeType: 'application/jsonl',
    useCase: 'Reading comprehension and extractive QA',
  },
  {
    id: 'markdown',
    name: 'Markdown',
    description: 'Clean markdown text with optional frontmatter',
    fileExtension: '.jsonl',
    mimeType: 'application/jsonl',
    useCase: 'General LLM training and document understanding',
  },
  {
    id: 'ner',
    name: 'NER Spans',
    description: 'Span-based named entity recognition format',
    fileExtension: '.jsonl',
    mimeType: 'application/jsonl',
    useCase: 'Entity recognition model training',
  },
  {
    id: 'conll',
    name: 'CoNLL',
    description: 'Token-per-line with BIO tags',
    fileExtension: '.conll',
    mimeType: 'text/plain',
    useCase: 'Sequence labeling and NER',
  },
  {
    id: 'spacy',
    name: 'spaCy',
    description: 'spaCy DocBin-compatible format',
    fileExtension: '.jsonl',
    mimeType: 'application/jsonl',
    useCase: 'spaCy NER model training',
  },
];

export function getFormatInfo(format: ExportFormat): FormatInfo | undefined {
  return EXPORT_FORMATS.find(f => f.id === format);
}
