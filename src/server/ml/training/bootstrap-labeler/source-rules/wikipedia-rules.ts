/**
 * Wikipedia Source-Specific Rules
 *
 * Positional rules leveraging Wikipedia's infobox and article structure.
 * Wikipedia uses consistent patterns like .infobox, .infobox-image, and
 * bold text in the lead paragraph for titles.
 *
 * Helpers and constants are in ./wikipedia-rules/wikipedia-helpers.ts
 * Volume metadata rules are in ./wikipedia-rules/wikipedia-volume-metadata-rules.ts
 *
 * @module ml/training/bootstrap-labeler/source-rules/wikipedia-rules
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import {
  findSpanEnd,
  hasClassPattern,
  isLargeImage,
} from './types';
import {
  hasChapterNumberNearby,
  isAfterVolumeTableWithChapters,
  isChapterNumberPattern,
  isChapterNumberToken,
  isDirectlyAfterChapterList,
  isInHatnote,
  isSubstantiveTitle,
  isUnderVolumeOrChapterHeader,
} from './wikipedia-rules/wikipedia-helpers';
import { WIKIPEDIA_INFOBOX_METADATA_RULES } from './wikipedia-rules/wikipedia-infobox-metadata-rules';
import { WIKIPEDIA_VOLUME_METADATA_RULES } from './wikipedia-rules/wikipedia-volume-metadata-rules';

import type { SourceRule, SourceRuleContext } from './types';

// ============================================================================
// Wikipedia Rules
// ============================================================================

export const WIKIPEDIA_RULES: SourceRule[] = [
  // -------------------------------------------------------------------------
  // Title Rules (safe - these don't create large spans)
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-lead-bold-title',
    entityType: 'TITLE',
    confidence: 0.9,
    priority: 100,
    description: 'Wikipedia lead paragraph bold text (title)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean =>
      token.isBold &&
      index < 200 &&
      !token.isInTable &&
      token.sectionType === 'main_content' &&
      token.text.trim().length > 2 &&
      !ctx.matchedEntities.has('TITLE'),
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 8, (t) => !t.isBold),
  },

  {
    id: 'wikipedia-firstheading',
    entityType: 'TITLE',
    confidence: 0.95,
    priority: 95,
    description: 'Wikipedia page heading (#firstHeading)',
    idPatterns: ['firstHeading'],
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean =>
      token.isHeader &&
      token.headerLevel === 1 &&
      token.elementId === 'firstHeading' &&
      !ctx.matchedEntities.has('TITLE'),
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 10, (t) => !t.isHeader),
  },

  // -------------------------------------------------------------------------
  // Cover Image Rules (safe - single token, no span)
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-infobox-image',
    entityType: 'COVER_IMAGE',
    confidence: 0.9,
    priority: 95,
    description: 'Wikipedia infobox image (.infobox-image)',
    classPatterns: ['infobox-image'],
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean =>
      token.isImage &&
      hasClassPattern(token, ['infobox-image']) &&
      !ctx.matchedEntities.has('COVER_IMAGE'),
  },

  {
    id: 'wikipedia-infobox-first-large-image',
    entityType: 'COVER_IMAGE',
    confidence: 0.85,
    priority: 90,
    description: 'First large image in Wikipedia infobox',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean =>
      token.isImage &&
      token.isInInfobox &&
      isLargeImage(token) &&
      !ctx.matchedEntities.has('COVER_IMAGE'),
  },

  // -------------------------------------------------------------------------
  // Chapters List URL — "Further information: List of X chapters" hatnote
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-chapters-list-url',
    entityType: 'CHAPTERS_LIST_URL',
    confidence: 0.9,
    priority: 85,
    description: 'Link to chapters/volumes list page from hatnote',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      if (!token.isLink) return false;
      if (!token.linkHref) return false;
      if (!isInHatnote(token)) return false;
      if (ctx.matchedEntities.has('CHAPTERS_LIST_URL')) return false;
      // Href must specifically reference chapters or volumes (not just "list")
      const href = token.linkHref.toLowerCase();
      if (!href.includes('chapter') && !href.includes('volume') && !href.includes('episode')) return false;
      return true;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 15, (t) => !t.isLink || !isInHatnote(t)),
  },

  // -------------------------------------------------------------------------
  // Infobox Metadata Rules — author, artist, publisher, genre, etc.
  // Defined in ./wikipedia-rules/wikipedia-infobox-metadata-rules.ts
  // -------------------------------------------------------------------------
  ...WIKIPEDIA_INFOBOX_METADATA_RULES,

  // -------------------------------------------------------------------------
  // Volume Metadata Rules — number, dates, ISBNs (JP then EN)
  // Defined in ./wikipedia-rules/wikipedia-volume-metadata-rules.ts
  // -------------------------------------------------------------------------
  ...WIKIPEDIA_VOLUME_METADATA_RULES,

  // -------------------------------------------------------------------------
  // Chapter Rules - Wikipedia numbered chapter format (3 entity types)
  // Token structure: "001" "." "\"Normanni\"" "(" "北人" "," "Norumanni" ")"
  // All tokens have isInTable:true. 6-gate detection via isChapterNumberToken().
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-chapter-number',
    entityType: 'CHAPTER_NUMBER',
    confidence: 0.9,
    priority: 72,
    description: 'Wikipedia chapter number (001) inside volume table',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean =>
      isChapterNumberToken(token, index, ctx),
    // Single token span — just the number itself
  },

  {
    id: 'wikipedia-chapter-title',
    entityType: 'CHAPTER_TITLE',
    confidence: 0.85,
    priority: 71,
    description: 'Wikipedia chapter title ("Normanni") after number+period',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // This token must be the title token (index + 2 from a chapter number)
      // Look back 2 tokens: should be number(i-2), period(i-1), this(i)
      if (index < 2) return false;
      const periodToken = ctx.tokens[index - 1];
      const numberToken = ctx.tokens[index - 2];
      if (!periodToken || !numberToken) return false;
      if (periodToken.text.trim() !== '.') return false;
      // Verify the number token passes all 6 gates
      if (!isChapterNumberToken(numberToken, index - 2, ctx)) return false;
      // This token must look like a title
      return isSubstantiveTitle(token.text.trim());
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Extend through title text, stop at "(" (alt title) or next chapter
      let endIndex = index;
      for (let i = index + 1; i < Math.min(index + 10, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t || t.isHeader) break;
        const text = t.text.trim();
        // Stop at opening paren (alt title starts)
        if (text === '(') break;
        // Stop at next chapter number
        if (/^\d{1,3}$/.test(text) && t.isInTable && ctx.tokens[i + 1]?.text.trim() === '.') break;
        endIndex = i;
      }
      return endIndex;
    },
  },

  // -------------------------------------------------------------------------
  // Unified Alt-Title Detection (Japanese + Romanization)
  // Detects Japanese text (kanji/hiragana/katakana) and romanization after chapter titles
  // Works with or without parentheses
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-chapter-alt-title-japanese',
    entityType: 'CHAPTER_ALT_TITLE',
    confidence: 0.85,
    priority: 70,
    description: 'Chapter alt title - Japanese text (kanji/kana) after chapter title',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      const text = token.text.trim();

      // Must contain Japanese characters (kanji, hiragana, or katakana)
      if (!/[ぁ-んァ-ヶー一-龯]/.test(text)) return false;
      if (!token.isInTable) return false;
      if (!token.isInList) return false;

      // Look back for chapter context: closing quote, paren, or chapter number
      for (let i = index - 1; i >= Math.max(0, index - 8); i--) {
        const prev = ctx.tokens[i];
        if (!prev) continue;
        const prevText = prev.text.trim();

        // After opening paren - classic (Japanese, Romanization) format
        if (prevText === '(' || prevText === '（') {
          return hasChapterNumberNearby(index, ctx, 20);
        }

        // After closing quote - Japanese follows chapter title directly
        if (prevText.endsWith('"') || prevText.endsWith('\u201D') || prevText.endsWith('」')) {
          return hasChapterNumberNearby(index, ctx, 25);
        }
      }
      return false;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Extend through Japanese text, comma, romanization, numbers, and closing paren
      let endIndex = index;
      let foundComma = false;

      for (let i = index + 1; i < Math.min(index + 25, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t || t.isHeader) break;
        const text = t.text.trim();

        // Stop at next chapter number (e.g., "117" followed by ".")
        if (/^\d{1,3}$/.test(text) && ctx.tokens[i + 1]?.text.trim() === '.') break;

        // Include and stop at closing paren
        if (text === ')' || text === '）' || text.endsWith(')') || text.endsWith('）')) {
          return i;
        }

        // Include comma (separator between Japanese and romanization)
        if (text === ',') {
          foundComma = true;
          endIndex = i;
          continue;
        }

        // Include Japanese characters
        if (/[ぁ-んァ-ヶー一-龯]/.test(text)) {
          endIndex = i;
          continue;
        }

        // Include romanization (Latin letters, numbers, macrons like ō, ū)
        if (/^[A-Za-zÀ-ÿ0-9\s\-–—''´]+$/.test(text)) {
          endIndex = i;
          continue;
        }

        // Stop at other content after we've seen the comma (romanization should be done)
        if (foundComma && text.length > 0) {
          break;
        }
      }
      return endIndex;
    },
  },

  {
    id: 'wikipedia-chapter-alt-title-romanization',
    entityType: 'CHAPTER_ALT_TITLE',
    confidence: 0.8,
    priority: 68,
    description: 'Chapter alt title - Italic romanization after Japanese',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // Must be italic text (romanization is typically italicized)
      if (!token.isItalic) return false;
      if (!token.isInTable) return false;
      if (!token.isInList) return false;

      const text = token.text.trim();
      // Must look like romanization (Latin letters, possibly with macrons)
      if (!/^[A-Za-zÀ-ÿ]/.test(text)) return false;

      // Check if we're after Japanese text (within recent tokens)
      for (let i = index - 1; i >= Math.max(0, index - 10); i--) {
        const prev = ctx.tokens[i];
        if (!prev) continue;
        // Found Japanese text - this is romanization following it
        if (/[ぁ-んァ-ヶー一-龯]/.test(prev.text)) {
          return hasChapterNumberNearby(index, ctx, 25);
        }
        // Stop if we hit a chapter number (went too far back)
        if (/^\d{1,3}$/.test(prev.text.trim()) && ctx.tokens[i + 1]?.text.trim() === '.') break;
      }
      return false;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Include all italic romanization text until closing paren or next chapter
      let endIndex = index;
      for (let i = index + 1; i < Math.min(index + 15, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t || t.isHeader) break;
        const text = t.text.trim();

        // Stop at next chapter number
        if (/^\d{1,3}$/.test(text) && ctx.tokens[i + 1]?.text.trim() === '.') break;

        // Include and stop at closing paren
        if (text === ')' || text === '）' || text.endsWith(')')) {
          return i;
        }

        // Include continuation of romanization (italic or plain)
        if (t.isItalic || /^[A-Za-zÀ-ÿ0-9\s\-–—''´]+$/.test(text) || text === ',') {
          endIndex = i;
        } else {
          break;
        }
      }
      return endIndex;
    },
  },

  {
    id: 'wikipedia-chapter-english-title',
    entityType: 'CHAPTER_TITLE',
    confidence: 0.85,
    priority: 72,
    description: 'Wikipedia chapter English title in quotes after number',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      const text = token.text.trim();
      // Match quoted titles starting with quote
      if (text !== '"') return false;
      if (!token.isInTable) return false;
      if (!token.isInList) return false;

      // Check if there's a chapter number before this (within 5 tokens)
      for (let i = Math.max(0, index - 5); i < index; i++) {
        const prevToken = ctx.tokens[i];
        if (prevToken && /^\d{3}$/.test(prevToken.text.trim())) {
          return true;
        }
      }
      return false;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Include all tokens until we hit opening parenthesis or another quote
      let endIndex = index;
      for (let i = index + 1; i < Math.min(index + 15, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        const text = t.text.trim();
        // Stop at parenthesis (start of alt title) or closing quote
        if (text === '(' || text === '"') break;
        endIndex = i;
      }
      return endIndex;
    },
  },

  // -------------------------------------------------------------------------
  // Special Chapter Rules — Bonus, Extra, Side Story, etc.
  // These entries have no numeric prefix and bypass isChapterNumberToken().
  // Triggers on the QUOTED title after a special prefix, matching regular
  // chapter patterns (separate CHAPTER_TITLE + CHAPTER_ALT_TITLE).
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-special-chapter-title',
    entityType: 'CHAPTER_TITLE',
    confidence: 0.85,
    priority: 69,
    description: 'Quoted title after Bonus/Extra/Special/Side Story prefix',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      const text = token.text.trim();
      // Must start with a quote character (the actual title)
      if (!text.startsWith('"') && !text.startsWith('\u201C') && !text.startsWith('\u300C')) return false;
      if (!token.isInTable || !token.isInList) return false;
      if (!isUnderVolumeOrChapterHeader(ctx.tokens, index)) return false;
      // Look back for a special prefix within 5 tokens (e.g., "Bonus Material .")
      for (let i = index - 1; i >= Math.max(0, index - 5); i--) {
        const prev = ctx.tokens[i];
        if (!prev?.isInList) break;
        if (/^(Bonus|Extra|Special|Side)$/i.test(prev.text.trim())) return true;
      }
      return false;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Extend through quoted title, stop at closing quote or paren boundary
      let endIndex = index;
      for (let i = index + 1; i < Math.min(index + 20, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t || t.isHeader) break;
        const text = t.text.trim();
        // Stop at next chapter number
        if (/^\d{1,3}$/.test(text) && t.isInList && ctx.tokens[i + 1]?.text.trim() === '.') break;
        // Stop at opening paren (alt-title boundary — handled by alt-title rule)
        if (text === '(' || text === '\uFF08') break;
        endIndex = i;
        // Stop after closing quote
        if (text.endsWith('"') || text.endsWith('\u201D') || text.endsWith('\u300D')) break;
      }
      return endIndex;
    },
  },

  // -------------------------------------------------------------------------
  // Volume Summary Rules
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-volume-summary-prose',
    entityType: 'VOLUME_SUMMARY',
    confidence: 0.8,
    priority: 60,
    description: 'Prose paragraph after chapter list (volume plot summary)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // Must be prose text, not in table/infobox
      if (token.isInTable || token.isInInfobox) return false;
      if (token.isHeader || token.isImage) return false;
      if (token.sectionType !== 'main_content') return false;

      const text = token.text.trim();
      if (text.length < 3) return false;

      // Must start with capital letter or common article words
      const startsWithCapital = /^[A-Z]/.test(text);
      const startsWithArticle = /^(The|A|An|In|On|At|After|Before|During|When|While)\b/i.test(text);
      if (!startsWithCapital && !startsWithArticle) return false;

      // CRITICAL: Must come AFTER a volume table with chapters
      return isAfterVolumeTableWithChapters(index, ctx.tokens);
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      let endIndex = index;
      for (let i = index + 1; i < Math.min(index + 300, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        if (t.isHeader) break;
        if (t.isInTable) break;
        // Stop at chapter patterns
        if (/^\*\d{1,3}/.test(t.text.trim())) break;
        if (isChapterNumberPattern(t, i, ctx.tokens)) break;
        endIndex = i;
      }
      return endIndex;
    },
  },

  {
    id: 'wikipedia-volume-summary-in-table',
    entityType: 'VOLUME_SUMMARY',
    confidence: 0.75,
    priority: 58,
    description: 'Volume summary text inside chapter table cell',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!token.isInTable) return false;
      if (token.isInInfobox) return false; // Infobox is a table but never has volume summaries
      if (token.isHeader || token.isImage) return false;
      if (token.isTableHeader) return false;

      // Volume summaries are paragraph text, not list items.
      // Check both isInList AND xpath for /li or /ul — isInList alone is unreliable
      // for deeply nested tokens inside <li> (e.g., text inside <i> inside <li>).
      if (token.isInList) return false;
      const xpathLower = token.xpath.toLowerCase();
      if (xpathLower.includes('/li') || xpathLower.includes('/ul') || xpathLower.includes('/ol')) return false;

      const text = token.text.trim();
      // Tokens are word-level (one per word), so check minimum 2 chars
      if (text.length < 2) return false;
      if (!/^[A-Z]/.test(text)) return false; // Must start like a sentence

      // Must be directly after chapter list items — no <th> in between
      return isDirectlyAfterChapterList(index, ctx.tokens);
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      let endIndex = index;
      for (let i = index + 1; i < Math.min(index + 200, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        if (t.isHeader) break;
        if (!t.isInTable) break;
        // Stop at table header cells (<th>) — indicates next volume's metadata row
        if (t.isTableHeader) break;
        // Stop at list items — indicates next volume's chapter list
        if (t.isInList) break;
        // Stop at chapter number patterns
        if (isChapterNumberPattern(t, i, ctx.tokens)) break;
        // Stop at volume boundaries
        if (/^(vol\.?|volume)\s*\d/i.test(t.text.trim())) break;
        endIndex = i;
      }
      return endIndex;
    },
  },
];
