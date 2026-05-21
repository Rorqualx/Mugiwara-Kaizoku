/**
 * Tests for URL normalization utilities
 *
 * @module url-normalization.test
 */

import {
  isValidUrl,
  normalizeUrlForComparison,
  resolveHrefSafe,
  resolveUrlSafe,
} from '../url-normalization';

describe('normalizeUrlForComparison', () => {
  it('should strip query parameters', () => {
    const result = normalizeUrlForComparison('https://example.com/path?query=1&other=2');
    expect(result).toBe('https://example.com/path');
  });

  it('should strip fragments', () => {
    const result = normalizeUrlForComparison('https://example.com/path#section');
    expect(result).toBe('https://example.com/path');
  });

  it('should strip both query params and fragments', () => {
    const result = normalizeUrlForComparison('https://example.com/path?q=1#anchor');
    expect(result).toBe('https://example.com/path');
  });

  it('should remove trailing slash (except for root)', () => {
    expect(normalizeUrlForComparison('https://example.com/path/')).toBe('https://example.com/path');
    expect(normalizeUrlForComparison('https://example.com/deep/path/')).toBe(
      'https://example.com/deep/path'
    );
  });

  it('should keep trailing slash for root path', () => {
    expect(normalizeUrlForComparison('https://example.com/')).toBe('https://example.com/');
  });

  it('should normalize protocol to https', () => {
    expect(normalizeUrlForComparison('http://example.com/path')).toBe('https://example.com/path');
  });

  it('should lowercase the URL', () => {
    expect(normalizeUrlForComparison('https://EXAMPLE.COM/Path')).toBe('https://example.com/path');
  });

  it('should handle invalid URLs by returning lowercase trimmed input', () => {
    expect(normalizeUrlForComparison('not-a-url')).toBe('not-a-url');
    expect(normalizeUrlForComparison('  spaces  ')).toBe('spaces');
  });

  it('should handle complex real-world URLs', () => {
    const fandomUrl = 'https://one-piece.fandom.com/wiki/Chapters?action=edit#Notes';
    expect(normalizeUrlForComparison(fandomUrl)).toBe('https://one-piece.fandom.com/wiki/chapters');
  });
});

describe('isValidUrl', () => {
  it('should return true for valid URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com/path')).toBe(true);
    expect(isValidUrl('https://sub.example.com:8080/path?q=1#hash')).toBe(true);
  });

  it('should return false for invalid URLs', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('//example.com')).toBe(false); // Protocol-relative is invalid for URL constructor
  });
});

describe('resolveHrefSafe', () => {
  const baseUrl = 'https://wiki.example.com';
  const pageUrl = 'https://wiki.example.com/wiki/Category/Page';

  it('should return null for anchor-only links', () => {
    expect(resolveHrefSafe('#section', baseUrl, pageUrl)).toBeNull();
    expect(resolveHrefSafe('#', baseUrl, pageUrl)).toBeNull();
  });

  it('should resolve absolute paths', () => {
    expect(resolveHrefSafe('/wiki/Other', baseUrl, pageUrl)).toBe(
      'https://wiki.example.com/wiki/Other'
    );
  });

  it('should pass through full URLs', () => {
    expect(resolveHrefSafe('https://other.com/page', baseUrl, pageUrl)).toBe(
      'https://other.com/page'
    );
    expect(resolveHrefSafe('http://other.com/page', baseUrl, pageUrl)).toBe(
      'http://other.com/page'
    );
  });

  it('should resolve simple relative paths', () => {
    expect(resolveHrefSafe('Sibling', baseUrl, pageUrl)).toBe(
      'https://wiki.example.com/wiki/Category/Sibling'
    );
  });

  it('should resolve parent relative paths (../../)', () => {
    // Key bug fix: ../../ paths should work correctly
    expect(resolveHrefSafe('../Other', baseUrl, pageUrl)).toBe(
      'https://wiki.example.com/wiki/Other'
    );
    expect(resolveHrefSafe('../../Root', baseUrl, pageUrl)).toBe(
      'https://wiki.example.com/Root'
    );
  });

  it('should handle complex relative paths', () => {
    const deepPage = 'https://wiki.example.com/a/b/c/d/page';
    expect(resolveHrefSafe('../../../other', baseUrl, deepPage)).toBe(
      'https://wiki.example.com/a/other'
    );
  });

  it('should fallback gracefully for malformed inputs', () => {
    expect(resolveHrefSafe('/path', baseUrl, 'invalid-url')).toBe('https://wiki.example.com/path');
    expect(resolveHrefSafe('https://valid.com', baseUrl, 'invalid-url')).toBe('https://valid.com');
  });
});

describe('resolveUrlSafe', () => {
  const baseUrl = 'https://wiki.example.com/wiki/Page';

  it('should return undefined for undefined input', () => {
    expect(resolveUrlSafe(undefined, baseUrl)).toBeUndefined();
  });

  it('should handle protocol-relative URLs', () => {
    expect(resolveUrlSafe('//cdn.example.com/image.jpg', baseUrl)).toBe(
      'https://cdn.example.com/image.jpg'
    );
  });

  it('should resolve absolute paths', () => {
    expect(resolveUrlSafe('/other/path', baseUrl)).toBe('https://wiki.example.com/other/path');
  });

  it('should resolve relative paths', () => {
    expect(resolveUrlSafe('sibling', baseUrl)).toBe('https://wiki.example.com/wiki/sibling');
  });

  it('should pass through full URLs', () => {
    expect(resolveUrlSafe('https://other.com/page', baseUrl)).toBe('https://other.com/page');
  });

  it('should resolve complex relative paths with ../', () => {
    expect(resolveUrlSafe('../other', baseUrl)).toBe('https://wiki.example.com/other');
    expect(resolveUrlSafe('../../root', baseUrl)).toBe('https://wiki.example.com/root');
  });

  it('should handle protocol-relative with http base', () => {
    expect(resolveUrlSafe('//cdn.example.com/img.jpg', 'http://example.com/page')).toBe(
      'http://cdn.example.com/img.jpg'
    );
  });

  it('should return input as-is for malformed base URLs', () => {
    // When base URL is invalid, we can't resolve, so return as-is
    expect(resolveUrlSafe('relative', 'not-a-url')).toBe('relative');
  });
});
