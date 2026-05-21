# AniList API Implementation Improvement Plan

## Overview
This document outlines a phased approach to upgrade our AniList API client based on best practices analysis. Each phase is designed to be implemented independently with minimal disruption to existing functionality.

## Implementation Phases

### 🚨 Phase 1: Rate Limit Header Monitoring (High Priority)
**Timeline: 2-3 days**
**Impact: Critical for API stability**

#### Objectives
- Parse and utilize rate limit headers from API responses
- Implement adaptive rate limiting based on actual API limits
- Prevent unnecessary 429 errors

#### Implementation Tasks

1. **Update RateLimiter Interface** (`src/api/utils/rateLimit.ts`)
```typescript
export interface RateLimiter {
  acquire(cost?: number): Promise<void>;
  release(): void;
  updateFromHeaders(remaining: number, reset: number): void; // NEW
  getInfo(): RateLimitInfo;
  reset(): void;
}
```

2. **Create AdaptiveRateLimiter Class**
```typescript
export class AdaptiveRateLimiter implements RateLimiter {
  private remaining: number = 90;
  private resetTime: number = Date.now() + 60000;
  private limit: number = 90;
  
  updateFromHeaders(remaining: number, reset: number): void {
    this.remaining = remaining;
    this.resetTime = reset * 1000; // Convert to milliseconds
    
    // Log for monitoring
    console.log(`[AniList] Rate limit updated: ${remaining}/${this.limit} remaining, resets at ${new Date(this.resetTime)}`);
  }
  
  async acquire(cost: number = 1): Promise<void> {
    // If we're out of requests, wait until reset
    if (this.remaining < cost) {
      const waitTime = this.resetTime - Date.now();
      if (waitTime > 0) {
        console.log(`[AniList] Rate limit reached, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.remaining = this.limit; // Reset after waiting
      }
    }
    
    this.remaining -= cost;
  }
  
  getInfo(): RateLimitInfo {
    return {
      remaining: this.remaining,
      reset: new Date(this.resetTime),
      limit: this.limit,
      retryAfter: Math.max(0, this.resetTime - Date.now())
    };
  }
}
```

3. **Update AniListClient.graphqlQuery Method**
```typescript
private async graphqlQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  // ... existing cache check ...
  
  await this.graphqlRateLimiter.acquire();
  
  const response = await this.http.post<GraphQLResponse<T>>('', { query, variables });
  
  // NEW: Update rate limiter from headers
  const remaining = response.headers?.['x-ratelimit-remaining'];
  const reset = response.headers?.['x-ratelimit-reset'];
  
  if (remaining !== undefined && reset !== undefined) {
    this.graphqlRateLimiter.updateFromHeaders(
      parseInt(remaining, 10),
      parseInt(reset, 10)
    );
  }
  
  // ... rest of method ...
}
```

#### Testing
- Monitor rate limit headers in development
- Test behavior when approaching rate limits
- Verify waiting behavior when limits are exceeded

---

### 🔄 Phase 2: Retry Logic with Exponential Backoff (High Priority)
**Timeline: 1-2 days**
**Impact: Improves reliability and user experience**

#### Objectives
- Automatically retry failed requests with exponential backoff
- Handle 429 (rate limit) and 503 (service unavailable) errors gracefully
- Provide configurable retry behavior

#### Implementation Tasks

1. **Create Retry Utility** (`src/api/utils/retry.ts`)
```typescript
export interface RetryConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryableStatuses?: number[];
  onRetry?: (attempt: number, error: any) => void;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    retryableStatuses = [429, 503, 502],
    onRetry
  } = config;
  
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = error.status && retryableStatuses.includes(error.status);
      
      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      let delay = initialDelay * Math.pow(backoffFactor, attempt);
      
      // Check for Retry-After header (429 responses)
      if (error.status === 429 && error.headers?.['retry-after']) {
        const retryAfter = parseInt(error.headers['retry-after'], 10);
        delay = retryAfter * 1000; // Convert to milliseconds
      }
      
      // Cap at maxDelay
      delay = Math.min(delay, maxDelay);
      
      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error);
      }
      
      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
```

2. **Update AniListClient Configuration**
```typescript
export interface AniListConfig extends ApiClientConfig {
  // ... existing fields ...
  
  /**
   * Retry configuration for failed requests
   */
  retryConfig?: RetryConfig;
}
```

3. **Wrap graphqlQuery with Retry Logic**
```typescript
private async graphqlQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  return retryWithBackoff(
    async () => {
      // ... existing graphqlQuery implementation ...
    },
    {
      ...this.config.retryConfig,
      onRetry: (attempt, error) => {
        console.log(`[AniList] Retry attempt ${attempt} after error:`, error.message);
      }
    }
  );
}
```

#### Testing
- Simulate 429 errors and verify retry behavior
- Test exponential backoff timing
- Verify Retry-After header handling
- Test max retries limit

---

### 📄 Phase 3: Pagination Support (High Priority)
**Timeline: 2 days**
**Impact: Enables fetching large result sets**

#### Objectives
- Add page and perPage parameters to search options
- Implement cursor-based pagination for better performance
- Return pagination metadata with results

#### Implementation Tasks

1. **Update Search Options Interface**
```typescript
interface SearchOptions extends BaseSearchOptions {
  page?: number;
  perPage?: number;
  providerSpecific?: AniListSearchOptions;
}

interface PaginatedResult<T> {
  data: T[];
  pageInfo: {
    total: number;
    perPage: number;
    currentPage: number;
    lastPage: number;
    hasNextPage: boolean;
  };
}
```

2. **Update Search Query to Include PageInfo**
```typescript
const searchQuery = `
  query ($search: String, $page: Int, $perPage: Int, ...) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        perPage
        currentPage
        lastPage
        hasNextPage
      }
      media(search: $search, type: MANGA, ...) {
        # ... existing fields ...
      }
    }
  }
`;
```

3. **Create Paginated Search Method**
```typescript
public async searchPaginated(
  query: string, 
  options?: SearchOptions
): Promise<PaginatedResult<Manga>> {
  const variables = {
    search: query,
    page: options?.page || 1,
    perPage: options?.perPage || 20,
    // ... other variables ...
  };
  
  const response = await this.graphqlQuery<{
    Page: {
      pageInfo: PageInfo;
      media: AniListMedia[];
    };
  }>(searchQuery, variables);
  
  return {
    data: this.convertMediaArrayToManga(response.Page.media),
    pageInfo: response.Page.pageInfo
  };
}
```

4. **Add Helper Method for Fetching All Pages**
```typescript
public async searchAll(
  query: string,
  options?: Omit<SearchOptions, 'page'>
): Promise<Manga[]> {
  const allResults: Manga[] = [];
  let currentPage = 1;
  let hasNextPage = true;
  
  while (hasNextPage) {
    const result = await this.searchPaginated(query, {
      ...options,
      page: currentPage,
      perPage: 50 // Max allowed by AniList
    });
    
    allResults.push(...result.data);
    hasNextPage = result.pageInfo.hasNextPage;
    currentPage++;
    
    // Add small delay between pages to avoid rate limiting
    if (hasNextPage) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return allResults;
}
```

#### Testing
- Test fetching multiple pages
- Verify pageInfo accuracy
- Test searchAll with large result sets
- Monitor rate limiting with multiple page requests

---

### 🧩 Phase 4: GraphQL Fragments (Medium Priority)
**Timeline: 2 days**
**Impact: Reduces code duplication and improves maintainability**

#### Objectives
- Create reusable fragments for common fields
- Reduce query size and duplication
- Improve query organization

#### Implementation Tasks

1. **Create Fragments Module** (`src/api/metadataProviders/anilist/fragments.ts`)
```typescript
export const fragments = {
  mediaTitle: `
    fragment MediaTitle on MediaTitle {
      romaji
      english
      native
    }
  `,
  
  mediaCoverImage: `
    fragment MediaCoverImage on MediaCoverImage {
      large
      medium
      color
    }
  `,
  
  mediaDate: `
    fragment MediaDate on FuzzyDate {
      year
      month
      day
    }
  `,
  
  mediaBasic: `
    fragment MediaBasic on Media {
      id
      title { ...MediaTitle }
      coverImage { ...MediaCoverImage }
      status
      format
      genres
      averageScore
      popularity
    }
  `,
  
  mediaDetailed: `
    fragment MediaDetailed on Media {
      ...MediaBasic
      description
      bannerImage
      chapters
      volumes
      startDate { ...MediaDate }
      endDate { ...MediaDate }
      synonyms
      countryOfOrigin
      isAdult
      tags {
        name
        rank
        isMediaSpoiler
      }
      staff {
        edges {
          role
          node {
            name { full native }
          }
        }
      }
      characters {
        edges {
          role
          node {
            name { full native }
          }
        }
      }
      externalLinks {
        url
        site
        type
      }
    }
  `
};

export function buildQuery(fragmentNames: string[], query: string): string {
  const selectedFragments = fragmentNames
    .map(name => fragments[name])
    .filter(Boolean)
    .join('\n');
  
  return `${selectedFragments}\n${query}`;
}
```

2. **Update Search Query to Use Fragments**
```typescript
const searchQuery = buildQuery(
  ['mediaTitle', 'mediaCoverImage', 'mediaDate', 'mediaBasic'],
  `
    query ($search: String, $page: Int, $perPage: Int, ...) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { ... }
        media(search: $search, type: MANGA, ...) {
          ...MediaBasic
          # Additional fields not in fragment
          chapters
          volumes
          startDate { ...MediaDate }
          endDate { ...MediaDate }
        }
      }
    }
  `
);
```

3. **Update Details Query to Use Fragments**
```typescript
const detailsQuery = buildQuery(
  ['mediaTitle', 'mediaCoverImage', 'mediaDate', 'mediaDetailed'],
  `
    query ($id: Int) {
      Media(id: $id, type: MANGA) {
        ...MediaDetailed
      }
    }
  `
);
```

#### Testing
- Verify fragments produce same results as inline fields
- Test query size reduction
- Ensure all fields are properly included

---

### 🔍 Phase 5: Sorting and Filtering Options (Medium Priority)
**Timeline: 1-2 days**
**Impact: Improves search functionality**

#### Objectives
- Add sorting options (score, popularity, trending, date)
- Add season and year filters
- Add status and format filters

#### Implementation Tasks

1. **Extend Search Options**
```typescript
export enum AniListSortOption {
  SCORE_DESC = 'SCORE_DESC',
  POPULARITY_DESC = 'POPULARITY_DESC',
  TRENDING_DESC = 'TRENDING_DESC',
  START_DATE_DESC = 'START_DATE_DESC',
  UPDATED_AT_DESC = 'UPDATED_AT_DESC',
  TITLE_ROMAJI = 'TITLE_ROMAJI'
}

export enum MediaSeason {
  WINTER = 'WINTER',
  SPRING = 'SPRING',
  SUMMER = 'SUMMER',
  FALL = 'FALL'
}

interface AniListSearchOptions {
  format?: string;
  sort?: AniListSortOption | AniListSortOption[];
  season?: MediaSeason;
  seasonYear?: number;
  startDate_greater?: string; // YYYYMMDD format
  startDate_lesser?: string;
  endDate_greater?: string;
  endDate_lesser?: string;
  minimumScore?: number;
  tagCategory_in?: string[];
  tagCategory_not_in?: string[];
}
```

2. **Update Search Query Variables**
```typescript
const searchQuery = `
  query (
    $search: String,
    $sort: [MediaSort],
    $season: MediaSeason,
    $seasonYear: Int,
    $startDate_greater: FuzzyDateInt,
    $startDate_lesser: FuzzyDateInt,
    $averageScore_greater: Int,
    ...
  ) {
    Page(page: $page, perPage: $perPage) {
      media(
        search: $search,
        type: MANGA,
        sort: $sort,
        season: $season,
        seasonYear: $seasonYear,
        startDate_greater: $startDate_greater,
        startDate_lesser: $startDate_lesser,
        averageScore_greater: $averageScore_greater,
        ...
      ) {
        # ... fields ...
      }
    }
  }
`;
```

3. **Add Convenience Methods**
```typescript
public async searchTrending(options?: Omit<SearchOptions, 'providerSpecific'>): Promise<Manga[]> {
  return this.searchDirect('', {
    ...options,
    providerSpecific: {
      sort: AniListSortOption.TRENDING_DESC
    }
  });
}

public async searchBySeason(
  season: MediaSeason,
  year: number,
  options?: SearchOptions
): Promise<Manga[]> {
  return this.searchDirect('', {
    ...options,
    providerSpecific: {
      season,
      seasonYear: year,
      sort: AniListSortOption.POPULARITY_DESC
    }
  });
}

public async searchTopRated(options?: SearchOptions): Promise<Manga[]> {
  return this.searchDirect('', {
    ...options,
    providerSpecific: {
      sort: AniListSortOption.SCORE_DESC,
      minimumScore: 70
    }
  });
}
```

#### Testing
- Test each sort option
- Test season/year filtering
- Test date range filtering
- Verify score filtering

---

### ⚡ Phase 6: Conditional Field Inclusion (Low Priority)
**Timeline: 1 day**
**Impact: Optimizes query performance**

#### Objectives
- Only request fields that are needed
- Reduce response size for list views
- Provide detailed data only when necessary

#### Implementation Tasks

1. **Create Field Selection Options**
```typescript
export interface FieldInclusion {
  includeDescription?: boolean;
  includeCharacters?: boolean;
  includeStaff?: boolean;
  includeStats?: boolean;
  includeRelations?: boolean;
  includeRecommendations?: boolean;
  includeExternalLinks?: boolean;
}

export enum DetailLevel {
  MINIMAL = 'MINIMAL',   // ID, title, cover only
  BASIC = 'BASIC',       // + status, format, genres
  STANDARD = 'STANDARD', // + description, scores, dates
  DETAILED = 'DETAILED', // + characters, staff
  FULL = 'FULL'         // Everything
}
```

2. **Update Queries with Directives**
```typescript
const conditionalQuery = `
  query (
    $id: Int,
    $includeDescription: Boolean = true,
    $includeCharacters: Boolean = false,
    $includeStaff: Boolean = false,
    $includeStats: Boolean = false
  ) {
    Media(id: $id, type: MANGA) {
      id
      title { ...MediaTitle }
      coverImage { ...MediaCoverImage }
      
      description @include(if: $includeDescription)
      
      characters @include(if: $includeCharacters) {
        edges {
          role
          node { name { full } }
        }
      }
      
      staff @include(if: $includeStaff) {
        edges {
          role
          node { name { full } }
        }
      }
      
      stats @include(if: $includeStats) {
        scoreDistribution { score amount }
        statusDistribution { status amount }
      }
    }
  }
`;
```

3. **Add Helper Methods with Detail Levels**
```typescript
public async getMangaWithDetail(
  id: string | number,
  detailLevel: DetailLevel = DetailLevel.STANDARD
): Promise<Manga> {
  const inclusion = this.getFieldInclusionForLevel(detailLevel);
  
  const variables = {
    id: typeof id === 'string' ? parseInt(id, 10) : id,
    ...inclusion
  };
  
  return this.graphqlQuery(conditionalQuery, variables);
}

private getFieldInclusionForLevel(level: DetailLevel): FieldInclusion {
  switch (level) {
    case DetailLevel.MINIMAL:
      return {
        includeDescription: false,
        includeCharacters: false,
        includeStaff: false,
        includeStats: false
      };
    case DetailLevel.BASIC:
      return {
        includeDescription: false,
        includeCharacters: false,
        includeStaff: false,
        includeStats: false
      };
    case DetailLevel.STANDARD:
      return {
        includeDescription: true,
        includeCharacters: false,
        includeStaff: false,
        includeStats: false
      };
    case DetailLevel.DETAILED:
      return {
        includeDescription: true,
        includeCharacters: true,
        includeStaff: true,
        includeStats: false
      };
    case DetailLevel.FULL:
      return {
        includeDescription: true,
        includeCharacters: true,
        includeStaff: true,
        includeStats: true
      };
  }
}
```

#### Testing
- Compare response sizes with different detail levels
- Verify conditional fields are included/excluded correctly
- Test performance improvements with minimal queries

---

## Implementation Schedule

### Week 1
- **Day 1-2**: Phase 1 - Rate Limit Header Monitoring
- **Day 3**: Phase 2 - Retry Logic
- **Day 4-5**: Phase 3 - Pagination Support

### Week 2
- **Day 1-2**: Phase 4 - GraphQL Fragments
- **Day 3**: Phase 5 - Sorting and Filtering
- **Day 4**: Phase 6 - Conditional Fields
- **Day 5**: Integration testing and documentation

## Success Metrics

1. **Rate Limiting**
   - Zero 429 errors during normal operation
   - Automatic recovery from rate limit conditions
   
2. **Reliability**
   - 95% reduction in transient failures
   - Successful retry rate > 90%
   
3. **Performance**
   - 30% reduction in average response size with conditional fields
   - 50% reduction in query duplication with fragments
   
4. **Functionality**
   - Support for fetching 1000+ results with pagination
   - 10+ new search filter options
   
## Risk Mitigation

1. **Backward Compatibility**
   - All changes are additive, existing methods remain unchanged
   - New features are opt-in through configuration or new methods
   
2. **Testing Strategy**
   - Unit tests for each new utility function
   - Integration tests with mock AniList responses
   - Manual testing against live API with rate limit monitoring
   
3. **Rollback Plan**
   - Each phase is independent and can be reverted
   - Feature flags for enabling/disabling new functionality
   
## Documentation Requirements

For each phase:
1. Update inline code documentation
2. Add usage examples to README
3. Document configuration options
4. Create migration guide if breaking changes

## Monitoring and Observability

Add logging for:
- Rate limit status after each request
- Retry attempts and outcomes
- Query performance metrics
- Cache hit/miss rates

## Next Steps

1. Review and approve implementation plan
2. Set up development environment with AniList API access
3. Create feature branch for Phase 1
4. Begin implementation following the plan

---

**Note**: This plan prioritizes stability and reliability improvements (Phases 1-3) before optimization and feature enhancements (Phases 4-6). Each phase builds upon the previous ones but can be implemented independently if needed.