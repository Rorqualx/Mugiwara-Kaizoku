"use strict";
/**
 * Priority-based metadata merger
 * Merges data from MangaDex + AniList + ComicVine into UnifiedManga
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataMerger = void 0;
const utils_1 = require("../core/utils");
const DEFAULT_CONFIG = {
    defaultPriority: ['mangadex', 'anilist', 'comicvine'],
    preferLongerText: true,
};
/** Source-specific priority rules (from plan) */
const CATEGORY_PRIORITY = {
    title: ['mangadex', 'anilist', 'comicvine'],
    altTitles: ['mangadex', 'anilist', 'comicvine'],
    description: ['anilist', 'comicvine', 'mangadex'],
    bannerImage: ['anilist'],
    covers: ['mangadex', 'comicvine', 'anilist'],
    genres: ['mangadex', 'anilist', 'comicvine'],
    themes: ['mangadex', 'anilist', 'comicvine'],
    tags: ['mangadex', 'anilist', 'comicvine'],
    creators: ['mangadex', 'anilist', 'comicvine'],
    characters: ['anilist', 'comicvine'],
    publisher: ['comicvine'],
    status: ['mangadex', 'anilist', 'comicvine'],
    startDate: ['anilist', 'mangadex', 'comicvine'],
    endDate: ['anilist'],
    score: ['anilist', 'mangadex'],
    format: ['anilist'],
    countryOfOrigin: ['anilist', 'mangadex'],
    volumes: ['comicvine', 'mangadex'],
    storyArcs: ['comicvine'],
    relations: ['anilist'],
    recommendations: ['anilist'],
    chapters: ['mangadex', 'comicvine'],
    externalLinks: ['mangadex', 'anilist', 'comicvine'],
};
class MetadataMerger {
    config;
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /** Merge multiple provider results into a single UnifiedManga */
    merge(results) {
        if (results.length === 0) {
            throw new Error('No provider results to merge');
        }
        // Sort results by priority
        const sorted = this.sortByPriority(results, this.config.defaultPriority);
        const sources = sorted.map((r) => r.source);
        // Build merged manga
        const merged = {
            ids: this.mergeIds(sorted),
            title: this.mergeLocalizedStrings(sorted, 'title'),
            altTitles: this.mergeStringArrays(sorted, 'altTitles'),
            description: this.mergeDescriptions(sorted),
            covers: this.mergeCovers(sorted),
            bannerImage: this.getByPriority(sorted, 'bannerImage', CATEGORY_PRIORITY['bannerImage']),
            genres: this.mergeStringArrays(sorted, 'genres'),
            themes: this.mergeStringArrays(sorted, 'themes'),
            tags: this.mergeStringArrays(sorted, 'tags'),
            contentRating: this.getByPriority(sorted, 'contentRating'),
            demographic: this.getByPriority(sorted, 'demographic'),
            format: this.getByPriority(sorted, 'format', CATEGORY_PRIORITY['format']),
            status: this.getByPriority(sorted, 'status', CATEGORY_PRIORITY['status']),
            startDate: this.getByPriority(sorted, 'startDate', CATEGORY_PRIORITY['startDate']),
            endDate: this.getByPriority(sorted, 'endDate', CATEGORY_PRIORITY['endDate']),
            year: this.getByPriority(sorted, 'year'),
            totalChapters: this.getByPriority(sorted, 'totalChapters'),
            totalVolumes: this.getByPriority(sorted, 'totalVolumes'),
            creators: this.mergeCreators(sorted),
            characters: this.mergeCharacters(sorted),
            publisher: this.getByPriority(sorted, 'publisher', CATEGORY_PRIORITY['publisher']),
            originalLanguage: this.getByPriority(sorted, 'originalLanguage'),
            countryOfOrigin: this.getByPriority(sorted, 'countryOfOrigin', CATEGORY_PRIORITY['countryOfOrigin']),
            availableLanguages: this.mergeStringArrays(sorted, 'availableLanguages'),
            score: this.mergeScores(sorted),
            relations: this.mergeRelations(sorted),
            recommendations: this.mergeRecommendations(sorted),
            storyArcs: this.mergeStoryArcs(sorted),
            externalLinks: this.mergeExternalLinks(sorted),
            volumes: this.mergeVolumes(sorted),
            chapters: this.mergeChapters(sorted),
            sources,
            lastUpdated: new Date().toISOString(),
        };
        return merged;
    }
    /** Calculate completeness score for merged manga */
    calculateCompleteness(manga) {
        const fieldChecks = {
            title: Object.keys(manga.title).length > 0,
            altTitles: manga.altTitles.length > 0,
            description: Object.keys(manga.description).length > 0,
            covers: !!manga.covers.large || !!manga.covers.original,
            bannerImage: !!manga.bannerImage,
            genres: manga.genres.length > 0,
            themes: manga.themes.length > 0,
            tags: manga.tags.length > 0,
            contentRating: !!manga.contentRating,
            format: !!manga.format,
            status: !!manga.status,
            startDate: !!manga.startDate,
            endDate: !!manga.endDate,
            year: !!manga.year,
            totalChapters: manga.totalChapters != null,
            totalVolumes: manga.totalVolumes != null,
            creators: manga.creators.length > 0,
            characters: manga.characters.length > 0,
            publisher: !!manga.publisher,
            originalLanguage: !!manga.originalLanguage,
            countryOfOrigin: !!manga.countryOfOrigin,
            score: !!manga.score?.averageScore,
            relations: manga.relations.length > 0,
            recommendations: manga.recommendations.length > 0,
            storyArcs: manga.storyArcs.length > 0,
            externalLinks: Object.values(manga.externalLinks).some((v) => !!v),
            volumes: manga.volumes.length > 0,
            chapters: manga.chapters.length > 0,
        };
        const totalFields = Object.keys(fieldChecks).length;
        const filledFields = Object.values(fieldChecks).filter(Boolean).length;
        const missingFields = Object.entries(fieldChecks)
            .filter(([, v]) => !v)
            .map(([k]) => k);
        // Source coverage
        const sourceCoverage = {};
        for (const source of manga.sources) {
            const sourceFields = Object.values(fieldChecks).filter(Boolean).length;
            sourceCoverage[source] = Math.round((sourceFields / totalFields) * 100);
        }
        return {
            overall: Math.round((filledFields / totalFields) * 100),
            fields: fieldChecks,
            missingFields,
            sourceCoverage,
        };
    }
    // ==================== Private merge methods ====================
    sortByPriority(results, priority) {
        return [...results].sort((a, b) => {
            const aIdx = priority.indexOf(a.source);
            const bIdx = priority.indexOf(b.source);
            return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
        });
    }
    mergeIds(results) {
        const ids = {};
        for (const r of results) {
            if (r.manga.ids) {
                for (const [source, id] of Object.entries(r.manga.ids)) {
                    if (id)
                        ids[source] = id;
                }
            }
        }
        return ids;
    }
    getByPriority(results, field, priority) {
        const ordered = priority
            ? this.sortByPriority(results, priority)
            : results;
        for (const r of ordered) {
            const val = r.manga[field];
            if (val !== undefined && val !== null && val !== '') {
                return val;
            }
        }
        return undefined;
    }
    mergeLocalizedStrings(results, field) {
        const merged = {};
        // Reverse order so higher-priority overwrites
        const ordered = this.sortByPriority(results, CATEGORY_PRIORITY[field] || this.config.defaultPriority);
        for (const r of [...ordered].reverse()) {
            const val = r.manga[field];
            if (val && typeof val === 'object') {
                for (const [lang, text] of Object.entries(val)) {
                    if (text)
                        merged[lang] = text;
                }
            }
        }
        return merged;
    }
    mergeDescriptions(results) {
        const merged = {};
        const ordered = this.sortByPriority(results, CATEGORY_PRIORITY['description']);
        for (const r of [...ordered].reverse()) {
            const desc = r.manga.description;
            if (desc && typeof desc === 'object') {
                for (const [lang, text] of Object.entries(desc)) {
                    if (!text)
                        continue;
                    if (this.config.preferLongerText) {
                        merged[lang] = (0, utils_1.preferLonger)(merged[lang], text) || text;
                    }
                    else {
                        merged[lang] = text;
                    }
                }
            }
        }
        return merged;
    }
    mergeCovers(results) {
        const ordered = this.sortByPriority(results, CATEGORY_PRIORITY['covers']);
        const merged = {};
        for (const r of ordered) {
            const c = r.manga.covers;
            if (!c)
                continue;
            if (!merged.original && c.original)
                merged.original = c.original;
            if (!merged.large && c.large)
                merged.large = c.large;
            if (!merged.medium && c.medium)
                merged.medium = c.medium;
            if (!merged.small && c.small)
                merged.small = c.small;
            if (!merged.color && c.color)
                merged.color = c.color;
        }
        return merged;
    }
    mergeStringArrays(results, field) {
        const all = [];
        for (const r of results) {
            const val = r.manga[field];
            if (Array.isArray(val)) {
                all.push(...val);
            }
        }
        return (0, utils_1.deduplicateStrings)(all);
    }
    mergeCreators(results) {
        const ordered = this.sortByPriority(results, CATEGORY_PRIORITY['creators']);
        let merged = [];
        for (const r of ordered) {
            if (r.manga.creators && r.manga.creators.length > 0) {
                merged = (0, utils_1.mergeArraysByKey)(merged, r.manga.creators, (c) => c.name);
            }
        }
        return merged;
    }
    mergeCharacters(results) {
        const ordered = this.sortByPriority(results, CATEGORY_PRIORITY['characters']);
        let merged = [];
        for (const r of ordered) {
            if (r.manga.characters && r.manga.characters.length > 0) {
                merged = (0, utils_1.mergeArraysByKey)(merged, r.manga.characters, (c) => c.name);
            }
        }
        return merged;
    }
    mergeScores(results) {
        const ordered = this.sortByPriority(results, CATEGORY_PRIORITY['score']);
        const merged = {};
        for (const r of ordered) {
            const s = r.manga.score;
            if (!s)
                continue;
            if (merged.averageScore == null && s.averageScore != null)
                merged.averageScore = s.averageScore;
            if (merged.meanScore == null && s.meanScore != null)
                merged.meanScore = s.meanScore;
            if (merged.ratingDistribution == null && s.ratingDistribution)
                merged.ratingDistribution = s.ratingDistribution;
            if (merged.follows == null && s.follows != null)
                merged.follows = s.follows;
            if (merged.popularity == null && s.popularity != null)
                merged.popularity = s.popularity;
            if (merged.trending == null && s.trending != null)
                merged.trending = s.trending;
        }
        return Object.keys(merged).length > 0 ? merged : undefined;
    }
    mergeRelations(results) {
        let merged = [];
        for (const r of results) {
            if (r.manga.relations && r.manga.relations.length > 0) {
                merged = (0, utils_1.mergeArraysByKey)(merged, r.manga.relations, (rel) => `${rel.relationType}:${rel.id}`);
            }
        }
        return merged;
    }
    mergeRecommendations(results) {
        let merged = [];
        for (const r of results) {
            if (r.manga.recommendations && r.manga.recommendations.length > 0) {
                merged = (0, utils_1.mergeArraysByKey)(merged, r.manga.recommendations, (rec) => rec.id);
            }
        }
        return merged;
    }
    mergeStoryArcs(results) {
        let merged = [];
        for (const r of results) {
            if (r.manga.storyArcs && r.manga.storyArcs.length > 0) {
                merged = (0, utils_1.mergeArraysByKey)(merged, r.manga.storyArcs, (sa) => sa.name);
            }
        }
        return merged;
    }
    mergeExternalLinks(results) {
        const ordered = this.sortByPriority(results, CATEGORY_PRIORITY['externalLinks']);
        const merged = {};
        for (const r of [...ordered].reverse()) {
            const links = r.manga.externalLinks;
            if (!links)
                continue;
            for (const [key, val] of Object.entries(links)) {
                if (val)
                    merged[key] = val;
            }
        }
        return merged;
    }
    mergeVolumes(results) {
        const ordered = this.sortByPriority(results, CATEGORY_PRIORITY['volumes']);
        const volumeMap = new Map();
        for (const r of ordered) {
            if (!r.manga.volumes?.length)
                continue;
            for (const vol of r.manga.volumes) {
                const key = vol.volumeNumber.toLowerCase();
                const existing = volumeMap.get(key);
                if (existing) {
                    // Deep merge: existing (higher priority) wins, but fill gaps from vol
                    volumeMap.set(key, {
                        ...vol, // lower-priority fields as base
                        ...existing, // higher-priority fields override
                        // Explicitly fill gaps for critical fields
                        startChapter: existing.startChapter || vol.startChapter,
                        endChapter: existing.endChapter || vol.endChapter,
                        coverImage: existing.coverImage || vol.coverImage,
                        chapterCount: existing.chapterCount ?? vol.chapterCount,
                        chapterRange: existing.chapterRange || vol.chapterRange,
                        creators: existing.creators.length > 0 ? existing.creators : vol.creators,
                        characters: existing.characters.length > 0 ? existing.characters : vol.characters,
                    });
                }
                else {
                    volumeMap.set(key, { ...vol });
                }
            }
        }
        return Array.from(volumeMap.values())
            .sort((a, b) => Number(a.volumeNumber) - Number(b.volumeNumber));
    }
    mergeChapters(results) {
        const ordered = this.sortByPriority(results, CATEGORY_PRIORITY['chapters']);
        let merged = [];
        for (const r of ordered) {
            if (r.manga.chapters && r.manga.chapters.length > 0) {
                merged = (0, utils_1.mergeArraysByKey)(merged, r.manga.chapters, (ch) => `${ch.chapterNumber ?? ''}:${ch.language}`);
            }
        }
        return merged.sort((a, b) => Number(a.chapterNumber ?? 0) - Number(b.chapterNumber ?? 0));
    }
}
exports.MetadataMerger = MetadataMerger;
//# sourceMappingURL=merger.js.map