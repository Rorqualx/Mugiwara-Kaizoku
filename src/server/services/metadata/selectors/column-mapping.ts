/**
 * Selector field → persister key mapping, applied at the cutover boundary.
 *
 * The selector names fields after Metadata columns (`cover`, `idMal`,
 * `summary`, `synonyms`, `coverLarge`…). The persister reads the legacy
 * result-builder's names (`coverImage`, `externalIds.malId`, `description`,
 * `alternativeTitles`, `covers.large`…). The overlay used to write winners
 * under the selector's name, where the persister never looked, so for these
 * fields the selector's pick was recorded in provenance but the legacy value
 * was what got stored.
 *
 * Provenance is keyed on the COLUMN name — the key the persister's pin and
 * drift guards and the UI badges use — and the legacy spelling of the same
 * entry is dropped, so one column has one provenance entry.
 *
 * Pure functions — no DB, no I/O.
 */

import { synonymKey } from '@/lib/metadata/synonym-key';
import type { MetadataField } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';

/** A selector winner about to be written for one field. */
export interface ColumnWinner {
  value: unknown;
  provider: string;
}

type MutableRecord = Record<string, unknown>;

/**
 * Below this length the legacy description counts as missing. Same boundary
 * the result builder uses before it swaps in a MangaDex or ComicVine text.
 */
const SHORT_SUMMARY_LENGTH = 80;

const COVER_SIZE_KEYS = {
  coverExtraLarge: 'extraLarge',
  coverLarge: 'large',
  coverMedium: 'medium',
} as const;

type CoverSizeField = keyof typeof COVER_SIZE_KEYS;

/** Column name → the legacy provenance key that describes the same column. */
const LEGACY_PROVENANCE_KEY: Readonly<Record<string, string>> = {
  cover: 'coverImage',
  idMal: 'externalIds',
  summary: 'description',
  synonyms: 'alternativeTitles',
  coverExtraLarge: 'covers',
  coverLarge: 'covers',
  coverMedium: 'covers',
};

function isCoverSizeField(field: string): field is CoverSizeField {
  return field in COVER_SIZE_KEYS;
}

function asRecord(value: unknown): MutableRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...(value as MutableRecord) } : {};
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

/**
 * Write a selector winner where the persister reads it, and stamp provenance
 * under the column name with the provider whose value is actually stored.
 *
 * Returns true when the selector's value was written (possibly merged), false
 * when the legacy value was kept.
 */
export function writeWinnerToColumn(
  field: MetadataField,
  winner: ColumnWinner,
  metadata: MutableRecord,
  provenance: Record<string, string>,
): boolean {
  /* eslint-disable no-param-reassign -- documented in-place overlay (see cutover-overlay.ts) */
  if (field === 'cover') {
    metadata['coverImage'] = winner.value;
    provenance['cover'] = winner.provider;
    return true;
  }
  if (field === 'idMal') {
    metadata['externalIds'] = { ...asRecord(metadata['externalIds']), malId: winner.value };
    provenance['idMal'] = winner.provider;
    return true;
  }
  if (isCoverSizeField(field)) {
    metadata['covers'] = { ...asRecord(metadata['covers']), [COVER_SIZE_KEYS[field]]: winner.value };
    provenance[field] = winner.provider;
    return true;
  }
  if (field === 'summary') return writeSummary(winner, metadata, provenance);
  if (field === 'synonyms') return writeSynonyms(winner, metadata, provenance);
  metadata[field] = winner.value;
  provenance[field] = winner.provider;
  return true;
  /* eslint-enable no-param-reassign */
}

/**
 * Decision D3: the legacy description (AniList's, or the fallback the result
 * builder already chose) stays unless it is missing or shorter than 80
 * characters; only then does the selector's summary reach the column.
 */
function writeSummary(winner: ColumnWinner, metadata: MutableRecord, provenance: Record<string, string>): boolean {
  const legacy = metadata['description'];
  const legacyLength = typeof legacy === 'string' ? legacy.trim().length : 0;
  if (legacyLength >= SHORT_SUMMARY_LENGTH || typeof winner.value !== 'string' || winner.value.trim().length === 0) {
    return false; // provenance for the kept text is carried over by `adoptColumnProvenanceKeys`
  }
  /* eslint-disable no-param-reassign -- documented in-place overlay */
  metadata['description'] = winner.value;
  provenance['summary'] = winner.provider;
  /* eslint-enable no-param-reassign */
  return true;
}

/**
 * Decision D3: synonyms are the legacy list (which carries the English,
 * romaji and native titles the selector's candidates lack) followed by
 * whatever the selector adds, de-duplicated on the shared `synonymKey`.
 *
 * One provenance slot cannot name several contributors; it names whoever
 * supplied most of the stored entries — the legacy list's provider unless
 * the selector added more titles than the legacy list held.
 */
function writeSynonyms(winner: ColumnWinner, metadata: MutableRecord, provenance: Record<string, string>): boolean {
  const selected = stringList(winner.value);
  if (selected.length === 0) return false;

  const seen = new Set<string>();
  const merged: string[] = [];
  const addAll = (items: string[]): number => {
    let added = 0;
    for (const item of items) {
      const key = synonymKey(item);
      if (key.length === 0 || seen.has(key)) continue;
      seen.add(key);
      merged.push(item.trim());
      added++;
    }
    return added;
  };
  const fromLegacy = addAll(stringList(metadata['alternativeTitles']));
  const fromSelector = addAll(selected);

  const legacyProvider = provenance['alternativeTitles'];
  /* eslint-disable no-param-reassign -- documented in-place overlay */
  metadata['alternativeTitles'] = merged;
  provenance['synonyms'] = legacyProvider !== undefined && fromLegacy >= fromSelector ? legacyProvider : winner.provider;
  /* eslint-enable no-param-reassign */
  return true;
}

/** Whether the legacy record holds a value for the column behind `column`. */
function hasLegacyValue(column: string, metadata: MutableRecord): boolean {
  if (isCoverSizeField(column)) {
    const url = asRecord(metadata['covers'])[COVER_SIZE_KEYS[column]];
    return typeof url === 'string' && url.length > 0;
  }
  if (column === 'idMal') return asRecord(metadata['externalIds'])['malId'] !== undefined;
  const value = metadata[LEGACY_PROVENANCE_KEY[column] ?? column];
  return value !== undefined && value !== null;
}

/**
 * Re-key legacy provenance onto column names and drop the legacy spellings.
 *
 * Runs after every winner is written. A column the selector did not write
 * (no candidates, abstained, or the legacy value was kept under D3) inherits
 * the legacy entry — that is the provider whose value will be stored.
 */
export function adoptColumnProvenanceKeys(metadata: MutableRecord, provenance: Record<string, string>): void {
  /* eslint-disable no-param-reassign -- documented in-place overlay */
  for (const [column, legacyKey] of Object.entries(LEGACY_PROVENANCE_KEY)) {
    const legacyProvider = provenance[legacyKey];
    if (provenance[column] === undefined && legacyProvider !== undefined && hasLegacyValue(column, metadata)) {
      provenance[column] = legacyProvider;
    }
  }
  for (const legacyKey of new Set(Object.values(LEGACY_PROVENANCE_KEY))) delete provenance[legacyKey];
  /* eslint-enable no-param-reassign */
}

/**
 * Drop stored legacy-spelled provenance entries that this write supersedes.
 *
 * The persister merges incoming provenance over what is stored, so a title
 * enriched before the column re-keying would keep `description: anilist` next
 * to the new `summary: mangadex` forever. An entry goes only when the incoming
 * map names the column and does not itself use the legacy spelling; `keep`
 * protects manually pinned entries.
 */
export function dropSupersededProvenanceKeys(
  merged: Record<string, string>,
  incoming: Readonly<Record<string, string>>,
  keep: ReadonlySet<string>,
): void {
  for (const [column, legacyKey] of Object.entries(LEGACY_PROVENANCE_KEY)) {
    if (incoming[column] === undefined || incoming[legacyKey] !== undefined || keep.has(legacyKey)) continue;
    // eslint-disable-next-line no-param-reassign -- prunes the caller's merged map in place
    delete merged[legacyKey];
  }
}
