"use strict";
/**
 * MangaDex Metadata Library
 * Unified metadata from MangaDex + ComicVine + AniList
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataEnricher = exports.MetadataMerger = exports.GET_MANGA_DETAILS = exports.SEARCH_MANGA = exports.mapAniListMedia = exports.AniListProvider = exports.AniListClient = exports.cleanDescription = exports.extractCoverFromPage = exports.extractThemes = exports.extractChapterRange = exports.mapComicVineVolume = exports.ComicVineProvider = exports.ComicVineClient = exports.mapMangaDexChapter = exports.mapMangaDexManga = exports.MangaDexProvider = exports.createDefaultClient = exports.MangaDexApiError = exports.MangaDexClient = exports.preferLonger = exports.mergeArraysByKey = exports.deduplicateStrings = exports.firstNonEmpty = exports.parsePartialDate = exports.stripHtml = exports.assertUUID = exports.isValidUUID = exports.HttpClient = exports.TTLCache = exports.RateLimiter = void 0;
// ==================== Unified Types ====================
__exportStar(require("./types"), exports);
// ==================== Core Infrastructure ====================
var core_1 = require("./core");
Object.defineProperty(exports, "RateLimiter", { enumerable: true, get: function () { return core_1.RateLimiter; } });
Object.defineProperty(exports, "TTLCache", { enumerable: true, get: function () { return core_1.TTLCache; } });
Object.defineProperty(exports, "HttpClient", { enumerable: true, get: function () { return core_1.HttpClient; } });
var core_2 = require("./core");
Object.defineProperty(exports, "isValidUUID", { enumerable: true, get: function () { return core_2.isValidUUID; } });
Object.defineProperty(exports, "assertUUID", { enumerable: true, get: function () { return core_2.assertUUID; } });
Object.defineProperty(exports, "stripHtml", { enumerable: true, get: function () { return core_2.stripHtml; } });
Object.defineProperty(exports, "parsePartialDate", { enumerable: true, get: function () { return core_2.parsePartialDate; } });
Object.defineProperty(exports, "firstNonEmpty", { enumerable: true, get: function () { return core_2.firstNonEmpty; } });
Object.defineProperty(exports, "deduplicateStrings", { enumerable: true, get: function () { return core_2.deduplicateStrings; } });
Object.defineProperty(exports, "mergeArraysByKey", { enumerable: true, get: function () { return core_2.mergeArraysByKey; } });
Object.defineProperty(exports, "preferLonger", { enumerable: true, get: function () { return core_2.preferLonger; } });
// ==================== Providers ====================
// MangaDex
var mangadex_1 = require("./providers/mangadex");
Object.defineProperty(exports, "MangaDexClient", { enumerable: true, get: function () { return mangadex_1.MangaDexClient; } });
Object.defineProperty(exports, "MangaDexApiError", { enumerable: true, get: function () { return mangadex_1.MangaDexApiError; } });
Object.defineProperty(exports, "createDefaultClient", { enumerable: true, get: function () { return mangadex_1.createDefaultClient; } });
Object.defineProperty(exports, "MangaDexProvider", { enumerable: true, get: function () { return mangadex_1.MangaDexProvider; } });
Object.defineProperty(exports, "mapMangaDexManga", { enumerable: true, get: function () { return mangadex_1.mapMangaDexManga; } });
Object.defineProperty(exports, "mapMangaDexChapter", { enumerable: true, get: function () { return mangadex_1.mapMangaDexChapter; } });
// ComicVine
var comicvine_1 = require("./providers/comicvine");
Object.defineProperty(exports, "ComicVineClient", { enumerable: true, get: function () { return comicvine_1.ComicVineClient; } });
Object.defineProperty(exports, "ComicVineProvider", { enumerable: true, get: function () { return comicvine_1.ComicVineProvider; } });
Object.defineProperty(exports, "mapComicVineVolume", { enumerable: true, get: function () { return comicvine_1.mapComicVineVolume; } });
Object.defineProperty(exports, "extractChapterRange", { enumerable: true, get: function () { return comicvine_1.extractChapterRange; } });
Object.defineProperty(exports, "extractThemes", { enumerable: true, get: function () { return comicvine_1.extractThemes; } });
Object.defineProperty(exports, "extractCoverFromPage", { enumerable: true, get: function () { return comicvine_1.extractCoverFromPage; } });
Object.defineProperty(exports, "cleanDescription", { enumerable: true, get: function () { return comicvine_1.cleanDescription; } });
// AniList
var anilist_1 = require("./providers/anilist");
Object.defineProperty(exports, "AniListClient", { enumerable: true, get: function () { return anilist_1.AniListClient; } });
Object.defineProperty(exports, "AniListProvider", { enumerable: true, get: function () { return anilist_1.AniListProvider; } });
Object.defineProperty(exports, "mapAniListMedia", { enumerable: true, get: function () { return anilist_1.mapAniListMedia; } });
Object.defineProperty(exports, "SEARCH_MANGA", { enumerable: true, get: function () { return anilist_1.SEARCH_MANGA; } });
Object.defineProperty(exports, "GET_MANGA_DETAILS", { enumerable: true, get: function () { return anilist_1.GET_MANGA_DETAILS; } });
// ==================== Metadata Layer ====================
var metadata_1 = require("./metadata");
Object.defineProperty(exports, "MetadataMerger", { enumerable: true, get: function () { return metadata_1.MetadataMerger; } });
Object.defineProperty(exports, "MetadataEnricher", { enumerable: true, get: function () { return metadata_1.MetadataEnricher; } });
//# sourceMappingURL=index.js.map