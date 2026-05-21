/**
 * Pattern Manager Module
 *
 * Manages the pattern library, including loading, creating, and evolving patterns.
 * Extracted from: PatternRecognitionEngine.ts
 * Date: 2025-11-20
 */

import { EventEmitter } from 'events';

import type {
  Pattern,
  PatternFeatures,
  PatternType,
  Prediction,
  PatternEvent
} from '@/server/parsers/pattern-recognition/types';
import { PatternStore } from '@/server/parsers/pattern-recognition/utils/PatternStore';
import { logger } from '@/utils/logger';


import { isValidPatternType } from './utils';

import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';


type Element = AnyNode;

/**
 * PatternManager
 *
 * Manages pattern library operations including loading, creating, and evolving patterns.
 * Handles pattern storage and indexing by type.
 */
export class PatternManager extends EventEmitter {
  private patterns: Map<string, Pattern> = new Map();
  private patternsByType: Map<PatternType, Pattern[]> = new Map();
  private store: PatternStore;

  /**
   * Create a new PatternManager
   * @param store - Pattern storage service
   */
  constructor(store: PatternStore) {
    super();
    this.store = store;
  }

  /**
   * Load patterns from storage
   */
  async loadPatterns(): Promise<void> {
    const patterns = await this.store.loadPatterns();
    for (const pattern of patterns) {
      // Access id using bracket notation for unknown type
      const id = pattern['id'];
      if (typeof id === 'string') {
        this.patterns.set(id, pattern);
        // Index by type
        if (!this.patternsByType.has(pattern.type)) {
          this.patternsByType.set(pattern.type, []);
        }
        // Use optional chaining and null check for safe array access
        const patternsForType = this.patternsByType.get(pattern.type);
        if (patternsForType) {
          patternsForType.push(pattern);
        }
      }
    }
    logger.info(`Loaded ${patterns.length} patterns`);
  }

  /**
   * Create new pattern from high-confidence prediction
   */
  async createNewPattern(
    element: Element,
    $: CheerioAPI,
    features: PatternFeatures,
    prediction: Prediction
  ): Promise<Pattern | null> {
    try {
      const _$el = $(element);

      // Generate selector
      const selector = this.generateSelector(element, $);

      // Validate prediction label
      if (!isValidPatternType(prediction.label)) {
        logger.error('Invalid pattern type in prediction', { label: prediction.label });
        return null;
      }

      // Create pattern
      const pattern: Pattern = {
        id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `Auto-learned ${prediction.label}`,
        type: prediction.label as PatternType,
        features,
        selector,
        confidence: prediction.confidence,
        accuracy: prediction.confidence, // Initial accuracy equals confidence
        usageCount: 1,
        successRate: 1,
        lastUsed: new Date(),
        created: new Date(),
        version: 1,
        source: 'learned',
        metadata: {
          autoLearned: true,
          sourceUrl: $('base').attr('href') ?? '',
          elementTag:
            'tagName' in element && element.tagName ? String(element.tagName) : '',
          prediction
        }
      };

      // Add to library
      this.patterns.set(pattern['id'], pattern);
      if (!this.patternsByType.has(pattern.type)) {
        this.patternsByType.set(pattern.type, []);
      }

      // Use optional chaining and null check for safe array access
      const patternsForType = this.patternsByType.get(pattern.type);
      if (patternsForType) {
        patternsForType.push(pattern);
      }

      // Save pattern
      await this.store.savePattern(pattern);

      // Emit event
      this.emit('pattern:learned', {
        type: 'pattern:learned',
        pattern,
        timestamp: new Date()
      } as PatternEvent);

      return pattern;
    } catch (error: unknown) {
      logger.error('Failed to create new pattern', { error });
      return null;
    }
  }

  /**
   * Evolve patterns based on performance
   */
  async evolvePatterns(): Promise<void> {
    try {
      logger.info('Starting pattern evolution...');

      const allPatterns = Array.from(this.patterns.values());

      // ML components disabled - evolution skipped
      const evolvedPatterns = allPatterns; // No evolution
      // const evolvedPatterns = await this.evolutionManager.evolvePatterns(allPatterns);

      // Update pattern library
      this.patterns.clear();
      this.patternsByType.clear();

      for (const pattern of evolvedPatterns) {
        const id = pattern['id'];
        if (typeof id === 'string') {
          this.patterns.set(id, pattern);
          if (!this.patternsByType.has(pattern.type)) {
            this.patternsByType.set(pattern.type, []);
          }

          // Use optional chaining and null check for safe array access
          const patternsForType = this.patternsByType.get(pattern.type);
          if (patternsForType) {
            patternsForType.push(pattern);
          }
        }
      }

      // Save evolved patterns
      await this.store.savePatterns(evolvedPatterns);

      logger.info(`Evolution complete: ${evolvedPatterns.length} patterns`);

      // Emit event
      this.emit('pattern:evolved', {
        type: 'pattern:evolved',
        data: { count: evolvedPatterns.length },
        timestamp: new Date()
      } as PatternEvent);
    } catch (error: unknown) {
      logger.error('Failed to evolve patterns', { error });
    }
  }

  /**
   * Get all patterns as array
   */
  getPatterns(): Pattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get patterns Map (for internal use by orchestrator)
   * @internal
   */
  getPatternsMap(): Map<string, Pattern> {
    return this.patterns;
  }

  /**
   * Get patterns by type
   */
  getPatternsByType(type: PatternType): Pattern[] {
    return this.patternsByType.get(type) ?? [];
  }

  /**
   * Get patternsByType Map (for internal use by orchestrator)
   * @internal
   */
  getPatternsByTypeMap(): Map<PatternType, Pattern[]> {
    return this.patternsByType;
  }

  /**
   * Generate CSS selector for element
   * @internal
   */
  private generateSelector(element: Element, $: CheerioAPI): string {
    const $el = $(element);

    // Try ID first
    const id = $el.attr('id');
    if (id) {
      return `#${id}`;
    }

    // Try unique class combination
    const classes = ($el.attr('class') ?? '').split(' ').filter(Boolean);
    if (classes.length > 0) {
      const selector = '.' + classes.join('.');
      if ($(selector).length === 1) {
        return selector;
      }
    }

    // Generate path-based selector
    const path: string[] = [];
    let current = $el;
    while (current.length > 0 && path.length < 5) {
      const node = current[0];
      if (!node) break;

      const tag =
        'tagName' in node && node.tagName ? String(node.tagName).toLowerCase() : undefined;
      if (!tag) break;

      const currentClasses = (current.attr('class') ?? '').split(' ').filter(Boolean);
      const classSelector = currentClasses.length > 0 ? '.' + currentClasses[0] : '';
      path.unshift(tag + classSelector);
      current = current.parent();
    }

    return path.join(' > ');
  }

  /**
   * Clear all patterns
   */
  clear(): void {
    this.patterns.clear();
    this.patternsByType.clear();
  }
}
