/**
 * MangaDex response -> Unified types mapper
 */
import { Manga, Chapter, CoverArt, Author, MangaStatistics, AggregateResponse } from './types';
import { MangaDexClient } from './client';
import { UnifiedManga, UnifiedChapter } from '../../types/metadata';
/** Map MangaDex manga to UnifiedManga */
export declare function mapMangaDexManga(manga: Manga, client: MangaDexClient, options?: {
    statistics?: MangaStatistics;
    covers?: CoverArt[];
    chapters?: Chapter[];
    aggregate?: AggregateResponse;
    authors?: Author[];
}): Partial<UnifiedManga>;
/** Map MangaDex chapter to UnifiedChapter */
export declare function mapMangaDexChapter(chapter: Chapter): UnifiedChapter;
//# sourceMappingURL=mapper.d.ts.map