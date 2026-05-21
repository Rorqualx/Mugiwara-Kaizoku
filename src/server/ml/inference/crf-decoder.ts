/**
 * CRF Viterbi Decoder
 *
 * Implements the Viterbi algorithm for CRF sequence decoding in TypeScript.
 * Used to decode emission scores from the Transformer into optimal BIO sequences.
 */

import type { CRFParams } from './types';
import type { BIOTag } from '../features/dom-linearizer';

// ============================================================================
// CRF Decoder Class
// ============================================================================

export class CRFDecoder {
  private transitions: number[][];
  private startTransitions: number[];
  private endTransitions: number[];
  private numTags: number;
  private id2label: Record<string, string>;

  constructor(params: CRFParams) {
    this.transitions = params.transitions;
    this.startTransitions = params.startTransitions;
    this.endTransitions = params.endTransitions;
    this.numTags = params.numTags;
    this.id2label = params.id2label;
  }

  /**
   * Decode emission scores using Viterbi algorithm
   */
  decode(emissions: Float32Array, seqLength: number): { tags: number[]; score: number } {
    if (seqLength === 0) {
      return { tags: [], score: 0 };
    }

    const { viterbi, backpointers } = this.forwardPass(emissions, seqLength);
    const lastViterbi = viterbi[seqLength - 1];

    if (!lastViterbi) {
      return { tags: [], score: 0 };
    }

    const { tags, score } = this.backtrack(viterbi, backpointers, seqLength, lastViterbi);

    return { tags, score };
  }

  /**
   * Convert tag IDs to BIO labels
   */
  tagsToLabels(tags: number[]): BIOTag[] {
    return tags.map((tagId) => (this.id2label[String(tagId)] ?? 'O') as BIOTag);
  }

  /**
   * Decode and return BIO labels directly
   */
  decodeToLabels(emissions: Float32Array, seqLength: number): BIOTag[] {
    const { tags } = this.decode(emissions, seqLength);
    return this.tagsToLabels(tags);
  }

  // ============================================================================
  // Viterbi Algorithm Implementation
  // ============================================================================

  private forwardPass(
    emissions: Float32Array,
    seqLength: number
  ): { viterbi: number[][]; backpointers: number[][] } {
    const viterbi: number[][] = [];
    const backpointers: number[][] = [];

    // Initialize first position
    viterbi.push(this.initializeFirstPosition(emissions));
    backpointers.push(new Array(this.numTags).fill(0) as number[]);

    // Forward pass for remaining positions
    for (let t = 1; t < seqLength; t++) {
      const prevScores = viterbi[t - 1];
      if (!prevScores) continue;

      const { scores, pointers } = this.computePositionScores(emissions, prevScores, t);
      viterbi.push(scores);
      backpointers.push(pointers);
    }

    return { viterbi, backpointers };
  }

  private initializeFirstPosition(emissions: Float32Array): number[] {
    const scores: number[] = [];
    for (let j = 0; j < this.numTags; j++) {
      const startTrans = this.startTransitions[j] ?? 0;
      const emission = emissions[j] ?? 0;
      scores.push(startTrans + emission);
    }
    return scores;
  }

  private computePositionScores(
    emissions: Float32Array,
    prevScores: number[],
    position: number
  ): { scores: number[]; pointers: number[] } {
    const scores: number[] = [];
    const pointers: number[] = [];
    const emissionOffset = position * this.numTags;

    for (let j = 0; j < this.numTags; j++) {
      const { maxScore, maxIdx } = this.findBestPrevTag(prevScores, j);
      const emission = emissions[emissionOffset + j] ?? 0;
      scores.push(maxScore + emission);
      pointers.push(maxIdx);
    }

    return { scores, pointers };
  }

  private findBestPrevTag(prevScores: number[], currentTag: number): { maxScore: number; maxIdx: number } {
    let maxScore = Number.NEGATIVE_INFINITY;
    let maxIdx = 0;

    for (let i = 0; i < this.numTags; i++) {
      const prevScore = prevScores[i] ?? 0;
      const transRow = this.transitions[i];
      const trans = transRow?.[currentTag] ?? 0;
      const score = prevScore + trans;
      if (score > maxScore) {
        maxScore = score;
        maxIdx = i;
      }
    }

    return { maxScore, maxIdx };
  }

  private backtrack(
    viterbi: number[][],
    backpointers: number[][],
    seqLength: number,
    lastViterbi: number[]
  ): { tags: number[]; score: number } {
    // Find best final tag
    const { bestTag, bestScore } = this.findBestFinalTag(lastViterbi);

    // Backtrack to find best path
    const tags = this.tracePath(backpointers, seqLength, bestTag);

    return { tags, score: bestScore };
  }

  private findBestFinalTag(finalScores: number[]): { bestTag: number; bestScore: number } {
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestTag = 0;

    for (let j = 0; j < this.numTags; j++) {
      const finalScore = finalScores[j] ?? 0;
      const endTrans = this.endTransitions[j] ?? 0;
      const score = finalScore + endTrans;
      if (score > bestScore) {
        bestScore = score;
        bestTag = j;
      }
    }

    return { bestTag, bestScore };
  }

  private tracePath(backpointers: number[][], seqLength: number, finalTag: number): number[] {
    const tags: number[] = new Array(seqLength).fill(0) as number[];
    tags[seqLength - 1] = finalTag;

    for (let t = seqLength - 2; t >= 0; t--) {
      const nextIdx = tags[t + 1] ?? 0;
      const pointerRow = backpointers[t + 1];
      tags[t] = pointerRow?.[nextIdx] ?? 0;
    }

    return tags;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function loadCRFParams(paramsJson: string): CRFParams {
  const params = JSON.parse(paramsJson) as CRFParams;
  validateCRFParams(params);
  return params;
}

function validateCRFParams(params: CRFParams): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime validation for parsed JSON
  if (!params.transitions || !Array.isArray(params.transitions)) {
    throw new Error('Invalid CRF params: missing transitions matrix');
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime validation for parsed JSON
  if (!params.startTransitions || !Array.isArray(params.startTransitions)) {
    throw new Error('Invalid CRF params: missing start transitions');
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime validation for parsed JSON
  if (!params.endTransitions || !Array.isArray(params.endTransitions)) {
    throw new Error('Invalid CRF params: missing end transitions');
  }
  if (typeof params.numTags !== 'number' || params.numTags <= 0) {
    throw new Error('Invalid CRF params: invalid numTags');
  }
}

export function softmax(logits: Float32Array, start: number, length: number): number[] {
  const result: number[] = [];
  let maxVal = Number.NEGATIVE_INFINITY;

  // Find max for numerical stability
  for (let i = 0; i < length; i++) {
    const val = logits[start + i] ?? 0;
    if (val > maxVal) {
      maxVal = val;
    }
  }

  // Compute exp and sum
  let sum = 0;
  for (let i = 0; i < length; i++) {
    const val = logits[start + i] ?? 0;
    const exp = Math.exp(val - maxVal);
    result.push(exp);
    sum += exp;
  }

  // Normalize
  for (let i = 0; i < length; i++) {
    const r = result[i];
    if (r !== undefined) {
      result[i] = r / sum;
    }
  }

  return result;
}

export function getConfidenceScores(
  emissions: Float32Array,
  predictions: number[],
  numTags: number
): number[] {
  const confidences: number[] = [];

  for (let t = 0; t < predictions.length; t++) {
    const probs = softmax(emissions, t * numTags, numTags);
    const predIdx = predictions[t] ?? 0;
    confidences.push(probs[predIdx] ?? 0);
  }

  return confidences;
}
