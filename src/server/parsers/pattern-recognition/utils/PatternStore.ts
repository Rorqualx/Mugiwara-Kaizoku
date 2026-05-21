/**
 * Pattern Store
 *
 * Persistent storage for patterns and models.
 * Handles saving and loading of pattern definitions and ML model weights.
 */

import fs from 'fs/promises';
import path from 'path';

import { z } from 'zod';

import { logger } from '@/utils/logger';

import type { Pattern, PatternFeatures, PatternRecord } from '../types';

// Zod schema for validating pattern records
const PatternRecordSchema = z.object({
  id: z.string(),
  pattern: z.unknown(),
  features: z.unknown(),
  performance: z.object({
    totalUses: z.number(),
    successCount: z.number(),
    failureCount: z.number(),
    averageConfidence: z.number(),
    averageExtractionTime: z.number(),
    lastSuccess: z.date().or(z.string())
  }).passthrough(),
  created_at: z.date().or(z.string()),
  updated_at: z.date().or(z.string())
}).passthrough();

const PatternRecordsArraySchema = z.array(PatternRecordSchema);
const PatternsArraySchema = z.array(z.unknown()); // Patterns can have various structures
// Temporarily disabled due to TensorFlow dependency issues
// import { MLPipeline } from '../core/MLPipeline';

export class PatternStore {
  private storageDir: string;
  private patternsFile: string;
  private modelsDir: string;

  constructor(storageDir: string = './data/pattern-recognition') {
    this.storageDir = storageDir;
    this.patternsFile = path.join(storageDir, 'patterns.json');
    this.modelsDir = path.join(storageDir, 'models');
  }

  /**
   * Initialize storage directories
   */
  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.storageDir, { recursive: true });
    await fs.mkdir(this.modelsDir, { recursive: true });
  }

  /**
   * Load all patterns
   */
  async loadPatterns(): Promise<Pattern[]> {
    try {
      await this.ensureDirectories();

      const data = await fs.readFile(this.patternsFile, 'utf-8');
      const parsed: unknown = JSON.parse(data);
      const result = PatternRecordsArraySchema.safeParse(parsed);

      if (!result.success) {
        logger.error('[PatternStore] Invalid pattern records format:', result.error);
        return this.getDefaultPatterns();
      }

      const records = result.data;
      return records.map((record) => {
        const pattern = record.pattern as Pattern;
        return {
          ...pattern,
          created: new Date(record.created_at),
          lastUsed: new Date(record.updated_at)
        };
      });
    } catch (error: unknown) {
      // Check for file not found error
      const errorRecord = error as Record<string, unknown>;
      if (errorRecord['code'] === 'ENOENT') {
        // File doesn't exist, return default patterns
        return this.getDefaultPatterns();
      }
      throw error;
    }
  }

  /**
   * Save patterns
   */
  async savePatterns(patterns: Pattern[]): Promise<void> {
    await this.ensureDirectories();

    const records: PatternRecord[] = patterns.map((pattern) => {
      const record: PatternRecord = {
        id: pattern["id"],
        pattern,
        features: pattern.features,
        performance: {
          totalUses: pattern.usageCount,
          successCount: Math.floor(pattern.usageCount * pattern.successRate),
          failureCount: Math.floor(pattern.usageCount * (1 - pattern.successRate)),
          averageConfidence: pattern.confidence,
          averageExtractionTime: 50, // Default
          lastSuccess: pattern.lastUsed
        },
        created_at: pattern.created,
        updated_at: pattern.lastUsed
      };
      return record;
    });

    await fs.writeFile(this.patternsFile, JSON.stringify(records, null, 2));
  }

  /**
   * Save single pattern
   */
  async savePattern(pattern: Pattern): Promise<void> {
    const patterns = await this.loadPatterns();
    const index = patterns.findIndex((p) => p["id"] === pattern["id"]);

    if (index >= 0) {
      patterns[index] = pattern;
    } else {
      patterns.push(pattern);
    }

    await this.savePatterns(patterns);
  }

  /**
   * Delete pattern
   */
  async deletePattern(patternId: string): Promise<void> {
    const patterns = await this.loadPatterns();
    const filtered = patterns.filter((p) => p["id"] !== patternId);
    await this.savePatterns(filtered);
  }

  /**
   * Load ML models - Temporarily disabled due to TensorFlow dependency issues
   */
  loadModels(_pipeline: unknown): Promise<void> {
    // ML Pipeline disabled - model loading skipped
    logger.info('Model loading disabled - ML components not available');
    return Promise.resolve();
    
    // Original implementation:
    /*
    try {
      await this.ensureDirectories();

      // Load model metadata
      const metadataFile = path.join(this.modelsDir, 'metadata.json');
      const metadata = JSON.parse(await fs.readFile(metadataFile, 'utf-8'));

      // Load each model
      for (const modelInfo of metadata.models) {
        const modelPath = path.join(this.modelsDir, modelInfo["name"]);
        await pipeline.loadModel(modelPath);
      }
    } catch (error: unknown) {
      const errorRecord = error as Record<string, unknown>;
      if (errorRecord['code'] === 'ENOENT') {
        logger.info('No saved models found');
        return;
      }
      throw error;
    }
    */
  }

  /**
   * Save ML models - Temporarily disabled due to TensorFlow dependency issues
   */
  saveModels(_pipeline: unknown): Promise<void> {
    // ML Pipeline disabled - model saving skipped
    logger.info('Model saving disabled - ML components not available');
    return Promise.resolve();
    
    // Original implementation:
    /*
    await this.ensureDirectories();

    // Save model metadata
    const metadata = {
      models: [
      { name: 'classifier', type: 'classifier' },
      { name: 'similarity', type: 'similarity' },
      { name: 'anomaly', type: 'anomaly' }],

      savedAt: new Date().toISOString()
    };

    await fs.writeFile(
      path.join(this.modelsDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Note: Actual model saving would require access to the models
    // This is a placeholder - in production, you'd save the actual TensorFlow models
    logger.info('Model saving placeholder - implement actual TensorFlow model persistence');
    */
  }

  /**
   * Create empty pattern features
   */
  private createEmptyFeatures(): PatternFeatures {
    return {
      structural: {
        tagCounts: {},
        maxDepth: 0,
        averageDepth: 0,
        elementCount: 0
      },
      semantic: {
        keywordDensity: {},
        topicDistribution: {},
        sentimentScore: 0,
        readabilityScore: 0
      },
      statistical: {
        wordCount: 0,
        avgWordLength: 0,
        sentenceCount: 0,
        avgSentenceLength: 0,
        paragraphCount: 0
      },
      visual: {
        isVisible: true,
        isAboveFold: false
      },
      contextual: {
        nearbyText: []
      }
    };
  }

  /**
   * Get default patterns
   */
  private getDefaultPatterns(): Pattern[] {
    const now = new Date();

    const emptyFeatures = this.createEmptyFeatures();

    return [
    {
      id: 'default_volume_table',
      name: 'Volume Table',
      type: 'volume',
      features: emptyFeatures,
      selector: 'table:contains("Volume")',
      confidence: 0.8,
      accuracy: 0.8,
      usageCount: 0,
      successRate: 1,
      lastUsed: now,
      created: now,
      version: 1,
      source: 'manual',
      metadata: {}
    },
    {
      id: 'default_chapter_table',
      name: 'Chapter Table',
      type: 'chapter',
      features: emptyFeatures,
      selector: 'table:contains("Chapter")',
      confidence: 0.8,
      accuracy: 0.8,
      usageCount: 0,
      successRate: 1,
      lastUsed: now,
      created: now,
      version: 1,
      source: 'manual',
      metadata: {}
    },
    {
      id: 'default_infobox',
      name: 'Infobox',
      type: 'infobox',
      features: emptyFeatures,
      selector: '.infobox, .portable-infobox',
      confidence: 0.9,
      accuracy: 0.9,
      usageCount: 0,
      successRate: 1,
      lastUsed: now,
      created: now,
      version: 1,
      source: 'manual',
      metadata: {}
    },
    {
      id: 'default_cover_image',
      name: 'Cover Image',
      type: 'coverImage',
      features: emptyFeatures,
      selector: '.infobox img, .portable-infobox img',
      confidence: 0.85,
      accuracy: 0.85,
      usageCount: 0,
      successRate: 1,
      lastUsed: now,
      created: now,
      version: 1,
      source: 'manual',
      metadata: {}
    }];

  }

  /**
   * Export patterns to file
   */
  async exportPatterns(filePath: string): Promise<void> {
    const patterns = await this.loadPatterns();
    await fs.writeFile(filePath, JSON.stringify(patterns, null, 2));
  }

  /**
   * Import patterns from file
   */
  async importPatterns(filePath: string): Promise<void> {
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed: unknown = JSON.parse(data);
    const result = PatternsArraySchema.safeParse(parsed);

    if (!result.success) {
      logger.error('[PatternStore] Invalid patterns format in import file:', result.error);
      throw new Error('Invalid patterns format');
    }

    await this.savePatterns(result.data as Pattern[]);
  }

  /**
   * Get pattern statistics
   */
  async getStatistics(): Promise<{
    totalPatterns: number;
    byType: Record<string, number>;
    bySource: Record<string, number>;
    averageAccuracy: number;
    totalUsage: number;
  }> {
    const patterns = await this.loadPatterns();

    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let totalAccuracy = 0;
    let totalUsage = 0;

    for (const pattern of patterns) {
      // Count by type
      byType[pattern.type] = (byType[pattern.type] ?? 0) + 1;

      // Count by source
      bySource[pattern["source"]] = (bySource[pattern["source"]] ?? 0) + 1;

      // Sum accuracy and usage
      totalAccuracy += pattern.accuracy;
      totalUsage += pattern.usageCount;
    }

    return {
      totalPatterns: patterns.length,
      byType,
      bySource,
      averageAccuracy: patterns.length > 0 ? totalAccuracy / patterns.length : 0,
      totalUsage
    };
  }

  /**
   * Backup patterns
   */
  async backup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.storageDir, `backup-${timestamp}.json`);

    const patterns = await this.loadPatterns();
    await fs.writeFile(backupFile, JSON.stringify(patterns, null, 2));

    return backupFile;
  }

  /**
   * Restore from backup
   */
  async restore(backupFile: string): Promise<void> {
    const data = await fs.readFile(backupFile, 'utf-8');
    const parsed: unknown = JSON.parse(data);
    const result = PatternsArraySchema.safeParse(parsed);

    if (!result.success) {
      logger.error('[PatternStore] Invalid patterns format in backup file:', result.error);
      throw new Error('Invalid backup file format');
    }

    await this.savePatterns(result.data as Pattern[]);
  }

  /**
   * Clean old backups
   */
  async cleanOldBackups(daysToKeep: number = 30): Promise<void> {
    const files = await fs.readdir(this.storageDir);
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

    // Filter backup files first
    const backupFiles = files.filter(file => file.startsWith('backup-'));

    // Get stats for all backup files in parallel
    const fileStats = await Promise.all(
      backupFiles.map(async (file) => {
        const filePath = path.join(this.storageDir, file);
        const stats = await fs.stat(filePath);
        return { filePath, mtime: stats.mtime.getTime() };
      })
    );

    // Identify files to delete
    const filesToDelete = fileStats
      .filter(({ mtime }) => now - mtime > maxAge)
      .map(({ filePath }) => filePath);

    // Delete old files in parallel
    await Promise.all(filesToDelete.map(filePath => fs.unlink(filePath)));
  }
}