import { ValidationError } from '@/utils/errors';

/**
 * GraphQL Fragments for AniList API
 *
 * This module provides reusable GraphQL fragments to reduce query duplication,
 * improve maintainability, and optimize query size.
 */
/**
 * Base media title fragment
 * Used for basic title information
 */
export const MediaTitleFragment = `
  fragment MediaTitle on MediaTitle {
    romaji
    english
    native
  }
`;
/**
 * Cover image fragment
 * Used for cover art in different sizes
 */
export const MediaCoverImageFragment = `
  fragment MediaCoverImage on MediaCoverImage {
    large
    medium
    color
  }
`;
/**
 * Date fragment
 * Used for start and end dates
 */
export const FuzzyDateFragment = `
  fragment FuzzyDate on FuzzyDate {
    year
    month
    day
  }
`;
/**
 * Staff information fragment
 * Used for author/artist information
 */
export const StaffFragment = `
  fragment StaffInfo on StaffEdge {
    role
    node {
      id
      name {
        full
        native
      }
    }
  }
`;
/**
 * Character information fragment
 * Used for character listings
 */
export const CharacterFragment = `
  fragment CharacterInfo on CharacterEdge {
    role
    node {
      id
      name {
        full
        native
      }
    }
  }
`;
/**
 * Tag fragment
 * Used for content tags and genres
 */
export const MediaTagFragment = `
  fragment MediaTag on MediaTag {
    id
    name
    description
    category
    rank
    isGeneralSpoiler
    isMediaSpoiler
    isAdult
  }
`;
/**
 * External link fragment
 * Used for external site links
 */
export const ExternalLinkFragment = `
  fragment ExternalLink on MediaExternalLink {
    id
    url
    site
    type
    language
    color
    icon
  }
`;
/**
 * Basic media fields fragment
 * Contains the most commonly used fields
 */
export const MediaBasicFragment = `
  fragment MediaBasic on Media {
    id
    title {
      ...MediaTitle
    }
    description(asHtml: false)
    coverImage {
      ...MediaCoverImage
    }
    bannerImage
    status
    format
    isAdult
    genres
    synonyms
  }
`;
/**
 * Media statistics fragment
 * Contains popularity and score data
 */
export const MediaStatsFragment = `
  fragment MediaStats on Media {
    averageScore
    meanScore
    popularity
    favourites
    trending
  }
`;
/**
 * Media dates fragment
 * Contains publication date information
 */
export const MediaDatesFragment = `
  fragment MediaDates on Media {
    startDate {
      ...FuzzyDate
    }
    endDate {
      ...FuzzyDate
    }
    updatedAt
  }
`;
/**
 * Manga-specific fields fragment
 * Contains fields specific to manga media type
 */
export const MangaFieldsFragment = `
  fragment MangaFields on Media {
    chapters
    volumes
    countryOfOrigin
    isLicensed
    source
  }
`;
/**
 * Full media details fragment
 * Combines all fragments for complete media information
 */
export const MediaFullFragment = `
  fragment MediaFull on Media {
    ...MediaBasic
    ...MediaStats
    ...MediaDates
    ...MangaFields
    tags {
      ...MediaTag
    }
    staff(page: 1, perPage: 25) {
      edges {
        ...StaffInfo
      }
    }
    characters(page: 1, perPage: 25) {
      edges {
        ...CharacterInfo
      }
    }
    externalLinks {
      ...ExternalLink
    }
  }
`;
/**
 * Search result fragment
 * Optimized for search results with less data
 */
export const MediaSearchFragment = `
  fragment MediaSearch on Media {
    id
    title {
      ...MediaTitle
    }
    description(asHtml: false)
    coverImage {
      large
      medium
    }
    status
    chapters
    volumes
    format
    genres
    averageScore
    popularity
    isAdult
  }
`;
/**
 * List item fragment
 * Minimal data for list displays
 */
export const MediaListItemFragment = `
  fragment MediaListItem on Media {
    id
    title {
      romaji
      english
    }
    coverImage {
      medium
    }
    status
    format
    chapters
    volumes
  }
`;
/**
 * Fragment builder class for dynamic fragment composition
 */
export class FragmentBuilder {
    private fragments: Set<string> = new Set();
    private definitions: Map<string, string> = new Map();
    constructor() {
        // Register all available fragments
        this.registerFragment('MediaTitle', MediaTitleFragment);
        this.registerFragment('MediaCoverImage', MediaCoverImageFragment);
        this.registerFragment('FuzzyDate', FuzzyDateFragment);
        this.registerFragment('StaffInfo', StaffFragment);
        this.registerFragment('CharacterInfo', CharacterFragment);
        this.registerFragment('MediaTag', MediaTagFragment);
        this.registerFragment('ExternalLink', ExternalLinkFragment);
        this.registerFragment('MediaBasic', MediaBasicFragment);
        this.registerFragment('MediaStats', MediaStatsFragment);
        this.registerFragment('MediaDates', MediaDatesFragment);
        this.registerFragment('MangaFields', MangaFieldsFragment);
        this.registerFragment('MediaFull', MediaFullFragment);
        this.registerFragment('MediaSearch', MediaSearchFragment);
        this.registerFragment('MediaListItem', MediaListItemFragment);
    }
    /**
     * Registers a fragment definition
     */
    private registerFragment(name: string, definition: string): void {
        this.definitions.set(name, definition);
    }
    /**
     * Adds a fragment to be included in the query
     */
    public use(fragmentName: string): this {
        if (!this.definitions.has(fragmentName)) {
            throw new ValidationError(`Fragment '${fragmentName}' is not registered`);
        }
        this.fragments.add(fragmentName);
        // Also add dependencies
        this.addDependencies(fragmentName);
        return this;
    }
    /**
     * Adds fragment dependencies
     */
    private addDependencies(fragmentName: string): void {
        const definition = this.definitions.get(fragmentName);
        if (!definition)
            return;
        // Extract fragment references (e.g., ...MediaTitle)
        const fragmentRefs = definition.match(/\.\.\.(\w+)/g);
        if (fragmentRefs) {
            fragmentRefs.forEach(ref => {
                const depName = ref.replace('...', '');
                if (this.definitions.has(depName) && !this.fragments.has(depName)) {
                    this.fragments.add(depName);
                    this.addDependencies(depName); // Recursive for nested dependencies
                }
            });
        }
    }
    /**
     * Builds the complete fragment definitions string
     */
    public build(): string {
        const orderedFragments: string[] = [];
        const added = new Set<string>();
        // Add fragments in dependency order
        const addFragment = (name: string): void => {
            if (added.has(name))
                return;
            const definition = this.definitions.get(name);
            if (!definition)
                return;
            // Add dependencies first
            const deps = definition.match(/\.\.\.(\w+)/g);
            if (deps) {
                deps.forEach(dep => {
                    const depName = dep.replace('...', '');
                    if (this.fragments.has(depName)) {
                        addFragment(depName);
                    }
                });
            }
            orderedFragments.push(definition);
            added.add(name);
        };
        this.fragments.forEach(name => addFragment(name));
        return orderedFragments.join('\n\n');
    }
    /**
     * Clears all selected fragments
     */
    public clear(): this {
        this.fragments.clear();
        return this;
    }
}
/**
 * Pre-built queries using fragments
 */
export class FragmentQueries {
    /**
     * Search query with fragments
     */
    static searchQuery(includeFragments: boolean = true): string {
        const fragments = includeFragments ?
            new FragmentBuilder()
                .use('MediaSearch')
                .build() : '';
        return `
      ${fragments}
      
      query SearchManga($search: String, $page: Int, $perPage: Int, $genres: [String], $format: MediaFormat, $status: MediaStatus, $isAdult: Boolean) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            currentPage
            lastPage
            hasNextPage
            perPage
          }
          media(
            search: $search,
            type: MANGA,
            genre_in: $genres,
            format: $format,
            status: $status,
            isAdult: $isAdult
          ) {
            ${includeFragments ? '...MediaSearch' : `
              id
              title {
                romaji
                english
                native
              }
              description
              coverImage {
                large
                medium
              }
              status
              chapters
              volumes
              format
              genres
              averageScore
              popularity
              isAdult
            `}
          }
        }
      }
    `;
    }
    /**
     * Get manga details query with fragments
     */
    static detailsQuery(includeFragments: boolean = true): string {
        const fragments = includeFragments ?
            new FragmentBuilder()
                .use('MediaFull')
                .build() : '';
        return `
      ${fragments}
      
      query GetMangaDetails($id: Int) {
        Media(id: $id, type: MANGA) {
          ${includeFragments ? '...MediaFull' : `
            id
            title {
              romaji
              english
              native
            }
            description
            coverImage {
              large
              medium
            }
            bannerImage
            status
            chapters
            volumes
            format
            startDate {
              year
              month
              day
            }
            endDate {
              year
              month
              day
            }
            genres
            synonyms
            averageScore
            popularity
            tags {
              name
              isAdult
            }
            isAdult
            countryOfOrigin
            staff {
              edges {
                role
                node {
                  id
                  name {
                    full
                    native
                  }
                }
              }
            }
            characters {
              edges {
                role
                node {
                  id
                  name {
                    full
                    native
                  }
                }
              }
            }
            externalLinks {
              url
              site
              type
            }
          `}
        }
      }
    `;
    }
    /**
     * Trending manga query with fragments
     */
    static trendingQuery(includeFragments: boolean = true): string {
        const fragments = includeFragments ?
            new FragmentBuilder()
                .use('MediaListItem')
                .build() : '';
        return `
      ${fragments}
      
      query TrendingManga($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            currentPage
            lastPage
            hasNextPage
            perPage
          }
          media(type: MANGA, sort: TRENDING_DESC) {
            ${includeFragments ? '...MediaListItem' : `
              id
              title {
                romaji
                english
              }
              coverImage {
                medium
              }
              status
              format
              chapters
              volumes
            `}
          }
        }
      }
    `;
    }
}
/**
 * Fragment optimization utilities
 */
export class FragmentOptimizer {
    /**
     * Analyzes a query to suggest which fragments to use
     */
    static analyze(query: string): string[] {
        const suggestions: string[] = [];
        // Check for repeated field groups
        if (query.includes('title {') && query.split('title {').length > 2) {
            suggestions.push('Consider using MediaTitleFragment for title fields');
        }
        if (query.includes('coverImage {') && query.split('coverImage {').length > 2) {
            suggestions.push('Consider using MediaCoverImageFragment for cover images');
        }
        if (query.includes('startDate {') || query.includes('endDate {')) {
            suggestions.push('Consider using FuzzyDateFragment for date fields');
        }
        if (query.includes('staff {') || query.includes('characters {')) {
            suggestions.push('Consider using StaffFragment and CharacterFragment');
        }
        return suggestions;
    }
    /**
     * Estimates query complexity reduction when using fragments
     */
    static estimateReduction(originalQuery: string, fragmentQuery: string): number {
        const originalSize = originalQuery.replace(/\s+/g, '').length;
        const fragmentSize = fragmentQuery.replace(/\s+/g, '').length;
        return Math.round(((originalSize - fragmentSize) / originalSize) * 100);
    }
}
