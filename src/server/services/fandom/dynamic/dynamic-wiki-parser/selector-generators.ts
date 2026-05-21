/**
 * Dynamic Wiki Parser - Selector Generators Module
 *
 * Generates CSS selector strategies for different wiki structures.
 * Each generator returns prioritized selectors for specific content types.
 *
 * Extracted from: DynamicWikiParser.ts (lines 1362-1553)
 */

import { type SelectorStrategy } from './types';

import type { CheerioAPI } from 'cheerio';


// Table Selectors
/** Generate selectors for table-based structures */
export function generateTableSelectors(_$: CheerioAPI): SelectorStrategy[] {
  return [
    {
      selector: 'table:not(.navbox):not(.infobox)',
      type: 'css',
      priority: 1,
      confidence: 0.9,
      extractionMethod: 'html'
    },
    {
      selector: 'table:has(th:contains("Volume"))',
      type: 'css',
      priority: 2,
      confidence: 0.95,
      extractionMethod: 'html'
    }
  ];
}

// Tabbed Interface Selectors
/** Generate selectors for tabbed content interfaces */
export function generateTabbedSelectors(_$: CheerioAPI): SelectorStrategy[] {
  return [
    {
      selector: '.tabbertab',
      type: 'css',
      priority: 1,
      confidence: 0.9,
      extractionMethod: 'html'
    },
    {
      selector: '.wds-tab__content',
      type: 'css',
      priority: 2,
      confidence: 0.85,
      extractionMethod: 'html'
    }
  ];
}

// Definition List Selectors
/** Generate selectors for definition list structures */
export function generateDefinitionListSelectors(_$: CheerioAPI): SelectorStrategy[] {
  return [
    {
      selector: 'dl',
      type: 'css',
      priority: 1,
      confidence: 0.8,
      extractionMethod: 'html'
    }
  ];
}

// Gallery Selectors
/** Generate selectors for gallery content */
export function generateGallerySelectors(_$: CheerioAPI): SelectorStrategy[] {
  return [
    {
      selector: '.gallery',
      type: 'css',
      priority: 1,
      confidence: 0.85,
      extractionMethod: 'html'
    },
    {
      selector: '.wikia-gallery',
      type: 'css',
      priority: 2,
      confidence: 0.8,
      extractionMethod: 'html'
    }
  ];
}

// Collapsible Section Selectors
/** Generate selectors for collapsible sections */
export function generateCollapsibleSelectors(_$: CheerioAPI): SelectorStrategy[] {
  return [
    {
      selector: '.mw-collapsible',
      type: 'css',
      priority: 1,
      confidence: 0.85,
      extractionMethod: 'html'
    }
  ];
}

// Category Page Selectors
/** Generate selectors for category page links */
export function generateCategorySelectors(_$: CheerioAPI): SelectorStrategy[] {
  return [
    {
      selector: '#mw-pages li a',
      type: 'css',
      priority: 1,
      confidence: 0.9,
      extractionMethod: 'attr',
      attribute: 'href'
    }
  ];
}

// Generic Content Selectors
/** Generate generic content selectors for unstructured pages */
export function generateGenericSelectors(_$: CheerioAPI): SelectorStrategy[] {
  return [
    {
      selector: '#mw-content-text',
      type: 'css',
      priority: 1,
      confidence: 0.5,
      extractionMethod: 'html'
    }
  ];
}

// Fallback Selectors
/** Generate fallback selectors for chapter/volume links */
export function generateFallbackSelectors(_$: CheerioAPI): SelectorStrategy[] {
  return [
    {
      selector: 'a[href*="Chapter"], a[href*="chapter"]',
      type: 'css',
      priority: 10,
      confidence: 0.6,
      extractionMethod: 'attr',
      attribute: 'href'
    },
    {
      selector: 'a[href*="Volume"], a[href*="volume"]',
      type: 'css',
      priority: 11,
      confidence: 0.6,
      extractionMethod: 'attr',
      attribute: 'href'
    }
  ];
}

// Volume-Specific Selectors
/** Generate selectors for volume data extraction */
export function generateVolumeSelectors(_$: CheerioAPI): SelectorStrategy[] {
  return [
    {
      selector: 'tr:has(td:contains("Volume"))',
      type: 'css',
      priority: 1,
      confidence: 0.9,
      extractionMethod: 'text'
    },
    {
      selector: '.wikitable tr:has(a[href*="Volume_"])',
      type: 'css',
      priority: 2,
      confidence: 0.85,
      extractionMethod: 'html'
    },
    {
      selector: 'h3:contains("Volume"), h2:contains("Volume")',
      type: 'css',
      priority: 3,
      confidence: 0.8,
      extractionMethod: 'text'
    },
    {
      selector: '.volume-item, .volume-row',
      type: 'css',
      priority: 4,
      confidence: 0.75,
      extractionMethod: 'html'
    }
  ];
}

// Chapter-Specific Selectors
/** Generate selectors for chapter data extraction */
export function generateChapterSelectors(_$: CheerioAPI): SelectorStrategy[] {
  return [
    {
      selector: 'tr:has(td:contains("Chapter"))',
      type: 'css',
      priority: 1,
      confidence: 0.9,
      extractionMethod: 'text'
    },
    {
      selector: '.wikitable tr:has(a[href*="Chapter_"])',
      type: 'css',
      priority: 2,
      confidence: 0.85,
      extractionMethod: 'html'
    },
    {
      selector: 'li:has(a[href*="Chapter"])',
      type: 'css',
      priority: 3,
      confidence: 0.8,
      extractionMethod: 'html'
    },
    {
      selector: '.chapter-item, .chapter-row',
      type: 'css',
      priority: 4,
      confidence: 0.75,
      extractionMethod: 'html'
    }
  ];
}
