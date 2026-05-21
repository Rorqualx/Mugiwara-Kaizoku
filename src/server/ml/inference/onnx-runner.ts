/**
 * ONNX Runtime Inference Runner
 *
 * Wraps ONNX Runtime for running Transformer-CRF model inference.
 */

import { logger } from '@/utils/logger';

import { bioToEntitySpans } from '../features/dom-linearizer';

import { CRFDecoder, loadCRFParams, getConfidenceScores } from './crf-decoder';
import { DEFAULT_MODEL_CONFIG } from './types';

import type {
  ModelConfig,
  CRFParams,
  InferenceInput,
  InferenceOutput,
  ExtractedEntity,
} from './types';
import type { LinearizedToken, BIOTag, EntityType } from '../features/dom-linearizer';


// ============================================================================
// ONNX Session Types (conditional import)
// ============================================================================

type OrtSession = {
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array }>>;
  release(): Promise<void>;
};

type OrtTensor = {
  new (type: string, data: number[] | BigInt64Array, dims: number[]): unknown;
};

interface OrtModule {
  InferenceSession: {
    create(path: string): Promise<OrtSession>;
  };
  Tensor: OrtTensor;
}

// ============================================================================
// Inference Runner Class
// ============================================================================

export class TransformerCRFInference {
  private session: OrtSession | null = null;
  private crfDecoder: CRFDecoder | null = null;
  private config: ModelConfig;
  private isInitialized = false;
  private ort: OrtModule | null = null;

  constructor(config: Partial<ModelConfig> = {}) {
    this.config = { ...DEFAULT_MODEL_CONFIG, ...config };
  }

  /**
   * Initialize the inference session
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load onnxruntime-node
      this.ort = this.loadOnnxRuntime();

      // Load ONNX model
      this.session = await this.ort.InferenceSession.create(this.config.modelPath);
      logger.info('ONNX model loaded', { path: this.config.modelPath });

      // Load CRF parameters
      const crfParams = await this.loadCRFParams();
      this.crfDecoder = new CRFDecoder(crfParams);
      logger.info('CRF decoder initialized', { numTags: crfParams.numTags });

      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize inference session', { error });
      throw error;
    }
  }

  private loadOnnxRuntime(): OrtModule {
    try {
      // eslint-disable-next-line no-undef -- Optional CommonJS dependency that may not be installed
      const ort = require('onnxruntime-node') as OrtModule;
      return ort;
    } catch {
      throw new Error('onnxruntime-node is not installed. Run: npm install onnxruntime-node');
    }
  }

  private async loadCRFParams(): Promise<CRFParams> {
    const fs = await import('fs/promises');
    const paramsJson = await fs.readFile(this.config.crfParamsPath, 'utf-8');
    return loadCRFParams(paramsJson);
  }

  /**
   * Run inference on tokenized input
   */
  async predict(input: InferenceInput): Promise<InferenceOutput> {
    if (!this.isInitialized || !this.session || !this.crfDecoder || !this.ort) {
      throw new Error('Inference session not initialized. Call initialize() first.');
    }

    const { tokens, inputIds, attentionMask } = input;
    const seqLength = attentionMask.filter((m) => m === 1).length;

    // Run ONNX inference
    const emissions = await this.runOnnxInference(inputIds, attentionMask);

    // Decode with CRF
    const { tags } = this.crfDecoder.decode(emissions, seqLength);
    const predictions = this.crfDecoder.tagsToLabels(tags);

    // Get confidence scores
    const confidence = getConfidenceScores(emissions, tags, this.config.numLabels);

    // Extract entities
    const entities = this.extractEntities(tokens, predictions, confidence);

    return {
      predictions,
      confidence,
      entities,
      rawEmissions: emissions,
    };
  }

  private async runOnnxInference(
    inputIds: number[],
    attentionMask: number[]
  ): Promise<Float32Array> {
    if (!this.session || !this.ort) {
      throw new Error('Session not initialized');
    }

    // Pad to max sequence length
    const paddedInputIds = this.padSequence(inputIds, this.config.maxSeqLength, 0);
    const paddedMask = this.padSequence(attentionMask, this.config.maxSeqLength, 0);

    // Create tensors - ONNX expects int64 for input_ids
    const inputIdsTensor = new this.ort.Tensor(
      'int64',
      BigInt64Array.from(paddedInputIds.map(BigInt)),
      [1, this.config.maxSeqLength]
    );
    const maskTensor = new this.ort.Tensor(
      'int64',
      BigInt64Array.from(paddedMask.map(BigInt)),
      [1, this.config.maxSeqLength]
    );

    // Run inference
    const feeds = {
      input_ids: inputIdsTensor,
      attention_mask: maskTensor,
    };

    const results = await this.session.run(feeds);
    const emissions = results['emissions'];
    if (!emissions) {
      throw new Error('Model did not return emissions output');
    }
    return emissions.data;
  }

  private padSequence(seq: number[], length: number, padValue: number): number[] {
    if (seq.length >= length) {
      return seq.slice(0, length);
    }
    const paddingLength = length - seq.length;
    const padding: number[] = new Array(paddingLength).fill(padValue) as number[];
    return [...seq, ...padding];
  }

  private extractEntities(
    tokens: LinearizedToken[],
    predictions: BIOTag[],
    confidence: number[]
  ): ExtractedEntity[] {
    const spans = bioToEntitySpans(predictions);
    const entities: ExtractedEntity[] = [];

    for (const span of spans) {
      const entity = this.createEntity(tokens, span, confidence);
      if (entity) {
        entities.push(entity);
      }
    }

    return entities;
  }

  private createEntity(
    tokens: LinearizedToken[],
    span: { start: number; end: number; type: EntityType },
    confidence: number[]
  ): ExtractedEntity | null {
    if (span.start >= tokens.length) return null;

    const endIdx = Math.min(span.end, tokens.length - 1);
    const entityTokens = tokens.slice(span.start, endIdx + 1);
    const text = entityTokens.map((t) => t.text).join(' ');

    // Average confidence for the span
    const spanConfidence = confidence
      .slice(span.start, endIdx + 1)
      .reduce((a, b) => a + b, 0) / (endIdx - span.start + 1);

    return {
      type: span.type,
      text,
      tokens: entityTokens,
      startIndex: span.start,
      endIndex: endIdx,
      confidence: spanConfidence,
    };
  }

  /**
   * Close the inference session
   */
  async close(): Promise<void> {
    if (this.session) {
      await this.session.release();
      this.session = null;
    }
    this.isInitialized = false;
    logger.info('Inference session closed');
  }

  /**
   * Check if session is initialized
   */
  get ready(): boolean {
    return this.isInitialized;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let inferenceInstance: TransformerCRFInference | null = null;

export async function getInferenceSession(
  config?: Partial<ModelConfig>
): Promise<TransformerCRFInference> {
  if (!inferenceInstance) {
    inferenceInstance = new TransformerCRFInference(config);
    await inferenceInstance.initialize();
  }
  return inferenceInstance;
}

export async function closeInferenceSession(): Promise<void> {
  if (inferenceInstance) {
    await inferenceInstance.close();
    inferenceInstance = null;
  }
}
