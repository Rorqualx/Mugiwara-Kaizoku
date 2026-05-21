/**
 * Format Detection System
 * Dynamically identifies wiki formats and their features
 */

import * as cheerio from 'cheerio';

import type { CheerioAPI } from 'cheerio';

export interface FormatDetectorRule {
  name: string;
  priority: number;
  detect: ($: CheerioAPI) => boolean;
  features: FormatFeatures;
  confidence?: number;
}

export interface FormatFeatures {
  // Infobox types
  hasPortableInfobox?: boolean;
  hasTraditionalInfobox?: boolean;
  hasCustomInfobox?: boolean;
  
  // Table formats
  hasStandardTables?: boolean;
  hasArticleTables?: boolean;
  hasCustomTables?: boolean;
  hasNestedTables?: boolean;
  
  // Gallery formats
  hasWikiaGallery?: boolean;
  hasMediaWikiGallery?: boolean;
  hasTabberGallery?: boolean;
  hasSliderGallery?: boolean;
  
  // Special features
  hasLazyLoading?: boolean;
  hasTabbedContent?: boolean;
  hasCollapsibles?: boolean;
  hasReferences?: boolean;
  hasChapterLinks?: boolean;
  hasVolumePages?: boolean;
  hasStoryArcs?: boolean;
  
  // Content patterns
  usesPortableClasses?: boolean;
  usesWdsComponents?: boolean;
  usesMediaWikiFormat?: boolean;
  usesCustomFormat?: boolean;
}

export interface DetectedFormat {
  primary: FormatDetectorRule;
  alternatives: FormatDetectorRule[];
  features: FormatFeatures;
  confidence: number;
  signals: string[];
}

export class FormatDetector {
  private detectors: FormatDetectorRule[] = [
    // ====== Fandom Formats ======
    {
      name: 'fandom-modern',
      priority: 1,
      detect: ($) => {
        return $('.fandom-community-header').length > 0 ||
               ($('meta[property="og:site_name"]').attr('content')?.includes('Fandom') ?? false);
      },
      features: {
        hasPortableInfobox: true,
        usesWdsComponents: true,
        hasTabberGallery: true,
        hasLazyLoading: true,
        hasTabbedContent: true,
        usesPortableClasses: true
      }
    },
    {
      name: 'fandom-legacy',
      priority: 2,
      detect: ($) => {
        return $('.WikiaPage').length > 0 ||
               $('#WikiaHeader').length > 0 ||
               $('.wikia-gallery').length > 0;
      },
      features: {
        hasPortableInfobox: true,
        hasWikiaGallery: true,
        hasArticleTables: true,
        hasLazyLoading: true,
        usesPortableClasses: true
      }
    },
    {
      name: 'fandom-gamepedia',
      priority: 3,
      detect: ($) => {
        const hasMediaWiki = $('meta[name="generator"]').attr('content')?.includes('MediaWiki') ?? false;
        return hasMediaWiki && $('.netbar').length > 0;
      },
      features: {
        hasTraditionalInfobox: true,
        hasMediaWikiGallery: true,
        hasStandardTables: true,
        usesMediaWikiFormat: true
      }
    },
    
    // ====== Wikipedia Formats ======
    {
      name: 'wikipedia',
      priority: 4,
      detect: ($) => {
        const hasWikipedia = $('meta[property="og:site_name"]').attr('content')?.includes('Wikipedia') ?? false;
        return $('#mw-content-text').length > 0 &&
               $('.mw-parser-output').length > 0 &&
               hasWikipedia;
      },
      features: {
        hasTraditionalInfobox: true,
        hasStandardTables: true,
        hasReferences: true,
        usesMediaWikiFormat: true,
        hasChapterLinks: true
      }
    },
    {
      name: 'wikipedia-mobile',
      priority: 5,
      detect: ($) => {
        const hasMobileViewport = $('meta[name="viewport"]').attr('content')?.includes('mobile') ?? false;
        return $('.mw-mf-page-center').length > 0 || hasMobileViewport;
      },
      features: {
        hasTraditionalInfobox: true,
        hasCollapsibles: true,
        usesMediaWikiFormat: true
      }
    },
    
    // ====== MediaWiki Variants ======
    {
      name: 'mediawiki-generic',
      priority: 6,
      detect: ($) => {
        const hasMediaWiki = $('meta[name="generator"]').attr('content')?.includes('MediaWiki') ?? false;
        return hasMediaWiki && $('#content').length > 0;
      },
      features: {
        hasTraditionalInfobox: true,
        hasStandardTables: true,
        hasMediaWikiGallery: true,
        usesMediaWikiFormat: true
      }
    },
    {
      name: 'mediawiki-custom',
      priority: 7,
      detect: ($) => {
        return $('.mw-body-content').length > 0 ||
               $('.mw-content-ltr').length > 0;
      },
      features: {
        hasCustomInfobox: true,
        hasCustomTables: true,
        usesCustomFormat: true
      }
    },
    
    // ====== Specialized Wiki Formats ======
    {
      name: 'manga-specialized',
      priority: 8,
      detect: ($) => {
        const hasVolumeGallery = $('.volume-gallery, .volumes-gallery').length > 0;
        const hasChapterTable = $('table').filter((_, el) => 
          $(el).text().toLowerCase().includes('chapter')).length > 0;
        const hasStoryArcs = $('.story-arc, .arc-table').length > 0;
        
        return hasVolumeGallery || (hasChapterTable && hasStoryArcs);
      },
      features: {
        hasVolumePages: true,
        hasStoryArcs: true,
        hasChapterLinks: true,
        hasTabberGallery: true
      }
    },
    {
      name: 'anime-wiki',
      priority: 9,
      detect: ($) => {
        const hasEpisodeList = $('.episode-list, #Episode_List').length > 0;
        const hasSeasonTabs = $('.season-tabs, .wds-tabs').length > 0;
        
        return hasEpisodeList || hasSeasonTabs;
      },
      features: {
        hasTabbedContent: true,
        hasCustomTables: true,
        hasCollapsibles: true
      }
    },
    
    // ====== Custom Formats ======
    {
      name: 'custom-structured',
      priority: 10,
      detect: ($) => {
        // Check for custom structured data
        const hasDataAttributes = $('[data-volume], [data-chapter]').length > 0;
        const hasSchemaOrg = $('[itemtype*="schema.org"]').length > 0;
        const hasJsonLd = $('script[type="application/ld+json"]').length > 0;
        
        return hasDataAttributes || hasSchemaOrg || hasJsonLd;
      },
      features: {
        usesCustomFormat: true
      }
    }
  ];

  /**
   * Detect the format of the given HTML
   */
  detectFormat(html: string, $?: CheerioAPI): DetectedFormat {
    const loadedCheerio = $ ?? cheerio.load(html);

    // Score each detector
    const matches = this.detectors
      .map(detector => ({
        ...detector,
        score: this.scoreDetector(loadedCheerio, detector),
        signals: this.extractSignals(loadedCheerio, detector)
      }))
      .filter(d => d.score > 0)
      .sort((a, b) => {
        // Sort by score, then priority
        if (Math.abs(a.score - b.score) > 0.1) {
          return b.score - a.score;
        }
        return a.priority - b.priority;
      });

    if (matches.length === 0) {
      // No specific format detected, return generic
      return this.createGenericFormat(loadedCheerio);
    }

    // Detect additional features
    const features = this.detectFeatures(loadedCheerio);
    
    const firstMatch = matches[0];
    if (!firstMatch) {
      throw new Error('No matches found');
    }

    // Merge primary detector features with detected features
    const mergedFeatures = {
      ...features,
      ...firstMatch.features
    };

    return {
      primary: firstMatch,
      alternatives: matches.slice(1),
      features: mergedFeatures,
      confidence: this.calculateConfidence(matches.map(m => ({ score: m.score, format: m["name"] }))),
      signals: firstMatch.signals
    };
  }

  /**
   * Score a detector based on how well it matches
   */
  private scoreDetector($: CheerioAPI, detector: FormatDetectorRule): number {
    try {
      const matches = detector.detect($);
      if (!matches) return 0;
      
      // Base score
      let score = 1.0;
      
      // Adjust based on feature presence
      if (detector.features.hasPortableInfobox && $('.portable-infobox').length > 0) {
        score += 0.2;
      }
      if (detector.features.hasWikiaGallery && $('.wikia-gallery').length > 0) {
        score += 0.2;
      }
      if (detector.features.hasStandardTables && $('table.wikitable').length > 0) {
        score += 0.1;
      }
      if (detector.features.hasTabbedContent && $('.wds-tabber').length > 0) {
        score += 0.15;
      }
      
      // Apply confidence if specified
      if (detector.confidence) {
        score *= detector.confidence;
      }
      
      return Math.min(score, 1.5); // Cap at 1.5
    } catch (_error: unknown) {
      return 0;
    }
  }

  /**
   * Extract signals that helped identify the format
   */
  private extractSignals($: CheerioAPI, _detector: FormatDetectorRule): string[] {
    const signals: string[] = [];
    
    // Check for specific indicators
    if ($('.fandom-community-header').length > 0) {
      signals.push('fandom-community-header');
    }
    if ($('meta[property="og:site_name"]').attr('content')) {
      signals.push(`site:${$('meta[property="og:site_name"]').attr('content')}`);
    }
    if ($('meta[name="generator"]').attr('content')) {
      signals.push(`generator:${$('meta[name="generator"]').attr('content')}`);
    }
    if ($('.portable-infobox').length > 0) {
      signals.push('portable-infobox');
    }
    if ($('.wikia-gallery').length > 0) {
      signals.push('wikia-gallery');
    }
    if ($('#mw-content-text').length > 0) {
      signals.push('mediawiki-content');
    }
    
    return signals;
  }

  /**
   * Detect all features present in the HTML
   */
  private detectFeatures($: CheerioAPI): FormatFeatures {
    return {
      // Infobox detection
      hasPortableInfobox: $('.portable-infobox').length > 0,
      hasTraditionalInfobox: $('.infobox:not(.portable-infobox)').length > 0,
      hasCustomInfobox: $('[class*="infobox"]:not(.infobox):not(.portable-infobox)').length > 0,
      
      // Table detection
      hasStandardTables: $('table.wikitable').length > 0,
      hasArticleTables: $('table.article-table').length > 0,
      hasCustomTables: $('table[class*="custom"], table[class*="manga"], table[class*="volume"]').length > 0,
      hasNestedTables: $('table table').length > 0,
      
      // Gallery detection
      hasWikiaGallery: $('.wikia-gallery').length > 0,
      hasMediaWikiGallery: $('.gallery:not(.wikia-gallery)').length > 0,
      hasTabberGallery: $('.wds-tabber .gallery, .tabber .gallery').length > 0,
      hasSliderGallery: $('.slider-gallery, .image-gallery-slider').length > 0,
      
      // Special features
      hasLazyLoading: $('[data-src]:not([src])').length > 0,
      hasTabbedContent: $('.wds-tabber, .tabber, .tabs-container').length > 0,
      hasCollapsibles: $('.mw-collapsible, .collapsible').length > 0,
      hasReferences: $('.references, .reflist').length > 0,
      hasChapterLinks: $('a[href*="Chapter"], a[href*="chapter"]').length > 5,
      hasVolumePages: $('a[href*="Volume"], a[href*="volume"]').length > 3,
      hasStoryArcs: $('.story-arc, .arc-section, [class*="arc"]').length > 0,
      
      // Component detection
      usesPortableClasses: $('.pi-item, .pi-data, .pi-image').length > 0,
      usesWdsComponents: $('[class^="wds-"]').length > 0,
      usesMediaWikiFormat: $('.mw-parser-output, .mw-content-ltr').length > 0,
      usesCustomFormat: $('[data-manga], [data-volume], [data-chapter]').length > 0
    };
  }

  /**
   * Calculate confidence score for the detection
   */
  private calculateConfidence(matches: Array<{ score: number; format: string }>): number {
    if (matches.length === 0) return 0;

    const firstMatch = matches[0];
    if (!firstMatch) return 0;

    const topScore = firstMatch.score;
    const secondMatch = matches[1];
    const secondScore = secondMatch?.score ?? 0;
    
    // High confidence if clear winner
    if (topScore > 1.2 && topScore - secondScore > 0.5) {
      return 0.95;
    }
    
    // Medium-high confidence if good score
    if (topScore > 1.0) {
      return 0.85;
    }
    
    // Medium confidence if decent score
    if (topScore > 0.7) {
      return 0.70;
    }
    
    // Low confidence
    return 0.50;
  }

  /**
   * Create a generic format when no specific format is detected
   */
  private createGenericFormat($: CheerioAPI): DetectedFormat {
    const features = this.detectFeatures($);
    
    return {
      primary: {
        name: 'generic-wiki',
        priority: 100,
        detect: () => true,
        features: features
      },
      alternatives: [],
      features: features,
      confidence: 0.3,
      signals: ['no-specific-format-detected']
    };
  }

  /**
   * Add a custom detector at runtime
   */
  addDetector(detector: FormatDetectorRule): void {
    // Insert based on priority
    const index = this.detectors.findIndex(d => d.priority > detector.priority);
    if (index === -1) {
      this.detectors.push(detector);
    } else {
      this.detectors.splice(index, 0, detector);
    }
  }

  /**
   * Get format-specific extraction hints
   */
  getExtractionHints(format: DetectedFormat): ExtractionHints {
    const hints: ExtractionHints = {
      infoboxSelector: '.infobox',
      tableSelector: 'table',
      gallerySelector: '.gallery',
      chapterLinkPattern: /chapter/i,
      volumeLinkPattern: /volume/i,
      imageAttributes: ['src'],
      cleanupPatterns: []
    };
    
    // Customize based on format
    if (format.features.hasPortableInfobox) {
      hints.infoboxSelector = '.portable-infobox';
    }
    
    if (format.features.hasWikiaGallery) {
      hints.gallerySelector = '.wikia-gallery';
    }
    
    if (format.features.hasArticleTables) {
      hints.tableSelector = 'table.article-table';
    }
    
    if (format.features.hasLazyLoading) {
      hints.imageAttributes = ['src', 'data-src', 'data-original', 'data-image-url'];
    }
    
    if (format.features.usesWdsComponents) {
      hints.cleanupPatterns.push(/^wds-/);
    }
    
    return hints;
  }
}

export interface ExtractionHints {
  infoboxSelector: string;
  tableSelector: string;
  gallerySelector: string;
  chapterLinkPattern: RegExp;
  volumeLinkPattern: RegExp;
  imageAttributes: string[];
  cleanupPatterns: RegExp[];
}