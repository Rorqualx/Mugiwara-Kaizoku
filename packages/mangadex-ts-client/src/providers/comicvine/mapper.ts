/**
 * ComicVine response -> Unified types mapper
 */

import { CVVolume, CVIssue, CVPersonCredit, CVCharacterCredit } from './types';
import { cleanDescription, extractChapterRange } from './scraper';
import {
  UnifiedManga,
  UnifiedVolume,
  UnifiedChapter,
  CoverImages,
  Creator,
  Character,
  StoryArc,
  ExternalLinks,
} from '../../types/metadata';
import { CreatorRole, CharacterRole } from '../../types/common';
import { stripHtml } from '../../core/utils';

/** Map ComicVine person role string to CreatorRole */
function mapCreatorRole(role?: string): CreatorRole {
  if (!role) return 'OTHER';
  const r = role.toLowerCase();
  if (r.includes('writ') || r.includes('story') || r.includes('author')) return 'AUTHOR';
  if (r.includes('art') || r.includes('illustrat') || r.includes('pencil') || r.includes('draw')) return 'ARTIST';
  if (r.includes('ink')) return 'INKER';
  if (r.includes('color')) return 'COLORIST';
  if (r.includes('letter')) return 'LETTERER';
  if (r.includes('edit')) return 'EDITOR';
  if (r.includes('cover')) return 'COVER_ARTIST';
  if (r.includes('translat')) return 'TRANSLATOR';
  return 'OTHER';
}

/** Map CVPersonCredit[] -> Creator[] */
function mapCreators(people?: CVPersonCredit[]): Creator[] {
  if (!people) return [];
  return people.map((p) => ({
    id: String(p.id),
    name: p.name,
    role: mapCreatorRole(p.role),
    source: 'comicvine' as const,
  }));
}

/** Map CVCharacterCredit[] -> Character[] */
function mapCharacters(chars?: CVCharacterCredit[]): Character[] {
  if (!chars) return [];
  return chars.map((c) => ({
    id: String(c.id),
    name: c.name,
    role: 'SUPPORTING' as CharacterRole,
    isMain: false,
    source: 'comicvine' as const,
  }));
}

/** Map CVVolume to partial UnifiedManga */
export function mapComicVineVolume(
  volume: CVVolume,
  issues?: CVIssue[]
): Partial<UnifiedManga> {
  // Alt titles from aliases
  const altTitles = volume.aliases
    ? volume.aliases.split('\n').map((a) => a.trim()).filter(Boolean)
    : [];

  // Description
  const description: Record<string, string> = {};
  if (volume.deck) description['en'] = volume.deck;
  else if (volume.description) description['en'] = cleanDescription(volume.description);

  // Cover images
  const covers: CoverImages = {
    original: volume.image?.original_url,
    large: volume.image?.super_url || volume.image?.screen_large_url,
    medium: volume.image?.screen_url || volume.image?.medium_url,
    small: volume.image?.small_url,
  };

  // Genres
  const genres = volume.genres?.map((g) => g.name) || [];

  // Themes from concepts
  const themes = volume.concepts?.map((c) => c.name) || [];

  // Creators
  const creators = mapCreators(volume.people);

  // Characters
  const characters = mapCharacters(volume.characters);

  // Story arcs
  const storyArcs: StoryArc[] =
    volume.story_arcs?.map((sa) => ({
      id: String(sa.id),
      name: sa.name,
      source: 'comicvine' as const,
    })) || [];

  // External links
  const externalLinks: ExternalLinks = {
    comicVine: volume.site_detail_url,
  };

  // Volumes from issues
  const volumes: UnifiedVolume[] = issues
    ? mapIssuesToVolumes(issues)
    : [];

  // Chapters from issues
  const chapters: UnifiedChapter[] = issues
    ? issues.map((issue) => mapIssueToChapter(issue))
    : [];

  return {
    ids: { comicvine: String(volume.id) },
    title: { en: volume.name },
    altTitles,
    description,
    covers,
    genres,
    themes,
    tags: [...genres, ...themes],
    status: deriveStatus(volume, issues),
    year: volume.start_year ? Number(volume.start_year) : undefined,
    startDate: volume.start_year,
    totalChapters: volume.count_of_issues,
    totalVolumes: undefined,
    creators,
    characters,
    publisher: volume.publisher?.name,
    availableLanguages: [],
    storyArcs,
    externalLinks,
    relations: [],
    recommendations: [],
    volumes,
    chapters,
    sources: ['comicvine'],
    lastUpdated: volume.date_last_updated,
  };
}

/** Map a single issue to a volume entry */
function mapIssuesToVolumes(issues: CVIssue[]): UnifiedVolume[] {
  return issues.map((issue) => {
    const chapterRange = issue.description
      ? extractChapterRange(issue.description)
      : undefined;

    // Parse the range string into start/end fields
    let startChapter: string | undefined;
    let endChapter: string | undefined;
    if (chapterRange) {
      const rangeMatch = chapterRange.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
      if (rangeMatch) {
        startChapter = rangeMatch[1];
        endChapter = rangeMatch[2];
      }
    }

    return {
      id: String(issue.id),
      volumeNumber: issue.issue_number,
      title: issue.name,
      description: issue.deck || (issue.description ? cleanDescription(issue.description) : undefined),
      coverImage: issue.image?.screen_large_url || issue.image?.super_url,
      covers: {
        original: issue.image?.original_url,
        large: issue.image?.super_url || issue.image?.screen_large_url,
        medium: issue.image?.screen_url || issue.image?.medium_url,
        small: issue.image?.small_url,
      },
      chapterRange,
      startChapter,
      endChapter,
      releaseDate: issue.cover_date,
      creators: mapCreators(issue.person_credits),
      characters: mapCharacters(issue.character_credits),
      source: 'comicvine' as const,
    };
  });
}

/** Map a single issue to a chapter */
function mapIssueToChapter(issue: CVIssue): UnifiedChapter {
  return {
    id: String(issue.id),
    chapterNumber: issue.issue_number,
    title: issue.name,
    volume: issue.issue_number,
    pages: 0,
    language: 'en',
    publishedAt: issue.cover_date,
    createdAt: issue.date_added,
    updatedAt: issue.date_last_updated,
    source: 'comicvine' as const,
  };
}

/** Derive publication status from volume data */
function deriveStatus(
  volume: CVVolume,
  issues?: CVIssue[]
): 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | undefined {
  if (!issues || issues.length === 0) return undefined;

  // If last issue date is more than 1 year ago, likely completed
  const lastIssue = issues[issues.length - 1];
  if (lastIssue?.cover_date) {
    const lastDate = new Date(lastIssue.cover_date);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    if (lastDate < oneYearAgo) {
      return 'completed';
    }
  }

  return 'ongoing';
}
