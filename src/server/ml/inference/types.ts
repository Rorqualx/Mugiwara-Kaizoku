/**
 * Types for ML Inference
 *
 * Defines types for ONNX model inference and CRF decoding.
 */

import type { EntityType, BIOTag, LinearizedToken } from '../features/dom-linearizer';

// ============================================================================
// Model Configuration Types
// ============================================================================

export interface ModelConfig {
  modelPath: string;
  crfParamsPath: string;
  maxSeqLength: number;
  numLabels: number;
}

export interface CRFParams {
  transitions: number[][];
  startTransitions: number[];
  endTransitions: number[];
  numTags: number;
  label2id: Record<string, number>;
  id2label: Record<string, string>;
}

// ============================================================================
// Inference Types
// ============================================================================

export interface InferenceInput {
  tokens: LinearizedToken[];
  inputIds: number[];
  attentionMask: number[];
}

export interface InferenceOutput {
  predictions: BIOTag[];
  confidence: number[];
  entities: ExtractedEntity[];
  rawEmissions?: Float32Array;
}

export interface ExtractedEntity {
  type: EntityType;
  text: string;
  tokens: LinearizedToken[];
  startIndex: number;
  endIndex: number;
  confidence: number;
}

// ============================================================================
// Tokenizer Types
// ============================================================================

export interface TokenizerOutput {
  inputIds: number[];
  attentionMask: number[];
  tokenToOriginal: number[];
}

export interface TokenizerConfig {
  vocabPath?: string;
  maxLength: number;
  padTokenId: number;
  clsTokenId: number;
  sepTokenId: number;
  unkTokenId: number;
}

// ============================================================================
// Session Types
// ============================================================================

export interface InferenceSession {
  isInitialized: boolean;
  modelPath: string;
  run(input: InferenceInput): Promise<InferenceOutput>;
  close(): Promise<void>;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  modelPath: 'models/transformer_crf.onnx',
  crfParamsPath: 'models/crf_params.json',
  maxSeqLength: 512,
  numLabels: 33,
};

export const DEFAULT_TOKENIZER_CONFIG: TokenizerConfig = {
  maxLength: 512,
  padTokenId: 0,
  clsTokenId: 101,
  sepTokenId: 102,
  unkTokenId: 100,
};
