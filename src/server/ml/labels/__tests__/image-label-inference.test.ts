/**
 * Image Label Inference Tests
 *
 * Unit tests for the image label inference module that automatically
 * classifies images from LinearizedToken data.
 *
 * @module ml/labels/__tests__/image-label-inference.test
 */

import { describe, it, expect } from '@jest/globals';

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import {
  inferImageLabel,
  inferImageLabelsForTokens,
  computeImageStats,
} from '../image-label-inference';

// ============================================================================
// Test Utilities
// ============================================================================

function createMockImageToken(overrides: Partial<LinearizedToken> = {}): LinearizedToken {
  return {
    id: 'test-token-1',
    text: '',
    tagName: 'IMG',
    xpath: '/html/body/img',
    isImage: true,
    imageSrc: 'https://example.com/image.jpg',
    imageAlt: 'Test image',
    imageWidth: 200,
    imageHeight: 200,
    isInInfobox: false,
    isInTable: false,
    sectionType: 'main_content',
    precedingText: '',
    followingText: '',
    ...overrides,
  } as LinearizedToken;
}

function createMockTextToken(overrides: Partial<LinearizedToken> = {}): LinearizedToken {
  return {
    id: 'test-token-2',
    text: 'Sample text',
    tagName: 'SPAN',
    xpath: '/html/body/span',
    isImage: false,
    imageSrc: null,
    imageAlt: null,
    imageWidth: null,
    imageHeight: null,
    isInInfobox: false,
    isInTable: false,
    sectionType: 'main_content',
    precedingText: '',
    followingText: '',
    ...overrides,
  } as LinearizedToken;
}

// ============================================================================
// inferImageLabel Tests
// ============================================================================

describe('inferImageLabel', () => {
  describe('basic functionality', () => {
    it('should return null for non-image tokens', () => {
      const textToken = createMockTextToken();
      const result = inferImageLabel(textToken, 0);
      expect(result).toBeNull();
    });

    it('should return null for image tokens without src', () => {
      const token = createMockImageToken({ imageSrc: null });
      const result = inferImageLabel(token, 0);
      expect(result).toBeNull();
    });

    it('should return a valid label for image tokens with src', () => {
      const token = createMockImageToken();
      const result = inferImageLabel(token, 0);

      expect(result).not.toBeNull();
      expect(result?.label).toBeDefined();
      expect(result?.label.imageType).toBeDefined();
      expect(result?.label.quality).toBeDefined();
      expect(result?.label.contentType).toBeDefined();
      expect(typeof result?.label.isRelevant).toBe('boolean');
      expect(result?.confidence).toBeGreaterThan(0);
    });
  });

  describe('image type inference', () => {
    it('should identify cover images in infobox', () => {
      const token = createMockImageToken({
        isInInfobox: true,
        imageWidth: 300,
        imageHeight: 400,
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.imageType).toBe('COVER');
      expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should identify cover images from URL patterns', () => {
      const token = createMockImageToken({
        imageSrc: 'https://example.com/manga/cover-art.jpg',
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.imageType).toBe('COVER');
    });

    it('should identify volume covers from URL patterns', () => {
      const token = createMockImageToken({
        imageSrc: 'https://example.com/manga/volume5.jpg',
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.imageType).toBe('VOLUME_COVER');
    });

    it('should identify character images from URL patterns', () => {
      const token = createMockImageToken({
        imageSrc: 'https://example.com/character/luffy.jpg',
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.imageType).toBe('CHARACTER');
    });

    it('should identify screenshots from URL patterns', () => {
      const token = createMockImageToken({
        imageSrc: 'https://example.com/anime/screenshot-ep10.jpg',
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.imageType).toBe('SCREENSHOT');
    });

    it('should identify logos from URL patterns', () => {
      const token = createMockImageToken({
        imageSrc: 'https://example.com/brand-logo.png',
        imageWidth: 80,
        imageHeight: 80,
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.imageType).toBe('LOGO');
    });

    it('should identify icons from small dimensions', () => {
      const token = createMockImageToken({
        imageSrc: 'https://example.com/ui/icon.png',
        imageWidth: 32,
        imageHeight: 32,
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.imageType).toBe('ICON');
    });

    it('should identify banners from aspect ratio', () => {
      const token = createMockImageToken({
        imageSrc: 'https://example.com/site-header.jpg',
        imageWidth: 1200,
        imageHeight: 200,
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.imageType).toBe('BANNER');
    });
  });

  describe('quality tier inference', () => {
    it('should mark high quality for large images', () => {
      const token = createMockImageToken({
        imageWidth: 500,
        imageHeight: 500,
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.quality).toBe('HIGH');
    });

    it('should mark medium quality for medium images', () => {
      const token = createMockImageToken({
        imageWidth: 200,
        imageHeight: 200,
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.quality).toBe('MEDIUM');
    });

    it('should mark low quality for small images', () => {
      const token = createMockImageToken({
        imageWidth: 80,
        imageHeight: 80,
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.quality).toBe('LOW');
    });

    it('should mark exclude for very small images', () => {
      const token = createMockImageToken({
        imageWidth: 30,
        imageHeight: 30,
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.quality).toBe('EXCLUDE');
    });

    it('should default to medium when dimensions unknown', () => {
      const token = createMockImageToken({
        imageWidth: null,
        imageHeight: null,
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.quality).toBe('MEDIUM');
    });
  });

  describe('content type inference', () => {
    it('should identify photographs from alt text', () => {
      const token = createMockImageToken({
        imageAlt: 'Author photograph at interview',
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.contentType).toBe('PHOTOGRAPH');
    });

    it('should identify diagrams from alt text', () => {
      const token = createMockImageToken({
        imageAlt: 'Character relationship diagram',
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.contentType).toBe('DIAGRAM');
    });

    it('should identify decorative elements from URL', () => {
      const token = createMockImageToken({
        imageSrc: 'https://example.com/background-pattern.png',
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.contentType).toBe('DECORATIVE');
    });

    it('should default to artwork for manga content', () => {
      const token = createMockImageToken({
        imageSrc: 'https://example.com/manga/page.jpg',
        imageAlt: 'Manga scene',
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.contentType).toBe('ARTWORK');
    });
  });

  describe('relevance determination', () => {
    it('should mark cover images as relevant', () => {
      const token = createMockImageToken({
        isInInfobox: true,
        imageWidth: 300,
        imageHeight: 400,
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.isRelevant).toBe(true);
    });

    it('should mark character images as relevant', () => {
      const token = createMockImageToken({
        imageSrc: 'https://example.com/character/main.jpg',
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.isRelevant).toBe(true);
    });

    it('should mark icons as not relevant', () => {
      const token = createMockImageToken({
        imageSrc: 'https://example.com/ui/icon.png',
        imageWidth: 32,
        imageHeight: 32,
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.isRelevant).toBe(false);
    });

    it('should mark logos as not relevant', () => {
      const token = createMockImageToken({
        imageSrc: 'https://example.com/site-logo.png',
        imageWidth: 80,
        imageHeight: 40,
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.isRelevant).toBe(false);
    });
  });

  describe('caption extraction', () => {
    it('should extract meaningful alt text as caption', () => {
      const token = createMockImageToken({
        imageAlt: 'Luffy using Gear Fifth in battle',
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.caption).toBe('Luffy using Gear Fifth in battle');
    });

    it('should not use generic alt text as caption', () => {
      const token = createMockImageToken({
        imageAlt: 'image',
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.caption).toBeUndefined();
    });

    it('should use following text as caption if alt is missing', () => {
      const token = createMockImageToken({
        imageAlt: '',
        followingText: 'Figure 1: Main character design',
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.caption).toBe('Figure 1: Main character design');
    });
  });

  describe('improved alt generation', () => {
    it('should generate improved alt for images with generic alt', () => {
      const token = createMockImageToken({
        isInInfobox: true,
        imageWidth: 300,
        imageHeight: 400,
        imageAlt: 'img',
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.improvedAlt).toBeDefined();
      expect(result?.label.improvedAlt).toContain('cover');
    });

    it('should not generate improved alt if existing alt is good', () => {
      const token = createMockImageToken({
        imageAlt: 'One Piece Volume 100 Cover Art featuring Luffy',
      });
      const result = inferImageLabel(token, 0);

      expect(result?.label.improvedAlt).toBeUndefined();
    });
  });
});

// ============================================================================
// inferImageLabelsForTokens Tests
// ============================================================================

describe('inferImageLabelsForTokens', () => {
  it('should return empty array for tokens with no images', () => {
    const tokens = [
      createMockTextToken({ id: '1' }),
      createMockTextToken({ id: '2' }),
      createMockTextToken({ id: '3' }),
    ];
    const labels = inferImageLabelsForTokens(tokens);

    expect(labels).toHaveLength(0);
  });

  it('should return labels only for image tokens', () => {
    const tokens = [
      createMockTextToken({ id: '1' }),
      createMockImageToken({ id: '2' }),
      createMockTextToken({ id: '3' }),
      createMockImageToken({ id: '4' }),
    ];
    const labels = inferImageLabelsForTokens(tokens);

    expect(labels).toHaveLength(2);
    expect(labels[0]?.tokenId).toBe('2');
    expect(labels[1]?.tokenId).toBe('4');
  });

  it('should include token index in labels', () => {
    const tokens = [
      createMockTextToken({ id: '1' }),
      createMockImageToken({ id: '2' }),
      createMockTextToken({ id: '3' }),
    ];
    const labels = inferImageLabelsForTokens(tokens);

    expect(labels).toHaveLength(1);
    expect(labels[0]?.tokenIndex).toBe(1);
  });

  it('should skip image tokens without src', () => {
    const tokens = [
      createMockImageToken({ id: '1', imageSrc: null }),
      createMockImageToken({ id: '2', imageSrc: 'https://example.com/img.jpg' }),
    ];
    const labels = inferImageLabelsForTokens(tokens);

    expect(labels).toHaveLength(1);
    expect(labels[0]?.tokenId).toBe('2');
  });
});

// ============================================================================
// computeImageStats Tests
// ============================================================================

describe('computeImageStats', () => {
  it('should return zero stats for empty labels', () => {
    const stats = computeImageStats([]);

    expect(stats.total).toBe(0);
    expect(stats.relevant).toBe(0);
    expect(stats.irrelevant).toBe(0);
    expect(Object.keys(stats.byType)).toHaveLength(0);
    expect(Object.keys(stats.byQuality)).toHaveLength(0);
  });

  it('should count total images', () => {
    const tokens = [
      createMockImageToken({ id: '1' }),
      createMockImageToken({ id: '2' }),
      createMockImageToken({ id: '3' }),
    ];
    const labels = inferImageLabelsForTokens(tokens);
    const stats = computeImageStats(labels);

    expect(stats.total).toBe(3);
  });

  it('should count by image type', () => {
    const tokens = [
      createMockImageToken({ id: '1', isInInfobox: true, imageWidth: 300, imageHeight: 400 }),
      createMockImageToken({ id: '2', imageSrc: 'https://example.com/character/a.jpg' }),
      createMockImageToken({ id: '3', imageSrc: 'https://example.com/character/b.jpg' }),
    ];
    const labels = inferImageLabelsForTokens(tokens);
    const stats = computeImageStats(labels);

    expect(stats.byType['COVER']).toBe(1);
    expect(stats.byType['CHARACTER']).toBe(2);
  });

  it('should count by quality tier', () => {
    const tokens = [
      createMockImageToken({ id: '1', imageWidth: 500, imageHeight: 500 }),
      createMockImageToken({ id: '2', imageWidth: 200, imageHeight: 200 }),
      createMockImageToken({ id: '3', imageWidth: 80, imageHeight: 80 }),
    ];
    const labels = inferImageLabelsForTokens(tokens);
    const stats = computeImageStats(labels);

    expect(stats.byQuality['HIGH']).toBe(1);
    expect(stats.byQuality['MEDIUM']).toBe(1);
    expect(stats.byQuality['LOW']).toBe(1);
  });

  it('should count relevant vs irrelevant', () => {
    const tokens = [
      createMockImageToken({ id: '1', isInInfobox: true, imageWidth: 300, imageHeight: 400 }),
      createMockImageToken({ id: '2', imageSrc: 'https://example.com/ui/icon.png', imageWidth: 32, imageHeight: 32 }),
    ];
    const labels = inferImageLabelsForTokens(tokens);
    const stats = computeImageStats(labels);

    expect(stats.relevant).toBe(1);
    expect(stats.irrelevant).toBe(1);
  });

  it('should count images with captions', () => {
    const tokens = [
      createMockImageToken({ id: '1', imageAlt: 'A detailed description of the scene' }),
      createMockImageToken({ id: '2', imageAlt: 'img' }),
    ];
    const labels = inferImageLabelsForTokens(tokens);
    const stats = computeImageStats(labels);

    expect(stats.withCaptions).toBe(1);
  });

  it('should count images with improved alt', () => {
    const tokens = [
      createMockImageToken({ id: '1', isInInfobox: true, imageWidth: 300, imageHeight: 400, imageAlt: 'img' }),
      createMockImageToken({ id: '2', imageAlt: 'Detailed alt that needs no improvement' }),
    ];
    const labels = inferImageLabelsForTokens(tokens);
    const stats = computeImageStats(labels);

    expect(stats.withImprovedAlt).toBe(1);
  });
});
