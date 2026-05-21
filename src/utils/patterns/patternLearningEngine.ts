import { getErrorMessage } from '@/utils/errors/helpers';
import { logger } from '@/utils/logger';

/**
 * Pattern Learning Engine
 *
 * Learns from user metadata selections to improve future extractions
 * Tracks which extraction patterns work best for different providers
 */
// Define types locally since they don't exist in search.types
interface PatternFeedback {
    field: string;
    selector: string;
    provider: string;
    wasCorrect: boolean;
    extractedValue?: unknown;
    correctValue?: unknown;
    selectedPatterns?: Array<{
        field: string;
        pattern?: string;
        selector?: string;
        value?: unknown;
        wasCorrect?: boolean;
    }>;
    timestamp?: Date;
    url?: string;
}
interface PatternLearningConfig {
    enabled?: boolean;
    minConfidenceThreshold?: number;
    maxPatternsPerField?: number;
    learningRate?: number;
}
interface ExtractionStrategy {
    provider: string;
    patterns: Record<string, string[]>;
    confidence: number;
    strategies?: Record<string, unknown>;
}
interface PatternStats {
    selector: string;
    field: string;
    provider: string;
    successCount: number;
    failureCount: number;
    lastUsed: Date;
    confidence: number;
    examples: Array<{
        value: unknown;
        wasCorrect: boolean;
        timestamp: Date;
    }>;
}
interface LearningDatabase {
    patterns: Map<string, PatternStats>;
    providerStrategies: Map<string, ExtractionStrategy>;
    userPreferences: Map<string, unknown>;
}

interface StoredLearningData {
    patterns?: PatternStats[];
    strategies?: ExtractionStrategy[];
    preferences?: Record<string, unknown>;
}

function isStoredLearningData(data: unknown): data is StoredLearningData {
    return (
        typeof data === 'object' &&
        data !== null &&
        (!('patterns' in data) || Array.isArray((data as StoredLearningData).patterns)) &&
        (!('strategies' in data) || Array.isArray((data as StoredLearningData).strategies)) &&
        (!('preferences' in data) || typeof (data as StoredLearningData).preferences === 'object')
    );
}
export class PatternLearningEngine {
    private db: LearningDatabase;
    private config: PatternLearningConfig;
    constructor(config?: Partial<PatternLearningConfig>) {
        this.config = {
            enabled: true,
            minConfidenceThreshold: 0.6,
            maxPatternsPerField: 5,
            learningRate: 0.1,
            ...config
        };
        this.db = {
            patterns: new Map(),
            providerStrategies: new Map(),
            userPreferences: new Map()
        };
        this.loadFromStorage();
    }
    /**
     * Process user feedback on metadata selection
     */
    processFeedback(feedback: PatternFeedback): void {
        if (!this.config.enabled)
            return;
        const patterns = feedback.selectedPatterns ?? [feedback];
        patterns.forEach((pattern) => {
            const field = 'field' in pattern ? pattern.field : feedback.field;
            const patternStr = 'pattern' in pattern ? pattern.pattern : undefined;
            const selector = 'selector' in pattern ? pattern.selector : feedback.selector;
            const value = 'value' in pattern ? pattern.value : undefined;
            const wasCorrect = 'wasCorrect' in pattern ? pattern.wasCorrect : feedback.wasCorrect;

            const selectorValue = patternStr ?? selector;
            const key = this.getPatternKey(feedback.provider, field, selectorValue);
            const stats = this.db.patterns.get(key) ?? this.createNewPattern(
                feedback.provider,
                field,
                selectorValue
            );
            // Update statistics
            if (wasCorrect) {
                stats.successCount++;
                stats.confidence = this.updateConfidence(stats.confidence, true);
            }
            else {
                stats.failureCount++;
                stats.confidence = this.updateConfidence(stats.confidence, false);
            }
            stats.lastUsed = new Date();
            // Store example
            stats.examples.push({
                value: value,
                wasCorrect: wasCorrect === true,
                timestamp: feedback.timestamp ?? new Date()
            });
            // Keep only recent examples
            if (stats.examples.length > 10) {
                stats.examples = stats.examples.slice(-10);
            }
            this.db.patterns.set(key, stats);
        });
        // Update provider strategies
        this.updateProviderStrategy(feedback.provider);
        // Save to storage
        this.saveToStorage();
    }
    /**
     * Get recommended extraction patterns for a provider and field
     */
    getRecommendedPatterns(provider: string, field: string): Array<{
        pattern: string;
        confidence: number;
        successRate: number;
    }> {
        const patterns: Array<{ pattern: string; confidence: number; successRate: number; }> = [];
        // Find all patterns for this provider and field
        this.db.patterns.forEach((stats, _key) => {
            if (stats.provider === provider && stats.field === field) {
                const successRate = stats.successCount / (stats.successCount + stats.failureCount);
                if (stats.confidence >= (this.config.minConfidenceThreshold ?? 0.5)) {
                    patterns.push({
                        pattern: stats.selector,
                        confidence: stats.confidence,
                        successRate
                    });
                }
            }
        });
        // Sort by confidence and limit
        return patterns
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, this.config.maxPatternsPerField);
    }
    /**
     * Get extraction strategy for a provider
     */
    getProviderStrategy(provider: string): ExtractionStrategy | undefined {
        return this.db.providerStrategies.get(provider);
    }
    /**
     * Learn from successful extractions
     */
    learnFromSuccess(provider: string, field: string, selector: string, value: unknown): void {
        const feedback: PatternFeedback = {
            provider,
            field,
            selector,
            wasCorrect: true,
            extractedValue: value,
            selectedPatterns: [{
                    field,
                    pattern: selector,
                    selector,
                    value,
                    wasCorrect: true
                }],
            timestamp: new Date()
        };
        this.processFeedback(feedback);
    }
    /**
     * Learn from failed extractions
     */
    learnFromFailure(provider: string, field: string, selector: string, value: unknown): void {
        const feedback: PatternFeedback = {
            provider,
            field,
            selector,
            wasCorrect: false,
            extractedValue: value,
            selectedPatterns: [{
                    field,
                    pattern: selector,
                    selector,
                    value,
                    wasCorrect: false
                }],
            timestamp: new Date()
        };
        this.processFeedback(feedback);
    }
    /**
     * Get confidence score for a specific pattern
     */
    getPatternConfidence(provider: string, field: string, pattern: string): number {
        const key = this.getPatternKey(provider, field, pattern);
        const stats = this.db.patterns.get(key);
        return stats?.confidence ?? 0.5;
    }
    /**
     * Predict best extraction method for a field
     */
    predictBestMethod(provider: string, field: string, availableMethods: Array<{
        type: string;
        selector: string;
    }>): {
        method: unknown;
        confidence: number;
    } | null {
        let bestMethod: { type: string; selector: string } | null = null;
        let bestConfidence = 0;
        for (const method of availableMethods) {
            const confidence = this.getPatternConfidence(provider, field, method.selector);
            if (confidence > bestConfidence) {
                bestConfidence = confidence;
                bestMethod = method;
            }
        }
        return bestMethod !== null ? { method: bestMethod, confidence: bestConfidence } : null;
    }
    /**
     * Get user preferences for metadata selection
     */
    getUserPreferences(): Record<string, unknown> {
        const prefs: Record<string, unknown> = {};
        // Analyze patterns to determine preferences
        const providerCounts: Record<string, number> = {};
        const fieldSourcePrefs: Record<string, Record<string, number>> = {};
        this.db.patterns.forEach(stats => {
            // Count successful uses per provider
            if (stats.successCount > 0) {
                providerCounts[stats.provider] = (providerCounts[stats.provider] ?? 0) + stats.successCount;
                // Track field-source preferences
                fieldSourcePrefs[stats.field] ??= {};
                const fieldPref = fieldSourcePrefs[stats.field];
                if (fieldPref) {
                    fieldPref[stats.provider] = (fieldPref[stats.provider] ?? 0) + stats.successCount;
                }
            }
        });
        // Determine preferred providers
        prefs["preferredProviders"] = Object.entries(providerCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([provider]) => provider);
        // Determine preferred source per field
        const fieldPreferences: Record<string, string> = {};
        Object.entries(fieldSourcePrefs).forEach(([field, sources]) => {
            const preferred = Object.entries(sources)
                .sort(([, a], [, b]) => b - a)[0];
            if (preferred) {
                fieldPreferences[field] = preferred[0];
            }
        });
        prefs["fieldPreferences"] = fieldPreferences;
        return prefs;
    }
    /**
     * Export learning data for analysis
     */
    exportLearningData(): {
        patterns: Array<PatternStats>;
        strategies: Array<ExtractionStrategy>;
        summary: {
            totalPatterns: number;
            successRate: number;
            topProviders: Array<{
                provider: string;
                confidence: number;
            }>;
            topFields: Array<{
                field: string;
                successRate: number;
            }>;
        };
    } {
        const patterns = Array.from(this.db.patterns.values());
        const strategies = Array.from(this.db.providerStrategies.values());
        // Calculate summary statistics
        let totalSuccess = 0;
        let totalFailure = 0;
        const providerStats: Record<string, {
            success: number;
            total: number;
        }> = {};
        const fieldStats: Record<string, {
            success: number;
            total: number;
        }> = {};
        patterns.forEach(pattern => {
            totalSuccess += pattern.successCount;
            totalFailure += pattern.failureCount;
            // Provider stats
            providerStats[pattern.provider] ??= { success: 0, total: 0 };
            const providerStat = providerStats[pattern.provider];
            if (providerStat) {
                providerStat.success += pattern.successCount;
                providerStat.total += pattern.successCount + pattern.failureCount;
            }
            // Field stats
            fieldStats[pattern.field] ??= { success: 0, total: 0 };
            const fieldStat = fieldStats[pattern.field];
            if (fieldStat) {
                fieldStat.success += pattern.successCount;
                fieldStat.total += pattern.successCount + pattern.failureCount;
            }
        });
        return {
            patterns,
            strategies,
            summary: {
                totalPatterns: patterns.length,
                successRate: totalSuccess / (totalSuccess + totalFailure),
                topProviders: Object.entries(providerStats)
                    .map(([provider, stats]) => ({
                    provider,
                    confidence: stats.success / stats.total
                }))
                    .sort((a, b) => b.confidence - a.confidence)
                    .slice(0, 5),
                topFields: Object.entries(fieldStats)
                    .map(([field, stats]) => ({
                    field,
                    successRate: stats.success / stats.total
                }))
                    .sort((a, b) => b.successRate - a.successRate)
                    .slice(0, 10)
            }
        };
    }
    /**
     * Private helper methods
     */
    private getPatternKey(provider: string, field: string, pattern: string): string {
        return `${provider}:${field}:${pattern}`;
    }
    private createNewPattern(provider: string, field: string, selector: string): PatternStats {
        return {
            selector,
            field,
            provider,
            successCount: 0,
            failureCount: 0,
            lastUsed: new Date(),
            confidence: 0.5,
            examples: []
        };
    }
    private updateConfidence(current: number, success: boolean): number {
        const learningRate = this.config.learningRate ?? 0.1;
        const delta = success ? learningRate : -learningRate;
        const newConfidence = current + delta * (1 - current);
        return Math.max(0, Math.min(1, newConfidence));
    }
    private updateProviderStrategy(provider: string): void {
        const strategy: ExtractionStrategy = {
            provider,
            patterns: {},
            confidence: 0.5,
            strategies: {}
        };
        // Group patterns by field
        const fieldPatterns: Record<string, Array<PatternStats>> = {};
        this.db.patterns.forEach(stats => {
            if (stats.provider === provider) {
                fieldPatterns[stats.field] ??= [];
                const patterns = fieldPatterns[stats.field];
                if (patterns) {
                    patterns.push(stats);
                }
            }
        });
        // Build strategies for each field
        Object.entries(fieldPatterns).forEach(([field, patterns]) => {
            const methods = patterns
                .filter(p => p.confidence >= (this.config.minConfidenceThreshold ?? 0.5))
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, this.config.maxPatternsPerField ?? 5)
                .map((p, index) => ({
                type: 'selector' as const,
                pattern: p.selector,
                priority: index + 1,
                confidence: p.confidence
            }));
            if (methods.length > 0) {
                const strategies = strategy.strategies;
                if (strategies) {
                    strategies[field] = methods;
                }
            }
        });
        this.db.providerStrategies.set(provider, strategy);
    }
    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem('patternLearningData');
            if (stored) {
                const parsed: unknown = JSON.parse(stored);

                if (!isStoredLearningData(parsed)) {
                    logger.warn('Invalid pattern learning data format in storage');
                    return;
                }

                const data = parsed;

                // Restore patterns
                if (data.patterns) {
                    data.patterns.forEach((pattern: PatternStats) => {
                        const key = this.getPatternKey(pattern.provider, pattern.field, pattern.selector);
                        this.db.patterns.set(key, {
                            ...pattern,
                            lastUsed: new Date(pattern.lastUsed)
                        });
                    });
                }

                // Restore strategies
                if (data.strategies) {
                    data.strategies.forEach((strategy: ExtractionStrategy) => {
                        this.db.providerStrategies.set(strategy.provider, strategy);
                    });
                }

                // Restore preferences
                if (data.preferences) {
                    Object.entries(data.preferences).forEach(([key, value]) => {
                        this.db.userPreferences.set(key, value);
                    });
                }
            }
        }
        catch (error: unknown) {
            const errorMessage = getErrorMessage(error);
            logger.error('Failed to load pattern learning data:', errorMessage);
        }
    }
    private saveToStorage(): void {
        try {
            const data = {
                patterns: Array.from(this.db.patterns.values()),
                strategies: Array.from(this.db.providerStrategies.values()),
                preferences: Object.fromEntries(this.db.userPreferences)
            };
            localStorage.setItem('patternLearningData', JSON.stringify(data));
        }
        catch (error: unknown) {
            const errorMessage = getErrorMessage(error);
            logger.error('Failed to save pattern learning data:', errorMessage);
        }
    }
}
// Singleton instance
export const patternLearningEngine = new PatternLearningEngine();
