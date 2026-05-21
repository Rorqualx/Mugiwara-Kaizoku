/**
 * LLM Prompts for Agent Review
 *
 * Structured prompts for the LLM to review and validate entity labels.
 */


import type { BIOTag, EntityType } from '@/server/ml/features/bio-types';

import { detectPageType, getPageTypeLabel } from './page-type-detector';

import type { PageType } from './types';
import type { AnnotationSourceType } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface TokenForPrompt {
  index: number;
  text: string;
  label: BIOTag;
}

interface PageForPrompt {
  url: string;
  sourceType: AnnotationSourceType;
  tokens: TokenForPrompt[];
  pageType?: PageType;
}

// ============================================================================
// Entity Type Descriptions
// ============================================================================

const ENTITY_DESCRIPTIONS: Record<EntityType, string> = {
  TITLE: 'Main manga/series title',
  ALT_TITLE: 'Alternative/Japanese/English title',
  AUTHOR: 'Writer/story creator name (real person)',
  ARTIST: 'Illustrator/artist name (real person)',
  SERIES_SUMMARY: 'Plot synopsis (80+ chars, sentences)',
  STATUS: 'Publication status (Ongoing/Completed/Hiatus)',
  GENRE: 'Content genres (Action, Romance, etc.)',
  DEMOGRAPHIC: 'Target audience (Shonen, Seinen, Shoujo, Josei)',
  PUBLISHER: 'Publishing company name',
  MAGAZINE: 'Serialization magazine name',
  ORIGINAL_RUN: 'Publication date range (start – end dates)',
  START_DATE: 'Serialization start date (e.g., April 13, 2005)',
  END_DATE: 'Serialization end date (e.g., July 25, 2025) or "present"',
  RELEASE_DATE: 'Series publication date',
  COVER_IMAGE: 'Main series cover image',
  THEMES: 'Story themes',
  TAGS: 'Descriptive tags',
  FORMAT: 'Media type (Manga, Manhwa, Manhua)',
  PAGE_TYPE: 'Internal page classification',
  VOLUME_COUNT: 'Total volumes in series (1-500)',
  CHAPTER_COUNT: 'Total chapters in series (1-2000)',
  CHAPTER_RANGE: 'Chapters in a volume (e.g., 12-15)',
  PAGE_COUNT: 'Pages in a chapter',
  VOLUME_PAGE_COUNT: 'Pages in a volume',
  VOLUME_NUMBER: 'Specific volume number (Vol. X)',
  CHAPTER_TITLE: 'Chapter name',
  CHAPTER_ALT_TITLE: 'Japanese/alternative chapter title',
  CHAPTER_NUMBER: 'Chapter sequence number',
  CHAPTER_BELONGS_TO_VOLUME: 'Parent volume reference',
  CHAPTER_RELEASE_DATE: 'Chapter release date',
  CHAPTER_SUMMARY: 'Chapter plot summary',
  CHAPTER_COVER: 'Chapter cover image',
  CHAPTER_URL: 'Link to chapter page',
  ENGLISH_ISBN: 'English edition ISBN (ISBN-10/13)',
  ENGLISH_PUBLISHER: 'English edition publisher (e.g., Kodansha USA, Viz Media)',
  ENGLISH_RELEASE_DATE: 'English edition release date',
  ISBN: 'Book identifier (ISBN-10/13)',
  VOLUME_ALT_TITLE: 'Alternative volume title',
  VOLUME_TITLE: 'Volume name',
  VOLUME_COVER: 'Volume cover image',
  VOLUME_RELEASE_DATE: 'Volume publication date',
  VOLUME_SUMMARY: 'Volume description',
  VOLUME_URL: 'Link to volume page',
  CHAPTERS_LIST_URL: 'Link to chapters page',
  VOLUMES_LIST_URL: 'Link to volumes page',
  GALLERY_URL: 'Link to image gallery',
  CHAPTER_TABLE: 'Table with chapter data',
  VOLUME_TABLE: 'Table with volume data',
  VOLUME_CHAPTER_TABLE: 'Combined volume+chapter table',
  GALLERY_SECTION: 'Gallery container section',
};

// ============================================================================
// Prompt Building
// ============================================================================

/**
 * Format labeled tokens for review prompt
 */
function formatLabelsForReview(tokens: TokenForPrompt[]): string {
  const lines: string[] = [];
  let currentEntity: EntityType | null = null;
  let entityText = '';
  let entityStart = -1;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    if (token.label === 'O') {
      // Flush current entity if any
      if (currentEntity) {
        lines.push(`[${entityStart}-${i - 1}] ${currentEntity}: "${entityText.trim()}"`);
        currentEntity = null;
        entityText = '';
      }
    } else if (token.label.startsWith('B-')) {
      // Flush previous and start new
      if (currentEntity) {
        lines.push(`[${entityStart}-${i - 1}] ${currentEntity}: "${entityText.trim()}"`);
      }
      currentEntity = token.label.substring(2) as EntityType;
      entityText = token.text;
      entityStart = i;
    } else if (token.label.startsWith('I-') && currentEntity) {
      // Continue current entity
      entityText += ' ' + token.text;
    }
  }

  // Flush final entity
  if (currentEntity) {
    lines.push(`[${entityStart}-${tokens.length - 1}] ${currentEntity}: "${entityText.trim()}"`);
  }

  return lines.length > 0 ? lines.join('\n') : '(No labels found)';
}

/**
 * Build the system prompt for label review
 */
export function buildSystemPrompt(): string {
  return `You are a quality assurance agent for manga metadata extraction training data.
Your job is to review auto-generated entity labels and identify errors.

## Entity Types
${Object.entries(ENTITY_DESCRIPTIONS)
  .map(([entity, desc]) => `- ${entity}: ${desc}`)
  .join('\n')}

## Common Errors to Detect
1. **Navigation as Content**: Wiki navigation text labeled as real content
2. **Character as Author**: Fictional character names labeled as AUTHOR/ARTIST
3. **Wrong Page Context**: SERIES_SUMMARY on chapter page (should be CHAPTER_SUMMARY)
4. **Numeric Confusion**: Page numbers labeled as volume/chapter counts
5. **Missing Labels**: Critical entities (TITLE, AUTHOR) not labeled
6. **Invalid Values**: Impossible ISBNs, counts > 2000, etc.

## Response Format
Always respond with valid JSON matching this structure:
{
  "status": "approved" | "corrected" | "flagged",
  "confidence": 0.0-1.0,
  "corrections": {
    "added": [],
    "removed": [],
    "modified": []
  },
  "issues": [],
  "notes": "Summary of findings"
}`;
}

/**
 * Build the review prompt for a specific page
 */
export function buildReviewPrompt(page: PageForPrompt): string {
  const pageType = page.pageType ?? detectPageType(page.url);
  const pageTypeLabel = getPageTypeLabel(pageType);

  return `## Page Information
URL: ${page.url}
Source: ${page.sourceType}
Page Type: ${pageTypeLabel}

## Current Labels
${formatLabelsForReview(page.tokens)}

## Review Instructions

1. **Validate existing labels:**
   - Is each TITLE actually a manga title (not navigation)?
   - Are AUTHOR/ARTIST names real people (not characters)?
   - Is SERIES_SUMMARY actual content (not navigation text)?
   - Are counts (VOLUME_COUNT, CHAPTER_COUNT) reasonable values?

2. **Check for errors:**
   - Navigation text labeled as content
   - Character names labeled as AUTHOR/ARTIST
   - Page numbers labeled as counts
   - Wrong page type context (CHAPTER_SUMMARY on series page)

3. **Find missing labels:**
   - Unlabeled text after "Author:", "Artist:", etc.
   - Unlabeled dates after "Released:", "Published:", etc.
   - Unlabeled numbers after "Volumes:", "Chapters:", etc.

Please analyze the labels and provide your assessment in JSON format.`;
}

/**
 * Build a prompt for batch review summary
 */
export function buildBatchSummaryPrompt(
  pageCount: number,
  errorCount: number,
  commonIssues: string[]
): string {
  return `## Batch Review Summary

Reviewed: ${pageCount} pages
Errors Found: ${errorCount}

Common Issues:
${commonIssues.map((issue) => `- ${issue}`).join('\n')}

Please provide recommendations for improving the auto-labeling rules based on these patterns.`;
}

/**
 * Type guard for valid status values
 */
function isValidStatus(value: unknown): value is 'approved' | 'corrected' | 'flagged' {
  return value === 'approved' || value === 'corrected' || value === 'flagged';
}

/**
 * Parse LLM response into structured review result
 */
export function parseReviewResponse(response: string): {
  status: 'approved' | 'corrected' | 'flagged';
  confidence: number;
  corrections: {
    added: Array<{ tokenRange: [number, number]; newLabel: string; reason: string }>;
    removed: Array<{ tokenRange: [number, number]; previousLabel: string; reason: string }>;
    modified: Array<{ tokenRange: [number, number]; from: string; to: string; reason: string }>;
  };
  issues: Array<{ type: string; severity: string; message: string }>;
  notes: string;
} | null {
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ??
                      response.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return null;
    }

    const jsonStr = jsonMatch[1] ?? jsonMatch[0];
    const parsed = JSON.parse(jsonStr) as unknown;

    // Validate structure
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    const corrections = obj['corrections'] as Record<string, unknown> | undefined;

    return {
      status: isValidStatus(obj['status']) ? obj['status'] : 'flagged',
      confidence: typeof obj['confidence'] === 'number' ? obj['confidence'] : 0.5,
      corrections: {
        added: Array.isArray(corrections?.['added'])
          ? corrections['added'] as Array<{ tokenRange: [number, number]; newLabel: string; reason: string }>
          : [],
        removed: Array.isArray(corrections?.['removed'])
          ? corrections['removed'] as Array<{ tokenRange: [number, number]; previousLabel: string; reason: string }>
          : [],
        modified: Array.isArray(corrections?.['modified'])
          ? corrections['modified'] as Array<{ tokenRange: [number, number]; from: string; to: string; reason: string }>
          : [],
      },
      issues: Array.isArray(obj['issues'])
        ? obj['issues'] as Array<{ type: string; severity: string; message: string }>
        : [],
      notes: typeof obj['notes'] === 'string' ? obj['notes'] : '',
    };
  } catch {
    return null;
  }
}
