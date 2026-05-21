import { ValidationError } from '@/utils/errors';

/**
 * Conditional Field Inclusion for AniList API
 *
 * This module provides dynamic field selection using GraphQL @include/@skip directives
 * to optimize query payloads based on actual data needs.
 */
/**
 * Detail levels for field inclusion
 */
export enum DetailLevel {
    MINIMAL = 'MINIMAL',// Only essential fields (id, title, cover)
    BASIC = 'BASIC',// Common fields for list views
    STANDARD = 'STANDARD',// Standard fields for detail views  
    DETAILED = 'DETAILED',// Most fields except resource-heavy ones
    FULL = 'FULL' // All available fields
}
/**
 * Field groups for conditional inclusion
 */
export interface FieldGroups {
    basic: boolean;
    dates: boolean;
    scores: boolean;
    stats: boolean;
    media: boolean;
    relations: boolean;
    recommendations: boolean;
    characters: boolean;
    staff: boolean;
    studios: boolean;
    external: boolean;
    trending: boolean;
    tags: boolean;
    streaming: boolean;
}
/**
 * Configuration for field inclusion
 */
export interface FieldInclusionConfig {
    detailLevel?: DetailLevel;
    customFields?: Partial<FieldGroups>;
    excludeFields?: (keyof FieldGroups)[];
}
/**
 * Get field groups for a detail level
 */
export function getFieldGroupsForLevel(level: DetailLevel): FieldGroups {
    switch (level) {
        case DetailLevel.MINIMAL:
            return {
                basic: true,
                dates: false,
                scores: false,
                stats: false,
                media: false,
                relations: false,
                recommendations: false,
                characters: false,
                staff: false,
                studios: false,
                external: false,
                trending: false,
                tags: false,
                streaming: false
            };
        case DetailLevel.BASIC:
            return {
                basic: true,
                dates: true,
                scores: true,
                stats: false,
                media: true,
                relations: false,
                recommendations: false,
                characters: false,
                staff: false,
                studios: false,
                external: false,
                trending: false,
                tags: true,
                streaming: false
            };
        case DetailLevel.STANDARD:
            return {
                basic: true,
                dates: true,
                scores: true,
                stats: true,
                media: true,
                relations: true,
                recommendations: false,
                characters: false,
                staff: false,
                studios: true,
                external: true,
                trending: false,
                tags: true,
                streaming: false
            };
        case DetailLevel.DETAILED:
            return {
                basic: true,
                dates: true,
                scores: true,
                stats: true,
                media: true,
                relations: true,
                recommendations: true,
                characters: true,
                staff: true,
                studios: true,
                external: true,
                trending: true,
                tags: true,
                streaming: false
            };
        case DetailLevel.FULL:
            return {
                basic: true,
                dates: true,
                scores: true,
                stats: true,
                media: true,
                relations: true,
                recommendations: true,
                characters: true,
                staff: true,
                studios: true,
                external: true,
                trending: true,
                tags: true,
                streaming: true
            };
        default:
            // Exhaustive check - all DetailLevel cases should be handled above
            return {
                basic: true,
                dates: true,
                scores: true,
                stats: true,
                media: true,
                relations: true,
                recommendations: true,
                characters: true,
                staff: true,
                studios: true,
                external: true,
                trending: true,
                tags: true,
                streaming: true
            };
    }
}
/**
 * Merge field configuration with custom overrides
 */
export function mergeFieldConfig(level: DetailLevel, config?: FieldInclusionConfig): FieldGroups {
    let fields = getFieldGroupsForLevel(level);
    // Apply custom field overrides
    if (config?.customFields) {
        fields = { ...fields, ...config.customFields };
    }
    // Exclude specified fields
    if (config?.excludeFields) {
        for (const field of config.excludeFields) {
            fields[field] = false;
        }
    }
    return fields;
}
/**
 * Build conditional field fragments for GraphQL query
 */
export function buildConditionalFields(_fields: FieldGroups): string {
    return `
    id
    idMal
    title {
      romaji
      english
      native
    }
    coverImage {
      large
      medium
    }
    bannerImage @include(if: $includeMedia)
    format
    type
    status
    
    description @include(if: $includeBasic)
    chapters @include(if: $includeBasic)
    volumes @include(if: $includeBasic)
    
    startDate @include(if: $includeDates) {
      year
      month
      day
    }
    endDate @include(if: $includeDates) {
      year
      month
      day
    }
    
    averageScore @include(if: $includeScores)
    meanScore @include(if: $includeScores)
    popularity @include(if: $includeScores)
    favourites @include(if: $includeScores)
    
    trending @include(if: $includeTrending)
    rankings @include(if: $includeStats) {
      id
      rank
      type
      format
      year
      season
      allTime
      context
    }
    
    genres @include(if: $includeTags)
    tags @include(if: $includeTags) {
      id
      name
      description
      category
      rank
      isGeneralSpoiler
      isMediaSpoiler
      isAdult
    }
    
    relations @include(if: $includeRelations) {
      edges {
        id
        relationType
        node {
          id
          title {
            romaji
            english
          }
          type
          format
          status
        }
      }
    }
    
    characters @include(if: $includeCharacters) {
      edges {
        id
        role
        node {
          id
          name {
            full
            native
          }
          image {
            large
            medium
          }
        }
      }
    }
    
    staff @include(if: $includeStaff) {
      edges {
        id
        role
        node {
          id
          name {
            full
            native
          }
          image {
            large
            medium
          }
        }
      }
    }
    
    studios @include(if: $includeStudios) {
      edges {
        id
        isMain
        node {
          id
          name
        }
      }
    }
    
    externalLinks @include(if: $includeExternal) {
      id
      url
      site
      type
      language
      color
      icon
    }
    
    streamingEpisodes @include(if: $includeStreaming) {
      title
      thumbnail
      url
      site
    }
    
    recommendations @include(if: $includeRecommendations) {
      edges {
        node {
          id
          rating
          mediaRecommendation {
            id
            title {
              romaji
              english
            }
            coverImage {
              large
            }
          }
        }
      }
    }
    
    stats @include(if: $includeStats) {
      scoreDistribution {
        score
        amount
      }
      statusDistribution {
        status
        amount
      }
    }
    
    isLicensed @include(if: $includeExternal)
    source @include(if: $includeMedia)
    countryOfOrigin @include(if: $includeMedia)
    isAdult @include(if: $includeBasic)
    updatedAt @include(if: $includeDates)
  `;
}
/**
 * Build GraphQL variables for field inclusion
 */
export function buildFieldVariables(fields: FieldGroups): Record<string, boolean> {
    return {
        includeBasic: fields.basic,
        includeDates: fields.dates,
        includeScores: fields.scores,
        includeStats: fields.stats,
        includeMedia: fields.media,
        includeRelations: fields.relations,
        includeRecommendations: fields.recommendations,
        includeCharacters: fields.characters,
        includeStaff: fields.staff,
        includeStudios: fields.studios,
        includeExternal: fields.external,
        includeTrending: fields.trending,
        includeTags: fields.tags,
        includeStreaming: fields.streaming
    };
}
/**
 * Build optimized query with conditional fields
 */
export function buildOptimizedQuery(queryType: 'search' | 'details' | 'trending' | 'seasonal', fields: FieldGroups): string {
    const conditionalFields = buildConditionalFields(fields);
    getBaseVariables(queryType);
    const emptyFields: FieldGroups = {
        basic: false,
        dates: false,
        scores: false,
        stats: false,
        media: false,
        relations: false,
        recommendations: false,
        characters: false,
        staff: false,
        studios: false,
        external: false,
        trending: false,
        tags: false,
        streaming: false
    };
    const fieldVariables = Object.keys(buildFieldVariables(emptyFields))
        .map(v => `$${v}: Boolean = false`)
        .join(', ');
    switch (queryType) {
        case 'search':
            return `
        query SearchManga($search: String, $page: Int, $perPage: Int, ${fieldVariables}) {
          Page(page: $page, perPage: $perPage) {
            pageInfo {
              total
              currentPage
              lastPage
              hasNextPage
              perPage
            }
            media(search: $search, type: MANGA) {
              ${conditionalFields}
            }
          }
        }
      `;
        case 'details':
            return `
        query GetMangaDetails($id: Int!, ${fieldVariables}) {
          Media(id: $id, type: MANGA) {
            ${conditionalFields}
          }
        }
      `;
        case 'trending':
            return `
        query GetTrendingManga($page: Int, $perPage: Int, ${fieldVariables}) {
          Page(page: $page, perPage: $perPage) {
            pageInfo {
              total
              currentPage
              lastPage
              hasNextPage
              perPage
            }
            media(sort: TRENDING_DESC, type: MANGA) {
              ${conditionalFields}
            }
          }
        }
      `;
        case 'seasonal':
            return `
        query GetSeasonalManga($season: MediaSeason!, $year: Int!, $page: Int, $perPage: Int, ${fieldVariables}) {
          Page(page: $page, perPage: $perPage) {
            pageInfo {
              total
              currentPage
              lastPage
              hasNextPage
              perPage
            }
            media(season: $season, seasonYear: $year, type: MANGA, sort: POPULARITY_DESC) {
              ${conditionalFields}
            }
          }
        }
      `;
        default: throw new ValidationError(`Unknown query type: ${queryType}`);
    }
}
/**
 * Get base variables for query type
 */
function getBaseVariables(queryType: string): string[] {
    switch (queryType) {
        case 'search':
            return ['search', 'page', 'perPage'];
        case 'details':
            return ['id'];
        case 'trending':
            return ['page', 'perPage'];
        case 'seasonal':
            return ['season', 'year', 'page', 'perPage'];
        default:
            return [];
    }
}
/**
 * Calculate estimated query size reduction
 */
export function calculateQuerySizeReduction(fullQuery: string, optimizedQuery: string, _fields: FieldGroups): {
    fullSize: number;
    optimizedSize: number;
    reduction: number;
    percentage: number;
} {
    const fullSize = fullQuery.length;
    const optimizedSize = optimizedQuery.length;
    const reduction = fullSize - optimizedSize;
    const percentage = Math.round((reduction / fullSize) * 100);
    return {
        fullSize,
        optimizedSize,
        reduction,
        percentage
    };
}
/**
 * Get recommended detail level for use case
 */
export function getRecommendedDetailLevel(useCase: string): DetailLevel {
    const recommendations: Record<string, DetailLevel> = {
        'list': DetailLevel.BASIC,
        'grid': DetailLevel.MINIMAL,
        'card': DetailLevel.BASIC,
        'detail': DetailLevel.STANDARD,
        'full': DetailLevel.FULL,
        'search': DetailLevel.BASIC,
        'trending': DetailLevel.BASIC,
        'seasonal': DetailLevel.STANDARD,
        'recommendations': DetailLevel.DETAILED,
        'export': DetailLevel.FULL
    };
    return recommendations[useCase] ?? DetailLevel.STANDARD;
}
/**
 * Field inclusion presets for common use cases
 */
export class FieldInclusionPresets {
    /**
     * Minimal fields for list/grid views
     */
    static listView(): FieldInclusionConfig {
        return {
            detailLevel: DetailLevel.BASIC,
            excludeFields: ['relations', 'characters', 'staff', 'recommendations']
        };
    }
    /**
     * Fields for search results
     */
    static searchResults(): FieldInclusionConfig {
        return {
            detailLevel: DetailLevel.BASIC,
            customFields: {
                scores: true,
                tags: true
            }
        };
    }
    /**
     * Fields for manga detail page
     */
    static detailPage(): FieldInclusionConfig {
        return {
            detailLevel: DetailLevel.DETAILED,
            excludeFields: ['streaming']
        };
    }
    /**
     * Fields for trending/popular lists
     */
    static trending(): FieldInclusionConfig {
        return {
            detailLevel: DetailLevel.BASIC,
            customFields: {
                trending: true,
                scores: true
            }
        };
    }
    /**
     * Fields for seasonal lists
     */
    static seasonal(): FieldInclusionConfig {
        return {
            detailLevel: DetailLevel.STANDARD,
            customFields: {
                studios: true,
                external: true
            }
        };
    }
    /**
     * Minimal fields for performance
     */
    static performance(): FieldInclusionConfig {
        return {
            detailLevel: DetailLevel.MINIMAL
        };
    }
    /**
     * All fields for data export
     */
    static dataExport(): FieldInclusionConfig {
        return {
            detailLevel: DetailLevel.FULL
        };
    }
}
/**
 * Query optimizer for dynamic field selection
 */
export class QueryOptimizer {
    private config: FieldInclusionConfig;
    private fields: FieldGroups;
    constructor(config: FieldInclusionConfig = {}) {
        this.config = config;
        this.fields = mergeFieldConfig(config.detailLevel ?? DetailLevel.STANDARD, config);
    }
    /**
     * Build optimized query
     */
    buildQuery(queryType: 'search' | 'details' | 'trending' | 'seasonal'): string {
        return buildOptimizedQuery(queryType, this.fields);
    }
    /**
     * Get query variables including field flags
     */
    getVariables(baseVariables: Record<string, unknown> = {}): Record<string, unknown> {
        return {
            ...baseVariables,
            ...buildFieldVariables(this.fields)
        };
    }
    /**
     * Update configuration
     */
    updateConfig(config: Partial<FieldInclusionConfig>): void {
        this.config = { ...this.config, ...config };
        this.fields = mergeFieldConfig(this.config.detailLevel ?? DetailLevel.STANDARD, this.config);
    }
    /**
     * Enable specific field groups
     */
    enableFields(...fieldGroups: (keyof FieldGroups)[]): void {
        for (const group of fieldGroups) {
            this.fields[group] = true;
        }
    }
    /**
     * Disable specific field groups
     */
    disableFields(...fieldGroups: (keyof FieldGroups)[]): void {
        for (const group of fieldGroups) {
            this.fields[group] = false;
        }
    }
    /**
     * Get current field configuration
     */
    getFields(): FieldGroups {
        return { ...this.fields };
    }
    /**
     * Estimate query size reduction
     */
    estimateReduction(): number {
        const enabledCount = Object.values(this.fields).filter(v => v).length;
        const totalCount = Object.keys(this.fields).length;
        return Math.round((1 - enabledCount / totalCount) * 100);
    }
}
