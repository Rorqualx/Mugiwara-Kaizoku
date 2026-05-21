# Unified Dynamic Parser Architecture

## Executive Summary

This document outlines the migration from hardcoded wiki mappings to a comprehensive dynamic unified structure recognition system for the Fandom service. The new architecture will automatically detect and adapt to different wiki structures without requiring manual configuration.

## Current Problems

### 1. Hardcoded Mappings
- **Fire Force specific URLs**: `fire-force.fandom.com` hardcoded in multiple files
- **Series mappings**: 16+ series with hardcoded wiki domains and page paths
- **Volume/Chapter pages**: Static mappings for specific series
- **Wiki priorities**: Fixed list of prioritized wikis

### 2. Structure Recognition Failures
Based on analysis scripts, common failure patterns include:
- **Tabbed interfaces** (`.tabber`, `.wds-tabber`)
- **Category pages** instead of structured lists
- **Part-based organization** (e.g., JoJo's Bizarre Adventure)
- **Collapsible sections** (`.mw-collapsible`)
- **Gallery layouts** for volumes
- **Definition lists** instead of tables (Fire Force)
- **JavaScript-rendered content**

### 3. Parser Limitations
- No universal table parser
- Limited support for dynamic content
- Inflexible selector patterns
- No learning capability from successful extractions

## Proposed Architecture

### 1. Dynamic Structure Detection Engine

```typescript
interface StructureDetector {
  // Analyze page and detect structure type
  detectStructure(html: string): Promise<PageStructure>;
  
  // Learn from successful extractions
  learnPattern(structure: PageStructure, extractedData: any): void;
  
  // Confidence scoring for detection
  getConfidence(): number;
}

interface PageStructure {
  type: StructureType;
  selectors: DynamicSelectors;
  patterns: ContentPatterns;
  confidence: number;
  metadata: StructureMetadata;
}

enum StructureType {
  TABLE_BASED = 'table_based',
  TABBED_INTERFACE = 'tabbed_interface',
  DEFINITION_LIST = 'definition_list',
  GALLERY_BASED = 'gallery_based',
  CATEGORY_PAGE = 'category_page',
  COLLAPSIBLE_SECTIONS = 'collapsible_sections',
  HYBRID = 'hybrid'
}
```

### 2. Adaptive Selector System

```typescript
interface DynamicSelectors {
  // Primary content selectors
  content: SelectorStrategy[];
  
  // Fallback strategies
  fallbacks: SelectorStrategy[];
  
  // Context-aware selectors
  contextual: Map<string, SelectorStrategy>;
}

interface SelectorStrategy {
  selector: string;
  type: 'css' | 'xpath' | 'regex' | 'semantic';
  priority: number;
  confidence: number;
  extractionMethod: ExtractionMethod;
}
```

### 3. Pattern Learning System

```typescript
interface PatternLearner {
  // Analyze successful extractions
  analyzeSuccess(input: string, output: ExtractedData): Pattern;
  
  // Store learned patterns
  storePattern(pattern: Pattern): void;
  
  // Retrieve similar patterns
  findSimilarPatterns(structure: PageStructure): Pattern[];
  
  // Update pattern confidence
  updateConfidence(patternId: string, success: boolean): void;
}
```

### 4. Content Extraction Pipeline

```typescript
class UnifiedExtractionPipeline {
  private detector: StructureDetector;
  private extractors: Map<StructureType, Extractor>;
  private learner: PatternLearner;
  private cache: ExtractionCache;
  
  async extract(url: string, html: string): Promise<ExtractedData> {
    // 1. Detect structure
    const structure = await this.detector.detectStructure(html);
    
    // 2. Select appropriate extractor
    const extractor = this.extractors.get(structure.type);
    
    // 3. Apply extraction with fallbacks
    const data = await this.extractWithFallbacks(extractor, html, structure);
    
    // 4. Learn from extraction
    if (data.success) {
      this.learner.analyzeSuccess(html, data);
    }
    
    return data;
  }
}
```

## Implementation Phases

### Phase 1: Remove Hardcoded Mappings
1. Create `DynamicWikiResolver` to replace static mappings
2. Implement wiki discovery through search
3. Remove all hardcoded series mappings
4. Create fallback mechanisms

### Phase 2: Implement Structure Detection
1. Build `StructureDetector` with pattern matching
2. Create extractors for each structure type:
   - TableExtractor
   - TabbedExtractor
   - DefinitionListExtractor
   - GalleryExtractor
   - CategoryExtractor
   - CollapsibleExtractor
3. Implement confidence scoring

### Phase 3: Adaptive Selector System
1. Build dynamic selector generation
2. Implement fallback chains
3. Create context-aware selection
4. Add semantic selectors using NLP

### Phase 4: Pattern Learning
1. Implement pattern storage in database
2. Create similarity matching algorithms
3. Build confidence tracking system
4. Add reinforcement learning

### Phase 5: Integration & Migration
1. Replace existing FandomService methods
2. Migrate existing extractors to new system
3. Update all dependent services
4. Add monitoring and analytics

## Key Components to Build

### 1. DynamicWikiResolver
```typescript
class DynamicWikiResolver {
  async resolveWiki(query: string): Promise<WikiInfo> {
    // Search across fandom network
    const candidates = await this.searchFandomNetwork(query);
    
    // Score candidates
    const scored = this.scoreCandidates(candidates, query);
    
    // Return best match
    return scored[0];
  }
  
  private async searchFandomNetwork(query: string): Promise<WikiCandidate[]> {
    // Use Fandom's search API
    // No hardcoded domains
  }
}
```

### 2. StructureAnalyzer
```typescript
class StructureAnalyzer {
  analyze($: CheerioAPI): StructureAnalysis {
    return {
      tables: this.analyzeTables($),
      lists: this.analyzeLists($),
      tabbers: this.analyzeTabbers($),
      galleries: this.analyzeGalleries($),
      collapsibles: this.analyzeCollapsibles($),
      categories: this.analyzeCategories($)
    };
  }
  
  private analyzeTables($: CheerioAPI): TableAnalysis {
    const tables = $('table').not('.navbox');
    return {
      count: tables.length,
      largestSize: Math.max(...tables.map((_, t) => $(t).find('tr').length).get()),
      hasVolumeHeaders: tables.filter((_, t) => $(t).text().includes('Volume')).length > 0,
      hasChapterHeaders: tables.filter((_, t) => $(t).text().includes('Chapter')).length > 0
    };
  }
}
```

### 3. AdaptiveExtractor
```typescript
class AdaptiveExtractor {
  async extract(html: string, hints?: ExtractionHints): Promise<ExtractedData> {
    const $ = cheerio.load(html);
    const structure = new StructureAnalyzer().analyze($);
    
    // Try extraction strategies in order of confidence
    const strategies = this.rankStrategies(structure, hints);
    
    for (const strategy of strategies) {
      try {
        const result = await strategy.extract($);
        if (this.validateResult(result)) {
          return result;
        }
      } catch (error) {
        // Log and try next strategy
        continue;
      }
    }
    
    // Return best effort result
    return this.bestEffortExtraction($);
  }
}
```

## Pattern Recognition Patterns Discovered

From analysis scripts, key patterns to recognize:

### 1. Table Patterns
- **Single large table**: 20+ rows with volume/chapter columns
- **Multiple small tables**: One per volume
- **Nested tables**: Chapters within volume rows
- **Split tables**: Separate tables for different parts/arcs

### 2. List Patterns
- **Definition lists**: `<dl>`, `<dt>`, `<dd>` (Fire Force)
- **Unordered lists**: Chapters as `<li>` items
- **Nested lists**: Volumes containing chapter sublists

### 3. Special Structures
- **Tabbed interfaces**: Content in `.tabbertab` divs
- **Collapsible sections**: Hidden by default, need expansion
- **Gallery grids**: Volume covers in gallery format
- **Category pages**: Links to individual chapter pages

## Migration Strategy

### Step 1: Create Parallel System
1. Build new dynamic system alongside existing
2. Add feature flag for gradual rollout
3. Compare results between systems

### Step 2: Remove Hardcoded Mappings
```typescript
// OLD (Remove)
export const seriesMainPages: Record<string, string> = {
  'fire force': 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)',
  // ... other hardcoded mappings
};

// NEW (Replace with)
class DynamicPageResolver {
  async resolveMainPage(series: string): Promise<string> {
    const wiki = await this.findWiki(series);
    const mainPage = await this.discoverMainPage(wiki);
    return mainPage;
  }
}
```

### Step 3: Update Service Layer
```typescript
// Update FandomService
class FandomService {
  private resolver: DynamicWikiResolver;
  private extractor: AdaptiveExtractor;
  
  async searchManga(query: string): Promise<FandomSearchResult[]> {
    // No hardcoded wikis
    const wiki = await this.resolver.resolveWiki(query);
    return this.searchInWiki(wiki, query);
  }
  
  async extractChapters(url: string): Promise<FandomChapter[]> {
    const html = await this.fetchPage(url);
    // No hardcoded selectors
    return this.extractor.extract(html, { type: 'chapters' });
  }
}
```

## Success Metrics

1. **Coverage**: % of wikis successfully parsed (target: 95%)
2. **Accuracy**: Extraction accuracy vs manual verification (target: 98%)
3. **Performance**: Average extraction time (target: <500ms)
4. **Learning**: Pattern recognition improvement over time
5. **Maintenance**: Reduction in manual updates required

## Testing Strategy

### 1. Unit Tests
- Test each extractor independently
- Mock various wiki structures
- Validate extraction accuracy

### 2. Integration Tests
- Test against real wiki pages
- Compare with expected results
- Monitor for regressions

### 3. A/B Testing
- Run both systems in parallel
- Compare results
- Measure performance differences

### 4. Continuous Learning
- Log all extractions
- Monitor failures
- Update patterns based on failures

## Monitoring & Analytics

### 1. Extraction Metrics
```typescript
interface ExtractionMetrics {
  wikiDomain: string;
  structureType: StructureType;
  extractionTime: number;
  confidence: number;
  success: boolean;
  fallbacksUsed: number;
  dataCompleteness: number;
}
```

### 2. Pattern Performance
```typescript
interface PatternMetrics {
  patternId: string;
  usageCount: number;
  successRate: number;
  averageConfidence: number;
  lastUpdated: Date;
}
```

## Timeline

- **Week 1-2**: Remove hardcoded mappings, implement DynamicWikiResolver
- **Week 3-4**: Build StructureDetector and basic extractors
- **Week 5-6**: Implement adaptive selector system
- **Week 7-8**: Add pattern learning capabilities
- **Week 9-10**: Integration, testing, and migration
- **Week 11-12**: Monitoring, optimization, and documentation

## Conclusion

This unified dynamic parser architecture will:
1. Eliminate all hardcoded mappings
2. Automatically adapt to different wiki structures
3. Learn from successful extractions
4. Provide better coverage and accuracy
5. Reduce maintenance overhead
6. Enable continuous improvement through ML

The system will be more robust, scalable, and maintainable than the current hardcoded approach.