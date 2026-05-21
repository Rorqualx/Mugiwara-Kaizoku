/**
 * Wizard to Manga Input Mapper
 *
 * Maps wizard form data (WizardFormData) to the manga.add mutation input schema,
 * ensuring all selected data is properly formatted for database insertion.
 */

import type { WizardFormData, ProviderMetadata, Volume } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

import {
  extractSiteName,
  hasChapterData,
  validateVolumeSourceFormat,
  formatComicVineTitle,
  resolveSourceToProvider,
  extractValueWithoutProvider,
  extractArrayWithoutProviders,
} from './helpers';

import type { MangaAddInput } from './types';

/**
 * Maps wizard form data to manga.add mutation input
 */
 
export function mapWizardDataToMangaInput(
  formData: Partial<WizardFormData>,
  additionalData: {
    libraryId: number;
    provider: string;
    selectedSourcesMetadata: Record<string, ProviderMetadata>;
    volumesData: {
      volumes?: Volume[];
      totalVolumes?: number;
      totalChapters?: number;
    };
    mediaGallery: {
      covers: unknown[];
      gallery: unknown[];
      volumeCovers: unknown[];
    };
    externalIds: {
      anilistId?: string;
      malId?: string;
      comicVineId?: string;
      kitsuId?: string;
      mangaUpdatesId?: string;
    };
    externalLinks: string[];
    selectedCover?: string;
    selectedBanner?: string;
    selectedVolumes: (number | string)[];
    selectedChapters: unknown[];
    selectedGalleryImages?: string[];
    volumeDisplaySource?: string;
    chapterDisplaySource?: string;
    fieldSelections?: Record<string, unknown>;
  }
): MangaAddInput {
  const {
    libraryId,
    provider,
    selectedSourcesMetadata,
    volumesData,
    mediaGallery,
    externalIds,
    externalLinks,
    selectedCover,
    selectedBanner,
    selectedVolumes,
    selectedChapters,
    selectedGalleryImages,
    volumeDisplaySource,
    chapterDisplaySource,
    fieldSelections
  } = additionalData;

  logger.info('[wizardToMangaInputMapper] Mapping wizard data to manga input:', {
    title: formData["title"],
    provider,
    libraryId,
    hasVolumes: !!volumesData.volumes?.length,
    totalVolumes: volumesData.totalVolumes,
    totalChapters: volumesData.totalChapters,
    selectedVolumesCount: selectedVolumes.length,
    selectedChaptersCount: selectedChapters.length
  });

  // Validate required fields — throws are appropriate here as this is a UI-layer mapper,
  // not a service. The caller (React component) catches these.
  if (!formData["title"]) {
    throw new Error('Title is required for manga import');  
  }

  if (!formData.selectedSourceId && !formData.searchProvider) {
    throw new Error('Source ID is required for manga import');  
  }

  const volumeCount = volumesData.totalVolumes ??
                      (typeof formData.volumes === 'number' ? formData.volumes : null);
  const chapterCount = volumesData.totalChapters ??
                       (typeof formData["chapters"] === 'number' ? formData["chapters"] : null);

  const metadata = buildMetadata(formData, {
    coverValue: selectedCover ?? formData.coverUrl,
    bannerValue: selectedBanner ?? formData.bannerUrl,
    malIdValue: externalIds.malId ? parseInt(externalIds.malId) : undefined,
    volumeCount,
    chapterCount,
    externalLinks,
  });

  const resolvedVolumeSource = resolveSourceToProvider(volumeDisplaySource, selectedSourcesMetadata, provider);
  const resolvedChapterSource = resolveSourceToProvider(chapterDisplaySource, selectedSourcesMetadata, provider, true);

  logChapterSourceWarning(resolvedChapterSource, selectedSourcesMetadata);

  let processedVolumes = resolveVolumes(volumesData, resolvedVolumeSource, selectedSourcesMetadata);
  validateFirstVolume(processedVolumes, resolvedVolumeSource);

  if (resolvedVolumeSource === 'comicvine' && processedVolumes.length > 0) {
    processedVolumes = enrichComicVineVolumes(processedVolumes);
  }

  const importProfile = buildImportProfile({
    provider, resolvedVolumeSource, resolvedChapterSource,
    fieldSelections, selectedVolumes, selectedChapters,
    volumesData, processedVolumes, selectedCover, selectedBanner,
    selectedGalleryImages, selectedSourcesMetadata,
  });

  const rawProviderData = buildRawProviderData({
    formData, selectedSourcesMetadata, provider, processedVolumes,
    volumeCount, chapterCount, selectedCover, selectedBanner,
    selectedGalleryImages, selectedVolumes, selectedChapters,
    mediaGallery, importProfile,
  });

  const baseProviderMetadata: Record<string, unknown> = {
    ...selectedSourcesMetadata,
    selectedGalleryImages: selectedGalleryImages ?? [],
    importProfile
  };

  const { sourceIds: allSourceIds, autoBindings } = collectSourceIds(
    formData, provider, new Set(Object.keys(baseProviderMetadata)),
  );

  const providerMetadata: Record<string, unknown> = {
    ...baseProviderMetadata,
    ...autoBindings,
  };

  return buildFinalInput({
    formData, provider, libraryId, metadata, rawProviderData,
    providerMetadata, allSourceIds,
  });
}

/** Build the metadata object from form data */
// eslint-disable-next-line complexity -- Conditional field mapping with many optional spreads
function buildMetadata(
  formData: Partial<WizardFormData>,
  opts: {
    coverValue: string | undefined;
    bannerValue: string | undefined;
    malIdValue: number | undefined;
    volumeCount: number | null;
    chapterCount: number | null;
    externalLinks: string[];
  },
): MangaAddInput['metadata'] {
  const statusValue = extractValueWithoutProvider(formData["status"]);
  const formatValue = extractValueWithoutProvider(formData.format);
  const publisherValue = extractValueWithoutProvider(formData.publisher);

  return {
    ...(opts.coverValue !== undefined ? { cover: opts.coverValue } : {}),
    ...(opts.coverValue !== undefined ? { coverLarge: opts.coverValue } : {}),
    ...(opts.bannerValue !== undefined ? { bannerImage: opts.bannerValue } : {}),
    description: extractValueWithoutProvider(formData["description"]) ??
                 extractValueWithoutProvider(formData.synopsis) ??
                 '',
    ...(statusValue !== undefined ? { status: statusValue } : {}),
    ...(formatValue !== undefined ? { format: formatValue } : {}),
    ...(publisherValue !== undefined ? { publisher: publisherValue } : {}),
    ...(formData.startDate ? { startDate: formData.startDate } : {}),
    ...(formData.endDate ? { endDate: formData.endDate } : {}),
    ...(formData.averageScore ? { averageScore: formData.averageScore } : {}),
    ...(formData.popularity ? { popularity: formData.popularity } : {}),
    ...(formData.country ? { countryOfOrigin: formData.country } : {}),
    genres: extractArrayWithoutProviders(formData["genres"]) ?? [],
    authors: extractArrayWithoutProviders(formData["authors"]) ?? [],
    artists: extractArrayWithoutProviders(formData.artists) ?? [],
    tags: extractArrayWithoutProviders(formData.tags) ?? [],
    alternativeTitles: formData["alternativeTitles"] ?? [],
    synonyms: formData["alternativeTitles"] ?? [],
    ...(opts.volumeCount ? { volumes: opts.volumeCount } : {}),
    ...(opts.chapterCount ? { chapters: opts.chapterCount } : {}),
    ...(opts.externalLinks.length ? {
      externalLinks: opts.externalLinks.map(url => ({
        url,
        site: extractSiteName(url)
      }))
    } : {}),
    ...(opts.externalLinks.length ? { urls: opts.externalLinks } : {}),
    ...(opts.malIdValue ? { idMal: opts.malIdValue } : {})
  };
}

/** Log warning if selected chapter source has no chapter data */
function logChapterSourceWarning(
  resolvedChapterSource: string,
  selectedSourcesMetadata: Record<string, ProviderMetadata>,
): void {
  const chapterSourceKey = Object.keys(selectedSourcesMetadata).find(
    k => k.toLowerCase() === resolvedChapterSource.toLowerCase()
  );
  const chapterSourceVolumes = chapterSourceKey ? selectedSourcesMetadata[chapterSourceKey]?.volumeData ?? [] : [];

  if (!hasChapterData(resolvedChapterSource, chapterSourceVolumes)) {
    logger.warn(`[wizardToMangaInputMapper] Warning: Selected chapter source '${resolvedChapterSource}' has no chapter data.`);
  }
}

/** Resolve volumes from volumesData or selectedSourcesMetadata */
function resolveVolumes(
  volumesData: { volumes?: Volume[] },
  resolvedVolumeSource: string,
  selectedSourcesMetadata: Record<string, ProviderMetadata>,
): Volume[] {
  let processedVolumes = volumesData.volumes ?? [];

  if (processedVolumes.length === 0 && resolvedVolumeSource) {
    const sourceKey = Object.keys(selectedSourcesMetadata).find(
      k => k.toLowerCase() === resolvedVolumeSource.toLowerCase()
    );
    const sourceData = sourceKey ? selectedSourcesMetadata[sourceKey] : undefined;
    if (sourceData?.volumeData) {
      processedVolumes = sourceData.volumeData as Volume[];
      logger.info(`[wizardToMangaInputMapper] Using volumeData from selectedSourcesMetadata['${sourceKey}']`, {
        volumeCount: processedVolumes.length
      });
    }
  }

  return processedVolumes;
}

/** Validate first volume in array */
function validateFirstVolume(processedVolumes: Volume[], resolvedVolumeSource: string): void {
  if (processedVolumes.length === 0) return;
  const firstVolume = processedVolumes[0];
  if (!firstVolume) {
    logger.warn('[wizardToMangaInputMapper] First volume is undefined despite length > 0');
    return;
  }
  validateVolumeSourceFormat(firstVolume, resolvedVolumeSource);
}

/** Enrich ComicVine volumes with formatted titles */
function enrichComicVineVolumes(volumes: Volume[]): Volume[] {
  logger.info('[wizardToMangaInputMapper] Extracting enriched ComicVine volume titles');

  return volumes.map((volume: Volume) => {
    const volumeNumber = volume.volumeNumber ?? volume.number;
    const volumeObj = volume as unknown as Record<string, unknown>;
    const titleCandidates = [
      volume.title,
      typeof volumeObj["volumeTitle"] === 'string' ? volumeObj["volumeTitle"] : null,
      typeof volumeObj["name"] === 'string' ? volumeObj["name"] : null,
      typeof volumeObj["volumeName"] === 'string' ? volumeObj["volumeName"] : null
    ];
    const rawTitle: string | undefined = titleCandidates.filter((t): t is string => typeof t === 'string')[0];

    const formattedTitle = formatComicVineTitle(rawTitle, volumeNumber);

    const result: Volume = {
      ...volume,
      title: formattedTitle
    };
    if (volumeNumber !== undefined) {
      result.volumeNumber = volumeNumber;
      result.number = volumeNumber;
    }
    return result;
  });
}

/** Build import profile for provider metadata */
function buildImportProfile(opts: {
  provider: string;
  resolvedVolumeSource: string;
  resolvedChapterSource: string;
  fieldSelections: Record<string, unknown> | undefined;
  selectedVolumes: (number | string)[];
  selectedChapters: unknown[];
  volumesData: { totalVolumes?: number; totalChapters?: number };
  processedVolumes: Volume[];
  selectedCover: string | undefined;
  selectedBanner: string | undefined;
  selectedGalleryImages: string[] | undefined;
  selectedSourcesMetadata: Record<string, ProviderMetadata>;
}): Record<string, unknown> {
  const {
    provider, resolvedVolumeSource, resolvedChapterSource,
    fieldSelections, selectedVolumes, selectedChapters,
    volumesData, processedVolumes, selectedCover, selectedBanner,
    selectedGalleryImages, selectedSourcesMetadata,
  } = opts;
  const volumeSourceMetadata = selectedSourcesMetadata[resolvedVolumeSource];
  const chapterSourceMetadata = selectedSourcesMetadata[resolvedChapterSource];
  const volumesListUrl = volumeSourceMetadata?.volumesListUrl ?? chapterSourceMetadata?.volumesListUrl;
  const chaptersListUrl = volumeSourceMetadata?.chaptersListUrl ?? chapterSourceMetadata?.chaptersListUrl;

  return {
    primarySource: provider,
    volumeSource: resolvedVolumeSource,
    chapterSource: resolvedChapterSource,
    selectedFields: fieldSelections ?? {},
    selectedVolumes: selectedVolumes,
    selectedChapters: selectedChapters.length,
    totalAvailableVolumes: volumesData.totalVolumes ?? processedVolumes.length,
    totalAvailableChapters: volumesData.totalChapters ?? 0,
    mediaSelections: {
      cover: selectedCover,
      banner: selectedBanner,
      galleryImages: selectedGalleryImages ?? []
    },
    ...(volumesListUrl && { volumesListUrl }),
    ...(chaptersListUrl && { chaptersListUrl })
  };
}

/** Build raw provider data payload */
function buildRawProviderData(opts: {
  formData: Partial<WizardFormData>;
  selectedSourcesMetadata: Record<string, ProviderMetadata>;
  provider: string;
  processedVolumes: Volume[];
  volumeCount: number | null;
  chapterCount: number | null;
  selectedCover: string | undefined;
  selectedBanner: string | undefined;
  selectedGalleryImages: string[] | undefined;
  selectedVolumes: (number | string)[];
  selectedChapters: unknown[];
  mediaGallery: { volumeCovers: unknown[] };
  importProfile: Record<string, unknown>;
}): Record<string, unknown> {
  const {
    formData, selectedSourcesMetadata, provider, processedVolumes,
    volumeCount, chapterCount, selectedCover, selectedBanner,
    selectedGalleryImages, selectedVolumes, selectedChapters,
    mediaGallery, importProfile,
  } = opts;
  return {
    selectedCover,
    selectedBanner,
    selectedGalleryImages: selectedGalleryImages ?? [],
    volumes: processedVolumes,
    totalVolumes: volumeCount,
    totalChapters: chapterCount,
    selectedVolumes,
    selectedChapters,
    volumeCovers: mediaGallery.volumeCovers,
    chapterMetadataCache: formData["metadata"] ?? {},
    providerSpecific: selectedSourcesMetadata[provider]?.rawData ?? {},
    providerMetadata: {
      ...selectedSourcesMetadata,
      importProfile
    }
  };
}

/** Collect source IDs from cached search results and auto-bind providers */
function collectSourceIds(
  formData: Partial<WizardFormData>,
  provider: string,
  existingProviderKeys: Set<string>,
): { sourceIds: Record<string, string>; autoBindings: Record<string, unknown> } {
  const knownProviders = new Set(['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia']);
  const sourceIds: Record<string, string> = {};
  const autoBindings: Record<string, unknown> = {};
  const selectedSourceIdValue = formData.selectedSourceId;
  if (selectedSourceIdValue) {
    sourceIds[provider] = selectedSourceIdValue;
  }

  const cachedSearchResults = (formData as Record<string, unknown>)['cachedSearchResults'];
  if (!Array.isArray(cachedSearchResults)) return { sourceIds, autoBindings };

  for (const result of cachedSearchResults) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) continue;
    const r = result as Record<string, unknown>;
    const rProvider = (
      typeof r['provider'] === 'string' ? r['provider'] :
      typeof r['source'] === 'string' ? r['source'] : ''
    ).toLowerCase();
    if (!rProvider || !knownProviders.has(rProvider)) continue;

    const rId = r['sourceId'] ?? r['id'];
    const rIdStr = rId !== null && rId !== undefined ? String(rId) : '';
    if (!rIdStr) continue;

    if (!(rProvider in sourceIds)) {
      sourceIds[rProvider] = rIdStr;
    }

    if (!existingProviderKeys.has(rProvider)) {
      autoBindings[rProvider] = {
        providerId: rIdStr,
        boundAt: new Date().toISOString(),
      };
      logger.info(`[wizardToMangaInputMapper] Auto-binding provider from search: ${rProvider} -> ${rIdStr}`);
    }
  }

  return { sourceIds, autoBindings };
}

/** Build the final MangaAddInput object */
function buildFinalInput(opts: {
  formData: Partial<WizardFormData>;
  provider: string;
  libraryId: number;
  metadata: MangaAddInput['metadata'];
  rawProviderData: Record<string, unknown>;
  providerMetadata: Record<string, unknown>;
  allSourceIds: Record<string, string>;
}): MangaAddInput {
  const { formData, provider, libraryId, metadata, rawProviderData, providerMetadata, allSourceIds } = opts;
  const searchProviderValue = formData.searchProvider ?? provider;

  return {
    title: formData["title"] ?? '',
    source: provider,
    libraryId,
    mangaId: formData.selectedSourceId ?? String(formData.externalIds?.anilistId ?? ''),
    ...(searchProviderValue ? { searchProvider: searchProviderValue } : {}),
    interval: 'daily',
    ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
    rawProviderData,
    providerMetadata,
    mlCorrected: false,
    ...(Object.keys(allSourceIds).length > 0 ? {
      selectedSourceId: JSON.stringify(allSourceIds)
    } : {}),
    metadataConfidence: 0.9
  };
}
