/**
 * Text Analysis Helpers
 *
 * Provides text embedding, n-gram generation, hashing, named entity extraction,
 * and language detection utilities for feature engineering.
 */
import * as crypto from 'crypto';

/**
 * Generate text embeddings using character n-grams and hashing
 *
 * @param text - Text to generate embeddings for
 * @param embeddingDimension - Dimensionality of the embedding vector
 * @param embeddingsCache - Cache map for storing computed embeddings
 * @returns Normalized embedding vector
 *
 * @remarks
 * This is a simple embedding implementation. In production, use proper NLP
 * embeddings (Word2Vec, BERT, etc.) for better semantic understanding.
 */
export function getTextEmbeddings(
  text: string,
  embeddingDimension: number,
  embeddingsCache: Map<string, number[]>
): number[] {
  // Check cache
  const cachedEmbedding = embeddingsCache.get(text);
  if (cachedEmbedding !== undefined) {
    return cachedEmbedding;
  }

  // Simple embedding using character n-grams and hashing
  const embedding = new Array<number>(embeddingDimension).fill(0);
  const ngrams = getNGrams(text.toLowerCase(), 3);

  for (const ngram of ngrams) {
    const hash = hashString(ngram);
    const index = Math.abs(hash) % embeddingDimension;
    const currentValue = embedding[index];
    if (currentValue !== undefined) {
      embedding[index] = currentValue + 1;
    }
  }

  // Normalize with type-safe array operations
  const magnitude = Math.sqrt(
    embedding.reduce((sum: number, val: number) => sum + val * val, 0)
  );

  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      const value = embedding[i];
      if (value !== undefined) {
        embedding[i] = value / magnitude;
      }
    }
  }

  embeddingsCache.set(text, embedding);
  return embedding;
}

/**
 * Extract character n-grams from text
 *
 * @param text - Text to extract n-grams from
 * @param n - Size of each n-gram
 * @returns Array of n-gram strings
 *
 * @example
 * ```typescript
 * getNGrams('hello', 2)
 * // Returns: ['he', 'el', 'll', 'lo']
 * ```
 */
export function getNGrams(text: string, n: number): string[] {
  const ngrams: string[] = [];
  for (let i = 0; i <= text.length - n; i++) {
    ngrams.push(text.substring(i, i + n));
  }
  return ngrams;
}

/**
 * Hash a string to a number using MD5
 *
 * @param str - String to hash
 * @returns 32-bit signed integer hash
 *
 * @remarks
 * Uses MD5 for fast hashing. Not suitable for cryptographic purposes.
 */
export function hashString(str: string): number {
  const hash = crypto.createHash('md5').update(str).digest();
  return hash.readInt32BE(0);
}

/**
 * Extract named entities from text using simple pattern matching
 *
 * @param text - Text to extract entities from
 * @returns Array of unique entity strings
 *
 * @remarks
 * This is a simple implementation using regex patterns. In production,
 * use proper NER (Named Entity Recognition) models for better accuracy.
 *
 * Extracts:
 * - Capitalized words (potential names)
 * - Numbers with units (volumes, chapters, episodes, pages)
 */
export function extractNamedEntities(text: string): string[] {
  const entities: string[] = [];

  // Extract capitalized words (potential names)
  const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g;
  const matches = text.match(namePattern) ?? [];
  entities.push(...matches);

  // Extract numbers with units
  const numberPattern = /\d+\s*(?:volumes?|chapters?|episodes?|pages?)/gi;
  const numberMatches = text.match(numberPattern) ?? [];
  entities.push(...numberMatches);

  return Array.from(new Set(entities));
}

/**
 * Detect the language of text based on character sets
 *
 * @param text - Text to analyze
 * @returns ISO 639-1 language code ('ja', 'zh', 'ko', or 'en')
 *
 * @remarks
 * This is a simple detection based on Unicode character ranges.
 * In production, use proper language detection libraries (e.g., franc, langdetect)
 * for more accurate and comprehensive language identification.
 *
 * Supported languages:
 * - Japanese (Hiragana, Katakana)
 * - Chinese (CJK Unified Ideographs)
 * - Korean (Hangul)
 * - English (default fallback)
 */
export function detectLanguage(text: string): string {
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja'; // Japanese
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh'; // Chinese
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko'; // Korean
  return 'en'; // Default to English
}
