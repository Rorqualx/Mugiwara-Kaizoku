# Plan vs Existing Implementation: Comparison Analysis

*Created: 2026-01-18*

## Executive Summary

The existing annotation implementation is a **production-ready NER (Named Entity Recognition) system** focused on sequence labeling with BIO tags for training Transformer-CRF models. The new plan proposes a **general-purpose LLM training data pipeline** with broader scope including instruction tuning, Q&A, and multi-modal data.

**Key Finding:** These are **complementary systems** that serve different training objectives. The existing system excels at structured entity extraction; the plan addresses general LLM fine-tuning needs.

---

## Side-by-Side Comparison

### 1. Core Purpose

| Aspect | Existing Implementation | New Plan |
|--------|------------------------|----------|
| **Primary Goal** | Train Transformer-CRF for manga metadata extraction | General LLM fine-tuning data pipeline |
| **Model Type** | Sequence labeling (NER) | Instruction tuning, Q&A, conversation |
| **Output** | BIO-tagged token sequences | JSONL instruction pairs, Alpaca/ShareGPT formats |
| **Focus** | Entity extraction (TITLE, AUTHOR, GENRE, etc.) | Document understanding, summarization, classification |

### 2. Data Schema

#### Existing: Token-Centric (70+ features per token)

```typescript
LinearizedToken {
  // Identity
  id, text, normalizedText, xpath, cssPath

  // DOM Structure
  tagName, domDepth, siblingIndex, parentId, childIds

  // Formatting
  isBold, isItalic, isHeader, headerLevel

  // Context
  isInTable, isInList, isInInfobox, isLink
  tableRow, tableCol, isTableHeader

  // Position
  documentPosition, charOffset, textLength

  // Token Classification
  tokenType, isNumeric, isDate, isPunctuation, isCJK

  // Semantic Patterns
  matchesDatePattern, matchesVolumePattern, matchesChapterPattern

  // Visual Features
  fontSize, fontWeight, color, backgroundColor

  // Context Signals
  precedingText, followingText, nearestLabelText
  sectionType, isFirstInElement, isLastInElement
}
```

#### Plan: Document-Centric (Segment-based)

```typescript
TrainingDocument {
  // Content
  markdown, plainText, segments[]

  // Assets
  images[], links[], media[]

  // Manga Context
  title, alternativeTitles, volume, chapter, genres

  // Quality
  score, extractionConfidence, language

  // Provenance
  adapter, version, rawDataHash
}
```

**Verdict:** Existing is **more granular** (token-level); Plan is **more holistic** (document-level). Both are needed for different tasks.

---

### 3. Label Taxonomy

#### Existing: BIO Entity Tags

```typescript
EntityType =
  | 'TITLE' | 'ALT_TITLE' | 'AUTHOR' | 'ARTIST'
  | 'STATUS' | 'GENRE' | 'TAG' | 'THEME'
  | 'VOLUME_COUNT' | 'CHAPTER_COUNT'
  | 'PUBLISHER' | 'MAGAZINE' | 'DEMOGRAPHIC'
  | 'RELEASE_DATE' | 'FORMAT' | 'CHARACTER'
  | 'URL' | 'SUMMARY'

BIOTag = 'O' | 'B-TITLE' | 'I-TITLE' | 'B-AUTHOR' | ...
```

#### Plan: Multi-Level Labels

```typescript
// Document-level
DocumentCategory = 'synopsis' | 'review' | 'analysis' | 'news' | 'reference' | ...
QualityLabel = 'high' | 'medium' | 'low' | 'exclude'
UseCaseLabel = 'instruction_tuning' | 'summarization' | 'qa' | 'classification' | ...

// Segment-level
SegmentContentType = 'title' | 'synopsis' | 'character_description' | 'plot_point' | ...

// Asset-level
ImageType = 'cover' | 'page' | 'panel' | 'character' | 'diagram' | ...
LinkRelevance = 'primary' | 'supporting' | 'tangential' | 'irrelevant'
```

**Verdict:** Existing has **precise entity boundaries**; Plan has **broader content classification**. Existing is better for extraction; Plan is better for filtering/routing.

---

### 4. Quality Metrics

#### Existing: Inter-Annotator Agreement

```typescript
AnnotationQualityMetric {
  alpha: Float          // Krippendorff's alpha (0-1)
  qualityLevel: String  // 'excellent' | 'good' | 'fair' | 'poor'
  entityScores: Json    // Per-entity alpha scores
  annotators: Json      // Annotator IDs compared
}
```

**Strengths:**
- Gold standard IAA measurement
- Per-entity quality tracking
- Statistical significance

#### Plan: Document Quality Scoring

```typescript
QualityMetrics {
  score: number              // 0-1 composite
  wordCount: number
  imageCount: number
  extractionConfidence: number
  hasStructuredContent: boolean
}
```

**Strengths:**
- Fast automated scoring
- Content richness signals
- Filtering efficiency

**Verdict:** Existing is **statistically rigorous**; Plan is **operationally efficient**. Recommend combining both.

---

### 5. Export Formats

#### Existing Formats

| Format | Structure | Use Case |
|--------|-----------|----------|
| **JSON** | `{tokens[], labels[], selections[]}` | Transformer-CRF training |
| **CONLL** | `token\tBIO-tag` per line | Standard NER format |
| **Context-enriched** | Token + surrounding sentences | Enhanced training |

#### Plan Formats

| Format | Structure | Use Case |
|--------|-----------|----------|
| **JSONL** | One record per line | Streaming, large datasets |
| **Parquet** | Columnar binary | High-performance, analytics |
| **Alpaca** | `{instruction, input, output}` | Instruction tuning |
| **ShareGPT** | `{conversations: [{from, value}]}` | Conversational fine-tuning |
| **NER** | `{text, entities: [{text, label, start, end}]}` | Entity recognition |

**Verdict:** Plan has **broader format support** for diverse LLM training; Existing is **specialized for NER**.

---

### 6. Workflow & Status Tracking

#### Existing: Annotation Lifecycle

```
BOOTSTRAP → IN_PROGRESS → REVIEWED → GOLD
                ↓
             REJECTED
```

- **BOOTSTRAP**: Auto-labeled by extractors
- **IN_PROGRESS**: Human annotating
- **REVIEWED**: First-pass review complete
- **GOLD**: Verified high-quality
- **REJECTED**: Unusable

#### Plan: Document Lifecycle

```
PENDING → RETRIEVED → LABELED → REVIEWED → EXPORTED
                                    ↓
                                ARCHIVED
```

**Verdict:** Similar concepts, different terminology. Existing has **BOOTSTRAP** for auto-labeling which is valuable.

---

### 7. UI Components

#### Existing Implementation

| Component | Purpose | Status |
|-----------|---------|--------|
| Annotation Dashboard | Overview, stats, bulk import | ✅ Built |
| Page Editor | Token-level BIO labeling | ✅ Built |
| Selection Toolbar | Text selection annotation | ✅ Built |
| Export Page | Format selection, filtering | ✅ Built |
| Quality Page | IAA metrics display | ✅ Built |
| Discovery Panel | Find pages from library | ✅ Built |

#### Plan Components

| Component | Purpose | Status |
|-----------|---------|--------|
| Document Viewer | Rendered document display | 📋 Planned |
| Label Panel | Multi-level labeling controls | 📋 Planned |
| Asset Gallery | Image/link labeling | 📋 Planned |
| Export Wizard | Format/filter configuration | 📋 Planned |

**Verdict:** Existing UI is **production-ready**; Plan describes **conceptual structure**. Can extend existing UI.

---

### 8. ML Infrastructure

#### Existing: Full MLOps Pipeline

```typescript
MLModelVersion {
  version: String           // Semantic versioning
  modelType: String         // transformer-crf, layoutlmv3
  backbone: String          // layoutlmv3-base
  trainingDataId: String    // Link to export
  metrics: Json             // {micro_f1, per_entity}
  config: Json              // Hyperparameters
  onnxPath: String          // Model file
  status: ModelStatus       // TRAINING → DEPLOYED
}
```

**Features:**
- Model versioning
- Training data lineage
- Metrics tracking
- ONNX deployment
- Status lifecycle

#### Plan: Export-Focused

```typescript
ExportResult {
  files: { path, format, split, recordCount }[]
  stats: { totalRecords, byCategory, avgQuality, tokenStats }
}
```

**Verdict:** Existing has **complete MLOps**; Plan focuses on **data preparation**. Existing is more mature.

---

## What Each Does Better

### Existing Implementation Excels At

| Capability | Why It's Better |
|------------|-----------------|
| **Token-level precision** | 70+ features per token enable fine-grained NER |
| **BIO labeling** | Industry-standard sequence labeling format |
| **Bootstrap labeling** | Auto-generates initial labels from extractors |
| **Quality metrics** | Krippendorff's alpha is statistically rigorous |
| **Model versioning** | Complete MLOps with training data lineage |
| **Production UI** | Fully built annotation editor with keyboard shortcuts |
| **Source-specific selectors** | CSS selectors per source (Fandom, Wikipedia, etc.) |

### New Plan Excels At

| Capability | Why It's Better |
|------------|-----------------|
| **Document-level understanding** | Captures overall content type, not just entities |
| **Multi-modal assets** | Explicit image/link labeling with context |
| **Diverse export formats** | Alpaca, ShareGPT for instruction tuning |
| **Broader use cases** | Summarization, Q&A, classification training |
| **Markdown normalization** | Clean text for general LLM consumption |
| **Quality filtering** | Fast automated scoring for large-scale filtering |
| **Segment-based structure** | Natural for document understanding tasks |

---

## What's Missing From Each

### Existing Implementation Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **No Markdown export** | Can't use for general LLM training | High |
| **No instruction format** | No Alpaca/ShareGPT export | High |
| **No image labeling** | Images referenced but not labeled | Medium |
| **No document-level labels** | Only token-level BIO tags | Medium |
| **No quality auto-scoring** | Relies on manual review | Medium |
| **No segment extraction** | Tokens only, not paragraphs/sections | Low |

### Plan Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **No BIO tagging** | Can't train NER models | High |
| **No token features** | Missing DOM structure signals | High |
| **No bootstrap labeling** | No auto-labeling from extractors | High |
| **No IAA calculation** | No statistical quality measure | Medium |
| **No model versioning** | No MLOps tracking | Medium |
| **No built UI** | Only conceptual structure | Medium |

---

## Recommendations for Enhancement

### 1. Unified Data Model (Combine Both)

Create a schema that supports both token-level and document-level:

```typescript
interface UnifiedTrainingDocument {
  // Document-level (from Plan)
  id: string;
  sourceUrl: string;
  content: {
    markdown: string;
    segments: Segment[];
  };
  documentLabels: {
    category: DocumentCategory;
    quality: QualityLabel;
    useCases: UseCaseLabel[];
  };

  // Token-level (from Existing)
  tokenization: {
    tokens: LinearizedToken[];    // 70+ features
    bioLabels: BIOTag[];          // Entity labels
    spans: TokenSpan[];           // Grouped entities
  };

  // Asset labeling (from Plan)
  assets: {
    images: LabeledImage[];
    links: LabeledLink[];
  };

  // Quality (Combined)
  quality: {
    autoScore: number;            // Fast automated (Plan)
    iaaScore?: number;            // Krippendorff's alpha (Existing)
    reviewStatus: AnnotationStatus;
  };
}
```

### 2. Enhanced Export Pipeline

Add new export formats to existing system:

```typescript
// Add to existing export-procedures.ts

type ExportFormat =
  | 'json'        // Existing
  | 'conll'       // Existing
  | 'jsonl'       // NEW: Streaming
  | 'parquet'     // NEW: Columnar
  | 'alpaca'      // NEW: Instruction tuning
  | 'sharegpt'    // NEW: Conversation
  | 'markdown'    // NEW: Clean text
  | 'ner-spans';  // NEW: Span-based NER

// Transform existing BIO tokens to instruction format
function toAlpacaFormat(page: AnnotatedPage): AlpacaRecord[] {
  return [
    {
      instruction: "Extract the manga title from this text",
      input: extractTextContext(page, 'TITLE'),
      output: extractEntityValue(page, 'TITLE'),
    },
    {
      instruction: "What is the publication status?",
      input: extractTextContext(page, 'STATUS'),
      output: extractEntityValue(page, 'STATUS'),
    },
    // ... more entity-based instructions
  ];
}
```

### 3. Document-Level Labels

Add document classification to existing schema:

```prisma
model AnnotatedPage {
  // ... existing fields ...

  // NEW: Document-level labels
  documentCategory   String?    // synopsis, review, analysis, etc.
  qualityTier        String?    // high, medium, low
  useCases           String[]   // instruction_tuning, summarization, etc.

  // NEW: Segment-level storage
  segments           Json?      // [{id, type, content, labels}]
}
```

### 4. Automated Quality Scoring

Add fast quality scoring alongside IAA:

```typescript
// Add to quality module

function computeAutoQualityScore(page: AnnotatedPage): number {
  const factors = {
    tokenCount: page.tokens.length,
    labeledRatio: countLabeled(page.labels) / page.tokens.length,
    entityDiversity: countUniqueEntities(page.labels),
    confidenceAvg: page.confidence ?? 0.5,
    structuredContent: hasInfobox(page.tokens) ? 0.1 : 0,
  };

  return weightedScore(factors);
}
```

### 5. Image Asset Labeling

Extend existing token system for images:

```typescript
// Images are already in LinearizedToken as:
// isImage, imageSrc, imageAlt, imageWidth, imageHeight

// Add image-specific labels:
interface ImageLabel {
  tokenId: string;           // Reference to image token
  imageType: 'cover' | 'page' | 'panel' | 'character' | 'diagram';
  quality: 'high' | 'medium' | 'low';
  caption?: string;          // Human-provided caption
  includeInTraining: boolean;
}

// Store in AnnotatedPage.features or new field
```

### 6. Markdown Export

Add Markdown generation from tokens:

```typescript
function tokensToMarkdown(tokens: LinearizedToken[]): string {
  let markdown = '';
  let currentHeader = 0;

  for (const token of tokens) {
    if (token.isHeader && token.headerLevel !== currentHeader) {
      markdown += '\n' + '#'.repeat(token.headerLevel) + ' ';
      currentHeader = token.headerLevel;
    }

    if (token.isBold) markdown += `**${token.text}**`;
    else if (token.isItalic) markdown += `*${token.text}*`;
    else if (token.isLink) markdown += `[${token.text}](${token.linkHref})`;
    else markdown += token.text;

    if (token.isLastInElement) markdown += '\n';
  }

  return markdown;
}
```

---

## Implementation Priority

### Phase 1: Quick Wins (Enhance Existing)

| Task | Effort | Impact |
|------|--------|--------|
| Add JSONL export format | Low | High |
| Add Alpaca export transformer | Medium | High |
| Add document-level category field | Low | Medium |
| Add auto quality scoring | Medium | Medium |

### Phase 2: Integration (Bridge Systems)

| Task | Effort | Impact |
|------|--------|--------|
| Add Markdown export | Medium | High |
| Add segment extraction from tokens | Medium | Medium |
| Add image labeling fields | Low | Medium |
| Create ShareGPT export format | Medium | Medium |

### Phase 3: Advanced (Full Unification)

| Task | Effort | Impact |
|------|--------|--------|
| Unified schema migration | High | High |
| Multi-format export wizard UI | High | Medium |
| Parquet export with Arrow | Medium | Medium |
| Document-level annotation UI | High | Medium |

---

## Conclusion

| Aspect | Recommendation |
|--------|----------------|
| **Architecture** | Keep existing token-centric system; add document-level layer on top |
| **Labels** | Extend BIO with document-level classification |
| **Quality** | Use auto-scoring for filtering, IAA for gold standard |
| **Export** | Add JSONL, Alpaca, ShareGPT, Markdown to existing formats |
| **UI** | Extend existing annotation editor with document-level controls |
| **Assets** | Add image/link labeling using existing token infrastructure |

The existing implementation is **more mature and production-ready**. The plan provides **strategic direction** for broader LLM training needs. **Combine both** by extending the existing system with the plan's document-level concepts and export formats.
