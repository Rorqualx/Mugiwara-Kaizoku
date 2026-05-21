/**
 * Tests for GraphQL Fragments
 */

import {
  MediaTitleFragment,
  MediaCoverImageFragment,
  MediaBasicFragment,
  MediaFullFragment,
  FragmentBuilder,
  FragmentQueries,
  FragmentOptimizer
} from '../fragments';

describe('GraphQL Fragments', () => {
  describe('Fragment Definitions', () => {
    it('should have valid MediaTitle fragment', () => {
      expect(MediaTitleFragment).toContain('fragment MediaTitle');
      expect(MediaTitleFragment).toContain('romaji');
      expect(MediaTitleFragment).toContain('english');
      expect(MediaTitleFragment).toContain('native');
    });
    
    it('should have valid MediaCoverImage fragment', () => {
      expect(MediaCoverImageFragment).toContain('fragment MediaCoverImage');
      expect(MediaCoverImageFragment).toContain('large');
      expect(MediaCoverImageFragment).toContain('medium');
      expect(MediaCoverImageFragment).toContain('color');
    });
    
    it('should have MediaBasic fragment with nested fragments', () => {
      expect(MediaBasicFragment).toContain('fragment MediaBasic');
      expect(MediaBasicFragment).toContain('...MediaTitle');
      expect(MediaBasicFragment).toContain('...MediaCoverImage');
    });
    
    it('should have MediaFull fragment with all sub-fragments', () => {
      expect(MediaFullFragment).toContain('fragment MediaFull');
      expect(MediaFullFragment).toContain('...MediaBasic');
      expect(MediaFullFragment).toContain('...MediaStats');
      expect(MediaFullFragment).toContain('...MediaDates');
      expect(MediaFullFragment).toContain('...MangaFields');
    });
  });
  
  describe('FragmentBuilder', () => {
    let builder: FragmentBuilder;
    
    beforeEach(() => {
      builder = new FragmentBuilder();
    });
    
    it('should build single fragment', () => {
      const result = builder.use('MediaTitle').build();
      expect(result).toContain('fragment MediaTitle');
    });
    
    it('should build multiple fragments', () => {
      const result = builder
        .use('MediaTitle')
        .use('MediaCoverImage')
        .build();
      
      expect(result).toContain('fragment MediaTitle');
      expect(result).toContain('fragment MediaCoverImage');
    });
    
    it('should automatically include dependencies', () => {
      const result = builder.use('MediaBasic').build();
      
      // Should include MediaTitle and MediaCoverImage as dependencies
      expect(result).toContain('fragment MediaTitle');
      expect(result).toContain('fragment MediaCoverImage');
      expect(result).toContain('fragment MediaBasic');
    });
    
    it('should handle nested dependencies', () => {
      const result = builder.use('MediaFull').build();
      
      // Should include all nested dependencies
      expect(result).toContain('fragment MediaTitle');
      expect(result).toContain('fragment MediaCoverImage');
      expect(result).toContain('fragment FuzzyDate');
      expect(result).toContain('fragment MediaBasic');
      expect(result).toContain('fragment MediaStats');
      expect(result).toContain('fragment MediaDates');
      expect(result).toContain('fragment MangaFields');
      expect(result).toContain('fragment MediaFull');
    });
    
    it('should throw error for unknown fragment', () => {
      expect(() => builder.use('UnknownFragment')).toThrow(
        "Fragment 'UnknownFragment' is not registered"
      );
    });
    
    it('should clear fragments', () => {
      builder.use('MediaTitle').use('MediaCoverImage');
      builder.clear();
      const result = builder.build();
      expect(result).toBe('');
    });
    
    it('should not duplicate fragments', () => {
      const result = builder
        .use('MediaTitle')
        .use('MediaTitle')
        .use('MediaBasic') // Also references MediaTitle
        .build();
      
      // MediaTitle should appear only once
      const matches = result.match(/fragment MediaTitle/g);
      expect(matches).toHaveLength(1);
    });
  });
  
  describe('FragmentQueries', () => {
    it('should generate search query with fragments', () => {
      const query = FragmentQueries.searchQuery(true);
      
      expect(query).toContain('fragment MediaSearch');
      expect(query).toContain('query SearchManga');
      expect(query).toContain('...MediaSearch');
    });
    
    it('should generate search query without fragments', () => {
      const query = FragmentQueries.searchQuery(false);
      
      expect(query).not.toContain('fragment MediaSearch');
      expect(query).toContain('query SearchManga');
      // Should have inline fields instead
      expect(query).toContain('title {');
      expect(query).toContain('coverImage {');
    });
    
    it('should generate details query with fragments', () => {
      const query = FragmentQueries.detailsQuery(true);
      
      expect(query).toContain('fragment MediaFull');
      expect(query).toContain('query GetMangaDetails');
      expect(query).toContain('...MediaFull');
    });
    
    it('should generate trending query with fragments', () => {
      const query = FragmentQueries.trendingQuery(true);
      
      expect(query).toContain('fragment MediaListItem');
      expect(query).toContain('query TrendingManga');
      expect(query).toContain('...MediaListItem');
    });
  });
  
  describe('FragmentOptimizer', () => {
    it('should analyze query for optimization opportunities', () => {
      const query = `
        query {
          manga1 {
            title {
              romaji
              english
            }
            coverImage {
              large
              medium
            }
          }
          manga2 {
            title {
              romaji
              english
            }
            coverImage {
              large
              medium
            }
          }
        }
      `;
      
      const suggestions = FragmentOptimizer.analyze(query);
      
      expect(suggestions).toContain(
        'Consider using MediaTitleFragment for title fields'
      );
      expect(suggestions).toContain(
        'Consider using MediaCoverImageFragment for cover images'
      );
    });
    
    it('should calculate query size reduction for repeated structures', () => {
      // When the same structure is repeated multiple times,
      // fragments provide size reduction
      const originalQuery = `
        query {
          manga1 {
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
          }
          manga2 {
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
          }
          manga3 {
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
          }
        }
      `;
      
      const fragmentQuery = `
        fragment MediaBasic on Media {
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
        }
        
        query {
          manga1 {
            ...MediaBasic
          }
          manga2 {
            ...MediaBasic
          }
          manga3 {
            ...MediaBasic
          }
        }
      `;
      
      const reduction = FragmentOptimizer.estimateReduction(originalQuery, fragmentQuery);
      
      // With multiple uses, fragment query should be smaller
      expect(reduction).toBeGreaterThan(0);
    });
    
    it('should detect date field patterns', () => {
      const query = `
        query {
          manga {
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
          }
        }
      `;
      
      const suggestions = FragmentOptimizer.analyze(query);
      
      expect(suggestions).toContain(
        'Consider using FuzzyDateFragment for date fields'
      );
    });
    
    it('should detect staff and character patterns', () => {
      const query = `
        query {
          manga {
            staff {
              edges {
                role
                node {
                  name {
                    full
                  }
                }
              }
            }
            characters {
              edges {
                role
                node {
                  name {
                    full
                  }
                }
              }
            }
          }
        }
      `;
      
      const suggestions = FragmentOptimizer.analyze(query);
      
      expect(suggestions).toContain(
        'Consider using StaffFragment and CharacterFragment'
      );
    });
  });
});