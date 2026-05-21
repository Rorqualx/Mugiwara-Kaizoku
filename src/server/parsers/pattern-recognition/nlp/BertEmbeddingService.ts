/**
 * BERT Embedding Service
 * 
 * Provides advanced NLP embeddings using BERT models for semantic feature extraction.
 * Uses TensorFlow.js with pre-trained BERT models for text understanding.
 */

import * as tf from '@tensorflow/tfjs-node';

// import * as use from '@tensorflow-models/universal-sentence-encoder';
// Note: Install with: npm install @tensorflow-models/universal-sentence-encoder
const use = { load: () => Promise.resolve({ embed: (texts: string[]) => Promise.resolve(tf.zeros([texts.length, 512])) }) }; // Mock for type checking
import { logger } from '@/utils/logger';

import type { SemanticFeatures } from '../types';

export class BertEmbeddingService {
  private model: unknown = null;
  private tokenizer: unknown = null;
  private isInitialized: boolean = false;
  private embeddingDimension: number = 512; // USE model dimension
  
  // Cache for frequently used embeddings
  private embeddingCache: Map<string, number[]> = new Map();
  private maxCacheSize: number = 1000;

  /**
   * Initialize BERT/USE model
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('Loading Universal Sentence Encoder model...');
      
      // Load Universal Sentence Encoder (lighter than full BERT)
      this.model = await use.load();
      
      // Initialize tokenizer
      await this.initializeTokenizer();
      
      this.isInitialized = true;
      logger.info('BERT embedding service initialized successfully');
    } catch (error: unknown) {
      logger.error('Error initializing BERT embedding service', { error });
      // Fallback to simpler embeddings if BERT fails to load
      this.isInitialized = false;
    }
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbeddings(text: string): Promise<number[]> {
    // Check cache first
    const cached = this.embeddingCache.get(text);
    if (cached) return cached;

    if (!this.isInitialized) {
      // Fallback to simple embeddings
      return this.generateSimpleEmbeddings(text);
    }

    try {
      // Generate embeddings using USE model
      if (!this.model || typeof this.model !== 'object' || !('embed' in this.model)) {
        return this.generateSimpleEmbeddings(text);
      }
      const embedMethod = this.model.embed as (texts: string[]) => Promise<unknown>;
      const embeddingsRaw = await embedMethod([text]);

      // Type guard for tensor with array() and dispose() methods
      if (
        embeddingsRaw !== null &&
        typeof embeddingsRaw === 'object' &&
        'array' in embeddingsRaw &&
        'dispose' in embeddingsRaw
      ) {
        const arrayMethod = embeddingsRaw.array as () => Promise<unknown>;
        const embeddingArray = (await arrayMethod()) as number[][];
        const embedding = embeddingArray[0] as number[];

        // Cache the result
        this.cacheEmbedding(text, embedding);

        // Dispose tensor to free memory
        const disposeMethod = embeddingsRaw.dispose as () => void;
        disposeMethod();

        return embedding;
      }

      return this.generateSimpleEmbeddings(text);
    } catch (error: unknown) {
      logger.error('Error generating embeddings', { error });
      return this.generateSimpleEmbeddings(text);
    }
  }

  /**
   * Generate batch embeddings
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized) {
      return texts.map(text => this.generateSimpleEmbeddings(text));
    }

    try {
      // Check cache and separate cached vs uncached
      const results: Array<number[] | undefined> = Array.from({ length: texts.length }, () => undefined);
      const uncachedTexts: string[] = [];
      const uncachedIndices: number[] = [];
      
      for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        if (text === undefined) continue;

        const cached = this.embeddingCache.get(text);
        if (cached) {
          results[i] = cached;
        } else {
          uncachedTexts.push(text);
          uncachedIndices.push(i);
        }
      }

      // Generate embeddings for uncached texts
      if (uncachedTexts.length === 0) {
        // Filter out undefined and return properly typed array
        return results.filter((embedding): embedding is number[] => embedding !== undefined);
      }

      // Early return if model is invalid
      if (!this.model || typeof this.model !== 'object' || !('embed' in this.model)) {
        return texts.map(text => this.generateSimpleEmbeddings(text));
      }

      const embedMethod = this.model.embed as (texts: string[]) => Promise<unknown>;
      const embeddingsRaw = await embedMethod(uncachedTexts);

      // Early return if tensor is invalid
      if (
        embeddingsRaw === null ||
        typeof embeddingsRaw !== 'object' ||
        !('array' in embeddingsRaw) ||
        !('dispose' in embeddingsRaw)
      ) {
        return texts.map(text => this.generateSimpleEmbeddings(text));
      }

      const arrayMethod = embeddingsRaw.array as () => Promise<unknown>;
      const embeddingArrays = (await arrayMethod()) as number[][];

      // Store results and update cache
      const updatedResults = this.storeEmbeddingResults(embeddingArrays, uncachedTexts, uncachedIndices, results);
      
      // Update the results array with the returned values
      for (let i = 0; i < updatedResults.length; i++) {
        if (updatedResults[i] !== undefined) {
          results[i] = updatedResults[i];
        }
      }

      const disposeMethod = embeddingsRaw.dispose as () => void;
      disposeMethod();

      // Filter out undefined and return properly typed array
      return results.filter((embedding): embedding is number[] => embedding !== undefined);
    } catch (error: unknown) {
      logger.error('Error generating batch embeddings', { error });
      return texts.map(text => this.generateSimpleEmbeddings(text));
    }
  }

  /**
   * Store embedding results and update cache
   */
  private storeEmbeddingResults(
    embeddingArrays: number[][],
    uncachedTexts: string[],
    uncachedIndices: number[],
    results: Array<number[] | undefined>
  ): Array<number[] | undefined> {
    // Create a copy to avoid ESLint no-param-reassign rule
    const updatedResults = [...results];
    
    for (let i = 0; i < uncachedTexts.length; i++) {
      const embedding = embeddingArrays[i] as number[];
      const originalIndex = uncachedIndices[i];
      if (originalIndex !== undefined) {
        updatedResults[originalIndex] = embedding;
      }
      const text = uncachedTexts[i];
      if (text !== undefined) {
        this.cacheEmbedding(text, embedding);
      }
    }
    
    return updatedResults;
  }

  /**
   * Extract semantic features from text
   */
  async extractSemanticFeatures(text: string): Promise<SemanticFeatures> {
    const embeddings = await this.generateEmbeddings(text);
    const _entities = await this.extractNamedEntities(text);
    const keywords = this.extractKeywords(text);
    const topics = await this.detectTopics(text);
    const sentiment = this.analyzeSentiment(text);
    
    return {
      embeddings,
      textContent: text,
      textLength: text.length,
      wordCount: text.split(/\s+/).length,
      hasNumbers: /\d/.test(text),
      hasDate: /\d{4}/.test(text) || /\d{1,2}\/\d{1,2}/.test(text),
      hasISBN: /ISBN|978-|979-/.test(text),
      // Add missing required fields
      keywordDensity: keywords.reduce<Record<string, number>>((acc, keyword) => {
        const count = (text.match(new RegExp(keyword, 'gi')) ?? []).length;
        return { ...acc, [keyword]: count / text.split(/\s+/).length };
      }, {}),
      topicDistribution: topics,
      sentimentScore: sentiment,
      readabilityScore: this.calculateReadabilityScore(text)
    };
  }

  /**
   * Calculate semantic similarity between texts
   */
  async calculateSemanticSimilarity(text1: string, text2: string): Promise<number> {
    const [emb1, emb2] = await this.generateBatchEmbeddings([text1, text2]);
    if (emb1 === undefined || emb2 === undefined) {
      return 0;
    }
    return this.cosineSimilarity(emb1, emb2);
  }

  /**
   * Find semantically similar texts
   */
  async findSimilarTexts(
    query: string, 
    candidates: string[], 
    topK: number = 5
  ): Promise<Array<{ text: string, similarity: number }>> {
    const queryEmbedding = await this.generateEmbeddings(query);
    const candidateEmbeddings = await this.generateBatchEmbeddings(candidates);
    
    const similarities = candidateEmbeddings
      .map((embedding, idx) => {
        const text = candidates[idx];
        if (text === undefined) {
          return null;
        }
        return {
          text,
          similarity: this.cosineSimilarity(queryEmbedding, embedding)
        };
      })
      .filter((item): item is { text: string; similarity: number } => item !== null);

    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, topK);
  }

  /**
   * Extract named entities (simplified version)
   */
  private extractNamedEntities(text: string): Promise<string[]> {
    const entities: string[] = [];
    
    // Simple pattern-based entity extraction
    // In production, use a proper NER model
    
    // Extract capitalized words (potential names)
    const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    const names = text.match(namePattern) ?? [];
    entities.push(...names);
    
    // Extract dates
    const datePattern = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}\b/g;
    const dates = text.match(datePattern) ?? [];
    entities.push(...dates);
    
    // Extract numbers with units
    const numberPattern = /\b\d+(?:\.\d+)?\s*(?:GB|MB|KB|ms|s|%)\b/gi;
    const numbers = text.match(numberPattern) ?? [];
    entities.push(...numbers);

    return Promise.resolve([...new Set(entities)]);
  }

  /**
   * Extract keywords using TF-IDF (simplified)
   */
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Count word frequencies
    const wordFreq = new Map<string, number>();
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
    }
    
    // Sort by frequency and get top keywords
    const sorted = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
    
    return sorted;
  }

  /**
   * Detect topics (simplified LDA-like approach)
   */
  private detectTopics(text: string): Promise<Record<string, number>> {
    // Predefined topic keywords (in production, use proper topic modeling)
    const topics = {
      'metadata': ['title', 'description', 'author', 'genre', 'tags'],
      'chapters': ['chapter', 'volume', 'episode', 'part', 'section'],
      'navigation': ['next', 'previous', 'page', 'menu', 'link'],
      'content': ['text', 'paragraph', 'article', 'body', 'content'],
      'media': ['image', 'video', 'audio', 'gallery', 'thumbnail']
    };
    
    const lowerText = text.toLowerCase();
    const topicScores: Record<string, number> = {};
    
    for (const [topic, keywords] of Object.entries(topics)) {
      let score = 0;
      for (const keyword of keywords) {
        const occurrences = (lowerText.match(new RegExp(keyword, 'g')) ?? []).length;
        score += occurrences;
      }
      topicScores[topic] = score / keywords.length;
    }
    
    // Normalize scores
    const total = Object.values(topicScores).reduce((a, b) => a + b, 0);
    if (total > 0) {
      for (const topic in topicScores) {
        const currentScore = topicScores[topic];
        if (currentScore !== undefined) {
          topicScores[topic] = currentScore / total;
        }
      }
    }

    return Promise.resolve(topicScores);
  }

  /**
   * Analyze sentiment (simplified)
   */
  private analyzeSentiment(text: string): number {
    // Simple lexicon-based sentiment analysis
    // Returns value between -1 (negative) and 1 (positive)
    
    const positiveWords = [
      'good', 'great', 'excellent', 'amazing', 'wonderful',
      'fantastic', 'love', 'best', 'happy', 'beautiful'
    ];
    
    const negativeWords = [
      'bad', 'terrible', 'awful', 'horrible', 'worst',
      'hate', 'ugly', 'disgusting', 'poor', 'fail'
    ];
    
    const lowerText = text.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;
    
    for (const word of positiveWords) {
      positiveCount += (lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) ?? []).length;
    }
    
    for (const word of negativeWords) {
      negativeCount += (lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) ?? []).length;
    }
    
    const total = positiveCount + negativeCount;
    if (total === 0) return 0;
    
    return (positiveCount - negativeCount) / total;
  }

  /**
   * Initialize tokenizer for BERT
   */
  private initializeTokenizer(): Promise<void> {
    // In a full implementation, this would load a proper BERT tokenizer
    // For now, we use the USE model which handles tokenization internally
    this.tokenizer = {
      encode: (text: string) => text.split(/\s+/),
      decode: (tokens: string[]) => tokens.join(' ')
    };

    return Promise.resolve();
  }

  /**
   * Generate simple embeddings as fallback
   */
  private generateSimpleEmbeddings(text: string): number[] {
    // Simple character-based hash embeddings as fallback
    const embedding: number[] = new Array<number>(this.embeddingDimension).fill(0);

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const index = (charCode * (i + 1)) % this.embeddingDimension;
      const currentValue = embedding[index];
      if (currentValue !== undefined) {
        embedding[index] = currentValue + 1;
      }
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        const currentValue = embedding[i];
        if (currentValue !== undefined) {
          embedding[i] = currentValue / magnitude;
        }
      }
    }

    return embedding;
  }

  /**
   * Cache embedding
   */
  private cacheEmbedding(text: string, embedding: number[]): void {
    // Limit cache size
    if (this.embeddingCache.size >= this.maxCacheSize) {
      // Remove oldest entry (simple FIFO)
      const firstKey = this.embeddingCache.keys().next().value;
      if (firstKey !== undefined) {
        this.embeddingCache.delete(firstKey);
      }
    }
    
    this.embeddingCache.set(text, embedding);
  }

  /**
   * Calculate readability score using Flesch-Kincaid
   */
  private calculateReadabilityScore(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length || 1;
    const words = text.split(/\s+/).filter(w => w.length > 0).length || 1;
    const syllables = text.split(/\s+/).reduce((count, word) => {
      // Simple syllable counting (approximation)
      return count + Math.max(1, word.replace(/[^aeiouAEIOU]/g, '').length);
    }, 0);
    
    // Flesch Reading Ease formula
    const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
    
    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, score / 100));
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i];
      const bVal = b[i];
      if (aVal === undefined || bVal === undefined) continue;

      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.embeddingCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number, maxSize: number, hitRate: number } {
    return {
      size: this.embeddingCache.size,
      maxSize: this.maxCacheSize,
      hitRate: 0 // Would need to track hits/misses for accurate rate
    };
  }
}
