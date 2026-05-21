# Unified Parser Development Plan

## Executive Summary

This plan outlines the development of a comprehensive Unified Metadata Parser that consolidates 15+ parser implementations (45,000+ lines) into a modular, extensible system while preserving all existing functionality and adding dynamic format detection capabilities.

## Current System Inventory

### Existing Parser Logic to Preserve

#### 1. **Fandom Table Parser** (`fandomTableParser.ts` - 43,000+ tokens)
- **Gallery-based layouts** (Black Clover pattern)
- **Multi-column tables** with complex rowspan/colspan
- **Story Arc parsing** with chapter groupings
- **Various table patterns** (15+ identified patterns)
- **Chapter link following** for detailed metadata
- **Volume variant detection** (Limited, Special editions)

#### 2. **Fandom Enhanced Parser** (`fandomEnhancedParser.ts`)
- **Individual chapter page fetching**
- **Deep metadata extraction** from chapter pages
- **Rate limiting** for respectful crawling
- **Batch processing** with configurable delays
- **Cover image extraction** from chapter pages

#### 3. **Wikipedia Service** (`WikipediaService.ts` - 1,573 lines)
- **MediaWiki API integration**
- **Disambiguation handling**
- **Redirect following**
- **Chapter list page detection**
- **Plot summary extraction**
- **Infobox parsing** (multiple formats)
- **Category-based filtering**

#### 4. **Refined Extraction** (`refinedExtraction.ts`)
- **Tabbed content handling** (`.wds-tabber`)
- **Lazy-loaded images** (`data-src` attributes)
- **Multiple gallery formats**
- **Advanced selector patterns**
- **Field normalization**

#### 5. **Enhanced Image Extraction** (`enhancedImageExtraction.ts`)
- **CDN URL cleaning** (Wikia/Fandom specific)
- **Thumbnail detection and original extraction**
- **Multiple image attribute checking**
- **Protocol normalization**
- **Query parameter removal**

## Unified Parser Architecture

### Core Structure

```
UnifiedMetadataParser/
├── core/
│   ├── UnifiedParser.ts          // Main parser class
│   ├── FormatDetector.ts         // Dynamic format detection
│   ├── ContentExtractor.ts       // Core extraction engine
│   └── DataNormalizer.ts         // Output normalization
├── patterns/
│   ├── PatternLibrary.ts         // Regex patterns
│   ├── SelectorLibrary.ts        // CSS selectors
│   ├── TablePatterns.ts          // Table detection patterns
│   └── WikiPatterns.ts           // Wiki-specific patterns
├── extractors/
│   ├── InfoboxExtractor.ts       // Infobox parsing
│   ├── TableExtractor.ts         // Table parsing
│   ├── GalleryExtractor.ts       // Gallery parsing
│   ├── ChapterExtractor.ts       // Chapter extraction
│   ├── VolumeExtractor.ts        // Volume extraction
│   ├── ImageExtractor.ts         // Image extraction
│   └── MetadataExtractor.ts      // Metadata fields
├── formatters/
│   ├── FandomFormatter.ts        // Fandom-specific
│   ├── WikipediaFormatter.ts     // Wikipedia-specific
│   ├── GenericFormatter.ts       // Generic wiki
│   └── CustomFormatter.ts        // User-defined formats
├── utilities/
│   ├── TextCleaner.ts           // Text processing
│   ├── UrlProcessor.ts          // URL handling
│   ├── DateParser.ts            // Date parsing
│   ├── NumberParser.ts          // Number extraction
│   └── ValidationUtils.ts       // Data validation
├── adapters/
│   ├── FandomAdapter.ts         // Fandom integration
│   ├── WikipediaAdapter.ts      // Wikipedia integration
│   ├── MediaWikiAdapter.ts      // Generic MediaWiki
│   └── CustomAdapter.ts         // Custom sources
└── types/
    ├── ParserTypes.ts            // Type definitions
    ├── ExtractorTypes.ts         // Extractor interfaces
    └── FormatTypes.ts            // Format definitions
```

## Detailed Implementation Plan

### Phase 1: Core Foundation (Week 1)

#### 1.1 Format Detection System

```typescript
// FormatDetector.ts
export class FormatDetector {
  private detectors: FormatDetectorRule[] = [
    // Fandom detection rules
    {
      name: 'fandom-modern',
      priority: 1,
      detect: ($) => {
        return $('.fandom-community-header').length > 0 ||
               $('meta[property="og:site_name"]').attr('content')?.includes('Fandom');
      },
      features: {
        hasPortableInfobox: true,
        hasWdsTabber: true,
        hasGalleries: true,
        hasLazyImages: true
      }
    },
    // Wikipedia detection rules
    {
      name: 'wikipedia',
      priority: 2,
      detect: ($) => {
        return $('#mw-content-text').length > 0 &&
               $('meta[name="generator"]').attr('content')?.includes('MediaWiki');
      },
      features: {
        hasTraditionalInfobox: true,
        hasMediaWikiTables: true,
        hasReferences: true
      }
    },
    // Add 20+ more format detection rules
  ];

  detectFormat(html: string): DetectedFormat {
    const $ = cheerio.load(html);
    
    // Run all detectors and score
    const matches = this.detectors
      .map(detector => ({
        ...detector,
        score: this.scoreDetector($, detector)
      }))
      .filter(d => d.score > 0)
      .sort((a, b) => b.score - a.score);
    
    return {
      primary: matches[0],
      alternatives: matches.slice(1),
      features: this.detectFeatures($),
      confidence: this.calculateConfidence(matches)
    };
  }

  private detectFeatures($: CheerioAPI): FormatFeatures {
    return {
      // Table formats
      hasStandardTables: $('table.wikitable').length > 0,
      hasArticleTables: $('table.article-table').length > 0,
      hasCustomTables: $('table[class*="custom"]').length > 0,
      
      // Gallery formats
      hasWikiaGallery: $('.wikia-gallery').length > 0,
      hasMediaWikiGallery: $('.gallery').length > 0,
      hasTabberGallery: $('.wds-tabber .gallery').length > 0,
      
      // Infobox formats
      hasPortableInfobox: $('.portable-infobox').length > 0,
      hasTraditionalInfobox: $('.infobox').length > 0,
      hasCustomInfobox: $('[class*="infobox"]').length > 0,
      
      // Special features
      hasLazyLoading: $('[data-src]').length > 0,
      hasTabbedContent: $('.wds-tabber').length > 0,
      hasCollapsibles: $('.mw-collapsible').length > 0,
      hasReferences: $('.references').length > 0
    };
  }
}
```

#### 1.2 Pattern Library System

```typescript
// PatternLibrary.ts
export class PatternLibrary {
  private patterns: Map<string, PatternCollection> = new Map();
  
  constructor() {
    this.registerDefaultPatterns();
    this.loadCustomPatterns();
  }

  private registerDefaultPatterns() {
    // Volume patterns (30+ variations)
    this.patterns.set('volume', {
      primary: [
        /Volume\s+(\d+\.?\d*)/i,
        /Vol\.?\s*(\d+)/i,
        /Tome\s+(\d+)/i,
        /第(\d+)巻/,
        /Band\s+(\d+)/i,
        /Tomo\s+(\d+)/i,
      ],
      contextual: [
        // Patterns that need context
        {
          pattern: /(\d+)/,
          requiresContext: ['volume', 'vol', 'tome'],
          confidence: 0.7
        }
      ],
      negative: [
        // Patterns to exclude
        /Volume\s+\d+\s+Extra/i,
        /Volume\s+\d+\s+Omake/i
      ]
    });

    // Chapter patterns (40+ variations)
    this.patterns.set('chapter', {
      primary: [
        /Chapter\s+(\d+\.?\d*)/i,
        /Ch\.?\s*(\d+)/i,
        /Episode\s+(\d+)/i,
        /第(\d+)話/,
        /Capítulo\s+(\d+)/i,
        /Chapitre\s+(\d+)/i,
      ],
      special: [
        // Special chapter patterns
        /Chapter\s+(\d+)\.(\d+)/i,  // Decimal chapters
        /Chapter\s+(\d+)[a-z]/i,     // Letter suffixes
        /Extra\s+Chapter\s+(\d+)/i,  // Extra chapters
        /Special\s+(\d+)/i,          // Specials
      ]
    });

    // Status patterns (20+ variations)
    this.patterns.set('status', {
      ongoing: [
        /ongoing/i,
        /serializ/i,
        /active/i,
        /current/i,
        /present/i,
        /連載中/,
        /en cours/i,
        /laufend/i,
      ],
      completed: [
        /complete/i,
        /finish/i,
        /end/i,
        /conclude/i,
        /完結/,
        /terminé/i,
        /abgeschlossen/i,
      ],
      hiatus: [
        /hiatus/i,
        /suspend/i,
        /pause/i,
        /休載/,
        /en pause/i,
      ]
    });

    // Date patterns (15+ formats)
    this.patterns.set('date', {
      standard: [
        /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/,
        /(\d{1,2}[-/]\d{1,2}[-/]\d{4})/,
      ],
      textual: [
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i,
        /\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/i,
      ],
      japanese: [
        /(\d{4})年(\d{1,2})月(\d{1,2})日/,
        /平成(\d+)年/,
        /令和(\d+)年/,
      ]
    });
  }

  match(text: string, patternType: string): PatternMatch | null {
    const collection = this.patterns.get(patternType);
    if (!collection) return null;

    // Try primary patterns first
    for (const pattern of collection.primary || []) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: patternType,
          value: match[1],
          confidence: 1.0,
          pattern: pattern.source
        };
      }
    }

    // Try contextual patterns
    for (const contextual of collection.contextual || []) {
      if (this.hasContext(text, contextual.requiresContext)) {
        const match = text.match(contextual.pattern);
        if (match) {
          return {
            type: patternType,
            value: match[1],
            confidence: contextual.confidence,
            pattern: contextual.pattern.source
          };
        }
      }
    }

    return null;
  }
}
```

### Phase 2: Extraction Engine (Week 2)

#### 2.1 Dynamic Table Extractor

```typescript
// TableExtractor.ts
export class TableExtractor {
  private tablePatterns: TablePattern[] = [
    // Pattern 1: Standard volume table
    {
      name: 'standard-volume-table',
      detect: (headers) => {
        return headers.some(h => /volume/i.test(h)) &&
               headers.some(h => /chapter/i.test(h));
      },
      extract: this.extractStandardVolumeTable.bind(this)
    },
    // Pattern 2: Gallery-based volumes (Black Clover)
    {
      name: 'gallery-volumes',
      detect: ($, element) => {
        return $(element).hasClass('wikia-gallery') &&
               $(element).find('.lightbox-caption').text().includes('Volume');
      },
      extract: this.extractGalleryVolumes.bind(this)
    },
    // Pattern 3: Story arc table (One Piece)
    {
      name: 'story-arc-table',
      detect: (headers) => {
        return headers.some(h => /arc/i.test(h)) &&
               headers.some(h => /chapter/i.test(h));
      },
      extract: this.extractStoryArcTable.bind(this)
    },
    // Pattern 4: Tabbed volume tables
    {
      name: 'tabbed-volumes',
      detect: ($, element) => {
        return $(element).closest('.wds-tabber').length > 0;
      },
      extract: this.extractTabbedVolumes.bind(this)
    },
    // Add 20+ more table patterns
  ];

  async extractTables($: CheerioAPI, options: ExtractionOptions): Promise<TableData[]> {
    const results: TableData[] = [];
    
    // Find all potential tables
    const candidates = this.findTableCandidates($);
    
    for (const candidate of candidates) {
      // Identify table pattern
      const pattern = this.identifyPattern($, candidate);
      
      if (pattern) {
        const data = await pattern.extract($, candidate, options);
        if (data) {
          results.push({
            ...data,
            pattern: pattern.name,
            confidence: this.calculateConfidence(data)
          });
        }
      } else {
        // Try generic extraction
        const genericData = this.extractGenericTable($, candidate);
        if (genericData) {
          results.push(genericData);
        }
      }
    }
    
    return this.mergeRelatedTables(results);
  }

  private findTableCandidates($: CheerioAPI): Element[] {
    const candidates: Element[] = [];
    
    // Standard tables
    $('table').each((_, table) => {
      if (this.isValidTable($, table)) {
        candidates.push(table);
      }
    });
    
    // Galleries that contain volume/chapter info
    $('.wikia-gallery, .gallery').each((_, gallery) => {
      if (this.containsVolumeInfo($, gallery)) {
        candidates.push(gallery);
      }
    });
    
    // Tabbed content
    $('.wds-tabber').each((_, tabber) => {
      $(tabber).find('.wds-tab__content').each((_, content) => {
        candidates.push(content);
      });
    });
    
    // Article sections with structured data
    $('section, .mw-parser-output > div').each((_, section) => {
      if (this.hasStructuredData($, section)) {
        candidates.push(section);
      }
    });
    
    return candidates;
  }

  private extractStandardVolumeTable($: CheerioAPI, table: Element, options: ExtractionOptions): VolumeData {
    const headers = this.extractHeaders($, table);
    const indices = this.mapHeaderIndices(headers);
    const volumes: VolumeInfo[] = [];
    
    $(table).find('tr').each((rowIndex, row) => {
      if (rowIndex === 0) return; // Skip header
      
      const cells = $(row).find('td, th');
      const volumeData = this.extractVolumeFromRow($, cells, indices);
      
      if (volumeData) {
        // Handle rowspan for chapters
        if (options.handleRowspan) {
          volumeData.chapters = this.extractChaptersWithRowspan($, table, rowIndex, indices);
        }
        
        volumes.push(volumeData);
      }
    });
    
    return { volumes, type: 'standard-table' };
  }

  private extractGalleryVolumes($: CheerioAPI, gallery: Element, options: ExtractionOptions): VolumeData {
    const volumes: VolumeInfo[] = [];
    
    $(gallery).find('.wikia-gallery-item, .gallerybox').each((_, item) => {
      const caption = $(item).find('.lightbox-caption, .gallerytext').text();
      const imageUrl = this.extractGalleryImage($, item);
      
      // Parse volume info from caption
      const volumeMatch = caption.match(/Volume\s+(\d+).*?Chapter(?:s)?\s+([\d-]+)/i);
      
      if (volumeMatch) {
        const volumeNum = parseInt(volumeMatch[1]);
        const chapterRange = volumeMatch[2];
        
        const volume: VolumeInfo = {
          volumeNumber: volumeNum,
          title: caption,
          coverImage: imageUrl,
          chapters: this.parseChapterRange(chapterRange, volumeNum)
        };
        
        // Extract additional info from caption
        const isbnMatch = caption.match(/ISBN[:\s]*([\d-]+)/);
        if (isbnMatch) {
          volume.isbn = isbnMatch[1];
        }
        
        volumes.push(volume);
      }
    });
    
    return { volumes, type: 'gallery' };
  }

  private extractStoryArcTable($: CheerioAPI, table: Element, options: ExtractionOptions): ChapterData {
    const arcs: StoryArc[] = [];
    let currentArc: StoryArc | null = null;
    
    $(table).find('tr').each((_, row) => {
      const cells = $(row).find('td, th');
      
      // Check if this is an arc header row
      if (this.isArcHeader($, row)) {
        if (currentArc) {
          arcs.push(currentArc);
        }
        currentArc = {
          name: $(cells[0]).text().trim(),
          chapters: []
        };
      } else if (currentArc) {
        // Extract chapter from row
        const chapter = this.extractChapterFromRow($, cells);
        if (chapter) {
          currentArc.chapters.push(chapter);
        }
      }
    });
    
    if (currentArc) {
      arcs.push(currentArc);
    }
    
    return { arcs, type: 'story-arc' };
  }
}
```

#### 2.2 Advanced Metadata Extractor

```typescript
// MetadataExtractor.ts
export class MetadataExtractor {
  private fieldMappings: FieldMapping[] = [
    // Author mappings
    {
      fields: ['author', 'writer', 'story', 'written by', '作者', 'auteur'],
      target: 'author',
      processor: (value) => this.splitNames(value)
    },
    // Artist mappings
    {
      fields: ['artist', 'illustrator', 'art', 'illustrated by', '画家', 'dessinateur'],
      target: 'artist',
      processor: (value) => this.splitNames(value)
    },
    // Publisher mappings
    {
      fields: ['publisher', 'english publisher', 'us publisher', '出版社', 'éditeur'],
      target: 'publisher',
      processor: (value) => this.cleanPublisher(value)
    },
    // Add 50+ more field mappings
  ];

  extractMetadata($: CheerioAPI, options: ExtractionOptions): ExtractedMetadata {
    const metadata: ExtractedMetadata = {};
    
    // Extract from multiple sources
    const infoboxData = this.extractFromInfobox($);
    const schemaData = this.extractFromSchema($);
    const metaTags = this.extractFromMetaTags($);
    const textData = this.extractFromText($);
    
    // Merge with priority
    this.mergeMetadata(metadata, [
      { data: schemaData, priority: 1 },
      { data: infoboxData, priority: 2 },
      { data: metaTags, priority: 3 },
      { data: textData, priority: 4 }
    ]);
    
    // Post-process
    this.normalizeMetadata(metadata);
    this.validateMetadata(metadata);
    
    return metadata;
  }

  private extractFromInfobox($: CheerioAPI): Partial<ExtractedMetadata> {
    const metadata: Partial<ExtractedMetadata> = {};
    
    // Try multiple infobox selectors
    const infoboxes = [
      $('.portable-infobox'),
      $('.infobox'),
      $('[class*="infobox"]'),
      $('.databox'),
      $('.sidebar')
    ];
    
    for (const $infobox of infoboxes) {
      if ($infobox.length === 0) continue;
      
      // Extract based on structure
      if ($infobox.hasClass('portable-infobox')) {
        this.extractPortableInfobox($infobox, metadata);
      } else {
        this.extractTraditionalInfobox($infobox, metadata);
      }
      
      if (Object.keys(metadata).length > 0) break;
    }
    
    return metadata;
  }

  private extractFromSchema($: CheerioAPI): Partial<ExtractedMetadata> {
    const metadata: Partial<ExtractedMetadata> = {};
    
    // Look for JSON-LD schema
    $('script[type="application/ld+json"]').each((_, script) => {
      try {
        const data = JSON.parse($(script).html() || '{}');
        if (data['@type'] === 'Book' || data['@type'] === 'CreativeWork') {
          metadata.title = data.name;
          metadata.author = this.extractPersons(data.author);
          metadata.publisher = data.publisher?.name;
          metadata.isbn = data.isbn;
        }
      } catch (e) {
        // Invalid JSON
      }
    });
    
    return metadata;
  }
}
```

### Phase 3: Dynamic Learning System (Week 3)

#### 3.1 Pattern Learning Engine

```typescript
// PatternLearner.ts
export class PatternLearner {
  private learnedPatterns: Map<string, LearnedPattern[]> = new Map();
  private patternDatabase: PatternDatabase;
  
  constructor() {
    this.patternDatabase = new PatternDatabase();
    this.loadLearnedPatterns();
  }

  async learnFromExample(html: string, annotations: Annotation[]): Promise<void> {
    const $ = cheerio.load(html);
    
    for (const annotation of annotations) {
      // Extract context around annotated data
      const context = this.extractContext($, annotation);
      
      // Generate patterns
      const patterns = this.generatePatterns(context, annotation);
      
      // Test and score patterns
      const scoredPatterns = await this.scorePatterns(patterns, html);
      
      // Store successful patterns
      const successful = scoredPatterns.filter(p => p.score > 0.8);
      this.storePatterns(annotation.type, successful);
    }
    
    // Persist to database
    await this.patternDatabase.save(this.learnedPatterns);
  }

  private generatePatterns(context: Context, annotation: Annotation): Pattern[] {
    const patterns: Pattern[] = [];
    
    // CSS selector patterns
    patterns.push(...this.generateSelectorPatterns(context));
    
    // Text patterns
    patterns.push(...this.generateTextPatterns(context, annotation.value));
    
    // Structural patterns
    patterns.push(...this.generateStructuralPatterns(context));
    
    // Relative patterns
    patterns.push(...this.generateRelativePatterns(context));
    
    return patterns;
  }

  private generateSelectorPatterns(context: Context): Pattern[] {
    const patterns: Pattern[] = [];
    const element = context.element;
    
    // ID-based
    if (element.id) {
      patterns.push({
        type: 'selector',
        value: `#${element.id}`,
        specificity: 1.0
      });
    }
    
    // Class-based
    if (element.classes.length > 0) {
      // Single class
      element.classes.forEach(cls => {
        patterns.push({
          type: 'selector',
          value: `.${cls}`,
          specificity: 0.7
        });
      });
      
      // Class combinations
      patterns.push({
        type: 'selector',
        value: '.' + element.classes.join('.'),
        specificity: 0.9
      });
    }
    
    // Attribute-based
    Object.entries(element.attributes).forEach(([key, value]) => {
      patterns.push({
        type: 'selector',
        value: `[${key}="${value}"]`,
        specificity: 0.8
      });
    });
    
    // Hierarchical
    if (context.parent) {
      patterns.push({
        type: 'selector',
        value: `${context.parent.tag} > ${element.tag}`,
        specificity: 0.6
      });
    }
    
    return patterns;
  }
}
```

### Phase 4: Integration Layer (Week 4)

#### 4.1 Adapter System

```typescript
// UnifiedAdapter.ts
export class UnifiedAdapter {
  private parser: UnifiedParser;
  private cache: CacheManager;
  private rateLimiter: RateLimiter;
  
  constructor(config: AdapterConfig) {
    this.parser = new UnifiedParser(config);
    this.cache = new CacheManager(config.cache);
    this.rateLimiter = new RateLimiter(config.rateLimit);
  }

  async extract(url: string, options?: ExtractOptions): Promise<MangaMetadata> {
    // Check cache
    const cached = await this.cache.get(url);
    if (cached && !options?.skipCache) {
      return cached;
    }
    
    // Rate limiting
    await this.rateLimiter.wait();
    
    // Fetch content
    const html = await this.fetchContent(url, options);
    
    // Parse with unified parser
    const parsed = await this.parser.parse(html, {
      url,
      source: options?.source || 'auto',
      features: options?.features || 'all',
      depth: options?.depth || 1
    });
    
    // Follow links if needed
    if (options?.followLinks && parsed.links) {
      await this.enrichWithLinkedContent(parsed, options);
    }
    
    // Format for domain
    const formatted = this.formatForDomain(parsed);
    
    // Cache result
    await this.cache.set(url, formatted);
    
    return formatted;
  }

  private async enrichWithLinkedContent(
    parsed: ParsedContent, 
    options: ExtractOptions
  ): Promise<void> {
    const linkBatches = this.batchLinks(parsed.links, options.batchSize || 5);
    
    for (const batch of linkBatches) {
      const enrichments = await Promise.all(
        batch.map(link => this.fetchEnrichment(link, options))
      );
      
      this.mergeEnrichments(parsed, enrichments);
      
      // Delay between batches
      if (options.batchDelay) {
        await new Promise(resolve => setTimeout(resolve, options.batchDelay));
      }
    }
  }
}
```

### Phase 5: Testing & Migration (Week 5-6)

#### 5.1 Comprehensive Test Suite

```typescript
// UnifiedParserTests.ts
describe('UnifiedParser', () => {
  describe('Format Detection', () => {
    test('should detect Fandom wiki', async () => {
      const html = await loadFixture('fandom-wiki.html');
      const format = detector.detectFormat(html);
      expect(format.primary.name).toBe('fandom-modern');
      expect(format.confidence).toBeGreaterThan(0.9);
    });

    test('should detect Wikipedia', async () => {
      const html = await loadFixture('wikipedia.html');
      const format = detector.detectFormat(html);
      expect(format.primary.name).toBe('wikipedia');
    });

    test('should handle ambiguous formats', async () => {
      const html = await loadFixture('ambiguous-wiki.html');
      const format = detector.detectFormat(html);
      expect(format.alternatives).toHaveLength(2);
    });
  });

  describe('Table Extraction', () => {
    test('should extract standard volume table', async () => {
      const html = await loadFixture('standard-volume-table.html');
      const tables = await extractor.extractTables(html);
      expect(tables[0].type).toBe('volume');
      expect(tables[0].volumes).toHaveLength(25);
    });

    test('should extract gallery-based volumes', async () => {
      const html = await loadFixture('black-clover-gallery.html');
      const tables = await extractor.extractTables(html);
      expect(tables[0].type).toBe('gallery');
      expect(tables[0].volumes[0].coverImage).toBeDefined();
    });

    test('should extract story arc table', async () => {
      const html = await loadFixture('one-piece-arcs.html');
      const tables = await extractor.extractTables(html);
      expect(tables[0].type).toBe('story-arc');
      expect(tables[0].arcs).toHaveLength(10);
    });

    // Add 50+ more test cases
  });

  describe('Pattern Learning', () => {
    test('should learn from annotated examples', async () => {
      const html = await loadFixture('annotated-example.html');
      const annotations = loadAnnotations('example-annotations.json');
      
      await learner.learnFromExample(html, annotations);
      
      const newHtml = await loadFixture('similar-structure.html');
      const extracted = await parser.parse(newHtml);
      
      expect(extracted.metadata.author).toBe('Expected Author');
    });
  });
});
```

#### 5.2 Migration Strategy

```typescript
// MigrationManager.ts
export class MigrationManager {
  private oldParsers: Map<string, any>;
  private unifiedParser: UnifiedParser;
  private comparisonLogger: ComparisonLogger;
  
  async migrateProvider(providerName: string): Promise<MigrationResult> {
    const oldParser = this.oldParsers.get(providerName);
    const testUrls = await this.getTestUrls(providerName);
    const results: ComparisonResult[] = [];
    
    for (const url of testUrls) {
      // Extract with old parser
      const oldResult = await oldParser.extract(url);
      
      // Extract with unified parser
      const newResult = await this.unifiedParser.extract(url);
      
      // Compare results
      const comparison = this.compareResults(oldResult, newResult);
      results.push(comparison);
      
      // Log differences
      if (comparison.hasDifferences) {
        this.comparisonLogger.log(providerName, url, comparison);
      }
    }
    
    // Generate migration report
    return {
      provider: providerName,
      testCount: testUrls.length,
      successRate: this.calculateSuccessRate(results),
      differences: this.summarizeDifferences(results),
      recommendation: this.generateRecommendation(results)
    };
  }

  private compareResults(oldResult: any, newResult: any): ComparisonResult {
    const comparison: ComparisonResult = {
      hasDifferences: false,
      fields: {}
    };
    
    // Compare each field
    const fields = [
      'title', 'author', 'artist', 'publisher', 
      'volumes', 'chapters', 'status', 'genres'
    ];
    
    for (const field of fields) {
      const oldValue = oldResult[field];
      const newValue = newResult[field];
      
      if (!this.valuesEqual(oldValue, newValue)) {
        comparison.hasDifferences = true;
        comparison.fields[field] = {
          old: oldValue,
          new: newValue,
          improvement: this.assessImprovement(oldValue, newValue)
        };
      }
    }
    
    return comparison;
  }
}
```

## Implementation Timeline

### Week 1: Core Foundation
- [ ] Day 1-2: Implement FormatDetector with 20+ detection rules
- [ ] Day 3-4: Build PatternLibrary with 100+ patterns
- [ ] Day 5: Create ExtractorUtilities consolidation

### Week 2: Extraction Engine
- [ ] Day 1-2: Implement TableExtractor with all patterns
- [ ] Day 3-4: Build MetadataExtractor with field mappings
- [ ] Day 5: Create ImageExtractor with CDN handling

### Week 3: Advanced Features
- [ ] Day 1-2: Implement PatternLearner
- [ ] Day 3-4: Build dynamic format adaptation
- [ ] Day 5: Create enrichment system

### Week 4: Integration
- [ ] Day 1-2: Build adapter layer
- [ ] Day 3-4: Implement caching and rate limiting
- [ ] Day 5: Create backward compatibility layer

### Week 5: Testing
- [ ] Day 1-2: Unit tests (200+ test cases)
- [ ] Day 3-4: Integration tests
- [ ] Day 5: Performance benchmarking

### Week 6: Migration
- [ ] Day 1-2: Migrate Fandom providers
- [ ] Day 3-4: Migrate Wikipedia providers
- [ ] Day 5: Documentation and training

## Success Metrics

### Performance Targets
- **Extraction Accuracy**: ≥95% parity with existing parsers
- **New Format Support**: 50+ wiki formats
- **Processing Speed**: 2x faster than current system
- **Memory Usage**: 50% reduction
- **Code Reduction**: 60-70% fewer lines

### Quality Metrics
- **Test Coverage**: >90%
- **Pattern Recognition**: 95% accuracy
- **Format Detection**: 99% accuracy
- **Error Recovery**: 100% graceful degradation

## Risk Mitigation

### Technical Risks
1. **Pattern Complexity**: Some patterns may be too complex
   - Mitigation: Fallback to simpler patterns
   - Backup: Keep original parser as fallback

2. **Performance Regression**: Unified parser might be slower
   - Mitigation: Aggressive caching
   - Backup: Parallel processing

3. **Compatibility Issues**: Breaking changes for consumers
   - Mitigation: Adapter layer
   - Backup: Versioned API

### Migration Risks
1. **Data Loss**: Missing fields during migration
   - Mitigation: Comprehensive comparison testing
   - Backup: Dual-run period

2. **User Disruption**: Changes in extraction quality
   - Mitigation: A/B testing
   - Backup: Feature flag rollout

## Maintenance Plan

### Documentation
- Comprehensive API documentation
- Pattern library reference
- Format detection guide
- Migration guide
- Troubleshooting guide

### Monitoring
- Extraction success rates
- Pattern match rates
- Performance metrics
- Error rates
- Format detection accuracy

### Updates
- Weekly pattern library updates
- Monthly format detection improvements
- Quarterly performance optimization
- Continuous learning from new formats

## Conclusion

The Unified Parser will consolidate 45,000+ lines of code into a maintainable, extensible system of approximately 5,000-8,000 lines while preserving all functionality and adding dynamic format detection. The modular architecture ensures easy maintenance and the ability to adapt to new formats without code changes.