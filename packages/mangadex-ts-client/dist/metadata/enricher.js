"use strict";
/**
 * Multi-provider orchestration — one-click metadata retrieval
 * Fetches from all available providers in parallel with graceful degradation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataEnricher = void 0;
const merger_1 = require("./merger");
const DEFAULT_ENRICHER_CONFIG = {
    merger: {},
    knownIds: {},
    crossSearch: true,
    searchLimit: 5,
};
class MetadataEnricher {
    providers = new Map();
    merger;
    constructor(providers, mergerConfig) {
        for (const p of providers) {
            if (p.isAvailable()) {
                this.providers.set(p.source, p);
            }
        }
        this.merger = new merger_1.MetadataMerger(mergerConfig);
    }
    /**
     * ONE-CLICK: Enrich metadata from a single ID + title
     * Fetches from all providers in parallel, merges, and scores
     */
    async enrich(primarySource, primaryId, title, config) {
        const cfg = { ...DEFAULT_ENRICHER_CONFIG, ...config };
        const startTime = Date.now();
        const errors = [];
        const timing = {};
        // Step 1: Fetch primary source
        const results = [];
        const primaryProvider = this.providers.get(primarySource);
        if (primaryProvider) {
            const t0 = Date.now();
            try {
                const result = await primaryProvider.getMetadata(primaryId);
                results.push(result);
                timing[primarySource] = Date.now() - t0;
            }
            catch (err) {
                timing[primarySource] = Date.now() - t0;
                errors.push({
                    source: primarySource,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        // Determine the title for cross-searching
        const searchTitle = title || this.extractTitle(results);
        // Step 2: Fetch secondary sources in parallel
        const secondaryProviders = [...this.providers.entries()]
            .filter(([source]) => source !== primarySource);
        const secondaryPromises = secondaryProviders.map(async ([source, provider]) => {
            const t0 = Date.now();
            try {
                // Use known ID if provided
                const knownId = cfg.knownIds?.[source];
                if (knownId) {
                    const result = await provider.getMetadata(knownId);
                    timing[source] = Date.now() - t0;
                    return result;
                }
                // Cross-search by title
                if (cfg.crossSearch && searchTitle) {
                    const searchResults = await provider.search(searchTitle, cfg.searchLimit);
                    if (searchResults.length > 0) {
                        const bestMatch = this.findBestMatch(searchTitle, searchResults);
                        if (bestMatch) {
                            const result = await provider.getMetadata(bestMatch.id);
                            timing[source] = Date.now() - t0;
                            return result;
                        }
                    }
                }
                timing[source] = Date.now() - t0;
                return undefined;
            }
            catch (err) {
                timing[source] = Date.now() - t0;
                errors.push({
                    source,
                    error: err instanceof Error ? err.message : String(err),
                });
                return undefined;
            }
        });
        const secondaryResults = await Promise.all(secondaryPromises);
        for (const r of secondaryResults) {
            if (r)
                results.push(r);
        }
        // Step 3: Merge
        const manga = this.merger.merge(results);
        const completeness = this.merger.calculateCompleteness(manga);
        // Determine enrichment tier
        const tier = results.length >= 3 ? 'full' :
            results.length >= 2 ? 'standard' : 'basic';
        return {
            manga,
            completeness,
            tier,
            errors,
            timing: {
                totalMs: Date.now() - startTime,
                perSource: timing,
            },
        };
    }
    /**
     * ONE-CLICK by title only — searches all providers, auto-picks best match
     */
    async enrichByTitle(title, config) {
        const cfg = { ...DEFAULT_ENRICHER_CONFIG, ...config };
        const startTime = Date.now();
        const errors = [];
        const timing = {};
        const results = [];
        // Search all providers in parallel
        const searchPromises = [...this.providers.entries()].map(async ([source, provider]) => {
            const t0 = Date.now();
            try {
                const searchResults = await provider.search(title, cfg.searchLimit);
                if (searchResults.length === 0) {
                    timing[source] = Date.now() - t0;
                    return;
                }
                const bestMatch = this.findBestMatch(title, searchResults);
                if (!bestMatch) {
                    timing[source] = Date.now() - t0;
                    return;
                }
                const result = await provider.getMetadata(bestMatch.id);
                results.push(result);
                timing[source] = Date.now() - t0;
            }
            catch (err) {
                timing[source] = Date.now() - t0;
                const errMsg = err instanceof Error ? err.message : String(err);
                console.warn(`[MetadataEnricher] Provider ${source} failed for "${title}": ${errMsg}`);
                errors.push({
                    source,
                    error: errMsg,
                });
            }
        });
        await Promise.all(searchPromises);
        if (results.length === 0) {
            throw new Error(`No results found for "${title}" across any provider`);
        }
        const manga = this.merger.merge(results);
        const completeness = this.merger.calculateCompleteness(manga);
        const tier = results.length >= 3 ? 'full' :
            results.length >= 2 ? 'standard' : 'basic';
        return {
            manga,
            completeness,
            tier,
            errors,
            timing: {
                totalMs: Date.now() - startTime,
                perSource: timing,
            },
        };
    }
    /** Search across all providers */
    async searchAll(query, limit = 5) {
        const allResults = [];
        const promises = [...this.providers.values()].map(async (provider) => {
            try {
                const results = await provider.search(query, limit);
                allResults.push(...results);
            }
            catch {
                // Silently skip failed providers
            }
        });
        await Promise.all(promises);
        return allResults;
    }
    /** Get list of available providers */
    getAvailableProviders() {
        return [...this.providers.keys()];
    }
    // ==================== Private helpers ====================
    extractTitle(results) {
        for (const r of results) {
            const title = r.manga.title;
            if (title) {
                return title['en'] || title['ja-ro'] || title['ja'] || Object.values(title)[0];
            }
        }
        return undefined;
    }
    findBestMatch(query, results) {
        const normalizedQuery = query.toLowerCase().trim();
        // Exact title match
        const exact = results.find((r) => r.title.toLowerCase().trim() === normalizedQuery);
        if (exact)
            return exact;
        // Alt title match
        const altMatch = results.find((r) => r.altTitles?.some((alt) => alt.toLowerCase().trim() === normalizedQuery));
        if (altMatch)
            return altMatch;
        // Contains match
        const contains = results.find((r) => r.title.toLowerCase().includes(normalizedQuery) ||
            normalizedQuery.includes(r.title.toLowerCase()));
        if (contains)
            return contains;
        // Default to first result
        return results[0];
    }
}
exports.MetadataEnricher = MetadataEnricher;
//# sourceMappingURL=enricher.js.map