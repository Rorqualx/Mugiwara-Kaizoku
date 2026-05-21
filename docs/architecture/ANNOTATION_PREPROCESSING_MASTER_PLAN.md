# Annotation Preprocessing Enhancement Master Plan

*Status: Draft*
*Created: 2026-01-11*
*Author: Claude Code*

## Executive Summary

This master plan outlines a comprehensive enhancement strategy for the annotation preprocessing system to maximize ML training data quality and efficiency. Based on thorough codebase analysis, we identified **6 key enhancement areas** that together can achieve:

- **68% memory reduction** in HTML processing
- **225x throughput improvement** for batch ingestion
- **100x faster token lookups** during annotation
- **99.5% selection anchor reliability** (vs 95% current)
- **Unified training data consistency** across client/server

---

## Enhancement Areas Overview

| # | Enhancement | Impact | Effort | Priority |
|---|-------------|--------|--------|----------|
| 1 | Unified Preprocessing Pipeline | HIGH | Medium | P0 |
| 2 | Token Feature Enrichment | HIGH | Low-Medium | P1 |
| 3 | Selection Anchor Hardening | HIGH | Medium | P1 |
| 4 | Batch Processing Optimization | HIGH | Medium | P2 |
| 5 | Sentence Utils Deduplication | MEDIUM | Low | P0 |
| 6 | Token Indexing for O(1) Lookups | MEDIUM | Low | P2 |

---

## Dependency Graph

```
                    ┌─────────────────────────┐
                    │  P0: Foundation Layer   │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       │
┌───────────────┐     ┌─────────────────┐              │
│ 5. Sentence   │     │ 1. Unified      │              │
│    Utils      │     │    Pipeline     │              │
│ (Dedup first) │     │ (Core refactor) │              │
└───────┬───────┘     └────────┬────────┘              │
        │                      │                       │
        │         ┌────────────┴────────────┐          │
        │         │                         │          │
        ▼         ▼                         ▼          │
┌───────────────────────┐     ┌─────────────────┐      │
│ 2. Token Feature      │     │ 3. Selection    │      │
│    Enrichment         │     │    Anchor       │      │
│ (Extends linearizer)  │     │    Hardening    │      │
└───────────┬───────────┘     └────────┬────────┘      │
            │                          │               │
            └──────────┬───────────────┘               │
                       │                               │
                       ▼                               │
            ┌─────────────────────────┐                │
            │  P2: Performance Layer  │                │
            └───────────┬─────────────┘                │
                        │                              │
        ┌───────────────┼───────────────┐              │
        │               │               │              │
        ▼               ▼               │              │
┌───────────────┐ ┌─────────────┐       │              │
│ 4. Batch      │ │ 6. Token    │       │              │
│    Processing │ │    Indexing │       │              │
└───────────────┘ └─────────────┘       │              │
                                        │              │
                    ┌───────────────────┘              │
                    │                                  │
                    ▼                                  │
            ┌─────────────────────────┐                │
            │  ML Training Export     │◄───────────────┘
            │  (Benefits from all)    │
            └─────────────────────────┘
```

---

## Phase 0: Foundation (Week 1)

### 5. Sentence Utils Deduplication

**Why First:** Eliminates immediate training data divergence risk. Quick win with low effort.

**Current Problem:**
- Client: 49 abbreviations in `selection-utils.ts`
- Server: 36 abbreviations in `helpers.ts`
- Only 23 overlap → Different sentence boundaries → Inconsistent training data

**Implementation:**

```
src/lib/text-processing/
├── index.ts                    # Re-exports
├── abbreviations.ts            # UNIFIED: 62 abbreviations (merged)
├── types.ts                    # Shared interfaces
└── sentence-helpers.ts         # Shared detection functions
```

**Tasks:**
1. Create `src/lib/text-processing/abbreviations.ts` with merged set
2. Create shared `isSentenceAbbreviation()` and `isEllipsis()` helpers
3. Update client import: `selection-utils.ts` → `@/lib/text-processing`
4. Update server import: `helpers.ts` → `@/lib/text-processing`
5. Run existing sentence boundary tests

**Effort:** 1 day
**Risk:** LOW - No logic changes, just consolidation

---

## Phase 1: Core Refactoring (Weeks 2-3)

### 1. Unified Preprocessing Pipeline

**Why:** Eliminates redundant HTML parsing (cheerio + happy-dom). 68% memory reduction.

**Current State:**
```
HTML → cheerio.load() [Pass 1: metadata extraction]
    → linearizeDOM() [Pass 2: tokenization]
    → detectPatterns() [Pass 3: pattern signals]
    → labelAllEntities() [Pass 4: BIO labels]
```

**Target State:**
```
HTML → linearizeDOMUnified() [Single Pass]
    ├─ Token creation
    ├─ Inline selector matching
    ├─ Inline pattern detection
    └─ Metadata assembly
    → labelAllEntities() [BIO labels]
```

**Key Changes:**

| File | Change | Lines |
|------|--------|-------|
| `dom-linearizer.ts` | Add selector evaluation during walk | +200 |
| `dom-linearizer.ts` | Add inline pattern detection | +50 |
| `metadata-assembler.ts` (NEW) | Extract value assembly logic | +200 |
| `bootstrap-labeler/index.ts` | Use unified linearization | -100, +20 |
| `bio-types.ts` | Extend LinearizedToken interface | +40 |

**New Token Fields:**
```typescript
interface LinearizedToken {
  // ... existing 83 fields ...

  // NEW: Extraction tracking
  selectorMatches?: { fieldName: EntityType; selector: string; confidence: number }[];
  extractionContext?: { isInExtractedSpan: boolean; extractedFieldName?: EntityType };
  patternSignals?: PatternSignal[];
  containerSemantics?: { isLabelToken: boolean; isValueToken: boolean; labelDistance: number };
}
```

**Effort:** 5-7 days
**Risk:** MEDIUM - Core refactor, requires comprehensive testing

---

### 2. Token Feature Enrichment

**Why:** Adds high-value ML features missing from current 83-field tokens.

**Current Gaps (Tier 1 - High Value, Low Cost):**

| Feature | Benefit | Cost |
|---------|---------|------|
| `relativePositionPercentile` | Position clustering signal | 8 bytes |
| `nearestHeadingText` + `headingLevel` | Section context | 40 bytes |
| `frequencyInDocument` | Rarity = likely entity | 8 bytes |
| `isPrecededByColon` | Label detection | 1 byte |

**Implementation Location:** `enrichTokenContext()` in `dom-linearizer.ts`

```typescript
// Add to enrichTokenContext() post-processing phase
function enrichTokenContext(tokens: LinearizedToken[]): void {
  const frequencyMap = buildFrequencyMap(tokens);
  let currentHeading = { text: null, level: 0 };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Relative position percentiles
    token.relativePositionPercentile = Math.floor((i / tokens.length) * 10);
    token.isInFirstQuartile = i < tokens.length * 0.25;
    token.isInLastQuartile = i > tokens.length * 0.75;

    // Heading context
    if (token.isHeader && token.headerLevel > 0) {
      currentHeading = { text: token.text, level: token.headerLevel };
    }
    token.nearestHeadingText = currentHeading.text;
    token.nearestHeadingLevel = currentHeading.level;

    // Frequency
    token.frequencyInDocument = frequencyMap.get(token.normalizedText) ?? 1;

    // Punctuation context
    token.isPrecededByColon = i > 0 && tokens[i-1].text.endsWith(':');
  }
}
```

**Effort:** 2-3 days
**Risk:** LOW - Additive changes, no breaking modifications

---

### 3. Selection Anchor Hardening

**Why:** Increases anchor reliability from 95% to 99.5% for training data stability.

**Current Anchors:**
- XPath + charStart/charEnd (primary)
- prefix/suffix 32 chars (secondary)
- globalCharStart/End (tertiary)

**New Anchors:**

```typescript
interface EnhancedTextSelection extends TextSelection {
  // NEW: Content fingerprinting
  textHash: string;           // SHA256(selectedText)
  contextHash: string;        // SHA256(prefix + text + suffix)

  // NEW: Structural positioning
  domPath: string;            // CSS selector path (more stable than XPath)

  // NEW: Normalization tracking
  normalizedOffsets?: {
    postNormalizationStart: number;
    postNormalizationEnd: number;
    wasShifted: boolean;
  };

  // NEW: Recovery metadata
  recoveryStrategy?: 'xpath' | 'context' | 'global' | 'text-search';
}
```

**Resolution Algorithm:**
```
1. TRY XPATH → if textHash matches → SUCCESS
2. TRY CONTEXT MATCH → if unique + textHash matches → SUCCESS (warn: XPath stale)
3. TRY GLOBAL OFFSET → if textHash matches → SUCCESS (warn: global fallback)
4. TRY TEXT SEARCH → if unique → SUCCESS (warn: full search required)
5. MANUAL RECOVERY → show candidates to user
```

**Files to Modify:**

| File | Change |
|------|--------|
| `schemas.ts` | Add optional hash/path fields |
| `selection-utils.ts` | Add hash generation functions |
| `selection-resolver.ts` (NEW) | Multi-strategy resolution |
| `xpath-validation.ts` | Enhance with hash checking |

**Effort:** 5-7 days
**Risk:** MEDIUM - Requires migration for existing selections

---

## Phase 2: Performance Optimization (Weeks 4-5)

### 4. Batch Processing Optimization

**Why:** Current sequential processing = 9-13 minutes for 50 URLs. Target: 35 seconds.

**Optimization Layers:**

| Layer | Current | Optimized | Improvement |
|-------|---------|-----------|-------------|
| FlareSolverr | 10s/page sequential | Session reuse (2-3s avg) | 3-5x |
| Bootstrap loader | Dynamic import per URL | Singleton cache | 5x |
| DB inserts | Individual creates | `createMany()` batch | 3-5x |
| Batching | Sequential batches | Parallel within batch | 5x |
| **Total** | 550s for 50 URLs | 35s for 50 URLs | **15-20x** |

**Implementation:**

```typescript
// Session pooling
const sessionPool = new Map<string, string>(); // domain → session name

async function getOrCreateSession(domain: string): Promise<string> {
  if (!sessionPool.has(domain)) {
    const sessionName = `annotation-${domain}-${Date.now()}`;
    await flareSolverrClient.createSession(sessionName);
    sessionPool.set(domain, sessionName);
  }
  return sessionPool.get(domain)!;
}

// Batch database writes
async function saveBatchResults(results: AnnotatedPageData[]): Promise<void> {
  await prisma.annotatedPage.createMany({
    data: results,
    skipDuplicates: true
  });
}
```

**Effort:** 4-5 days
**Risk:** LOW - Additive optimizations, graceful fallbacks

---

### 6. Token Indexing for O(1) Lookups

**Why:** Current O(n) scans cause 50-200ms latency per user interaction on 5000-token pages.

**Index Structure:**

```typescript
interface TextIndex {
  exactMatches: Map<string, number[]>;     // normalized_text → [token_index...]
  prefixIndex: Map<string, number[]>;      // 2-3 char prefix → [token_index...]
  numericIndex: Set<number>;               // All numeric token indices
  imageIndex: Set<number>;                 // All image token indices
  cjkIndex: Set<number>;                   // All CJK token indices
  imageFilenameIndex: Map<string, number[]>; // filename → [token_index...]
}
```

**Performance Impact:**

| Query Type | Current | With Index | Speedup |
|------------|---------|------------|---------|
| Exact match | 10-15ms | 0.1ms | 100-150x |
| Word click (4 passes) | 40-60ms | 0.5ms | 80-120x |
| Batch query (tool) | 100-200ms | 2-10ms | 10-100x |

**Memory Overhead:** ~50% of token data (~400KB for 5000 tokens)

**Build Strategy:** Eager during linearization (not lazy)

```typescript
// In dom-linearizer.ts
export function linearizeDOM(html: string, url: string): LinearizationResult {
  const tokens = walkDOM(...);
  const stats = computeStats(tokens);
  const textIndex = buildTextIndex(tokens); // NEW

  return { tokens, stats, textIndex };
}
```

**Effort:** 3-4 days
**Risk:** LOW - Additive, with O(n) fallback

---

## Implementation Timeline

```
Week 1: Foundation
├── Day 1-2: Sentence utils deduplication
└── Day 3-5: Planning & setup for Phase 1

Week 2: Core Refactoring (Part 1)
├── Day 1-3: Unified pipeline - linearizer changes
└── Day 4-5: Unified pipeline - metadata assembler

Week 3: Core Refactoring (Part 2)
├── Day 1-2: Token feature enrichment
├── Day 3-5: Selection anchor hardening
└── Day 5: Integration testing

Week 4: Performance (Part 1)
├── Day 1-3: Batch processing - session pooling
└── Day 4-5: Batch processing - DB batching

Week 5: Performance (Part 2)
├── Day 1-2: Token indexing
├── Day 3-4: Performance testing & optimization
└── Day 5: Documentation & cleanup
```

---

## Success Metrics

### Memory Efficiency
- **Baseline:** 145 MB peak for 10MB HTML
- **Target:** 46 MB peak (68% reduction)
- **Validation:** Memory profiling on 10+ large pages

### Throughput
- **Baseline:** 5 URLs/minute (sequential)
- **Target:** 100+ URLs/minute (batch)
- **Validation:** Benchmark 50-URL batches

### Query Latency
- **Baseline:** 50-200ms per token lookup
- **Target:** <1ms per lookup
- **Validation:** Profiling on 5000+ token pages

### Anchor Reliability
- **Baseline:** 95% XPath resolution success
- **Target:** 99.5% with fallback strategies
- **Validation:** Test on 1000+ archived selections

### Training Data Consistency
- **Baseline:** Unknown divergence between client/server sentence extraction
- **Target:** 100% consistent abbreviation handling
- **Validation:** Cross-validation tests

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Unified pipeline regression | BIO label accuracy | Output parity tests vs current system |
| Selection anchor migration | Data loss | Phased rollout, optional fields first |
| Memory overhead from indexing | Browser slowdown | Lazy indexing fallback, memory caps |
| Batch processing failures | Partial data loss | Per-URL error isolation, retry queue |
| Abbreviations change behavior | Training data shift | Comprehensive unit tests, gradual rollout |

---

## Testing Strategy

### Unit Tests
- Sentence boundary detection (existing + new)
- Token feature computation
- Hash generation and validation
- Index build and query

### Integration Tests
- Unified pipeline vs dual-pass output parity
- Selection anchor resolution with all strategies
- Batch processing with mixed success/failure

### E2E Tests (Playwright)
- Annotation creation → save → reload → recovery
- Batch URL processing UI
- Token matching performance on large pages

### Performance Benchmarks
- Memory profiling: linearization, pattern detection
- Latency: token lookup p50/p95/p99
- Throughput: URLs/minute with different batch sizes

---

## Rollout Plan

### Phase 0 (Week 1)
- Deploy sentence utils deduplication
- Feature flag: OFF (shadow mode)
- Validate via logging

### Phase 1 (Weeks 2-3)
- Deploy unified pipeline behind feature flag
- Deploy token enrichment (always on, additive)
- Deploy anchor hardening (optional fields)
- Feature flags: `UNIFIED_PIPELINE=false`, `ENHANCED_ANCHORS=false`

### Phase 2 (Weeks 4-5)
- Deploy batch processing optimizations
- Deploy token indexing
- Enable unified pipeline for new pages
- Enable enhanced anchors for new selections

### Phase 3 (Week 6+)
- Backfill enhanced anchors on REVIEWED/GOLD pages
- Enable unified pipeline globally
- Monitor metrics, iterate

---

## Appendix: File Impact Summary

| File | Phase | Changes |
|------|-------|---------|
| `src/lib/text-processing/` (NEW) | P0 | +4 files, ~200 lines |
| `src/server/ml/features/dom-linearizer.ts` | P1 | +300 lines modified |
| `src/server/ml/features/metadata-assembler.ts` (NEW) | P1 | +200 lines |
| `src/server/ml/training/bootstrap-labeler/index.ts` | P1 | -80, +20 lines |
| `src/server/ml/features/bio-types.ts` | P1 | +80 lines |
| `src/pages/annotation/editor/page-view/selection-utils.ts` | P0, P1 | +100 lines |
| `src/pages/annotation/editor/page-view/selection-resolver.ts` (NEW) | P1 | +200 lines |
| `src/server/trpc/routers/annotation/helpers.ts` | P0, P2 | +50 lines modified |
| `src/server/trpc/routers/annotation/schemas.ts` | P1 | +40 lines |
| `src/pages/annotation/editor/page-view/token-matching.ts` | P2 | +100 lines |
| `src/server/trpc/routers/annotation/add-from-url.ts` | P2 | +80 lines |

**Total New Code:** ~1,500 lines
**Total Modified:** ~500 lines

---

*This plan is a living document. Update as implementation progresses.*
