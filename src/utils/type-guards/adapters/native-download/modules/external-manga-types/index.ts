/**
 * External Manga Types Type Guards - Main Aggregator
 *
 * This module aggregates all external manga type guards into a single export point.
 * It maintains backward compatibility while organizing the code into focused modules.
 *
 * Architecture:
 * - utils.ts - Shared validation utilities (10 functions)
 * - anilist.ts - AniList type guards (1 main + 5 helper functions)
 * - suwayomi.ts - Suwayomi type guards (1 main + 5 helper functions)
 * - mal.ts - MAL type guards (1 main + 4 helper functions)
 * - kitsu.ts - Kitsu type guards (1 main function)
 *
 * Total: 4 main type guards + 14 helper functions
 * Original: 146 lines, 3 complexity violations
 * Refactored: ~300 lines, 0 complexity violations
 *
 * @module ExternalMangaTypesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

export { isExternalAnilistManga } from "./anilist";
export { isExternalSuwayomiManga } from "./suwayomi";
export { isExternalMALManga } from "./mal";
export { isExternalKitsuManga } from "./kitsu";