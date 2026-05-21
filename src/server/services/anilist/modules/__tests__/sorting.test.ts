/**
 * Tests for Sorting and Filtering functionality
 */

import {
  MediaSort,
  MediaSeason,
  CountryOfOrigin,
  dateToFuzzyInt,
  getCurrentSeason,
  getSeasonFromDate,
  buildFilterVariables,
  FilterPresets,
  AdvancedSearchQueryBuilder
} from '../sorting';

describe('Sorting and Filtering', () => {
  describe('dateToFuzzyInt', () => {
    it('should convert date to YYYYMMDD integer', () => {
      const date = new Date(2024, 2, 15); // March 15, 2024 (month is 0-indexed)
      expect(dateToFuzzyInt(date)).toBe(20240315);
    });
    
    it('should handle string dates', () => {
      expect(dateToFuzzyInt('2024-12-25')).toBe(20241225);
    });
    
    it('should handle single digit months and days', () => {
      const date = new Date(2024, 0, 5); // January 5, 2024
      expect(dateToFuzzyInt(date)).toBe(20240105);
    });
  });
  
  describe('getCurrentSeason', () => {
    it('should return correct season for each month', () => {
      // Mock Date
      const originalDate = Date;
      
      // Test Winter (Jan-Mar)
      global.Date = class extends originalDate {
        getMonth(): number { return 0; } // January
      } as unknown as typeof Date;
      expect(getCurrentSeason()).toBe(MediaSeason.WINTER);

      // Test Spring (Apr-Jun)
      global.Date = class extends originalDate {
        getMonth(): number { return 4; } // May
      } as unknown as typeof Date;
      expect(getCurrentSeason()).toBe(MediaSeason.SPRING);

      // Test Summer (Jul-Sep)
      global.Date = class extends originalDate {
        getMonth(): number { return 7; } // August
      } as unknown as typeof Date;
      expect(getCurrentSeason()).toBe(MediaSeason.SUMMER);

      // Test Fall (Oct-Dec)
      global.Date = class extends originalDate {
        getMonth(): number { return 11; } // December
      } as unknown as typeof Date;
      expect(getCurrentSeason()).toBe(MediaSeason.FALL);
      
      // Restore original Date
      global.Date = originalDate;
    });
  });
  
  describe('getSeasonFromDate', () => {
    it('should return correct season for date', () => {
      expect(getSeasonFromDate('2024-02-15')).toBe(MediaSeason.WINTER);
      expect(getSeasonFromDate('2024-05-15')).toBe(MediaSeason.SPRING);
      expect(getSeasonFromDate('2024-08-15')).toBe(MediaSeason.SUMMER);
      expect(getSeasonFromDate('2024-11-15')).toBe(MediaSeason.FALL);
    });
  });
  
  describe('buildFilterVariables', () => {
    it('should build empty object for no filters', () => {
      expect(buildFilterVariables()).toEqual({});
    });
    
    it('should build sort variables', () => {
      const vars = buildFilterVariables({
        sort: MediaSort.POPULARITY_DESC
      });
      expect(vars).toEqual({
        sort: [MediaSort.POPULARITY_DESC]
      });
    });
    
    it('should handle multiple sort options', () => {
      const vars = buildFilterVariables({
        sort: [MediaSort.SCORE_DESC, MediaSort.POPULARITY_DESC]
      });
      expect(vars).toEqual({
        sort: [MediaSort.SCORE_DESC, MediaSort.POPULARITY_DESC]
      });
    });
    
    it('should build season filters', () => {
      const vars = buildFilterVariables({
        season: MediaSeason.SUMMER,
        seasonYear: 2024
      });
      expect(vars).toEqual({
        season: MediaSeason.SUMMER,
        seasonYear: 2024
      });
    });
    
    it('should build date range filters', () => {
      const vars = buildFilterVariables({
        startDate_greater: 20240101,
        startDate_lesser: 20241231,
        endDate_greater: 20240601,
        endDate_lesser: 20241231
      });
      expect(vars).toEqual({
        startDate_greater: 20240101,
        startDate_lesser: 20241231,
        endDate_greater: 20240601,
        endDate_lesser: 20241231
      });
    });
    
    it('should build score and popularity filters', () => {
      const vars = buildFilterVariables({
        averageScore_greater: 70,
        averageScore_lesser: 100,
        popularity_greater: 1000,
        popularity_lesser: 100000
      });
      expect(vars).toEqual({
        averageScore_greater: 70,
        averageScore_lesser: 100,
        popularity_greater: 1000,
        popularity_lesser: 100000
      });
    });
    
    it('should build content filters', () => {
      const vars = buildFilterVariables({
        countryOfOrigin: CountryOfOrigin.JP,
        tag_in: ['Shounen', 'Action'],
        tag_not_in: ['Ecchi'],
        genre_in: ['Action', 'Adventure'],
        genre_not_in: ['Horror']
      });
      expect(vars).toEqual({
        countryOfOrigin: CountryOfOrigin.JP,
        tag_in: ['Shounen', 'Action'],
        tag_not_in: ['Ecchi'],
        genre_in: ['Action', 'Adventure'],
        genre_not_in: ['Horror']
      });
    });
    
    it('should build chapter and volume filters', () => {
      const vars = buildFilterVariables({
        chapters_greater: 100,
        chapters_lesser: 500,
        volumes_greater: 10,
        volumes_lesser: 50
      });
      expect(vars).toEqual({
        chapters_greater: 100,
        chapters_lesser: 500,
        volumes_greater: 10,
        volumes_lesser: 50
      });
    });
    
    it('should handle boolean filters', () => {
      const vars = buildFilterVariables({
        isLicensed: true
      });
      expect(vars).toEqual({
        isLicensed: true
      });
    });
  });
  
  describe('FilterPresets', () => {
    it('should create trending preset', () => {
      const preset = FilterPresets.trending();
      expect(preset).toEqual({
        sort: MediaSort.TRENDING_DESC
      });
    });
    
    it('should create popular preset', () => {
      const preset = FilterPresets.popular();
      expect(preset).toEqual({
        sort: MediaSort.POPULARITY_DESC
      });
    });
    
    it('should create top rated preset', () => {
      const preset = FilterPresets.topRated(80);
      expect(preset).toEqual({
        sort: MediaSort.SCORE_DESC,
        averageScore_greater: 80
      });
    });
    
    it('should create recently updated preset', () => {
      const preset = FilterPresets.recentlyUpdated();
      expect(preset).toEqual({
        sort: MediaSort.UPDATED_AT_DESC
      });
    });
    
    it('should create new releases preset', () => {
      const preset = FilterPresets.newReleases();
      expect(preset.sort).toBe(MediaSort.START_DATE_DESC);
      expect(preset.startDate_greater).toBeDefined();
    });
    
    it('should create seasonal preset', () => {
      const preset = FilterPresets.seasonal(MediaSeason.SUMMER, 2024);
      expect(preset).toEqual({
        season: MediaSeason.SUMMER,
        seasonYear: 2024,
        sort: [MediaSort.POPULARITY_DESC, MediaSort.SCORE_DESC]
      });
    });
    
    it('should create completed manga preset', () => {
      const preset = FilterPresets.completed();
      expect(preset.sort).toBe(MediaSort.SCORE_DESC);
      expect(preset.endDate_lesser).toBeDefined();
    });
    
    it('should create ongoing manga preset', () => {
      const preset = FilterPresets.ongoing();
      expect(preset.sort).toBe(MediaSort.POPULARITY_DESC);
      expect(preset.endDate_greater).toBeDefined();
    });
    
    it('should create country filter preset', () => {
      const preset = FilterPresets.byCountry(CountryOfOrigin.KR);
      expect(preset).toEqual({
        countryOfOrigin: CountryOfOrigin.KR,
        sort: MediaSort.POPULARITY_DESC
      });
    });
    
    it('should create date range preset', () => {
      const start = new Date(2024, 0, 1); // January 1, 2024
      const end = new Date(2024, 11, 31); // December 31, 2024
      const preset = FilterPresets.dateRange(start, end);
      expect(preset).toEqual({
        startDate_greater: 20240101,
        startDate_lesser: 20241231,
        sort: MediaSort.START_DATE_DESC
      });
    });
  });
  
  describe('AdvancedSearchQueryBuilder', () => {
    let builder: AdvancedSearchQueryBuilder;
    
    beforeEach(() => {
      builder = new AdvancedSearchQueryBuilder();
    });
    
    it('should build empty filters by default', () => {
      expect(builder.build()).toEqual({});
    });
    
    it('should set sort order', () => {
      const filters = builder
        .sortBy(MediaSort.SCORE_DESC)
        .build();
      expect(filters.sort).toBe(MediaSort.SCORE_DESC);
    });
    
    it('should set multiple sort orders', () => {
      const filters = builder
        .sortBy([MediaSort.SCORE_DESC, MediaSort.POPULARITY_DESC])
        .build();
      expect(filters.sort).toEqual([MediaSort.SCORE_DESC, MediaSort.POPULARITY_DESC]);
    });
    
    it('should filter by season', () => {
      const filters = builder
        .inSeason(MediaSeason.WINTER, 2024)
        .build();
      expect(filters.season).toBe(MediaSeason.WINTER);
      expect(filters.seasonYear).toBe(2024);
    });
    
    it('should filter by score range', () => {
      const filters = builder
        .withScoreRange(70, 100)
        .build();
      expect(filters.averageScore_greater).toBe(70);
      expect(filters.averageScore_lesser).toBe(100);
    });
    
    it('should filter by genres', () => {
      const filters = builder
        .withGenres(['Action', 'Adventure'], ['Horror'])
        .build();
      expect(filters.genre_in).toEqual(['Action', 'Adventure']);
      expect(filters.genre_not_in).toEqual(['Horror']);
    });
    
    it('should filter by tags', () => {
      const filters = builder
        .withTags(['Shounen'], ['Ecchi'])
        .build();
      expect(filters.tag_in).toEqual(['Shounen']);
      expect(filters.tag_not_in).toEqual(['Ecchi']);
    });
    
    it('should filter by date range', () => {
      const start = new Date(2024, 0, 1); // January 1, 2024
      const end = new Date(2024, 11, 31); // December 31, 2024
      const filters = builder
        .startedBetween(start, end)
        .build();
      expect(filters.startDate_greater).toBe(20240101);
      expect(filters.startDate_lesser).toBe(20241231);
    });
    
    it('should filter by chapter range', () => {
      const filters = builder
        .withChapterRange(100, 500)
        .build();
      expect(filters.chapters_greater).toBe(100);
      expect(filters.chapters_lesser).toBe(500);
    });
    
    it('should filter by country', () => {
      const filters = builder
        .fromCountry(CountryOfOrigin.CN)
        .build();
      expect(filters.countryOfOrigin).toBe(CountryOfOrigin.CN);
    });
    
    it('should filter by licensed status', () => {
      const filters = builder
        .onlyLicensed(true)
        .build();
      expect(filters.isLicensed).toBe(true);
    });
    
    it('should chain multiple filters', () => {
      const filters = builder
        .sortBy(MediaSort.SCORE_DESC)
        .withScoreRange(80)
        .withGenres(['Action'])
        .fromCountry(CountryOfOrigin.JP)
        .onlyLicensed(true)
        .build();
      
      expect(filters).toEqual({
        sort: MediaSort.SCORE_DESC,
        averageScore_greater: 80,
        genre_in: ['Action'],
        countryOfOrigin: CountryOfOrigin.JP,
        isLicensed: true
      });
    });
    
    it('should build GraphQL variables', () => {
      const variables = builder
        .sortBy(MediaSort.TRENDING_DESC)
        .withScoreRange(70)
        .buildVariables();
      
      expect(variables).toEqual({
        sort: [MediaSort.TRENDING_DESC],
        averageScore_greater: 70
      });
    });
    
    it('should reset filters', () => {
      const filters = builder
        .sortBy(MediaSort.SCORE_DESC)
        .withScoreRange(80)
        .reset()
        .build();
      
      expect(filters).toEqual({});
    });
  });
});