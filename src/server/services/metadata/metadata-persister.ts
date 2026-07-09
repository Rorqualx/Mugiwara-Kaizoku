/**
 * Metadata Persistence Service
 *
 * Handles persisting unified metadata to the database with proper type safety.
 *
 * This service:
 * - Saves UnifiedMangaMetadata to database (Manga + Metadata models)
 * - Removes all `as any` type casts from original implementation
 * - Supports transactional updates
 * - Returns AsyncResult for type-safe error handling
 * - Preserves existing metadata when new data is partial
 *
 * @module MetadataPersistenceService
 */

import { ANCHOR_PROVIDERS } from '@/lib/metadata/provider-registry';
import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { parseFieldAlternatives } from '@/types/domain/field-alternatives-types';
import { parseRatingJson } from '@/types/domain/rating-types';
import type { UnifiedMangaMetadata } from '@/types/search.types';
import { AsyncResult, createSuccessResult, createErrorResult } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';

import type { Manga, Metadata, MangaPublicationStatus, Prisma } from '@prisma/client';

/**
 * Per-field provenance entry persisted to `Manga.providerMetadata.metadataProvenance`.
 *
 * Phase 0 stores `{ provider }` for every field. Phase 1.5 will extend this with
 * `confidence` and `alternatives` (dissenting candidates with their providers
 * and confidence scores) when the cross-source consensus selector ships.
 *
 * Read-side accepts both the rich object shape and the legacy bare-string shape
 * (`Record<string, string>` rows written before Phase 0). Re-enrichment upgrades
 * legacy rows to the new shape; no separate migration needed.
 */
export interface ProvenanceEntry {
  provider: string;
  /** Phase 1.5: cross-source consensus confidence (0..1) */
  confidence?: number;
  /** Phase 1.5: dissenting candidates not selected, retained for UI provenance badges */
  alternatives?: Array<{
    provider: string;
    value: unknown;
    confidence: number;
  }>;
}

/**
 * Input for persisting metadata
 */
export interface PersistMetadataInput {
  /** Database manga ID */
  mangaId: number;
  /** Unified metadata to persist */
  metadata: UnifiedMangaMetadata;
  /** Metadata provenance (which provider supplied which field) */
  metadataProvenance: Record<string, string>;
}

/**
 * Result of metadata persistence
 */
export interface PersistMetadataResult {
  /** Updated manga with metadata */
  manga: Manga & { Metadata: Metadata | null };
  /** Whether metadata was created (true) or updated (false) */
  created: boolean;
}

/**
 * Coerce a raw `metadataProvenance` entry to a provider-name string.
 *
 * Accepts:
 * - bare string (legacy shape pre-Phase 0)
 * - `{ provider: string, confidence?, alternatives? }` (Phase 0+ shape)
 *
 * Returns null when the entry is malformed (skips it instead of throwing).
 */
function normalizeProvenanceEntry(raw: unknown): string | null {
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw !== null && 'provider' in raw) {
    const provider = (raw as { provider: unknown }).provider;
    if (typeof provider === 'string') return provider;
  }
  return null;
}

/**
 * Phase 4 v2-E: extract the `manual: true` flag from a provenance entry.
 * Returns true only when the entry is the rich-object shape AND has
 * `manual: true`. Bare-string legacy entries are never manual.
 */
function isManualPin(raw: unknown): boolean {
  if (typeof raw === 'object' && raw !== null && 'manual' in raw) {
    return (raw as { manual: unknown }).manual === true;
  }
  return false;
}

/**
 * Type-safe metadata update data matching Prisma's Metadata model
 */
interface MetadataUpdateData {
  coverExtraLarge?: string;
  coverLarge?: string;
  coverMedium?: string;
  cover: string;
  summary: string;
  genres: string[];
  authors: string[];
  artists: string[];
  tags: string[];
  themes: string[];
  // Phase 1: characters dropped (out of app scope).
  startDate?: Date;
  endDate?: Date;
  synonyms: string[];
  urls: string[];
  chapters?: number;
  volumes?: number;
  bannerImage?: string;
  format?: string;
  idMal?: number;
  averageScore?: number;
  popularity?: number;
  countryOfOrigin?: string;
  publishers?: string[];
  // Phase 1: MangaDex content classification.
  contentRating?: string;
  publicationDemographic?: string;
  // Phase 1: rating widened from Float? to Json?. Persister Zod-validates at boundary.
  rating?: import('@/types/domain/rating-types').RatingJson;
  source?: string;
  sourceId?: string;
  status: MangaPublicationStatus;
  lastFetch: Date;
  // Phase 1.5 #12: per-field dissenting candidates from the cross-source
  // consensus selector. Validated at the persister boundary via
  // parseFieldAlternatives before write.
  fieldAlternatives?: Prisma.InputJsonValue;
}

/**
 * Metadata Persistence Service
 *
 * Responsible for saving unified metadata to the database with full type safety
 */
export class MetadataPersistenceService {
  private logger = logger.child('MetadataPersistenceService', {
    module: 'MetadataPersistenceService'
  });

  /**
   * Persist unified metadata to database
   *
   * Updates or creates Metadata record and links it to Manga.
   * Preserves existing values when new metadata doesn't provide them.
   *
   * @param input - Persistence input with manga ID, metadata, and provenance
   * @returns AsyncResult with updated manga including metadata
   */
  async persistMetadata(
    input: PersistMetadataInput
  ): Promise<AsyncResult<PersistMetadataResult>> {
    try {
      const { mangaId, metadata, metadataProvenance } = input;

      this.logger.info(`Persisting metadata for manga ${mangaId}`);

      // Use transaction to ensure atomicity
      const result = await prisma.$transaction(async (tx) => {
        // Get manga with existing metadata
        const manga = await tx.manga.findUnique({
          where: { id: mangaId },
          include: { Metadata: true }
        });

        if (!manga) {
          throw new ValidationError(`Manga with ID ${mangaId} not found`);
        }

        // iter-MM-9-A: read existing field-level provenance so a non-AL
        // provider (e.g. Wikipedia mis-bound to a parent series article)
        // can't clobber an AL-anchored numeric field. Was previously
        // wholesale-replaced; now merged per-field.
        const existingProvenance = this.extractExistingProvenance(manga.providerMetadata);
        const pinnedFields = this.extractManualPinnedFields(manga.providerMetadata);

        // Build type-safe metadata update data
        const metadataData = this.buildMetadataUpdateData(metadata, manga.Metadata);

        // Apply provenance guards: drop fields where a non-anchor provider
        // is trying to drift an AL-sourced numeric value beyond tolerance.
        const refused = this.applyProvenanceGuards(
          metadataData, manga.Metadata, existingProvenance, metadataProvenance, mangaId,
        );

        // Phase 4 v2-E: refuse any field whose existing provenance entry
        // is marked `manual: true`. Sticky-pinned by the cover/banner picker.
        const manualRefused = this.applyManualPinGuards(metadataData, pinnedFields, mangaId);
        for (const f of manualRefused) refused.add(f);

        // Merge provenance per-field. Refused fields keep their prior source.
        const mergedProvenance: Record<string, string> = { ...existingProvenance };
        for (const [k, v] of Object.entries(metadataProvenance)) {
          if (!refused.has(k)) mergedProvenance[k] = v;
        }

        // Phase 0: persist the rich ProvenanceEntry shape forward-compatible
        // with Phase 1.5's confidence + alternatives. In-memory we still use
        // bare provider names (Record<string, string>); the conversion lives
        // only at the write boundary.
        //
        // Local write-shape is narrowed to `{provider: string}` so it satisfies
        // Prisma's InputJsonValue (the wider ProvenanceEntry type has
        // `alternatives.value: unknown` which isn't JSON-assignable). Phase 1.5
        // will widen this when it writes confidence/alternatives, with a Prisma-
        // JSON-compatible value type.
        //
        // Phase 4 v2-E: preserve the `manual: true` flag when re-stamping
        // pinned fields so a re-enrichment doesn't wipe the pin.
        const provenanceForDb: Record<string, { provider: string; manual?: true }> = {};
        for (const [k, v] of Object.entries(mergedProvenance)) {
          provenanceForDb[k] = pinnedFields.has(k) ? { provider: v, manual: true } : { provider: v };
        }

        // Prepare provider metadata with merged provenance
        const providerMetadata = {
          ...(typeof manga.providerMetadata === 'object' && manga.providerMetadata !== null ? manga.providerMetadata : {}),
          metadataProvenance: provenanceForDb
        };

        let updatedMetadata: Metadata;
        let created = false;

        if (manga.metadataId && manga.Metadata) {
          // Update existing metadata
          this.logger.info(`Updating existing metadata for manga ${mangaId}`);
          updatedMetadata = await tx.metadata.update({
            where: { id: manga.metadataId },
            data: metadataData
          });
        } else {
          // Create new metadata
          this.logger.info(`Creating new metadata for manga ${mangaId}`);
          created = true;
          updatedMetadata = await tx.metadata.create({
            data: {
              ...metadataData,
              Manga: {
                connect: { id: mangaId }
              }
            }
          });

          // Link metadata to manga if not already linked
          if (!manga.metadataId) {
            await tx.manga.update({
              where: { id: mangaId },
              data: { metadataId: updatedMetadata.id }
            });
          }
        }

        // Update manga provider metadata
        await tx.manga.update({
          where: { id: mangaId },
          data: { providerMetadata }
        });

        // Fetch final updated manga
        const updatedManga = await tx.manga.findUnique({
          where: { id: mangaId },
          include: { Metadata: true }
        });

        if (!updatedManga) {
          throw new ValidationError(`Failed to fetch updated manga ${mangaId}`);
        }

        return {
          manga: updatedManga,
          created
        };
      });

      this.logger.info(`Successfully persisted metadata for manga ${mangaId} (${result.created ? 'created' : 'updated'})`);

      // Emit WebSocket event for real-time UI sync
      void realtimeEmitter.emitMangaUpdate({
        mangaId,
        action: 'updated',
        data: {
          metadataPersisted: true,
          metadataCreated: result.created,
          source: 'metadata-persister'
        }
      });

      return createSuccessResult(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error persisting metadata for manga ${input.mangaId}:`, error);
      return createErrorResult(new Error(`Failed to persist metadata: ${errorMessage}`));
    }
  }

  /**
   * iter-MM-9-A: extract per-field provenance from a manga's persisted
   * `providerMetadata.metadataProvenance` object. Returns an empty record
   * when the manga has never had provenance written.
   *
   * Phase 0: accepts BOTH the legacy `Record<string, string>` shape and the
   * new `Record<string, ProvenanceEntry>` shape. Legacy rows upgrade to the
   * new shape on next re-enrichment; no separate migration needed.
   *
   * Returns `Record<string, string>` (provider name only) — in-memory
   * representation stays narrow. Phase 1.5 will widen this when the
   * cross-source selector starts reading confidence/alternatives.
   */
  private extractExistingProvenance(providerMetadata: unknown): Record<string, string> {
    if (typeof providerMetadata !== 'object' || providerMetadata === null) return {};
    const root = providerMetadata as Record<string, unknown>;
    const prov = root['metadataProvenance'];
    if (typeof prov !== 'object' || prov === null) return {};
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(prov as Record<string, unknown>)) {
      const providerName = normalizeProvenanceEntry(v);
      if (providerName !== null) result[k] = providerName;
    }
    return result;
  }

  /**
   * Phase 4 v2-E: extract the set of field names that the operator has
   * manually pinned via the cover/banner override picker. Re-enrichment
   * writes to these fields are refused so the user's pick sticks.
   */
  private extractManualPinnedFields(providerMetadata: unknown): Set<string> {
    const pinned = new Set<string>();
    if (typeof providerMetadata !== 'object' || providerMetadata === null) return pinned;
    const root = providerMetadata as Record<string, unknown>;
    const prov = root['metadataProvenance'];
    if (typeof prov !== 'object' || prov === null) return pinned;
    for (const [k, v] of Object.entries(prov as Record<string, unknown>)) {
      if (isManualPin(v)) pinned.add(k);
    }
    return pinned;
  }

  /**
   * Phase 4 v2-E: refuse incoming writes to any field whose existing
   * provenance entry is marked `manual: true`. Mirrors
   * `applyProvenanceGuards` shape — mutates `metadataData` in place by
   * deleting the refused fields and returns their names so the caller
   * can preserve the prior provenance entry intact.
   *
   * The cover-write paths (single `cover` + the `coverLarge`/`coverMedium`/
   * `coverExtraLarge` triplet) get coupled treatment: pinning `cover`
   * also locks the resolution-bucketed columns since the existing UI
   * writes the same URL to all of them.
   */
  private applyManualPinGuards(
    metadataData: MetadataUpdateData,
    pinnedFields: Set<string>,
    mangaId: number,
  ): Set<string> {
    const refused = new Set<string>();
    if (pinnedFields.size === 0) return refused;
    const coverColumns: Array<keyof MetadataUpdateData> = [
      'cover', 'coverLarge', 'coverMedium', 'coverExtraLarge',
    ];
    const isCoverPinned = pinnedFields.has('cover');
    for (const field of Object.keys(metadataData) as Array<keyof MetadataUpdateData>) {
      const locked = pinnedFields.has(field) || (isCoverPinned && coverColumns.includes(field));
      if (!locked) continue;
      refused.add(field);
      // eslint-disable-next-line no-param-reassign -- documented: this guard mutates metadataData in place
      delete metadataData[field];
    }
    if (refused.size > 0) {
      this.logger.info(
        `[v2-E] Refused ${refused.size} field overwrite(s) for manga ${mangaId} (manual pin): ${[...refused].join(',')}`,
      );
    }
    return refused;
  }

  /**
   * iter-MM-9-A: refuse to overwrite numeric Metadata fields when a
   * non-anchor provider would drift them more than 20% from an
   * AL-anchored value. Mutates `metadataData` in place by deleting
   * the refused fields. Returns the set of refused field names so the
   * caller can preserve their prior provenance entry.
   *
   * Anchor priority: anilist > mal (both authoritative for vol/chapter
   * counts). Other sources (wikipedia, fandom, comicvine, mangadex,
   * mangaupdates) cannot overwrite an anchor's value unless the drift
   * is small or there is no prior value.
   *
   * Guards apply to: `volumes`, `chapters`.
   */
  private applyProvenanceGuards(
    metadataData: MetadataUpdateData,
    existingMetadata: Metadata | null,
    existingProvenance: Record<string, string>,
    incomingProvenance: Record<string, string>,
    mangaId: number,
  ): Set<string> {
    const refused = new Set<string>();
    const guardedFields: Array<'volumes' | 'chapters'> = ['volumes', 'chapters'];
    const anchorSources = new Set<string>(ANCHOR_PROVIDERS);
    const DRIFT_TOLERANCE = 0.2;

    for (const field of guardedFields) {
      const incoming = metadataData[field];
      const existing = existingMetadata?.[field];
      if (incoming === undefined) continue;
      if (existing === undefined || existing === null) continue;

      const existingSource = existingProvenance[field];
      const incomingSource = incomingProvenance[field];
      if (!existingSource || !incomingSource) continue;
      if (existingSource === incomingSource) continue;
      if (!anchorSources.has(existingSource)) continue;
      if (anchorSources.has(incomingSource)) continue;

      const drift = Math.abs(incoming - existing) / Math.max(existing, 1);
      if (drift <= DRIFT_TOLERANCE) continue;

      // Refuse this write (intentional in-place mutation, see JSDoc above)
      refused.add(field);
      // eslint-disable-next-line no-param-reassign -- documented: this guard mutates metadataData in place
      delete metadataData[field];
      this.logger.warn(
        `[iter-MM-9-A] Refused ${field} overwrite for manga ${mangaId}: ` +
        `anchor=${existingSource}(${existing}) incoming=${incomingSource}(${incoming}) drift=${(drift * 100).toFixed(0)}%`,
      );
    }
    return refused;
  }

  /**
   * Build type-safe metadata update data
   *
   * Converts UnifiedMangaMetadata to Prisma Metadata model format,
   * preserving existing values when new metadata doesn't provide them.
   *
   * @param metadata - New unified metadata
   * @param existingMetadata - Existing metadata from database (nullable)
   * @returns Type-safe metadata update data
   */
  private buildMetadataUpdateData(
    metadata: UnifiedMangaMetadata,
    existingMetadata: Metadata | null
  ): MetadataUpdateData {
    // Build required fields
    const requiredFields = this.buildRequiredFields(metadata, existingMetadata);

    // Build optional fields
    const optionalFields = this.buildOptionalFields(metadata, existingMetadata);

    return { ...requiredFields, ...optionalFields };
  }

  /**
   * Build required metadata fields
   */
  private buildRequiredFields(
    metadata: UnifiedMangaMetadata,
    existingMetadata: Metadata | null
  ): Pick<MetadataUpdateData, 'cover' | 'summary' | 'genres' | 'authors' | 'artists' | 'tags' | 'themes' | 'synonyms' | 'urls' | 'status' | 'lastFetch'> {
    const getValue = <T>(newValue: T | undefined, existingValue: T | null | undefined, defaultValue: T): T => {
      if (newValue !== undefined && newValue !== null) return newValue;
      if (existingValue !== undefined && existingValue !== null) return existingValue;
      return defaultValue;
    };

    const getArrayValue = (newArray: string[] | undefined, existingArray: string[] | null | undefined): string[] => {
      if (newArray && newArray.length > 0) return newArray;
      if (existingArray && existingArray.length > 0) return existingArray;
      return [];
    };

    // Main cover
    const cover = getValue(metadata['coverImage'] as string | undefined, existingMetadata?.cover, '/cover-not-found.jpg');

    // Description/summary
    const summary = getValue(metadata['description'] as string | undefined, existingMetadata?.summary, '');

    // Arrays
    const genres = getArrayValue(metadata['genres'] as string[] | undefined, existingMetadata?.genres);
    const authors = getArrayValue(metadata['authors'] as string[] | undefined, existingMetadata?.authors);
    const artists = getArrayValue(metadata['artists'] as string[] | undefined, existingMetadata?.artists);
    const tags = getArrayValue(
      (metadata['tags'] as Array<string | { name: string }> | undefined)?.map(t => typeof t === 'string' ? t : t.name),
      existingMetadata?.tags
    );
    const themes = getArrayValue(
      (metadata['themes'] as Array<string | { name: string }> | undefined)?.map(t => typeof t === 'string' ? t : t.name),
      existingMetadata?.themes
    );
    // Phase 1: Metadata.characters dropped (out of app scope).
    const synonyms = getArrayValue(metadata['alternativeTitles'] as string[] | undefined, existingMetadata?.synonyms);

    // URLs
    const extractedUrls = Array.isArray(metadata['externalLinks'])
      ? (metadata['externalLinks'] as Array<{ url: string }>).map(link => link.url)
      : undefined;
    const urls = getArrayValue(extractedUrls, existingMetadata?.urls);

    // Status (required field with fallback to UNKNOWN)
    const status = (metadata['status'] ?? existingMetadata?.status ?? 'UNKNOWN') as MangaPublicationStatus;

    return {
      cover,
      summary,
      genres,
      authors,
      artists,
      tags,
      themes,
      synonyms,
      urls,
      status,
      lastFetch: new Date()
    };
  }

  /**
   * Build optional metadata fields
   */
  private buildOptionalFields(
    metadata: UnifiedMangaMetadata,
    existingMetadata: Metadata | null
  ): Partial<Omit<MetadataUpdateData, 'cover' | 'summary' | 'genres' | 'authors' | 'artists' | 'tags' | 'themes' | 'synonyms' | 'urls' | 'status' | 'lastFetch'>> {
    return {
      ...this.buildCoverVariants(metadata, existingMetadata),
      ...this.buildDateFields(metadata, existingMetadata),
      ...this.buildNumericFields(metadata, existingMetadata),
      ...this.buildStringFields(metadata, existingMetadata),
      ...this.buildFieldAlternatives(metadata),
    };
  }

  /**
   * Phase 1.5 #12 cutover: extract `fieldAlternatives` from the metadata
   * Record (set by the selector overlay) + validate via Zod before write.
   * Malformed payloads are silently dropped — the column stays null.
   */
  private buildFieldAlternatives(
    metadata: UnifiedMangaMetadata,
  ): Partial<Pick<MetadataUpdateData, 'fieldAlternatives'>> {
    const raw = (metadata as Record<string, unknown>)['fieldAlternatives'];
    if (raw === undefined || raw === null) return {};
    const parsed = parseFieldAlternatives(raw);
    if (parsed === null) return {};
    return { fieldAlternatives: parsed as unknown as Prisma.InputJsonValue };
  }

  /**
   * Build cover variant fields
   */
  private buildCoverVariants(
    metadata: UnifiedMangaMetadata,
    existingMetadata: Metadata | null
  ): Partial<Pick<MetadataUpdateData, 'coverExtraLarge' | 'coverLarge' | 'coverMedium'>> {
    const getOptionalValue = <T>(newValue: T | undefined, existingValue: T | null | undefined): T | undefined => {
      if (newValue !== undefined && newValue !== null) return newValue;
      if (existingValue !== undefined && existingValue !== null) return existingValue;
      return undefined;
    };

    const result: Partial<MetadataUpdateData> = {};
    const covers = metadata.covers;

    const coverExtraLarge = getOptionalValue(covers?.extraLarge, existingMetadata?.coverExtraLarge);
    const coverLarge = getOptionalValue(covers?.large, existingMetadata?.coverLarge);
    const coverMedium = getOptionalValue(covers?.medium, existingMetadata?.coverMedium);

    if (coverExtraLarge !== undefined) result.coverExtraLarge = coverExtraLarge;
    if (coverLarge !== undefined) result.coverLarge = coverLarge;
    if (coverMedium !== undefined) result.coverMedium = coverMedium;

    return result;
  }

  /**
   * Build date fields
   */
  private buildDateFields(
    metadata: UnifiedMangaMetadata,
    existingMetadata: Metadata | null
  ): Partial<Pick<MetadataUpdateData, 'startDate' | 'endDate'>> {
    const getOptionalValue = <T>(newValue: T | undefined, existingValue: T | null | undefined): T | undefined => {
      if (newValue !== undefined && newValue !== null) return newValue;
      if (existingValue !== undefined && existingValue !== null) return existingValue;
      return undefined;
    };

    const result: Partial<MetadataUpdateData> = {};

    const startDate = getOptionalValue(
      metadata['startDate'] ? new Date(metadata['startDate']) : undefined,
      existingMetadata?.startDate
    );
    const endDate = getOptionalValue(
      metadata['endDate'] ? new Date(metadata['endDate']) : undefined,
      existingMetadata?.endDate
    );

    if (startDate !== undefined) result.startDate = startDate;
    if (endDate !== undefined) result.endDate = endDate;

    return result;
  }

  /**
   * Build numeric fields
   */
  private buildNumericFields(
    metadata: UnifiedMangaMetadata,
    existingMetadata: Metadata | null
  ): Partial<Pick<MetadataUpdateData, 'chapters' | 'volumes' | 'idMal' | 'averageScore' | 'popularity'>> {
    const getOptionalValue = <T>(newValue: T | undefined, existingValue: T | null | undefined): T | undefined => {
      if (newValue !== undefined && newValue !== null) return newValue;
      if (existingValue !== undefined && existingValue !== null) return existingValue;
      return undefined;
    };

    const result: Partial<MetadataUpdateData> = {};

    // Phase 0: prefer the column-name key (`chapters`/`volumes`) so AL-only
    // matches don't silently drop counts. Fall back to the legacy
    // `chapterCount`/`volumeCount` keys for the brief window before fetchers
    // stop emitting them. After commit 6 lands those duplicate writes are
    // gone, but the fallback stays for any legacy path that still emits the
    // suffix shape — legacy retirement is Phase 3 scope.
    const chapters = getOptionalValue(
      (metadata['chapters'] as number | undefined) ?? metadata['chapterCount'],
      existingMetadata?.chapters,
    );
    const volumes = getOptionalValue(
      (metadata['volumes'] as number | undefined) ?? metadata['volumeCount'],
      existingMetadata?.volumes,
    );
    const idMal = getOptionalValue(metadata['externalIds']?.malId, existingMetadata?.idMal);
    const averageScore = getOptionalValue(metadata['averageScore'] as number | undefined, existingMetadata?.averageScore);
    const popularity = getOptionalValue(metadata['popularity'] as number | undefined, existingMetadata?.popularity);

    if (chapters !== undefined) result.chapters = chapters;
    if (volumes !== undefined) result.volumes = volumes;
    if (idMal !== undefined) result.idMal = idMal;
    if (averageScore !== undefined) result.averageScore = averageScore;
    if (popularity !== undefined) result.popularity = popularity;

    return result;
  }

  /**
   * Build string fields
   */
  private buildStringFields(
    metadata: UnifiedMangaMetadata,
    existingMetadata: Metadata | null
  ): Partial<Pick<MetadataUpdateData, 'bannerImage' | 'format' | 'countryOfOrigin' | 'publishers' | 'source' | 'sourceId' | 'contentRating' | 'publicationDemographic' | 'rating'>> {
    const getOptionalValue = <T>(newValue: T | undefined, existingValue: T | null | undefined): T | undefined => {
      if (newValue !== undefined && newValue !== null) return newValue;
      if (existingValue !== undefined && existingValue !== null) return existingValue;
      return undefined;
    };

    const result: Partial<MetadataUpdateData> = {};

    const bannerImage = getOptionalValue(metadata['bannerImage'] as string | undefined, existingMetadata?.bannerImage);
    const format = getOptionalValue(metadata['format'] as string | undefined, existingMetadata?.format);
    const countryOfOrigin = getOptionalValue(metadata['countryOfOrigin'] as string | undefined, existingMetadata?.countryOfOrigin);
    // Phase 1: publishers[] replaces single publisher. Accept either:
    // - metadata['publishers'] as string[] (Phase 1 fetchers)
    // - metadata['publisher'] as string (legacy single-source) wrapped to []
    const incomingPublishers = Array.isArray(metadata['publishers'])
      ? (metadata['publishers'] as string[]).filter((p): p is string => typeof p === 'string' && p.length > 0)
      : typeof metadata['publisher'] === 'string' && (metadata['publisher'] as string).length > 0
        ? [metadata['publisher'] as string]
        : undefined;
    const publishers = incomingPublishers ?? existingMetadata?.publishers ?? undefined;

    // sourceId ties the Metadata row back to the canonical provider record
    // (e.g. AniList ID). Previously never persisted despite being surfaced elsewhere.
    const source = getOptionalValue(metadata['source'] as string | undefined, existingMetadata?.source);
    const sourceId = getOptionalValue(
      (metadata['sourceId'] ?? metadata['providerId']) as string | undefined,
      existingMetadata?.sourceId,
    );

    if (bannerImage !== undefined) result.bannerImage = bannerImage;
    if (format !== undefined) result.format = format;
    if (countryOfOrigin !== undefined) result.countryOfOrigin = countryOfOrigin;
    if (publishers !== undefined) result.publishers = publishers;
    Object.assign(result, extractPhase1ClassificationFields(metadata));
    if (source !== undefined) result.source = source;
    if (sourceId !== undefined) result.sourceId = sourceId;

    return result;
  }
}

/**
 * Pull Phase 1 classification fields (`contentRating`, `publicationDemographic`,
 * `rating`) off the incoming metadata record. Each is independently optional;
 * `rating` is Zod-validated at this boundary so a bogus shape from a provider
 * fetcher can't poison the DB.
 */
function extractPhase1ClassificationFields(
  metadata: UnifiedMangaMetadata,
): Partial<Pick<MetadataUpdateData, 'contentRating' | 'publicationDemographic' | 'rating'>> {
  const out: Partial<Pick<MetadataUpdateData, 'contentRating' | 'publicationDemographic' | 'rating'>> = {};
  const contentRating = metadata['contentRating'] as string | undefined;
  if (typeof contentRating === 'string' && contentRating.length > 0) {
    out.contentRating = contentRating;
  }
  const publicationDemographic = metadata['publicationDemographic'] as string | undefined;
  if (typeof publicationDemographic === 'string' && publicationDemographic.length > 0) {
    out.publicationDemographic = publicationDemographic;
  }
  const incomingRating = metadata['rating'];
  if (incomingRating !== undefined && incomingRating !== null) {
    const parsed = parseRatingJson(incomingRating);
    if (parsed !== null) out.rating = parsed;
  }
  return out;
}

/**
 * Get singleton instance of MetadataPersistenceService
 */
let metadataPersistenceServiceInstance: MetadataPersistenceService | null = null;

export function getMetadataPersistenceService(): MetadataPersistenceService {
  metadataPersistenceServiceInstance ??= new MetadataPersistenceService();
  return metadataPersistenceServiceInstance;
}

/**
 * Export singleton instance
 */
export const metadataPersistenceService = getMetadataPersistenceService();
