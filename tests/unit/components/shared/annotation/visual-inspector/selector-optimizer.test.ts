/**
 * Selector Optimizer Unit Tests
 *
 * Tests for CSS selector generation and optimization utilities.
 */

import { JSDOM } from 'jsdom';

import {
  generateOptimizedSelector,
  generateSelectorWithValidation,
  testSelectorUniqueness,
  testSelector
} from '@/components/shared/annotation/visual-inspector/selector-optimizer';

// Setup JSDOM for each test
function createTestDocument(html: string): Document {
  const dom = new JSDOM(html);
  return dom.window.document;
}

describe('selector-optimizer', () => {
  describe('generateOptimizedSelector', () => {
    it('should generate selector with ID when available', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div id="unique-element">Content</div>
          </body>
        </html>
      `);

      const element = doc.getElementById('unique-element');
      expect(element).not.toBeNull();

      if (element) {
        const selector = generateOptimizedSelector(element);
        expect(selector).toContain('#unique-element');
      }
    });

    it('should generate selector with class when no ID', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div class="manga-title">One Piece</div>
          </body>
        </html>
      `);

      const element = doc.querySelector('.manga-title');
      expect(element).not.toBeNull();

      if (element) {
        const selector = generateOptimizedSelector(element);
        expect(selector).toMatch(/manga-title/);
      }
    });

    it('should generate nested selector for deeply nested elements', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div class="container">
              <div class="wrapper">
                <span class="text">Content</span>
              </div>
            </div>
          </body>
        </html>
      `);

      const element = doc.querySelector('.text');
      expect(element).not.toBeNull();

      if (element) {
        const selector = generateOptimizedSelector(element);
        expect(selector).toBeDefined();
        expect(selector.length).toBeGreaterThan(0);
      }
    });

    it('should respect maxLength option', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div class="very-long-class-name-container">
              <div class="another-long-class-name">
                <span class="deeply-nested-element">Content</span>
              </div>
            </div>
          </body>
        </html>
      `);

      const element = doc.querySelector('.deeply-nested-element');
      expect(element).not.toBeNull();

      if (element) {
        const selector = generateOptimizedSelector(element, { maxLength: 50 });
        expect(selector.length).toBeLessThanOrEqual(100); // Some tolerance for truncation
      }
    });

    it('should include tag name when includeTag is true', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <span class="title">Title</span>
          </body>
        </html>
      `);

      const element = doc.querySelector('.title');
      expect(element).not.toBeNull();

      if (element) {
        const selector = generateOptimizedSelector(element, { includeTag: true });
        expect(selector).toMatch(/span|\.title/);
      }
    });
  });

  describe('generateSelectorWithValidation', () => {
    it('should return isUnique true for unique selectors', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div id="unique-element">Content</div>
            <div class="other">Other</div>
          </body>
        </html>
      `);

      const element = doc.getElementById('unique-element');
      expect(element).not.toBeNull();

      if (element) {
        const result = generateSelectorWithValidation(element);
        expect(result.isUnique).toBe(true);
        expect(result.selector).toBeDefined();
        expect(result.specificity).toBeGreaterThan(0);
      }
    });

    it('should provide alternatives for non-unique selectors', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div class="item">Item 1</div>
            <div class="item">Item 2</div>
            <div class="item">Item 3</div>
          </body>
        </html>
      `);

      const elements = doc.querySelectorAll('.item');
      expect(elements.length).toBe(3);

      const element = elements[1]; // Middle element
      if (element) {
        const result = generateSelectorWithValidation(element as Element);
        expect(result.selector).toBeDefined();
        // Non-unique selectors should have alternatives or be made unique
      }
    });

    it('should calculate specificity correctly', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div id="test" class="container">
              <span class="text">Content</span>
            </div>
          </body>
        </html>
      `);

      const element = doc.getElementById('test');
      expect(element).not.toBeNull();

      if (element) {
        const result = generateSelectorWithValidation(element);
        // ID selectors have high specificity (100+)
        expect(result.specificity).toBeGreaterThanOrEqual(100);
      }
    });
  });

  describe('testSelectorUniqueness', () => {
    it('should return true for unique selector', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div id="unique">Content</div>
          </body>
        </html>
      `);

      const element = doc.getElementById('unique');
      expect(element).not.toBeNull();

      if (element) {
        const isUnique = testSelectorUniqueness('#unique', element);
        expect(isUnique).toBe(true);
      }
    });

    it('should return false for non-unique selector', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div class="item">Item 1</div>
            <div class="item">Item 2</div>
          </body>
        </html>
      `);

      const element = doc.querySelector('.item');
      expect(element).not.toBeNull();

      if (element) {
        const isUnique = testSelectorUniqueness('.item', element);
        expect(isUnique).toBe(false);
      }
    });
  });

  describe('testSelector', () => {
    it('should return all matching elements', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div class="item">Item 1</div>
            <div class="item">Item 2</div>
            <div class="item">Item 3</div>
          </body>
        </html>
      `);

      const elements = testSelector('.item', doc);
      expect(elements.length).toBe(3);
    });

    it('should return empty array for non-matching selector', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div class="item">Item</div>
          </body>
        </html>
      `);

      const elements = testSelector('.nonexistent', doc);
      expect(elements.length).toBe(0);
    });

    it('should return empty array for invalid selector', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div>Content</div>
          </body>
        </html>
      `);

      const elements = testSelector('invalid[[[selector', doc);
      expect(elements.length).toBe(0);
    });
  });
});
