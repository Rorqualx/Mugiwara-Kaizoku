/**
 * Lookup helper that lets the enrichment merge identify when a provider
 * chapter coming in at a particular chapter number is actually the same
 * physical chapter that the user already has on disk under a different
 * number (or under chapterNumber=NULL after a manual cleanup that tagged
 * the title with "[Dup of ch N] ..."). The merge uses this to skip the
 * "create a new row" branch and avoid recreating duplicates on every
 * forceRefresh re-enrichment.
 *
 * Two lookup keys are maintained:
 *   1. `(normalizedTitle, releaseDate)` — confident match when both pieces
 *      are present on the provider chapter.
 *   2. `normalizedTitle` alone — fallback for Tier-2 stubs (which lack
 *      releaseDate) and provider chapters that don't ship a release date.
 *      Only populated when exactly one file-attached row shares that
 *      normalized title, so we never collapse two distinct chapters that
 *      happen to share a generic name.
 *
 * `normalizeTitleForDedup` (shared with the secondary dedup pass) already
 * strips generic placeholders like "Chapter 12", so title-only matching
 * cannot accidentally collapse stubs.
 */

import type { ProviderChapter } from './types';

interface ExistingChapterMinimal {
  id: number;
  filePath: string | null;
  title: string;
  releaseDate: Date | null;
}

const DUP_TAG_PREFIX = /^\[Dup of ch [\d.]+\]\s*/;

export function buildFileContentMatcher<T extends ExistingChapterMinimal>(
  existing: T[],
  normalizeTitleForDedup: (title: string | undefined) => string | null,
): {
  findFileMatchByContent: (pch: ProviderChapter) => T | null;
} {
  const byTitleDate = new Map<string, T>();
  const candidatesByTitle = new Map<string, T[]>();
  for (const ch of existing) {
    if (!ch.filePath) continue;
    const stripped = ch.title.replace(DUP_TAG_PREFIX, '');
    const normTitle = normalizeTitleForDedup(stripped);
    if (!normTitle) continue;
    if (ch.releaseDate) {
      byTitleDate.set(`${normTitle}|${ch.releaseDate.toISOString().slice(0, 10)}`, ch);
    }
    const arr = candidatesByTitle.get(normTitle) ?? [];
    arr.push(ch);
    candidatesByTitle.set(normTitle, arr);
  }
  // Title-only fallback: when any file-attached row carries this title we
  // already own a copy and should NOT let a new provider stub at a different
  // chapterNumber duplicate it. Multiple candidates can happen when the user
  // already has both a canonical row and a "[Dup of ch N]" tagged row — both
  // are file-attached, both represent the same physical chapter, neither
  // should be shadowed.
  const byTitleOnly = new Map<string, T>();
  for (const [k, arr] of candidatesByTitle) {
    const first = arr[0];
    if (first) byTitleOnly.set(k, first);
  }
  return { findFileMatchByContent: (pch) => lookupMatch(pch, normalizeTitleForDedup, byTitleDate, byTitleOnly) };
}

function lookupMatch<T extends ExistingChapterMinimal>(
  pch: ProviderChapter,
  normalizeTitleForDedup: (title: string | undefined) => string | null,
  byTitleDate: Map<string, T>,
  byTitleOnly: Map<string, T>,
): T | null {
  const normTitle = normalizeTitleForDedup(pch.title);
  if (!normTitle) return null;
  if (pch.releaseDate) {
    const parsed = Date.parse(pch.releaseDate);
    if (!isNaN(parsed)) {
      const hit = byTitleDate.get(`${normTitle}|${new Date(parsed).toISOString().slice(0, 10)}`);
      if (hit) return hit;
    }
  }
  return byTitleOnly.get(normTitle) ?? null;
}
