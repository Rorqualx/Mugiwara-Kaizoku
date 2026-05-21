/**
 * Priority-based metadata merger
 * Merges data from MangaDex + AniList + ComicVine into UnifiedManga
 */
import { DataSource } from '../types/common';
import { UnifiedManga, CompletenessScore } from '../types/metadata';
import { ProviderResult } from '../types/provider';
/** Priority configuration per data category */
export interface MergerConfig {
    /** Default source priority for scalar fields */
    defaultPriority: DataSource[];
    /** Prefer longer text for description */
    preferLongerText: boolean;
    /** Category-specific overrides */
    overrides?: Partial<Record<string, DataSource[]>>;
}
export declare class MetadataMerger {
    private readonly config;
    constructor(config?: Partial<MergerConfig>);
    /** Merge multiple provider results into a single UnifiedManga */
    merge(results: ProviderResult[]): UnifiedManga;
    /** Calculate completeness score for merged manga */
    calculateCompleteness(manga: UnifiedManga): CompletenessScore;
    private sortByPriority;
    private mergeIds;
    private getByPriority;
    private mergeLocalizedStrings;
    private mergeDescriptions;
    private mergeCovers;
    private mergeStringArrays;
    private mergeCreators;
    private mergeCharacters;
    private mergeScores;
    private mergeRelations;
    private mergeRecommendations;
    private mergeStoryArcs;
    private mergeExternalLinks;
    private mergeVolumes;
    private mergeChapters;
}
//# sourceMappingURL=merger.d.ts.map