/**
 * Tests for Field Inclusion functionality
 */

import {
  DetailLevel,
  getFieldGroupsForLevel,
  mergeFieldConfig,
  buildFieldVariables,
  buildConditionalFields,
  calculateQuerySizeReduction,
  getRecommendedDetailLevel,
  FieldInclusionPresets,
  QueryOptimizer
} from '../fieldInclusion';

import type {
  FieldGroups,
  FieldInclusionConfig} from '../fieldInclusion';

describe('Field Inclusion', () => {
  describe('getFieldGroupsForLevel', () => {
    it('should return minimal fields for MINIMAL level', () => {
      const fields = getFieldGroupsForLevel(DetailLevel.MINIMAL);
      
      expect(fields.basic).toBe(true);
      expect(fields.dates).toBe(false);
      expect(fields.scores).toBe(false);
      expect(fields.stats).toBe(false);
      expect(fields.media).toBe(false);
      expect(fields.relations).toBe(false);
      expect(fields.recommendations).toBe(false);
      expect(fields.characters).toBe(false);
      expect(fields.staff).toBe(false);
      expect(fields.studios).toBe(false);
      expect(fields.external).toBe(false);
      expect(fields.trending).toBe(false);
      expect(fields.tags).toBe(false);
      expect(fields.streaming).toBe(false);
    });
    
    it('should return basic fields for BASIC level', () => {
      const fields = getFieldGroupsForLevel(DetailLevel.BASIC);
      
      expect(fields.basic).toBe(true);
      expect(fields.dates).toBe(true);
      expect(fields.scores).toBe(true);
      expect(fields.stats).toBe(false);
      expect(fields.media).toBe(true);
      expect(fields.relations).toBe(false);
      expect(fields.tags).toBe(true);
    });
    
    it('should return standard fields for STANDARD level', () => {
      const fields = getFieldGroupsForLevel(DetailLevel.STANDARD);
      
      expect(fields.basic).toBe(true);
      expect(fields.dates).toBe(true);
      expect(fields.scores).toBe(true);
      expect(fields.stats).toBe(true);
      expect(fields.media).toBe(true);
      expect(fields.relations).toBe(true);
      expect(fields.studios).toBe(true);
      expect(fields.external).toBe(true);
      expect(fields.tags).toBe(true);
      expect(fields.recommendations).toBe(false);
      expect(fields.characters).toBe(false);
      expect(fields.staff).toBe(false);
    });
    
    it('should return detailed fields for DETAILED level', () => {
      const fields = getFieldGroupsForLevel(DetailLevel.DETAILED);
      
      expect(fields.basic).toBe(true);
      expect(fields.dates).toBe(true);
      expect(fields.scores).toBe(true);
      expect(fields.stats).toBe(true);
      expect(fields.media).toBe(true);
      expect(fields.relations).toBe(true);
      expect(fields.recommendations).toBe(true);
      expect(fields.characters).toBe(true);
      expect(fields.staff).toBe(true);
      expect(fields.studios).toBe(true);
      expect(fields.external).toBe(true);
      expect(fields.trending).toBe(true);
      expect(fields.tags).toBe(true);
      expect(fields.streaming).toBe(false);
    });
    
    it('should return all fields for FULL level', () => {
      const fields = getFieldGroupsForLevel(DetailLevel.FULL);
      
      // All fields should be true
      Object.values(fields).forEach(value => {
        expect(value).toBe(true);
      });
    });
  });
  
  describe('mergeFieldConfig', () => {
    it('should apply custom field overrides', () => {
      const config: FieldInclusionConfig = {
        customFields: {
          characters: true,
          staff: true
        }
      };
      
      const fields = mergeFieldConfig(DetailLevel.BASIC, config);
      
      // Should have BASIC fields plus custom overrides
      expect(fields.basic).toBe(true);
      expect(fields.dates).toBe(true);
      expect(fields.scores).toBe(true);
      expect(fields.characters).toBe(true); // Custom override
      expect(fields.staff).toBe(true); // Custom override
    });
    
    it('should exclude specified fields', () => {
      const config: FieldInclusionConfig = {
        excludeFields: ['dates', 'scores']
      };
      
      const fields = mergeFieldConfig(DetailLevel.STANDARD, config);
      
      // Should have STANDARD fields minus exclusions
      expect(fields.basic).toBe(true);
      expect(fields.dates).toBe(false); // Excluded
      expect(fields.scores).toBe(false); // Excluded
      expect(fields.media).toBe(true);
    });
    
    it('should apply both custom fields and exclusions', () => {
      const config: FieldInclusionConfig = {
        customFields: {
          characters: true
        },
        excludeFields: ['tags']
      };
      
      const fields = mergeFieldConfig(DetailLevel.BASIC, config);
      
      expect(fields.characters).toBe(true); // Added
      expect(fields.tags).toBe(false); // Excluded
    });
  });
  
  describe('buildFieldVariables', () => {
    it('should build variables from field groups', () => {
      const fields: FieldGroups = {
        basic: true,
        dates: true,
        scores: false,
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
      
      const variables = buildFieldVariables(fields);
      
      expect(variables).toEqual({
        includeBasic: true,
        includeDates: true,
        includeScores: false,
        includeStats: false,
        includeMedia: true,
        includeRelations: false,
        includeRecommendations: false,
        includeCharacters: false,
        includeStaff: false,
        includeStudios: false,
        includeExternal: false,
        includeTrending: false,
        includeTags: true,
        includeStreaming: false
      });
    });
  });
  
  describe('getRecommendedDetailLevel', () => {
    it('should return appropriate detail levels for use cases', () => {
      expect(getRecommendedDetailLevel('list')).toBe(DetailLevel.BASIC);
      expect(getRecommendedDetailLevel('grid')).toBe(DetailLevel.MINIMAL);
      expect(getRecommendedDetailLevel('card')).toBe(DetailLevel.BASIC);
      expect(getRecommendedDetailLevel('detail')).toBe(DetailLevel.STANDARD);
      expect(getRecommendedDetailLevel('full')).toBe(DetailLevel.FULL);
      expect(getRecommendedDetailLevel('search')).toBe(DetailLevel.BASIC);
      expect(getRecommendedDetailLevel('trending')).toBe(DetailLevel.BASIC);
      expect(getRecommendedDetailLevel('seasonal')).toBe(DetailLevel.STANDARD);
      expect(getRecommendedDetailLevel('recommendations')).toBe(DetailLevel.DETAILED);
      expect(getRecommendedDetailLevel('export')).toBe(DetailLevel.FULL);
    });
    
    it('should return STANDARD for unknown use cases', () => {
      expect(getRecommendedDetailLevel('unknown')).toBe(DetailLevel.STANDARD);
    });
  });
  
  describe('FieldInclusionPresets', () => {
    it('should create list view preset', () => {
      const preset = FieldInclusionPresets.listView();
      
      expect(preset.detailLevel).toBe(DetailLevel.BASIC);
      expect(preset.excludeFields).toContain('relations');
      expect(preset.excludeFields).toContain('characters');
      expect(preset.excludeFields).toContain('staff');
      expect(preset.excludeFields).toContain('recommendations');
    });
    
    it('should create search results preset', () => {
      const preset = FieldInclusionPresets.searchResults();
      
      expect(preset.detailLevel).toBe(DetailLevel.BASIC);
      expect(preset.customFields).toEqual({
        scores: true,
        tags: true
      });
    });
    
    it('should create detail page preset', () => {
      const preset = FieldInclusionPresets.detailPage();
      
      expect(preset.detailLevel).toBe(DetailLevel.DETAILED);
      expect(preset.excludeFields).toContain('streaming');
    });
    
    it('should create trending preset', () => {
      const preset = FieldInclusionPresets.trending();
      
      expect(preset.detailLevel).toBe(DetailLevel.BASIC);
      expect(preset.customFields).toEqual({
        trending: true,
        scores: true
      });
    });
    
    it('should create seasonal preset', () => {
      const preset = FieldInclusionPresets.seasonal();
      
      expect(preset.detailLevel).toBe(DetailLevel.STANDARD);
      expect(preset.customFields).toEqual({
        studios: true,
        external: true
      });
    });
    
    it('should create performance preset', () => {
      const preset = FieldInclusionPresets.performance();
      
      expect(preset.detailLevel).toBe(DetailLevel.MINIMAL);
    });
    
    it('should create data export preset', () => {
      const preset = FieldInclusionPresets.dataExport();
      
      expect(preset.detailLevel).toBe(DetailLevel.FULL);
    });
  });
  
  describe('QueryOptimizer', () => {
    let optimizer: QueryOptimizer;
    
    beforeEach(() => {
      optimizer = new QueryOptimizer({
        detailLevel: DetailLevel.BASIC
      });
    });
    
    it('should build query for search', () => {
      const query = optimizer.buildQuery('search');
      
      expect(query).toContain('query SearchManga');
      expect(query).toContain('@include(if: $includeBasic)');
      expect(query).toContain('@include(if: $includeDates)');
    });
    
    it('should build query for details', () => {
      const query = optimizer.buildQuery('details');
      
      expect(query).toContain('query GetMangaDetails');
      expect(query).toContain('Media(id: $id, type: MANGA)');
    });
    
    it('should build query for trending', () => {
      const query = optimizer.buildQuery('trending');
      
      expect(query).toContain('query GetTrendingManga');
      expect(query).toContain('sort: TRENDING_DESC');
    });
    
    it('should build query for seasonal', () => {
      const query = optimizer.buildQuery('seasonal');
      
      expect(query).toContain('query GetSeasonalManga');
      expect(query).toContain('$season: MediaSeason!');
      expect(query).toContain('$year: Int!');
    });
    
    it('should get variables with field flags', () => {
      const baseVars = { search: 'test', page: 1 };
      const variables = optimizer.getVariables(baseVars);
      
      expect(variables["search"]).toBe('test');
      expect(variables["page"]).toBe(1);
      expect(variables["includeBasic"]).toBe(true);
      expect(variables["includeDates"]).toBe(true);
      expect(variables["includeScores"]).toBe(true);
      expect(variables["includeCharacters"]).toBe(false);
    });
    
    it('should update configuration', () => {
      optimizer.updateConfig({
        detailLevel: DetailLevel.FULL
      });
      
      const fields = optimizer.getFields();
      
      // All fields should be true for FULL level
      Object.values(fields).forEach(value => {
        expect(value).toBe(true);
      });
    });
    
    it('should enable specific fields', () => {
      optimizer.enableFields('characters', 'staff');
      
      const fields = optimizer.getFields();
      
      expect(fields.characters).toBe(true);
      expect(fields.staff).toBe(true);
    });
    
    it('should disable specific fields', () => {
      optimizer.disableFields('dates', 'scores');
      
      const fields = optimizer.getFields();
      
      expect(fields.dates).toBe(false);
      expect(fields.scores).toBe(false);
    });
    
    it('should estimate query reduction', () => {
      const minimalOptimizer = new QueryOptimizer({
        detailLevel: DetailLevel.MINIMAL
      });
      
      const reduction = minimalOptimizer.estimateReduction();
      
      // Should have high reduction for minimal fields
      expect(reduction).toBeGreaterThan(70);
    });
    
    it('should have low reduction for full detail', () => {
      const fullOptimizer = new QueryOptimizer({
        detailLevel: DetailLevel.FULL
      });
      
      const reduction = fullOptimizer.estimateReduction();
      
      // Should have no reduction for full fields
      expect(reduction).toBe(0);
    });
  });
  
  describe('calculateQuerySizeReduction', () => {
    it('should calculate query size reduction', () => {
      const fullQuery = 'query { Media { id title description chapters volumes startDate endDate } }';
      const optimizedQuery = 'query { Media { id title } }';
      const fields = getFieldGroupsForLevel(DetailLevel.MINIMAL);
      
      const result = calculateQuerySizeReduction(fullQuery, optimizedQuery, fields);
      
      expect(result.fullSize).toBe(fullQuery.length);
      expect(result.optimizedSize).toBe(optimizedQuery.length);
      expect(result.reduction).toBe(fullQuery.length - optimizedQuery.length);
      expect(result.percentage).toBeGreaterThan(0);
    });
  });
  
  describe('buildConditionalFields', () => {
    it('should include directives for conditional fields', () => {
      const fields = getFieldGroupsForLevel(DetailLevel.BASIC);
      const query = buildConditionalFields(fields);
      
      // Always included fields
      expect(query).toContain('id');
      expect(query).toContain('title {');
      expect(query).toContain('coverImage {');
      
      // Conditional fields
      expect(query).toContain('description @include(if: $includeBasic)');
      expect(query).toContain('startDate @include(if: $includeDates)');
      expect(query).toContain('averageScore @include(if: $includeScores)');
      expect(query).toContain('relations @include(if: $includeRelations)');
    });
  });
  
  describe('Integration scenarios', () => {
    it('should optimize query for list view', () => {
      const preset = FieldInclusionPresets.listView();
      const optimizer = new QueryOptimizer(preset);
      optimizer.buildQuery('search');
      const variables = optimizer.getVariables({ search: 'One Piece' });

      // Should exclude heavy fields
      expect(variables["includeRelations"]).toBe(false);
      expect(variables["includeCharacters"]).toBe(false);
      expect(variables["includeStaff"]).toBe(false);
      expect(variables["includeRecommendations"]).toBe(false);
      
      // Should include basic fields
      expect(variables["includeBasic"]).toBe(true);
      expect(variables["includeDates"]).toBe(true);
    });
    
    it('should maximize data for export', () => {
      const preset = FieldInclusionPresets.dataExport();
      const optimizer = new QueryOptimizer(preset);
      const variables = optimizer.getVariables({});
      
      // All fields should be included
      Object.keys(variables).forEach(key => {
        if (key.startsWith('include')) {
          expect(variables[key]).toBe(true);
        }
      });
    });
    
    it('should minimize data for performance', () => {
      const preset = FieldInclusionPresets.performance();
      const optimizer = new QueryOptimizer(preset);
      const variables = optimizer.getVariables({});
      
      // Only basic fields should be included
      expect(variables["includeBasic"]).toBe(true);
      
      // Everything else should be false
      Object.keys(variables).forEach(key => {
        if (key.startsWith('include') && key !== 'includeBasic') {
          expect(variables[key]).toBe(false);
        }
      });
    });
  });
});