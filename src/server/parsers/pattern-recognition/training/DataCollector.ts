/**
 * Training Data Collector
 *
 * Collects and prepares training data from existing manga/wiki sources
 * for initial model training and continuous improvement.
 */
import fs from 'fs/promises';
import path from 'path';

import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

import { FeatureEngineering } from '../core/FeatureEngineering';

import type { PatternType, PatternFeatures, LearningExample } from '../types';
import type { Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';
export interface TrainingDataSource {
  url: string;
  html: string;
  type: 'fandom' | 'wikipedia' | 'other';
  labels?: Record<string, unknown>;
}
export interface LabeledElement {
  html: string;
  selector: string;
  type: PatternType;
  features: PatternFeatures;
  metadata: Record<string, unknown>;
}
export class DataCollector {
  private featureEngineering: FeatureEngineering;
  private dataDir: string;
  private sources: TrainingDataSource[] = [];
  private labeledData: LabeledElement[] = [];
  constructor(dataDir: string = './data/training') {
    this.featureEngineering = new FeatureEngineering();
    this.dataDir = dataDir;
  }
  /**
   * Initialize collector
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(path.join(this.dataDir, 'raw'), { recursive: true });
    await fs.mkdir(path.join(this.dataDir, 'labeled'), { recursive: true });
    await fs.mkdir(path.join(this.dataDir, 'features'), { recursive: true });
  }
  /**
   * Collect data from a source
   */
  async collectFromSource(source: TrainingDataSource): Promise<void> {
    this.sources.push(source);
    // Save raw HTML
    const timestamp = Date.now();
    const filename = `${source.type}_${timestamp}.html`;
    await fs.writeFile(
      path.join(this.dataDir, 'raw', filename),
      source.html
    );
    // Extract and label elements
    const labeled = await this.extractLabeledElements(source);
    this.labeledData.push(...labeled);
    logger.info(`Collected ${labeled.length} labeled elements from ${source.url}`);
  }
  /**
   * Extract labeled elements from source
   */
  private extractLabeledElements(source: TrainingDataSource): Promise<LabeledElement[]> {
    const $ = cheerio.load(source.html);
    const labeled: LabeledElement[] = [];
    // Define extraction rules based on source type
    const rules = this.getExtractionRules(source.type);
    for (const rule of rules) {
      $(rule.selector).each((_, element) => {
        const $el = $(element) as Cheerio<AnyNode>;
        const html = $el.html() ?? '';
        // Skip empty elements
        if (!html.trim()) return;
        // Extract features
        const features = this.featureEngineering.extractFeatures(element, $);
        // Validate element matches expected type
        if (this.validateElement($el, rule.type)) {
          labeled.push({
            html,
            selector: rule.selector,
            type: rule.type,
            features,
            metadata: {
              sourceUrl: source.url,
              sourceType: source.type,
              extracted: this.extractMetadata($el, rule.type)
            }
          });
        }
      });
    }
    return Promise.resolve(labeled);
  }
  /**
   * Get extraction rules for source type
   */
  private getExtractionRules(sourceType: string): Array<{selector: string;type: PatternType;}> {
    const commonRules = [
    { selector: 'h1', type: 'title' as PatternType },
    { selector: '.infobox, .portable-infobox', type: 'infobox' as PatternType },
    { selector: 'table', type: 'table' as PatternType }];
    switch (sourceType) {
      case 'fandom':
        return [
        ...commonRules,
        { selector: '.portable-infobox .pi-image img', type: 'coverImage' as PatternType },
        { selector: 'tr:contains("Volume")', type: 'volume' as PatternType },
        { selector: 'tr:contains("Chapter")', type: 'chapter' as PatternType },
        { selector: '.wikia-gallery', type: 'gallery' as PatternType }];
      case 'wikipedia':
        return [
        ...commonRules,
        { selector: '.infobox .image img', type: 'coverImage' as PatternType },
        { selector: '.wikitable tr:contains("Volume")', type: 'volume' as PatternType },
        { selector: '.wikitable tr:contains("Chapter")', type: 'chapter' as PatternType }];
      default:
        return commonRules;
    }
  }
  /**
   * Validate element matches expected type
   */
  private validateElement($el: Cheerio<AnyNode>, type: PatternType): boolean {
    const text = $el.text().toLowerCase();
    switch (type) {
      case 'volume':
        return /volume|vol\.?\s*\d+/i.test(text);
      case 'chapter':
        return /chapter|ch\.?\s*\d+/i.test(text);
      case 'title':
        return $el.is('h1, h2') && text.length > 0;
      case 'coverImage':
        return $el.is('img') || $el.find('img').length > 0;
      case 'infobox':
        return $el.find('.pi-item, tr').length > 3;
      case 'table':
        return $el.find('tr').length > 2;
      default:
        return true;
    }
  }
  /**
   * Extract metadata based on element type
   */
  private extractMetadata($el: Cheerio<AnyNode>, type: PatternType): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    switch (type) {
      case 'volume': {
        const volumeMatch = $el.text().match(/volume\s*(\d+)/i);
        if (volumeMatch?.[1]) {
          metadata["volumeNumber"] = parseInt(volumeMatch[1], 10);
        }
        metadata["title"] = $el.find('.title, td:nth-child(2)').text().trim();
        break;
      }
      case 'chapter': {
        const chapterMatch = $el.text().match(/chapter\s*([\d.]+)/i);
        if (chapterMatch?.[1]) {
          metadata["chapterNumber"] = chapterMatch[1];
        }
        metadata["title"] = $el.find('.title, td:nth-child(2)').text().trim();
        break;
      }
      case 'infobox': {
        $el.find('.pi-item, tr').each((_: number, item: AnyNode) => {
          const $item = cheerio.load(item as unknown as string);
          const label = $item('.pi-data-label, th').text().trim();
          const value = $item('.pi-data-value, td').text().trim();
          if (label && value) {
            metadata[label.toLowerCase().replace(/\s+/g, '_')] = value;
          }
        });
        break;
      }
      case 'coverImage': {
        metadata["src"] = $el.attr('src') ?? $el.find('img').attr('src');
        metadata["alt"] = $el.attr('alt') ?? $el.find('img').attr('alt');
        break;
      }
      default: {
        // No specific metadata extraction for other types
        break;
      }
    }
    return metadata;
  }
  /**
   * Generate training examples from labeled data
   */
  async generateTrainingExamples(): Promise<LearningExample[]> {
    const examples: LearningExample[] = [];
    for (const labeled of this.labeledData) {
      const example: LearningExample = {
        id: `train_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        html: labeled.html,
        features: labeled.features,
        label: labeled.type,
        correct: true,
        timestamp: new Date()
      };
      examples.push(example);
    }
    // Save training examples
    await this.saveTrainingExamples(examples);
    return examples;
  }
  /**
   * Save training examples to disk
   */
  private async saveTrainingExamples(examples: LearningExample[]): Promise<void> {
    const filename = `training_examples_${Date.now()}.json`;
    await fs.writeFile(
      path.join(this.dataDir, 'labeled', filename),
      JSON.stringify(examples, null, 2)
    );
    // Also save features separately for faster loading
    const features = examples.map((e) => ({
      id: e["id"],
      features: e.features,
      label: e.label
    }));
    await fs.writeFile(
      path.join(this.dataDir, 'features', filename),
      JSON.stringify(features, null, 2)
    );
  }
  /**
   * Load existing training examples
   */
  async loadTrainingExamples(): Promise<LearningExample[]> {
    const examples: LearningExample[] = [];
    try {
      const files = await fs.readdir(path.join(this.dataDir, 'labeled'));
      const filePromises = files
        .filter((file) => file.endsWith('.json'))
        .map(async (file) => {
          const data = await fs.readFile(
            path.join(this.dataDir, 'labeled', file),
            'utf-8'
          );
          const parsed: unknown = JSON.parse(data);
          // Validate that parsed data is an array
          if (Array.isArray(parsed)) {
            return parsed as LearningExample[];
          }
          logger.warn(`Invalid training data format in ${file}`, { file });
          return [];
        });

      const results = await Promise.all(filePromises);
      for (const fileExamples of results) {
        examples.push(...fileExamples);
      }
    } catch (error: unknown) {
      logger.error('Error loading training examples', { error });
    }
    return examples;
  }
  /**
   * Augment training data
   */
  augmentTrainingData(examples: LearningExample[]): LearningExample[] {
    const augmented: LearningExample[] = [...examples];
    // Count examples per type
    const typeCounts = new Map<string, number>();
    for (const example of examples) {
      typeCounts.set(example.label, (typeCounts.get(example.label) ?? 0) + 1);
    }
    // Find minority classes
    const avgCount = Array.from(typeCounts.values()).reduce((a, b) => a + b, 0) / typeCounts.size;
    for (const [type, count] of typeCounts) {
      if (count < avgCount * 0.5) {
        // Augment minority class
        const typeExamples = examples.filter((e) => e.label === type);
        const needed = Math.floor(avgCount - count);
        for (let i = 0; i < needed; i++) {
          const original = typeExamples[i % typeExamples.length];
          if (original) {
            const augmentedExample = this.createAugmentedExample(original, i);
            augmented.push(augmentedExample);
          }
        }
      }
    }
    return augmented;
  }
  /**
   * Create augmented training example
   */
  private createAugmentedExample(original: LearningExample, index: number): LearningExample {
    return {
      ...original,
      id: `${original["id"]}_aug_${index}`,
      features: {
        ...original.features,
        structural: {
          ...original.features.structural,
          domDepth: (original.features.structural.domDepth ?? 0) + (index % 3 - 1),
          siblingCount: Math.max(0, (original.features.structural.siblingCount ?? 0) + (index % 3 - 1))
        },
        statistical: {
          ...original.features.statistical,
          entropy: (original.features.statistical.entropy ?? 0) * (0.9 + Math.random() * 0.2),
          patternScore: Math.min(1, (original.features.statistical.patternScore ?? 0) * (0.9 + Math.random() * 0.2))
        }
      }
    };
  }
  /**
   * Split data into train/validation/test sets
   */
  splitDataset(
  examples: LearningExample[],
  trainRatio: number = 0.7,
  valRatio: number = 0.15)
  : {
    train: LearningExample[];
    validation: LearningExample[];
    test: LearningExample[];
  } {
    // Shuffle examples
    const shuffled = [...examples].sort(() => Math.random() - 0.5);
    const trainSize = Math.floor(shuffled.length * trainRatio);
    const valSize = Math.floor(shuffled.length * valRatio);
    return {
      train: shuffled.slice(0, trainSize),
      validation: shuffled.slice(trainSize, trainSize + valSize),
      test: shuffled.slice(trainSize + valSize)
    };
  }
  /**
   * Get statistics about collected data
   */
  getStatistics(): {
    totalSources: number;
    totalElements: number;
    byType: Record<string, number>;
    bySource: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const element of this.labeledData) {
      byType[element.type] = (byType[element.type] ?? 0) + 1;
      const sourceType = element['metadata']['sourceType'];
      if (typeof sourceType === 'string') {
        bySource[sourceType] = (bySource[sourceType] ?? 0) + 1;
      }
    }
    return {
      totalSources: this.sources.length,
      totalElements: this.labeledData.length,
      byType,
      bySource
    };
  }
  /**
   * Export collected data
   */
  async exportData(outputPath: string): Promise<void> {
    const data = {
      sources: this.sources.map((s) => ({
        url: s.url,
        type: s.type
      })),
      labeledData: this.labeledData,
      statistics: this.getStatistics(),
      exportedAt: new Date().toISOString()
    };
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
  }
  /**
   * Import previously collected data
   */
  async importData(inputPath: string): Promise<void> {
    const fileContent = await fs.readFile(inputPath, 'utf-8');
    const parsed: unknown = JSON.parse(fileContent);

    // Validate parsed data structure
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'sources' in parsed &&
      'labeledData' in parsed
    ) {
      const data = parsed as {
        sources?: TrainingDataSource[];
        labeledData?: LabeledElement[];
      };
      this.sources = Array.isArray(data.sources) ? data.sources : [];
      this.labeledData = Array.isArray(data.labeledData) ? data.labeledData : [];
    } else {
      logger.warn('Invalid import data format', { inputPath });
      this.sources = [];
      this.labeledData = [];
    }
  }
}