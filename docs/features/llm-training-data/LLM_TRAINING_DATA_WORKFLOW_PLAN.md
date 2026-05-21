# LLM Training Data Workflow Plan for Manga Project

*Status: Draft → Amended with Existing Architecture*
*Created: 2026-01-18*
*Updated: 2026-01-18*

## Executive Summary

This document outlines a comprehensive workflow for retrieving, standardizing, labeling, and exporting web data for LLM training. **This amended version integrates with the existing production-ready annotation system** and maps out new additions needed to extend NER capabilities into general-purpose LLM training data.

---

## Part 1: Existing Architecture (What We Have)

### 1.1 Current System Overview

The project already has a **production-ready ML annotation system** for training Transformer-CRF models:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXISTING ANNOTATION ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐            │
│  │  RETRIEVAL      │   │  TOKENIZATION   │   │  BIO LABELING   │            │
│  │  protectedFetch │──▶│  DOM Linearizer │──▶│  Bootstrap      │            │
│  │  + HTML Snapshot│   │  (70+ features) │   │  Labeler        │            │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘            │
│                                                      │                       │
│                                                      ▼                       │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐            │
│  │  QUALITY        │   │  HUMAN REVIEW   │   │  EXPORT         │            │
│  │  IAA Calculator │◀──│  Editor UI      │──▶│  JSON/CONLL     │            │
│  │  (Krippendorff) │   │  + Corrections  │   │  + Context      │            │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘            │
│                                                      │                       │
│                                                      ▼                       │
│                                              ┌─────────────────┐            │
│                                              │  ML TRAINING    │            │
│                                              │  Transformer-CRF│            │
│                                              │  + ONNX Deploy  │            │
│                                              └─────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Existing Database Models

```prisma
# EXISTING - prisma/schema.prisma (lines 1054-1158)

model AnnotatedPage {
  id              String               @id @default(cuid())
  url             String               @unique
  mangaTitle      String?
  sourceType      AnnotationSourceType  # FANDOM, WIKIPEDIA, ANILIST, COMICVINE
  htmlSnapshot    String               # Full HTML at annotation time
  tokens          Json                 # LinearizedToken[] (70+ features each)
  labels          Json                 # BIO labels array
  selections      Json?                # TextSelection[] - user annotations
  features        Json?                # Pre-extracted ML features
  annotatorId     String?
  status          AnnotationStatus     # BOOTSTRAP → IN_PROGRESS → REVIEWED → GOLD
  confidence      Float?               # Model confidence 0-1
  entityCounts    Json?                # {TITLE: 1, AUTHOR: 2, ...}
  urlAnnotations  Json?                # URL-specific labels
  version         Int                  # Optimistic locking
  previousVersion Json?                # Rollback support
}

model AnnotationQualityMetric {
  id           String  @id
  pageId       String
  alpha        Float   # Krippendorff's alpha (0-1)
  qualityLevel String  # 'excellent' | 'good' | 'fair' | 'poor'
  entityScores Json    # Per-entity alpha scores
}

model TrainingDataExport {
  id           String  @id
  version      String  # Semantic version
  pageCount    Int
  tokenCount   Int
  entityCounts Json
  splitRatios  Json    # {train: 0.8, val: 0.1, test: 0.1}
  filePath     String
  format       String  # json, conll
}

model MLModelVersion {
  id            String  @id
  version       String  @unique
  modelType     String  # transformer-crf, layoutlmv3
  backbone      String  # layoutlmv3-base
  metrics       Json    # {micro_f1, per_entity}
  onnxPath      String?
  status        ModelStatus  # TRAINING → DEPLOYED
}
```

### 1.3 Existing Token Features (70+ per token)

```typescript
// EXISTING - src/server/ml/features/dom-linearizer.ts

interface LinearizedToken {
  // Identity
  id: string;
  text: string;
  normalizedText: string;

  // DOM Structure
  tagName: string;
  xpath: string;
  cssPath: string;
  domDepth: number;
  siblingIndex: number;
  parentId: string | null;
  childIds: string[];

  // Formatting
  isBold: boolean;
  isItalic: boolean;
  isHeader: boolean;
  headerLevel: number;

  // Context
  isInTable: boolean;
  isInList: boolean;
  isInInfobox: boolean;
  isLink: boolean;
  linkHref: string | null;
  tableRow: number | null;
  tableCol: number | null;

  // Position
  documentPosition: number;
  charOffset: number;
  textLength: number;

  // Image Fields
  isImage: boolean;
  imageSrc: string | null;
  imageAlt: string | null;
  imageWidth: number | null;
  imageHeight: number | null;

  // Token Classification
  tokenType: 'word' | 'number' | 'date' | 'punctuation' | 'cjk' | 'mixed' | 'image';
  isNumeric: boolean;
  isDate: boolean;
  isPunctuation: boolean;
  isCJK: boolean;

  // Semantic Patterns
  matchesDatePattern: boolean;
  matchesVolumePattern: boolean;
  matchesChapterPattern: boolean;
  matchesNamePattern: boolean;

  // Context Signals
  precedingText: string | null;
  followingText: string | null;
  distanceFromLabel: number;
  nearestLabelText: string | null;

  // Section Context
  sectionType: 'infobox' | 'sidebar' | 'main_content' | 'header' | 'footer' | 'navigation';
  isFirstInElement: boolean;
  isLastInElement: boolean;

  // Visual Features
  fontSize: string | null;
  fontWeight: string | null;
  color: string | null;
  backgroundColor: string | null;
}
```

### 1.4 Existing BIO Entity Types

```typescript
// EXISTING - src/server/ml/features/bio-types.ts

type EntityType =
  | 'TITLE' | 'ALT_TITLE' | 'AUTHOR' | 'ARTIST'
  | 'STATUS' | 'GENRE' | 'TAG' | 'THEME'
  | 'VOLUME_COUNT' | 'CHAPTER_COUNT'
  | 'PUBLISHER' | 'MAGAZINE' | 'DEMOGRAPHIC'
  | 'RELEASE_DATE' | 'FORMAT' | 'CHARACTER'
  | 'URL' | 'SUMMARY';

type BIOTag = 'O' | `B-${EntityType}` | `I-${EntityType}`;
// Examples: 'O', 'B-TITLE', 'I-TITLE', 'B-AUTHOR', 'I-AUTHOR'
```

### 1.5 Existing UI Components

| Component | Location | Status |
|-----------|----------|--------|
| Annotation Dashboard | `src/pages/annotation/index.tsx` | ✅ Built |
| Page Editor | `src/features/annotation/editor/` | ✅ Built |
| Selection Toolbar | `src/features/annotation/editor/components/SelectionToolbar.tsx` | ✅ Built |
| Export Page | `src/pages/annotation/export.tsx` | ✅ Built |
| Quality Page | `src/pages/annotation/quality.tsx` | ✅ Built |
| Discovery Panel | `src/features/annotation/components/DiscoveryPanel.tsx` | ✅ Built |
| Bulk Import | `src/features/annotation/components/BulkImportModal.tsx` | ✅ Built |

### 1.6 Existing tRPC Procedures

| Procedure | Location | Purpose |
|-----------|----------|---------|
| `annotation.getStats` | `index.ts` | Dashboard statistics |
| `annotation.getPages` | `crud-procedures.ts` | List pages with filters |
| `annotation.create` | `crud-procedures.ts` | Create new annotation |
| `annotation.updateLabels` | `crud-procedures.ts` | Update BIO labels |
| `annotation.batchImport` | `batch-import-procedures.ts` | Parallel page import |
| `annotation.tokenizePage` | `tokenize-procedures.ts` | DOM linearization |
| `annotation.exportTrainingData` | `export-procedures.ts` | Export with context |
| `annotation.getQualityReport` | `quality-procedures.ts` | IAA metrics |

---

## Part 2: Gap Analysis (What's Missing)

### 2.1 Feature Comparison Matrix

| Capability | Existing | Needed for LLM Training | Gap |
|------------|----------|------------------------|-----|
| Token-level NER | ✅ BIO tags, 70+ features | ✅ Sufficient | None |
| Document-level labels | ❌ Not implemented | Category, quality, use case | **NEW** |
| Markdown export | ❌ Not implemented | Clean text for LLMs | **NEW** |
| Instruction format (Alpaca) | ❌ Not implemented | Fine-tuning format | **NEW** |
| Conversation format (ShareGPT) | ❌ Not implemented | Chat fine-tuning | **NEW** |
| JSONL streaming export | ❌ JSON only | Large dataset support | **NEW** |
| Parquet export | ❌ Not implemented | Analytics, HuggingFace | **NEW** |
| Image labeling | ⚠️ Tokens exist | Explicit classification | **EXTEND** |
| Auto quality scoring | ❌ IAA only | Fast filtering | **NEW** |
| Segment extraction | ❌ Tokens only | Paragraph/section level | **NEW** |
| Q&A generation | ❌ Not implemented | Q&A training pairs | **NEW** |

### 2.2 Architecture Gap Visualization

```
EXISTING SYSTEM                      NEW ADDITIONS
─────────────────────────────────────────────────────────────────────────

AnnotatedPage                        ┌─────────────────────────┐
├─ tokens (LinearizedToken[])        │ DocumentLevelLabels     │ ← NEW
├─ labels (BIOTag[])                 │ ├─ category             │
├─ status (AnnotationStatus)         │ ├─ qualityTier          │
├─ confidence                        │ └─ useCases[]           │
└─ entityCounts                      └─────────────────────────┘

                                     ┌─────────────────────────┐
                                     │ Segments                │ ← NEW
                                     │ ├─ paragraphs[]         │
                                     │ ├─ sections[]           │
                                     │ └─ markdown             │
                                     └─────────────────────────┘

                                     ┌─────────────────────────┐
                                     │ ImageLabels             │ ← EXTEND
                                     │ ├─ type (cover/panel)   │
                                     │ ├─ quality              │
                                     │ └─ caption              │
                                     └─────────────────────────┘

TrainingDataExport                   ┌─────────────────────────┐
├─ format: json | conll              │ NEW FORMATS             │ ← NEW
                                     │ ├─ jsonl                │
                                     │ ├─ parquet              │
                                     │ ├─ alpaca               │
                                     │ ├─ sharegpt             │
                                     │ ├─ qa                   │
                                     │ └─ markdown             │
                                     └─────────────────────────┘

                                     ┌─────────────────────────┐
                                     │ AutoQualityScore        │ ← NEW
                                     │ ├─ score (0-1)          │
                                     │ ├─ factors{}            │
                                     │ └─ computed vs IAA      │
                                     └─────────────────────────┘
```

---

## Part 3: Unified Architecture (Combined System)

### 3.1 Integrated Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     UNIFIED LLM TRAINING DATA PIPELINE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        STAGE 1: RETRIEVAL                            │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │    │
│  │  │ EXISTING     │  │ EXISTING     │  │ NEW          │               │    │
│  │  │ protectedFetch│  │ Fandom/Wiki  │  │ Markdown     │               │    │
│  │  │ + FlareSolverr│  │ Adapters     │  │ Converter    │               │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      STAGE 2: TOKENIZATION                           │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │ EXISTING: DOM Linearizer (70+ features per token)             │   │    │
│  │  └──────────────────────────────────────────────────────────────┘   │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │ NEW: Segment Extractor (paragraphs, sections, markdown)       │   │    │
│  │  └──────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       STAGE 3: LABELING                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │    │
│  │  │ EXISTING     │  │ NEW          │  │ NEW          │               │    │
│  │  │ BIO Labels   │  │ Document     │  │ Image/Asset  │               │    │
│  │  │ (NER)        │  │ Labels       │  │ Labels       │               │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │ EXISTING: Annotation Editor UI + Bootstrap Labeler            │   │    │
│  │  └──────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        STAGE 4: QUALITY                              │    │
│  │  ┌──────────────┐  ┌──────────────┐                                 │    │
│  │  │ EXISTING     │  │ NEW          │                                 │    │
│  │  │ IAA (Krippen-│  │ Auto Quality │                                 │    │
│  │  │ dorff's α)   │  │ Scoring      │                                 │    │
│  │  └──────────────┘  └──────────────┘                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        STAGE 5: EXPORT                               │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │    │
│  │  │ EXISTING     │  │ NEW          │  │ NEW          │               │    │
│  │  │ JSON/CONLL   │  │ JSONL/Parquet│  │ Alpaca/      │               │    │
│  │  │ (NER)        │  │ (Streaming)  │  │ ShareGPT     │               │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │    │
│  │  ┌──────────────┐  ┌──────────────┐                                 │    │
│  │  │ NEW          │  │ NEW          │                                 │    │
│  │  │ Markdown     │  │ Q&A Pairs    │                                 │    │
│  │  │ (Clean Text) │  │ Generator    │                                 │    │
│  │  └──────────────┘  └──────────────┘                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Unified Data Model

```typescript
// src/types/training/unified-document.ts

/**
 * Unified Training Document - Combines existing token-level with new document-level
 */
interface UnifiedTrainingDocument {
  // ═══════════════════════════════════════════════════════════════════
  // EXISTING FIELDS (from AnnotatedPage)
  // ═══════════════════════════════════════════════════════════════════

  id: string;
  url: string;
  mangaTitle?: string;
  sourceType: AnnotationSourceType;  // FANDOM, WIKIPEDIA, ANILIST, COMICVINE
  htmlSnapshot: string;

  // Token-level (EXISTING)
  tokens: LinearizedToken[];         // 70+ features per token
  bioLabels: BIOTag[];               // B-TITLE, I-AUTHOR, O, etc.
  entitySpans: TokenSpan[];          // Grouped entity spans

  // Annotation metadata (EXISTING)
  annotatorId?: string;
  status: AnnotationStatus;          // BOOTSTRAP → GOLD
  confidence?: number;
  entityCounts?: Record<EntityType, number>;

  // ═══════════════════════════════════════════════════════════════════
  // NEW FIELDS (Document-Level)
  // ═══════════════════════════════════════════════════════════════════

  // Document classification (NEW)
  documentLabels?: {
    category: DocumentCategory;      // synopsis, review, reference, etc.
    qualityTier: QualityTier;        // high, medium, low, exclude
    useCases: UseCaseLabel[];        // instruction_tuning, qa, summarization
  };

  // Segments (NEW) - derived from tokens
  segments?: {
    paragraphs: Paragraph[];         // Grouped text blocks
    sections: Section[];             // H1-H6 sections
    markdown: string;                // Clean markdown representation
    plainText: string;               // Plain text (no formatting)
  };

  // Image labels (NEW) - extends existing image tokens
  imageLabels?: ImageLabel[];

  // Quality scoring (NEW)
  autoQualityScore?: {
    score: number;                   // 0-1 composite
    factors: QualityFactors;
    computedAt: Date;
  };

  // ═══════════════════════════════════════════════════════════════════
  // COMBINED QUALITY (Existing IAA + New Auto)
  // ═══════════════════════════════════════════════════════════════════

  quality: {
    iaaScore?: number;               // EXISTING: Krippendorff's alpha
    autoScore?: number;              // NEW: Automated quality
    reviewStatus: AnnotationStatus;  // EXISTING
    exportedAt?: Date;               // EXISTING
  };
}
```

---

## Part 4: Schema Extensions (Database Changes)

### 4.1 Extend AnnotatedPage Model

```prisma
// prisma/schema.prisma - ADDITIONS to existing AnnotatedPage

model AnnotatedPage {
  // ═══════════════════════════════════════════════════════════════════
  // EXISTING FIELDS (unchanged)
  // ═══════════════════════════════════════════════════════════════════
  id              String               @id @default(cuid())
  url             String               @unique
  mangaTitle      String?
  sourceType      AnnotationSourceType
  htmlSnapshot    String
  tokens          Json                 // LinearizedToken[]
  labels          Json                 // BIOTag[]
  selections      Json?
  features        Json?
  annotatorId     String?
  annotator       User?                @relation(...)
  status          AnnotationStatus     @default(BOOTSTRAP)
  confidence      Float?
  entityCounts    Json?
  urlAnnotations  Json?
  notes           String?
  version         Int                  @default(0)
  previousVersion Json?
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt
  reviewedAt      DateTime?
  exportedAt      DateTime?

  qualityMetrics  AnnotationQualityMetric[]

  // ═══════════════════════════════════════════════════════════════════
  // NEW FIELDS (additions)
  // ═══════════════════════════════════════════════════════════════════

  // Document-level classification
  documentCategory   String?           // synopsis, review, reference, etc.
  qualityTier        String?           // high, medium, low, exclude
  useCases           String[]          @default([])  // instruction_tuning, qa, etc.

  // Segments (derived from tokens, cached for performance)
  segments           Json?             // { paragraphs[], sections[], markdown }

  // Image-specific labels
  imageLabels        Json?             // ImageLabel[] for image tokens

  // Auto quality scoring
  autoQualityScore   Float?            // 0-1 composite score
  qualityFactors     Json?             // Breakdown of score factors

  // NEW indexes
  @@index([documentCategory])
  @@index([qualityTier])
  @@index([autoQualityScore])
}
```

### 4.2 Add Export Format Tracking

```prisma
// Extend existing TrainingDataExport

model TrainingDataExport {
  // EXISTING fields...

  // NEW: Extended format support
  format       String   @default("json")
  // NEW VALUES: json, conll, jsonl, parquet, alpaca, sharegpt, qa, markdown

  // NEW: Document-level filters used
  categoryFilter    String[]  @default([])
  qualityFilter     String[]  @default([])
  useCaseFilter     String[]  @default([])
  minAutoQuality    Float?

  // NEW: Export includes
  includeSegments   Boolean   @default(false)
  includeMarkdown   Boolean   @default(false)
  includeImageLabels Boolean  @default(false)
}
```

### 4.3 New Enums

```prisma
// Add to existing enums section

enum DocumentCategory {
  SYNOPSIS
  REVIEW
  ANALYSIS
  NEWS
  REFERENCE
  DISCUSSION
  METADATA
  MIXED
}

enum QualityTier {
  HIGH
  MEDIUM
  LOW
  EXCLUDE
}

enum UseCaseLabel {
  INSTRUCTION_TUNING
  SUMMARIZATION
  QA
  CLASSIFICATION
  ENTITY_EXTRACTION
  RECOMMENDATION
  TRANSLATION
}

enum ExportFormat {
  JSON           // Existing
  CONLL          // Existing
  JSONL          // NEW
  PARQUET        // NEW
  ALPACA         // NEW
  SHAREGPT       // NEW
  QA             // NEW
  MARKDOWN       // NEW
  NER_SPANS      // NEW
}
```

---

## Part 5: New Implementations Required

### 5.1 Segment Extractor

```typescript
// NEW: src/server/ml/features/segment-extractor.ts

import type { LinearizedToken } from './dom-linearizer';

interface Paragraph {
  id: string;
  tokens: LinearizedToken[];
  text: string;
  markdown: string;
  startIndex: number;
  endIndex: number;
}

interface Section {
  id: string;
  level: number;           // 1-6 for H1-H6
  title: string;
  paragraphs: Paragraph[];
  subsections: Section[];
}

interface SegmentationResult {
  paragraphs: Paragraph[];
  sections: Section[];
  markdown: string;
  plainText: string;
}

/**
 * Extract segments from linearized tokens
 * Reuses existing token features for section detection
 */
export function extractSegments(tokens: LinearizedToken[]): SegmentationResult {
  const paragraphs = groupIntoParagraphs(tokens);
  const sections = buildSectionHierarchy(tokens, paragraphs);
  const markdown = tokensToMarkdown(tokens);
  const plainText = tokens.map(t => t.text).join(' ');

  return { paragraphs, sections, markdown, plainText };
}

function tokensToMarkdown(tokens: LinearizedToken[]): string {
  let md = '';
  let inHeader = false;
  let headerLevel = 0;

  for (const token of tokens) {
    // Use EXISTING token features
    if (token.isHeader && token.headerLevel !== headerLevel) {
      if (inHeader) md += '\n\n';
      md += '#'.repeat(token.headerLevel) + ' ';
      headerLevel = token.headerLevel;
      inHeader = true;
    }

    if (token.isBold) md += `**${token.text}**`;
    else if (token.isItalic) md += `*${token.text}*`;
    else if (token.isLink) md += `[${token.text}](${token.linkHref})`;
    else if (token.isImage) md += `![${token.imageAlt ?? ''}](${token.imageSrc})`;
    else md += token.text;

    if (token.isLastInElement) {
      md += '\n';
      inHeader = false;
    } else {
      md += ' ';
    }
  }

  return md.trim();
}
```

### 5.2 Auto Quality Scorer

```typescript
// NEW: src/server/ml/quality/auto-scorer.ts

interface QualityFactors {
  tokenCount: number;
  labeledRatio: number;
  entityDiversity: number;
  confidenceAvg: number;
  structuredContent: number;
  wordCount: number;
  hasInfobox: boolean;
  hasTable: boolean;
}

interface AutoQualityResult {
  score: number;           // 0-1 composite
  factors: QualityFactors;
  recommendation: 'high' | 'medium' | 'low' | 'exclude';
}

/**
 * Compute automatic quality score using existing token features
 * Complements (does not replace) IAA scoring
 */
export function computeAutoQuality(
  tokens: LinearizedToken[],
  labels: BIOTag[],
  confidence?: number
): AutoQualityResult {
  const factors: QualityFactors = {
    tokenCount: tokens.length,
    labeledRatio: labels.filter(l => l !== 'O').length / labels.length,
    entityDiversity: countUniqueEntities(labels),
    confidenceAvg: confidence ?? 0.5,
    structuredContent: tokens.filter(t => t.isInInfobox || t.isInTable).length / tokens.length,
    wordCount: tokens.filter(t => t.tokenType === 'word').length,
    hasInfobox: tokens.some(t => t.isInInfobox),
    hasTable: tokens.some(t => t.isInTable),
  };

  // Weighted scoring
  const score = (
    (factors.labeledRatio * 0.25) +
    (Math.min(factors.entityDiversity / 10, 1) * 0.20) +
    (factors.confidenceAvg * 0.25) +
    (factors.structuredContent * 0.15) +
    (Math.min(factors.wordCount / 500, 1) * 0.15)
  );

  const recommendation =
    score >= 0.8 ? 'high' :
    score >= 0.5 ? 'medium' :
    score >= 0.3 ? 'low' : 'exclude';

  return { score, factors, recommendation };
}
```

### 5.3 Document-Level Label Service

```typescript
// NEW: src/server/services/training/document-labeling.ts

import type { AnnotatedPage } from '@prisma/client';
import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

interface DocumentLabels {
  category: DocumentCategory;
  qualityTier: QualityTier;
  useCases: UseCaseLabel[];
}

/**
 * Infer document-level labels from existing token features and BIO labels
 */
export function inferDocumentLabels(
  page: AnnotatedPage,
  tokens: LinearizedToken[],
  bioLabels: BIOTag[]
): DocumentLabels {
  // Category inference from content patterns
  const category = inferCategory(tokens, bioLabels);

  // Quality tier from auto scoring + existing confidence
  const qualityTier = inferQualityTier(page.confidence, page.autoQualityScore);

  // Use case inference from entity distribution
  const useCases = inferUseCases(page.entityCounts, tokens);

  return { category, qualityTier, useCases };
}

function inferCategory(tokens: LinearizedToken[], labels: BIOTag[]): DocumentCategory {
  const summaryRatio = labels.filter(l => l.includes('SUMMARY')).length / labels.length;
  const hasInfobox = tokens.some(t => t.isInInfobox);
  const headerCount = tokens.filter(t => t.isHeader).length;

  if (summaryRatio > 0.3) return 'SYNOPSIS';
  if (hasInfobox && headerCount > 5) return 'REFERENCE';
  if (tokens.some(t => t.text.toLowerCase().includes('review'))) return 'REVIEW';
  return 'MIXED';
}

function inferUseCases(
  entityCounts: Record<string, number> | null,
  tokens: LinearizedToken[]
): UseCaseLabel[] {
  const useCases: UseCaseLabel[] = [];

  // Always good for NER
  useCases.push('ENTITY_EXTRACTION');

  // Good for instruction tuning if has structured Q&A-like content
  if (tokens.some(t => t.isInInfobox)) {
    useCases.push('INSTRUCTION_TUNING');
  }

  // Good for summarization if has summary section
  if (entityCounts?.SUMMARY) {
    useCases.push('SUMMARIZATION');
  }

  // Good for classification if has genres/tags
  if (entityCounts?.GENRE || entityCounts?.TAG) {
    useCases.push('CLASSIFICATION');
  }

  return useCases;
}
```

### 5.4 Export Format Transformers

```typescript
// NEW: src/server/services/training/export/formats/

// ─────────────────────────────────────────────────────────────────────────────
// JSONL Exporter (NEW)
// ─────────────────────────────────────────────────────────────────────────────

// src/server/services/training/export/formats/jsonl.ts

export async function* exportAsJSONL(
  pages: AsyncIterable<AnnotatedPage>
): AsyncGenerator<string> {
  for await (const page of pages) {
    yield JSON.stringify(transformToRecord(page)) + '\n';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Alpaca Format (NEW)
// ─────────────────────────────────────────────────────────────────────────────

// src/server/services/training/export/formats/alpaca.ts

interface AlpacaRecord {
  instruction: string;
  input: string;
  output: string;
  metadata?: Record<string, unknown>;
}

/**
 * Generate instruction-tuning pairs from annotated page
 * Uses EXISTING BIO labels to create training examples
 */
export function toAlpacaFormat(page: AnnotatedPage): AlpacaRecord[] {
  const records: AlpacaRecord[] = [];
  const tokens = page.tokens as LinearizedToken[];
  const labels = page.labels as BIOTag[];
  const entities = extractEntitiesFromBIO(tokens, labels);

  // Generate extraction instructions
  for (const entity of entities) {
    records.push({
      instruction: `Extract the ${entity.type.toLowerCase()} from this manga description.`,
      input: getContextAroundEntity(tokens, entity),
      output: entity.text,
      metadata: {
        source: page.sourceType,
        mangaTitle: page.mangaTitle,
        entityType: entity.type,
      },
    });
  }

  // Generate summary if available
  if (page.segments?.markdown) {
    records.push({
      instruction: 'Summarize this manga page.',
      input: page.segments.markdown.slice(0, 2000),
      output: entities.find(e => e.type === 'SUMMARY')?.text ?? '',
      metadata: { source: page.sourceType },
    });
  }

  return records;
}

// ─────────────────────────────────────────────────────────────────────────────
// ShareGPT Format (NEW)
// ─────────────────────────────────────────────────────────────────────────────

// src/server/services/training/export/formats/sharegpt.ts

interface ShareGPTRecord {
  conversations: Array<{ from: 'human' | 'gpt'; value: string }>;
  metadata?: Record<string, unknown>;
}

export function toShareGPTFormat(page: AnnotatedPage): ShareGPTRecord[] {
  const records: ShareGPTRecord[] = [];
  const entities = extractEntitiesFromBIO(page.tokens, page.labels);

  // Create Q&A conversations
  for (const entity of entities) {
    records.push({
      conversations: [
        { from: 'human', value: getQuestionForEntity(entity.type, page.mangaTitle) },
        { from: 'gpt', value: entity.text },
      ],
      metadata: { source: page.sourceType, entityType: entity.type },
    });
  }

  return records;
}

function getQuestionForEntity(type: EntityType, mangaTitle?: string): string {
  const title = mangaTitle ?? 'this manga';
  const questions: Record<EntityType, string> = {
    TITLE: `What is the title of ${title}?`,
    AUTHOR: `Who is the author of ${title}?`,
    ARTIST: `Who is the artist of ${title}?`,
    GENRE: `What genre is ${title}?`,
    STATUS: `What is the publication status of ${title}?`,
    SUMMARY: `What is ${title} about?`,
    // ... etc
  };
  return questions[type] ?? `Tell me about the ${type.toLowerCase()} of ${title}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Q&A Pairs Generator (NEW)
// ─────────────────────────────────────────────────────────────────────────────

// src/server/services/training/export/formats/qa.ts

interface QARecord {
  question: string;
  answer: string;
  context: string;
  metadata: Record<string, unknown>;
}

export function toQAFormat(page: AnnotatedPage): QARecord[] {
  const tokens = page.tokens as LinearizedToken[];
  const labels = page.labels as BIOTag[];
  const entities = extractEntitiesFromBIO(tokens, labels);

  return entities.map(entity => ({
    question: generateQuestion(entity.type, page.mangaTitle),
    answer: entity.text,
    context: getContextAroundEntity(tokens, entity, 100), // 100 tokens context
    metadata: {
      source: page.sourceType,
      entityType: entity.type,
      mangaTitle: page.mangaTitle,
      confidence: entity.confidence,
    },
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown Export (NEW)
// ─────────────────────────────────────────────────────────────────────────────

// src/server/services/training/export/formats/markdown.ts

export function toMarkdownFormat(page: AnnotatedPage): string {
  // Use cached segments if available
  if (page.segments?.markdown) {
    return page.segments.markdown;
  }

  // Otherwise generate from tokens
  const tokens = page.tokens as LinearizedToken[];
  return tokensToMarkdown(tokens);
}
```

### 5.5 Extended tRPC Procedures

```typescript
// NEW: src/server/trpc/routers/annotation/extended-export-procedures.ts

import { z } from 'zod';
import { protectedProcedure, router } from '@/server/trpc';

export const extendedExportRouter = router({
  /**
   * Export with new format options
   * Extends existing exportTrainingData
   */
  exportExtended: protectedProcedure
    .input(z.object({
      // EXISTING filters
      status: z.array(z.nativeEnum(AnnotationStatus)).optional(),
      sourceType: z.array(z.nativeEnum(AnnotationSourceType)).optional(),

      // NEW filters
      documentCategory: z.array(z.nativeEnum(DocumentCategory)).optional(),
      qualityTier: z.array(z.nativeEnum(QualityTier)).optional(),
      useCases: z.array(z.nativeEnum(UseCaseLabel)).optional(),
      minAutoQuality: z.number().min(0).max(1).optional(),

      // NEW format options
      format: z.enum([
        'json', 'conll',           // EXISTING
        'jsonl', 'parquet',        // NEW
        'alpaca', 'sharegpt', 'qa', // NEW
        'markdown', 'ner_spans',   // NEW
      ]),

      // NEW includes
      includeSegments: z.boolean().default(false),
      includeMarkdown: z.boolean().default(false),
      includeImageLabels: z.boolean().default(false),

      // Existing options
      includeContext: z.boolean().default(true),
      contextSentences: z.number().min(0).max(3).default(1),
      limit: z.number().min(1).max(10000).default(1000),
    }))
    .mutation(async ({ ctx, input }) => {
      // Query with extended filters
      const pages = await ctx.prisma.annotatedPage.findMany({
        where: {
          status: input.status ? { in: input.status } : undefined,
          sourceType: input.sourceType ? { in: input.sourceType } : undefined,
          documentCategory: input.documentCategory ? { in: input.documentCategory } : undefined,
          qualityTier: input.qualityTier ? { in: input.qualityTier } : undefined,
          useCases: input.useCases ? { hasSome: input.useCases } : undefined,
          autoQualityScore: input.minAutoQuality ? { gte: input.minAutoQuality } : undefined,
        },
        take: input.limit,
      });

      // Transform based on format
      const transformer = getTransformer(input.format);
      const records = pages.flatMap(page => transformer(page, input));

      // Generate export file
      const result = await writeExport(records, input.format);

      // Track export
      await ctx.prisma.trainingDataExport.create({
        data: {
          version: generateVersion(),
          pageCount: pages.length,
          tokenCount: countTokens(pages),
          format: input.format,
          filePath: result.path,
          fileSize: result.size,
          categoryFilter: input.documentCategory ?? [],
          qualityFilter: input.qualityTier ?? [],
          useCaseFilter: input.useCases ?? [],
          minAutoQuality: input.minAutoQuality,
          includeSegments: input.includeSegments,
          includeMarkdown: input.includeMarkdown,
        },
      });

      return result;
    }),

  /**
   * Compute segments and auto quality for page
   */
  enrichPage: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const page = await ctx.prisma.annotatedPage.findUnique({
        where: { id: input.pageId },
      });

      if (!page) throw new Error('Page not found');

      const tokens = page.tokens as LinearizedToken[];
      const labels = page.labels as BIOTag[];

      // Compute segments (NEW)
      const segments = extractSegments(tokens);

      // Compute auto quality (NEW)
      const autoQuality = computeAutoQuality(tokens, labels, page.confidence ?? undefined);

      // Infer document labels (NEW)
      const documentLabels = inferDocumentLabels(page, tokens, labels);

      // Update page
      return ctx.prisma.annotatedPage.update({
        where: { id: input.pageId },
        data: {
          segments,
          autoQualityScore: autoQuality.score,
          qualityFactors: autoQuality.factors,
          documentCategory: documentLabels.category,
          qualityTier: documentLabels.qualityTier,
          useCases: documentLabels.useCases,
        },
      });
    }),

  /**
   * Batch enrich all pages
   */
  enrichAllPages: protectedProcedure
    .input(z.object({
      batchSize: z.number().default(50),
      skipEnriched: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const where = input.skipEnriched
        ? { segments: null }
        : {};

      const pages = await ctx.prisma.annotatedPage.findMany({
        where,
        take: input.batchSize,
        select: { id: true },
      });

      let enriched = 0;
      for (const { id } of pages) {
        await ctx.trpc.annotation.enrichPage({ pageId: id });
        enriched++;
      }

      return { enriched, remaining: await ctx.prisma.annotatedPage.count({ where }) };
    }),
});
```

---

## Part 6: UI Extensions

### 6.1 Extend Existing Export Page

```typescript
// EXTEND: src/pages/annotation/export.tsx

// Add new format options to existing UI
const FORMAT_OPTIONS = [
  // EXISTING
  { value: 'json', label: 'JSON (NER Training)' },
  { value: 'conll', label: 'CoNLL (Sequence Labeling)' },
  // NEW
  { value: 'jsonl', label: 'JSONL (Streaming)' },
  { value: 'parquet', label: 'Parquet (Analytics)' },
  { value: 'alpaca', label: 'Alpaca (Instruction Tuning)' },
  { value: 'sharegpt', label: 'ShareGPT (Conversation)' },
  { value: 'qa', label: 'Q&A Pairs' },
  { value: 'markdown', label: 'Markdown (Clean Text)' },
];

// Add new filter sections
const DOCUMENT_CATEGORY_OPTIONS = [
  { value: 'SYNOPSIS', label: 'Synopsis' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'REFERENCE', label: 'Reference' },
  // ...
];

const QUALITY_TIER_OPTIONS = [
  { value: 'HIGH', label: 'High Quality' },
  { value: 'MEDIUM', label: 'Medium Quality' },
  { value: 'LOW', label: 'Low Quality' },
];

const USE_CASE_OPTIONS = [
  { value: 'INSTRUCTION_TUNING', label: 'Instruction Tuning' },
  { value: 'SUMMARIZATION', label: 'Summarization' },
  { value: 'QA', label: 'Q&A' },
  { value: 'CLASSIFICATION', label: 'Classification' },
  // ...
];
```

### 6.2 Add Document Labels Panel to Editor

```typescript
// EXTEND: src/features/annotation/editor/components/

// New component for document-level labels
// Add to existing editor layout

interface DocumentLabelsPanelProps {
  page: AnnotatedPage;
  onUpdate: (labels: DocumentLabels) => void;
}

// Categories, quality tier, use cases selection
// Displayed alongside existing BIO labeling tools
```

---

## Part 7: Implementation Phases

### Phase 1: Schema & Infrastructure (Week 1-2)

| Task | Type | Priority | Files |
|------|------|----------|-------|
| Add new fields to AnnotatedPage | EXTEND | P0 | `prisma/schema.prisma` |
| Create Prisma migration | NEW | P0 | `prisma/migrations/` |
| Add new enums | NEW | P0 | `prisma/schema.prisma` |
| Create segment-extractor.ts | NEW | P0 | `src/server/ml/features/` |
| Create auto-scorer.ts | NEW | P0 | `src/server/ml/quality/` |

### Phase 2: Export Formats (Week 2-3)

| Task | Type | Priority | Files |
|------|------|----------|-------|
| JSONL exporter | NEW | P0 | `src/server/services/training/export/formats/jsonl.ts` |
| Alpaca transformer | NEW | P0 | `src/server/services/training/export/formats/alpaca.ts` |
| ShareGPT transformer | NEW | P1 | `src/server/services/training/export/formats/sharegpt.ts` |
| Q&A generator | NEW | P1 | `src/server/services/training/export/formats/qa.ts` |
| Markdown exporter | NEW | P1 | `src/server/services/training/export/formats/markdown.ts` |
| Parquet exporter | NEW | P2 | `src/server/services/training/export/formats/parquet.ts` |

### Phase 3: tRPC & API (Week 3-4)

| Task | Type | Priority | Files |
|------|------|----------|-------|
| exportExtended procedure | NEW | P0 | `src/server/trpc/routers/annotation/extended-export-procedures.ts` |
| enrichPage procedure | NEW | P0 | Same file |
| enrichAllPages batch | NEW | P1 | Same file |
| Update existing export | EXTEND | P1 | `src/server/trpc/routers/annotation/export-procedures.ts` |

### Phase 4: Document Labeling (Week 4-5)

| Task | Type | Priority | Files |
|------|------|----------|-------|
| Document label inference | NEW | P1 | `src/server/services/training/document-labeling.ts` |
| Image label schema | EXTEND | P2 | `src/types/training/` |
| Label validation | NEW | P2 | `src/lib/schemas/` |

### Phase 5: UI Extensions (Week 5-6)

| Task | Type | Priority | Files |
|------|------|----------|-------|
| Extend export page | EXTEND | P1 | `src/pages/annotation/export.tsx` |
| Document labels panel | NEW | P2 | `src/features/annotation/editor/components/` |
| Quality dashboard updates | EXTEND | P2 | `src/pages/annotation/quality.tsx` |

---

## Part 8: File Structure (Final)

```
src/
├── server/
│   ├── ml/
│   │   ├── features/
│   │   │   ├── dom-linearizer.ts          # EXISTING (70+ token features)
│   │   │   ├── bio-types.ts               # EXISTING (BIO labels)
│   │   │   ├── selection-tokenizer.ts     # EXISTING
│   │   │   └── segment-extractor.ts       # NEW (paragraph/section extraction)
│   │   ├── training/
│   │   │   └── bootstrap-labeler/         # EXISTING (auto-labeling)
│   │   ├── quality/
│   │   │   ├── iaa-calculator.ts          # EXISTING (Krippendorff's alpha)
│   │   │   └── auto-scorer.ts             # NEW (automated quality scoring)
│   │   └── inference/                     # EXISTING (ONNX, CRF decoder)
│   │
│   ├── services/
│   │   └── training/                      # NEW directory
│   │       ├── document-labeling.ts       # NEW (infer doc labels)
│   │       └── export/
│   │           ├── index.ts               # NEW (export orchestration)
│   │           └── formats/
│   │               ├── jsonl.ts           # NEW
│   │               ├── alpaca.ts          # NEW
│   │               ├── sharegpt.ts        # NEW
│   │               ├── qa.ts              # NEW
│   │               ├── markdown.ts        # NEW
│   │               └── parquet.ts         # NEW
│   │
│   └── trpc/
│       └── routers/
│           └── annotation/
│               ├── index.ts               # EXISTING
│               ├── export-procedures.ts   # EXISTING (extend)
│               ├── extended-export-procedures.ts  # NEW
│               └── ...                    # EXISTING
│
├── types/
│   └── training/                          # NEW directory
│       ├── unified-document.ts            # NEW (combined schema)
│       ├── document-labels.ts             # NEW
│       ├── export-formats.ts              # NEW
│       └── index.ts                       # NEW
│
├── pages/
│   └── annotation/
│       ├── index.tsx                      # EXISTING (dashboard)
│       ├── [pageId].tsx                   # EXISTING (editor)
│       ├── export.tsx                     # EXISTING (extend)
│       └── quality.tsx                    # EXISTING (extend)
│
└── features/
    └── annotation/
        └── editor/
            └── components/
                ├── SelectionToolbar.tsx   # EXISTING
                └── DocumentLabelsPanel.tsx # NEW
```

---

## Part 9: Migration Strategy

### 9.1 Database Migration

```sql
-- Migration: add_llm_training_fields

ALTER TABLE "AnnotatedPage" ADD COLUMN "documentCategory" TEXT;
ALTER TABLE "AnnotatedPage" ADD COLUMN "qualityTier" TEXT;
ALTER TABLE "AnnotatedPage" ADD COLUMN "useCases" TEXT[] DEFAULT '{}';
ALTER TABLE "AnnotatedPage" ADD COLUMN "segments" JSONB;
ALTER TABLE "AnnotatedPage" ADD COLUMN "imageLabels" JSONB;
ALTER TABLE "AnnotatedPage" ADD COLUMN "autoQualityScore" DOUBLE PRECISION;
ALTER TABLE "AnnotatedPage" ADD COLUMN "qualityFactors" JSONB;

CREATE INDEX "AnnotatedPage_documentCategory_idx" ON "AnnotatedPage"("documentCategory");
CREATE INDEX "AnnotatedPage_qualityTier_idx" ON "AnnotatedPage"("qualityTier");
CREATE INDEX "AnnotatedPage_autoQualityScore_idx" ON "AnnotatedPage"("autoQualityScore");
```

### 9.2 Backfill Script

```typescript
// scripts/backfill-training-fields.ts

async function backfillTrainingFields() {
  const pages = await prisma.annotatedPage.findMany({
    where: { segments: null },
  });

  for (const page of pages) {
    const tokens = page.tokens as LinearizedToken[];
    const labels = page.labels as BIOTag[];

    const segments = extractSegments(tokens);
    const autoQuality = computeAutoQuality(tokens, labels, page.confidence ?? undefined);
    const documentLabels = inferDocumentLabels(page, tokens, labels);

    await prisma.annotatedPage.update({
      where: { id: page.id },
      data: {
        segments,
        autoQualityScore: autoQuality.score,
        qualityFactors: autoQuality.factors,
        documentCategory: documentLabels.category,
        qualityTier: documentLabels.qualityTier,
        useCases: documentLabels.useCases,
      },
    });
  }
}
```

---

## Part 10: Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Export formats | 2 (JSON, CONLL) | 8 | Count of working exporters |
| Document-level labels | 0% | 100% | Pages with category assigned |
| Auto quality scored | 0% | 100% | Pages with autoQualityScore |
| Segments extracted | 0% | 100% | Pages with segments |
| Markdown export | ❌ | ✅ | Feature available |
| Alpaca export | ❌ | ✅ | Feature available |
| Q&A generation | ❌ | ✅ | Feature available |

---

## Sources

### Existing Implementation
- `prisma/schema.prisma` (lines 1054-1158) - Annotation models
- `src/server/ml/features/dom-linearizer.ts` - 70+ token features
- `src/server/ml/training/bootstrap-labeler/` - Auto-labeling
- `src/server/trpc/routers/annotation/` - tRPC procedures
- `src/pages/annotation/` - UI components

### Research
- [ScrapeGraphAI - LLM Web Scraping](https://scrapegraphai.com/blog/llm-web-scraping)
- [HuggingFace - LLM Dataset Formats 101](https://huggingface.co/blog/tegridydev/llm-dataset-formats-101-hugging-face)
- [Anyscale - Dataset Preparation](https://docs.anyscale.com/llm/fine-tuning/data-preparation)

---

*This amended plan integrates with the existing production annotation system and maps out specific additions needed for general-purpose LLM training data generation.*
