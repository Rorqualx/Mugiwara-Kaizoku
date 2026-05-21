/**
 * MangaDex response -> Unified types mapper
 */

import {
  Manga,
  Chapter,
  CoverArt,
  Author,
  MangaDexTag,
  MangaStatistics,
  AggregateResponse,
  MangaDexRelationship,
} from './types';
import { MangaDexClient } from './client';
import {
  UnifiedManga,
  UnifiedChapter,
  UnifiedVolume,
  CoverImages,
  Creator,
  ExternalLinks,
  ScoreInfo,
  LocalizedString,
} from '../../types/metadata';
import { PublicationStatus, CreatorRole } from '../../types/common';

/** Map MangaDex manga to UnifiedManga */
export function mapMangaDexManga(
  manga: Manga,
  client: MangaDexClient,
  options?: {
    statistics?: MangaStatistics;
    covers?: CoverArt[];
    chapters?: Chapter[];
    aggregate?: AggregateResponse;
    authors?: Author[];
  }
): Partial<UnifiedManga> {
  const attrs = manga.attributes;

  // Titles
  const title: LocalizedString = {};
  for (const [lang, val] of Object.entries(attrs.title)) {
    if (val) title[lang] = val;
  }

  // Alt titles
  const altTitles: string[] = [];
  for (const alt of attrs.altTitles) {
    for (const val of Object.values(alt)) {
      if (val) altTitles.push(val);
    }
  }

  // Description
  const description: LocalizedString = {};
  for (const [lang, val] of Object.entries(attrs.description)) {
    if (val) description[lang] = val;
  }

  // Tags, genres, themes
  const genres: string[] = [];
  const themes: string[] = [];
  const tags: string[] = [];

  for (const tag of attrs.tags) {
    const name = tag.attributes.name['en'] || Object.values(tag.attributes.name)[0] || '';
    if (!name) continue;

    tags.push(name);
    if (tag.attributes.group === 'genre') genres.push(name);
    if (tag.attributes.group === 'theme') themes.push(name);
  }

  // Creators from relationships
  const creators: Creator[] = [];
  const authorRels = manga.relationships.filter((r) => r.type === 'author');
  const artistRels = manga.relationships.filter((r) => r.type === 'artist');

  for (const rel of authorRels) {
    const authorData = options?.authors?.find((a) => a.id === rel.id);
    creators.push({
      id: rel.id,
      name: authorData?.attributes.name || rel.attributes?.['name'] as string || 'Unknown',
      role: 'AUTHOR' as CreatorRole,
      imageUrl: authorData?.attributes.imageUrl,
      source: 'mangadex',
    });
  }

  for (const rel of artistRels) {
    // Don't duplicate if same person is author+artist
    if (authorRels.some((a) => a.id === rel.id)) {
      const existing = creators.find((c) => c.id === rel.id);
      if (existing) existing.role = 'AUTHOR_ARTIST';
      continue;
    }
    const authorData = options?.authors?.find((a) => a.id === rel.id);
    creators.push({
      id: rel.id,
      name: authorData?.attributes.name || rel.attributes?.['name'] as string || 'Unknown',
      role: 'ARTIST' as CreatorRole,
      imageUrl: authorData?.attributes.imageUrl,
      source: 'mangadex',
    });
  }

  // Covers
  const covers = mapCovers(manga.id, manga.relationships, client, options?.covers);

  // External links
  const externalLinks = mapExternalLinks(attrs.links);

  // Volumes from aggregate
  const volumes = mapVolumesFromAggregate(manga.id, options?.aggregate, options?.covers, client);

  // Chapters
  const chapters = options?.chapters?.map((ch) => mapMangaDexChapter(ch)) || [];

  // Statistics
  const score = mapStatistics(options?.statistics);

  // Status
  const status = mapStatus(attrs.status);

  return {
    ids: { mangadex: manga.id },
    title,
    altTitles,
    description,
    covers,
    genres,
    themes,
    tags,
    contentRating: attrs.contentRating,
    demographic: attrs.publicationDemographic === 'none' ? undefined : attrs.publicationDemographic,
    status,
    year: attrs.year,
    startDate: attrs.year ? String(attrs.year) : undefined,
    creators,
    characters: [],
    originalLanguage: attrs.originalLanguage,
    availableLanguages: attrs.availableTranslatedLanguages,
    score,
    externalLinks,
    relations: [],
    recommendations: [],
    storyArcs: [],
    volumes,
    chapters,
    sources: ['mangadex'],
    lastUpdated: attrs.updatedAt,
  };
}

/** Map MangaDex chapter to UnifiedChapter */
export function mapMangaDexChapter(chapter: Chapter): UnifiedChapter {
  const attrs = chapter.attributes;
  const groupRel = chapter.relationships.find((r) => r.type === 'scanlation_group');

  return {
    id: chapter.id,
    chapterNumber: attrs.chapter,
    title: attrs.title,
    volume: attrs.volume,
    pages: attrs.pages,
    language: attrs.translatedLanguage,
    publishedAt: attrs.publishAt,
    readableAt: attrs.readableAt,
    createdAt: attrs.createdAt,
    updatedAt: attrs.updatedAt,
    scanlationGroup: groupRel?.attributes?.['name'] as string | undefined,
    uploader: attrs.uploader,
    externalUrl: attrs.externalUrl,
    source: 'mangadex',
  };
}

function mapCovers(
  mangaId: string,
  relationships: MangaDexRelationship[],
  client: MangaDexClient,
  allCovers?: CoverArt[]
): CoverImages {
  // Try to get the primary cover from relationships
  const coverRel = relationships.find((r) => r.type === 'cover_art');
  const fileName = coverRel?.attributes?.['fileName'] as string | undefined;

  if (fileName) {
    return {
      original: client.getCoverUrl(mangaId, { fileName }, 'original'),
      large: client.getCoverUrl(mangaId, { fileName }, '512'),
      medium: client.getCoverUrl(mangaId, { fileName }, '256'),
    };
  }

  // Fallback to first cover from allCovers
  if (allCovers && allCovers.length > 0) {
    const first = allCovers[0]!;
    return {
      original: client.getCoverUrl(mangaId, first.attributes, 'original'),
      large: client.getCoverUrl(mangaId, first.attributes, '512'),
      medium: client.getCoverUrl(mangaId, first.attributes, '256'),
    };
  }

  return {};
}

function mapExternalLinks(links?: Record<string, string | undefined>): ExternalLinks {
  if (!links) return {};
  return {
    anilist: links['al'] ? `https://anilist.co/manga/${links['al']}` : undefined,
    myAnimeList: links['mal'] ? `https://myanimelist.net/manga/${links['mal']}` : undefined,
    mangaUpdates: links['mu'] ? `https://www.mangaupdates.com/series.html?id=${links['mu']}` : undefined,
    animePlanet: links['ap'] ? `https://www.anime-planet.com/manga/${links['ap']}` : undefined,
    bookWalker: links['bw'] ? `https://bookwalker.jp/${links['bw']}` : undefined,
    kitsu: links['kt'] ? `https://kitsu.io/manga/${links['kt']}` : undefined,
    amazon: links['amz'],
    eBookJapan: links['ebj'],
    raw: links['raw'],
    englishTranslation: links['engtl'],
  };
}

function mapStatus(status: string): PublicationStatus {
  switch (status) {
    case 'ongoing':
      return 'ongoing';
    case 'completed':
      return 'completed';
    case 'hiatus':
      return 'hiatus';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'ongoing';
  }
}

function mapStatistics(stats?: MangaStatistics): ScoreInfo | undefined {
  if (!stats) return undefined;
  return {
    averageScore: stats.rating.average ? Math.round(stats.rating.average * 10) : undefined,
    meanScore: stats.rating.bayesian ? Math.round(stats.rating.bayesian * 10) : undefined,
    ratingDistribution: stats.rating.distribution,
    follows: stats.follows,
  };
}

function mapVolumesFromAggregate(
  mangaId: string,
  aggregate?: AggregateResponse,
  covers?: CoverArt[],
  client?: MangaDexClient
): UnifiedVolume[] {
  if (!aggregate) return [];

  const volumes: UnifiedVolume[] = [];

  for (const [volNum, volData] of Object.entries(aggregate.volumes)) {
    if (volNum === 'none') continue;

    const chapterKeys = Object.keys(volData.chapters);
    const chapterNumbers = chapterKeys
      .map((k) => volData.chapters[k]?.chapter)
      .filter((c): c is string => !!c)
      .sort((a, b) => Number(a) - Number(b));

    // Find cover for this volume
    const volumeCover = covers?.find((c) => c.attributes.volume === volNum);
    let coverImage: string | undefined;
    if (volumeCover && client) {
      coverImage = client.getCoverUrl(mangaId, volumeCover.attributes, '512');
    }

    volumes.push({
      volumeNumber: volNum,
      chapterCount: volData.count,
      startChapter: chapterNumbers[0],
      endChapter: chapterNumbers[chapterNumbers.length - 1],
      chapterRange:
        chapterNumbers.length > 0
          ? `${chapterNumbers[0]}-${chapterNumbers[chapterNumbers.length - 1]}`
          : undefined,
      coverImage,
      creators: [],
      characters: [],
      source: 'mangadex',
    });
  }

  return volumes.sort((a, b) => Number(a.volumeNumber) - Number(b.volumeNumber));
}
