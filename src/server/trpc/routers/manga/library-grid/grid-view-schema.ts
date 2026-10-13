/**
 * Zod schema for the library grid view (`LibraryGridView`) sent with
 * manga.query and the grid summary procedures.
 *
 * @module server/trpc/routers/manga/library-grid/grid-view-schema
 */
import { z } from 'zod';

const MAX_LIST = 1000;
const listSchema = z.array(z.string().max(500)).max(MAX_LIST).optional();

const advancedFilterSchema = z.object({
  dateAddedFrom: z.string().max(64).optional(),
  dateAddedTo: z.string().max(64).optional(),
  lastReadFrom: z.string().max(64).optional(),
  lastReadTo: z.string().max(64).optional(),
  chaptersMin: z.number().optional(),
  chaptersMax: z.number().optional(),
  genres: listSchema,
  tags: listSchema,
  excludeGenres: listSchema,
  excludeTags: listSchema,
  publicationStatus: listSchema,
  readingStatus: z.array(z.enum(['has-chapters', 'no-chapters', 'has-downloaded', 'fully-read', 'partially-read', 'not-started'])).max(10).optional(),
  ratingMin: z.number().optional(),
  ratingMax: z.number().optional(),
  monitored: z.boolean().optional(),
  countryOfOrigin: listSchema,
});

export const gridViewSchema = z.object({
  sortBy: z.enum(['alphabetical', 'alphabetical-desc', 'date-added', 'date-added-desc', 'last-read', 'progress', 'rating']),
  filterBy: z.array(z.enum(['read', 'unread', 'in-progress', 'completed', 'downloaded', 'has-issues'])).max(10),
  searchQuery: z.string().max(2000),
  searchField: z.enum(['title', 'author', 'artist', 'genre', 'tag', 'all']),
  advancedFilters: advancedFilterSchema,
  mediaType: z.enum(['all', 'manga', 'comicbook']),
});
