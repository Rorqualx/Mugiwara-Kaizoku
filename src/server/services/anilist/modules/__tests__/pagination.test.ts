/**
 * Tests for AniList Pagination Support
 */

import {
  buildPaginationVariables,
  extractPaginationInfo,
  calculateOptimalPageSize,
  shouldFetchMorePages,
  fetchAllPages,
  createPaginationIterator,
  PaginationBatcher
} from '../pagination';

import type {
  PaginatedResponse,
  AniListPageInfo
} from '../pagination';

describe('AniList Pagination', () => {
  describe('buildPaginationVariables', () => {
    it('should return default values when no params provided', () => {
      const vars = buildPaginationVariables();
      expect(vars).toEqual({
        page: 1,
        perPage: 10
      });
    });
    
    it('should use provided values', () => {
      const vars = buildPaginationVariables({
        page: 3,
        perPage: 25
      });
      expect(vars).toEqual({
        page: 3,
        perPage: 25
      });
    });
    
    it('should cap perPage at 50', () => {
      const vars = buildPaginationVariables({
        page: 1,
        perPage: 100
      });
      expect(vars).toEqual({
        page: 1,
        perPage: 50
      });
    });
  });
  
  describe('extractPaginationInfo', () => {
    it('should correctly extract pagination info from AniList response', () => {
      const anilistPageInfo: AniListPageInfo = {
        total: 100,
        currentPage: 2,
        lastPage: 10,
        hasNextPage: true,
        perPage: 10
      };
      
      const info = extractPaginationInfo(anilistPageInfo);
      
      expect(info).toEqual({
        total: 100,
        currentPage: 2,
        lastPage: 10,
        hasNextPage: true,
        perPage: 10
      });
    });
  });
  
  describe('calculateOptimalPageSize', () => {
    it('should return 10 for small result sets', () => {
      expect(calculateOptimalPageSize(5)).toBe(10);
      expect(calculateOptimalPageSize(10)).toBe(10);
    });
    
    it('should return moderate size for medium result sets', () => {
      expect(calculateOptimalPageSize(30)).toBe(20);
      expect(calculateOptimalPageSize(45)).toBe(20);
    });
    
    it('should use preferred size for large result sets', () => {
      expect(calculateOptimalPageSize(100, 30)).toBe(30);
      expect(calculateOptimalPageSize(200, 50)).toBe(50);
    });
    
    it('should cap at 50 even for large preferred sizes', () => {
      expect(calculateOptimalPageSize(500, 100)).toBe(50);
    });
  });
  
  describe('shouldFetchMorePages', () => {
    it('should return true when there are more pages', () => {
      expect(shouldFetchMorePages(1, 5, Infinity, true)).toBe(true);
    });
    
    it('should return false when on last page', () => {
      expect(shouldFetchMorePages(5, 5, Infinity, false)).toBe(false);
    });
    
    it('should return false when max pages reached', () => {
      expect(shouldFetchMorePages(3, 10, 3, true)).toBe(false);
    });
    
    it('should return false when hasNextPage is false', () => {
      expect(shouldFetchMorePages(2, 5, Infinity, false)).toBe(false);
    });
  });
  
  describe('fetchAllPages', () => {
    it('should fetch all pages and combine results', async () => {
      const mockFetchPage = jest.fn<Promise<PaginatedResponse<string>>, [number]>();
      
      mockFetchPage
        .mockResolvedValueOnce({
          data: ['item1', 'item2'],
          pageInfo: {
            total: 5,
            currentPage: 1,
            lastPage: 3,
            hasNextPage: true,
            perPage: 2
          }
        })
        .mockResolvedValueOnce({
          data: ['item3', 'item4'],
          pageInfo: {
            total: 5,
            currentPage: 2,
            lastPage: 3,
            hasNextPage: true,
            perPage: 2
          }
        })
        .mockResolvedValueOnce({
          data: ['item5'],
          pageInfo: {
            total: 5,
            currentPage: 3,
            lastPage: 3,
            hasNextPage: false,
            perPage: 2
          }
        });
      
      const results = await fetchAllPages(mockFetchPage);
      
      expect(results).toEqual(['item1', 'item2', 'item3', 'item4', 'item5']);
      expect(mockFetchPage).toHaveBeenCalledTimes(3);
      expect(mockFetchPage).toHaveBeenCalledWith(1);
      expect(mockFetchPage).toHaveBeenCalledWith(2);
      expect(mockFetchPage).toHaveBeenCalledWith(3);
    });
    
    it('should respect maxPages option', async () => {
      const mockFetchPage = jest.fn<Promise<PaginatedResponse<string>>, [number]>();
      
      mockFetchPage.mockImplementation((page) => Promise.resolve({
        data: [`page${page}-item`],
        pageInfo: {
          total: 100,
          currentPage: page,
          lastPage: 10,
          hasNextPage: page < 10,
          perPage: 10
        }
      }));
      
      const results = await fetchAllPages(mockFetchPage, { maxPages: 2 });
      
      expect(results).toEqual(['page1-item', 'page2-item']);
      expect(mockFetchPage).toHaveBeenCalledTimes(2);
    });
    
    it('should call onPageFetched callback', async () => {
      const mockFetchPage = jest.fn<Promise<PaginatedResponse<string>>, [number]>();
      const onPageFetched = jest.fn();
      
      mockFetchPage.mockResolvedValueOnce({
        data: ['item1'],
        pageInfo: {
          total: 1,
          currentPage: 1,
          lastPage: 1,
          hasNextPage: false,
          perPage: 10
        }
      });
      
      await fetchAllPages(mockFetchPage, { onPageFetched });
      
      expect(onPageFetched).toHaveBeenCalledWith(
        1,
        ['item1'],
        expect.objectContaining({
          total: 1,
          currentPage: 1,
          lastPage: 1,
          hasNextPage: false,
          perPage: 10
        })
      );
    });
    
    it('should add delay between pages when specified', async () => {
      const mockFetchPage = jest.fn<Promise<PaginatedResponse<string>>, [number]>();
      
      mockFetchPage
        .mockResolvedValueOnce({
          data: ['item1'],
          pageInfo: {
            total: 2,
            currentPage: 1,
            lastPage: 2,
            hasNextPage: true,
            perPage: 1
          }
        })
        .mockResolvedValueOnce({
          data: ['item2'],
          pageInfo: {
            total: 2,
            currentPage: 2,
            lastPage: 2,
            hasNextPage: false,
            perPage: 1
          }
        });
      
      const startTime = Date.now();
      await fetchAllPages(mockFetchPage, { delayBetweenPages: 100 });
      const duration = Date.now() - startTime;

      // Allow ~10ms slack for setTimeout drift under heavy CI load
      expect(duration).toBeGreaterThanOrEqual(90);
      expect(mockFetchPage).toHaveBeenCalledTimes(2);
    });
    
    it('should handle errors based on stopOnError option', async () => {
      const mockFetchPage = jest.fn<Promise<PaginatedResponse<string>>, [number]>();
      
      mockFetchPage
        .mockResolvedValueOnce({
          data: ['item1'],
          pageInfo: {
            total: 3,
            currentPage: 1,
            lastPage: 3,
            hasNextPage: true,
            perPage: 1
          }
        })
        .mockRejectedValueOnce(new Error('Network error'));
      
      // With stopOnError: false (default)
      const results = await fetchAllPages(mockFetchPage);
      expect(results).toEqual(['item1']);
      
      // Reset mock
      mockFetchPage.mockClear();
      mockFetchPage
        .mockResolvedValueOnce({
          data: ['item1'],
          pageInfo: {
            total: 3,
            currentPage: 1,
            lastPage: 3,
            hasNextPage: true,
            perPage: 1
          }
        })
        .mockRejectedValueOnce(new Error('Network error'));
      
      // With stopOnError: true
      await expect(
        fetchAllPages(mockFetchPage, { stopOnError: true })
      ).rejects.toThrow('Network error');
    });
  });
  
  describe('createPaginationIterator', () => {
    it('should yield pages one by one', async () => {
      const mockFetchPage = jest.fn<Promise<PaginatedResponse<string>>, [number]>();
      
      mockFetchPage
        .mockResolvedValueOnce({
          data: ['item1', 'item2'],
          pageInfo: {
            total: 4,
            currentPage: 1,
            lastPage: 2,
            hasNextPage: true,
            perPage: 2
          }
        })
        .mockResolvedValueOnce({
          data: ['item3', 'item4'],
          pageInfo: {
            total: 4,
            currentPage: 2,
            lastPage: 2,
            hasNextPage: false,
            perPage: 2
          }
        });
      
      const pages: string[][] = [];
      for await (const page of createPaginationIterator(mockFetchPage)) {
        pages.push(page);
      }
      
      expect(pages).toEqual([
        ['item1', 'item2'],
        ['item3', 'item4']
      ]);
    });
  });
  
  describe('PaginationBatcher', () => {
    it('should batch multiple queries', async () => {
      const batcher = new PaginationBatcher(50);
      const mockFetch = jest.fn().mockResolvedValue('result');
      
      const promise1 = batcher.addQuery('key1', mockFetch);
      const promise2 = batcher.addQuery('key1', mockFetch);
      const promise3 = batcher.addQuery('key1', mockFetch);
      
      const results = await Promise.all([promise1, promise2, promise3]);
      
      expect(results).toEqual(['result', 'result', 'result']);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only called once despite 3 queries
    });
    
    it('should handle errors in batch', async () => {
      const batcher = new PaginationBatcher(50);
      const mockFetch = jest.fn().mockRejectedValue(new Error('Batch error'));

      const promise1 = batcher.addQuery('key1', mockFetch);
      const promise2 = batcher.addQuery('key1', mockFetch);

      // Use Promise.allSettled to handle rejections without unhandled promise rejection warnings
      const results = await Promise.allSettled([promise1, promise2]);

      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('rejected');

      if (results[0].status === 'rejected') {
        expect(results[0].reason).toEqual(new Error('Batch error'));
      }
      if (results[1].status === 'rejected') {
        expect(results[1].reason).toEqual(new Error('Batch error'));
      }

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
    
    it('should clear pending queries', () => {
      const batcher = new PaginationBatcher(1000); // Long delay
      const mockFetch = jest.fn().mockResolvedValue('result');

      void batcher.addQuery('key1', mockFetch);
      batcher.clear();

      // Fetch should not be called after clear
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});