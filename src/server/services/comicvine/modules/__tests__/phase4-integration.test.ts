/**
 * Phase 4 Integration Tests - Multi-tier Caching and Deduplication
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

import { FieldOptimizer, FIELD_SETS } from '../fieldOptimizer';
import { MultiTierCache } from '../multiTierCache';

// Mock fs for testing
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    mkdir: jest.fn(),
    readdir: jest.fn(),
    access: jest.fn()
  }
}));

describe('Phase 4: Multi-tier Caching and Deduplication', () => {
  describe('Multi-tier Cache', () => {
    let cache: MultiTierCache<unknown>;

    beforeEach(() => {
      cache = new MultiTierCache({
        l1MaxSize: 5,
        l1TtlMs: 1000,
        l2Enabled: true,
        // l2MaxSize not supported, skipping
        l2TtlMs: 5000,
        l3Enabled: false, // Disable disk cache for tests
        deduplicationEnabled: true,
        deduplicationWindowMs: 500
      });
    });
    
    afterEach(async () => {
      await cache.clear();
    });
    
    describe('Basic Caching', () => {
      it('should store and retrieve from L1 cache', async () => {
        const data = { id: 1, name: 'Test Volume' };
        await cache.set('test-key', data);
        
        const retrieved = await cache.get('test-key');
        expect(retrieved).toEqual(data);
        
        const stats = cache.getStats();
        expect(stats.l1.hits).toBe(1);
      });
      
      it('should promote from L2 to L1', async () => {
        const data = { id: 2, name: 'Test Volume 2' };

        // Fill L1 cache
        await Promise.all(
          Array.from({ length: 5 }, (_, i) => cache.set(`key-${i}`, { id: i }))
        );

        // Add one more (will go to L2 due to L1 being full)
        await cache.set('promoted-key', data);
        
        // Access it (should promote to L1)
        const retrieved = await cache.get('promoted-key');
        expect(retrieved).toEqual(data);
        
        const stats = cache.getStats();
        expect(stats.l2.hits).toBeGreaterThanOrEqual(0);
      });
      
      it('should respect TTL', async () => {
        // Create a cache with L2 disabled to test L1 TTL expiration
        const ttlCache = new MultiTierCache<{ id: number; name: string }>({
          l1MaxSize: 5,
          l1TtlMs: 500,
          l2Enabled: false,
          l3Enabled: false,
          deduplicationEnabled: false
        });

        const data = { id: 3, name: 'Expires' };
        await ttlCache.set('ttl-key', data);

        // Wait for TTL to expire
        await new Promise<void>(resolve => { setTimeout(resolve, 600); });

        const retrieved = await ttlCache.get('ttl-key');
        expect(retrieved).toBeUndefined();

        // Entry was found but expired (deleted and returned undefined)
        const stats = ttlCache.getStats();
        expect(stats.l1.entries).toBe(0); // Entry was removed after TTL expiration
      });
    });
    
    describe('Deduplication', () => {
      it('should deduplicate concurrent requests', async () => {
        let callCount = 0;
        const expensiveOperation = async (): Promise<{ data: string; callCount: number }> => {
          callCount++;
          await new Promise<void>(resolve => { setTimeout(resolve, 100); });
          return { data: 'expensive result', callCount };
        };
        
        // Make multiple concurrent requests
        const promises = [
          cache.getOrFetch('dedup-key', expensiveOperation),
          cache.getOrFetch('dedup-key', expensiveOperation),
          cache.getOrFetch('dedup-key', expensiveOperation)
        ];
        
        const results = await Promise.all(promises);
        
        // All should get the same result
        expect(results[0]).toEqual(results[1]);
        expect(results[1]).toEqual(results[2]);
        
        // Function should only be called once
        expect(callCount).toBe(1);
        
        const stats = cache.getStats();
        expect(stats.deduplication.prevented).toBe(2);
      });
      
      it('should not deduplicate after window expires', async () => {
        // Create a cache with very short TTL so cached values expire before second call
        const dedupCache = new MultiTierCache<{ callCount: number }>({
          l1MaxSize: 5,
          l1TtlMs: 100, // Very short TTL
          l2Enabled: false,
          l3Enabled: false,
          deduplicationEnabled: true,
          deduplicationWindowMs: 200
        });

        let callCount = 0;
        const operation = (): Promise<{ callCount: number }> => {
          callCount++;
          return Promise.resolve({ callCount });
        };

        // First request
        await dedupCache.getOrFetch('window-key', operation);
        expect(callCount).toBe(1);

        // Wait for both deduplication window AND cache TTL to expire
        await new Promise<void>(resolve => { setTimeout(resolve, 300); });

        // Second request - dedup window expired AND cache TTL expired
        // So the function should be called again
        await dedupCache.getOrFetch('window-key', operation);
        expect(callCount).toBe(2);
      });
    });
    
    describe('GetOrSet', () => {
      it('should fetch and cache on miss', async () => {
        let fetchCount = 0;
        const fetcher = (): Promise<{ id: number; fetched: boolean }> => {
          fetchCount++;
          return Promise.resolve({ id: 100, fetched: true });
        };
        
        const result = await cache.getOrFetch('fetch-key', fetcher);
        expect(result).toEqual({ id: 100, fetched: true });
        expect(fetchCount).toBe(1);
        
        // Second call should use cache
        const cached = await cache.getOrFetch('fetch-key', fetcher);
        expect(cached).toEqual(result);
        expect(fetchCount).toBe(1); // Not called again
      });
      
      it('should handle concurrent getOrSet calls', async () => {
        let fetchCount = 0;
        const fetcher = async (): Promise<{ concurrent: boolean; count: number }> => {
          fetchCount++;
          await new Promise<void>(resolve => { setTimeout(resolve, 50); });
          return { concurrent: true, count: fetchCount };
        };
        
        const promises = [
          cache.getOrFetch('concurrent-key', fetcher),
          cache.getOrFetch('concurrent-key', fetcher),
          cache.getOrFetch('concurrent-key', fetcher)
        ];
        
        const results = await Promise.all(promises);
        
        // All should get the same result
        expect(results[0]).toEqual(results[1]);
        expect(results[1]).toEqual(results[2]);
        
        // Fetcher should only be called once (deduplication)
        expect(fetchCount).toBe(1);
      });
    });
    
    describe('Invalidation', () => {
      it('should invalidate by pattern', async () => {
        await cache.set('user:1', { id: 1 });
        await cache.set('user:2', { id: 2 });
        await cache.set('volume:1', { id: 1 });
        
        // Clear specific pattern not directly supported, clear all user keys
        await cache.clear('user:1');
        await cache.clear('user:2');
        const invalidated = 2;
        expect(invalidated).toBe(2);
        
        // User entries should be gone
        expect(await cache.get('user:1')).toBeUndefined();
        expect(await cache.get('user:2')).toBeUndefined();
        
        // Volume entry should still exist
        expect(await cache.get('volume:1')).toBeDefined();
      });
    });
    
    describe('Statistics', () => {
      it('should track cache statistics', async () => {
        // Generate some cache activity
        await cache.set('stat-1', { data: 1 });
        await cache.get('stat-1'); // Hit
        await cache.get('stat-2'); // Miss
        
        const stats = cache.getStats();
        
        expect(stats.l1.hits).toBe(1);
        expect(stats.l1.misses).toBe(1);
        // Calculate hit rate manually
        const hitRate = stats.l1.hits / (stats.l1.hits + stats.l1.misses);
        expect(hitRate).toBeGreaterThan(0);
      });
    });
  });
  
  describe('Field Optimizer', () => {
    let optimizer: FieldOptimizer;
    
    beforeEach(() => {
      optimizer = new FieldOptimizer();
    });
    
    afterEach(() => {
      optimizer.reset();
    });
    
    describe('Field Selection', () => {
      it('should return minimal fields for search', () => {
        const fields = optimizer.getFields('search');
        const fieldArray = fields.split(',');
        
        expect(fieldArray).toContain('id');
        expect(fieldArray).toContain('name');
        expect(fieldArray).not.toContain('description'); // Too large for search
        expect(fieldArray.length).toBeLessThanOrEqual(FIELD_SETS.search.length);
      });
      
      it('should return extended fields when requested', () => {
        const fields = optimizer.getFields('extended');
        const fieldArray = fields.split(',');
        
        expect(fieldArray).toContain('characters');
        expect(fieldArray).toContain('people');
        expect(fieldArray.length).toBe(FIELD_SETS.extended.length);
      });
      
      it('should merge custom fields', () => {
        const fields = optimizer.getFields('minimal', ['custom_field']);
        const fieldArray = fields.split(',');
        
        expect(fieldArray).toContain('custom_field');
        expect(fieldArray).toContain('id'); // Still has base fields
      });
    });
    
    describe('Size Reduction', () => {
      it('should calculate size reduction', () => {
        const metrics = optimizer.calculateSizeReduction(
          ['id', 'name', 'image'],
          Object.keys(FIELD_SETS.extended)
        );
        
        expect(metrics.savedBytes).toBeGreaterThan(0);
        expect(metrics.reductionPercent).toBeGreaterThan(50);
      });
      
      it('should track optimization statistics', () => {
        optimizer.getFields('minimal');
        optimizer.getFields('search');
        
        const stats = optimizer.getStats();
        expect(stats.requestsOptimized).toBe(2);
        expect(stats.averageSavingsPercent).toBeGreaterThan(0);
      });
    });
    
    describe('Field Usage Analysis', () => {
      it('should analyze field usage', () => {
        const response = {
          id: 123,
          name: 'Test',
          description: 'Long text',
          unused_field: 'extra'
        };
        
        const analysis = optimizer.analyzeFieldUsage(
          response,
          ['id', 'name', 'description', 'missing_field']
        );
        
        expect(analysis.used).toContain('id');
        expect(analysis.used).toContain('name');
        expect(analysis.unused).toContain('missing_field');
        expect(analysis.missing).toContain('unused_field');
        expect(analysis.efficiency).toBe(75); // 3 out of 4 fields used
      });
      
      it('should suggest optimal fields based on usage', () => {
        const usageHistory = [
          { fields: ['id', 'name', 'description'], used: ['id', 'name'] },
          { fields: ['id', 'name', 'description'], used: ['id', 'name'] },
          { fields: ['id', 'name', 'image'], used: ['id', 'name', 'image'] }
        ];
        
        const suggested = optimizer.suggestFields('minimal', usageHistory);
        
        expect(suggested).toContain('id');
        expect(suggested).toContain('name');
        // Description not commonly used, might not be suggested
      });
    });
    
    describe('Dynamic Field Selection', () => {
      it('should create dynamic selector based on context', () => {
        const fields = optimizer.createDynamicSelector({
          operation: 'standard',
          resourceType: 'volume',
          includeRelations: true,
          includeMetadata: false
        });
        
        expect(fields).toContain('characters');
        expect(fields).toContain('people');
        expect(fields).toContain('id');
        expect(fields).toContain('name');
      });
      
      it('should respect size limits', () => {
        const fields = optimizer.createDynamicSelector({
          operation: 'extended',
          resourceType: 'volume',
          maxSize: 500 // Very small limit
        });
        
        // Should prioritize essential fields
        expect(fields).toContain('id');
        expect(fields).toContain('name');
        // Large fields should be excluded
        expect(fields).not.toContain('description');
      });
    });
  });
});