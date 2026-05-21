/**
 * Wanted functionality tRPC router.
 *
 * Composes the per-concern submodules into the flat `trpc.wanted.*` API
 * surface that callers depend on. Submodules:
 *   - missing.ts  → getMissing
 *   - items.ts    → getWanted, addToWanted, updateWanted, removeFromWanted
 *   - search.ts   → searchChapters
 *   - history.ts  → getHistory
 */

import { router } from '@/server/trpc/trpc';

import { getHistory } from './history';
import { getWanted, addToWanted, updateWanted, removeFromWanted } from './items';
import { getMissing, getMissingMangaIds } from './missing';
import { searchChapters } from './search';

export const wantedRouter = router({
  getMissing,
  getMissingMangaIds,
  getWanted,
  addToWanted,
  updateWanted,
  removeFromWanted,
  searchChapters,
  getHistory
});
