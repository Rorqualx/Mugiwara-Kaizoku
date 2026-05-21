/**
 * AniList Adapter Type Guards
 *
 * Type guards for AniList adapter types and API responses
 */

import type {
  AniListAdapterConfig,
  AniListMedia,
  AniListDate,
  AniListTag,
  AniListCharacter,
  AniListStaff,
  AniListMediaEdge,
  AniListCharacterEdge,
  AniListStaffEdge,
  AniListStudioEdge,
  AniListAiringScheduleEdge,
  AniListMediaTrendEdge,
  AniListReviewEdge,
  AniListRecommendationEdge,
  AniListStudio,
  AniListAiringSchedule,
  AniListMediaTrend,
  AniListExternalLink,
  AniListStreamingEpisode,
  AniListMediaRank,
  AniListMediaListEntry,
  AniListReview,
  AniListRecommendation,
  PageInfo,
  AniListConfig
} from "@/types/adapters/anilist";

/**
 * Check if a value is an AniListAdapterConfig
 */
export function isAniListAdapterConfig(obj: unknown): obj is AniListAdapterConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("accessToken" in candidate) || typeof candidate["accessToken"] === "string") &&
    (!("clientId" in candidate) || typeof candidate["clientId"] === "string") &&
    (!("clientSecret" in candidate) || typeof candidate["clientSecret"] === "string") &&
    (!("redirectUri" in candidate) || typeof candidate["redirectUri"] === "string")
  );
}

/**
 * Validate required AniListMedia fields
 */
function validateAniListMediaRequired(candidate: Record<string, unknown>): boolean {
  return (
    typeof candidate["id"] === "number" &&
    "title" in candidate
  );
}

/**
 * Validate ID and season number fields for AniListMedia
 */
function validateAniListMediaNumbersBasic(candidate: Record<string, unknown>): boolean {
  return (
    (!("idMal" in candidate) || typeof candidate["idMal"] === "number") &&
    (!("seasonYear" in candidate) || typeof candidate["seasonYear"] === "number") &&
    (!("seasonInt" in candidate) || typeof candidate["seasonInt"] === "number") &&
    (!("updatedAt" in candidate) || typeof candidate["updatedAt"] === "number")
  );
}

/**
 * Validate content count number fields for AniListMedia
 */
function validateAniListMediaNumbersCounts(candidate: Record<string, unknown>): boolean {
  return (
    (!("episodes" in candidate) || typeof candidate["episodes"] === "number") &&
    (!("duration" in candidate) || typeof candidate["duration"] === "number") &&
    (!("chapters" in candidate) || typeof candidate["chapters"] === "number") &&
    (!("volumes" in candidate) || typeof candidate["volumes"] === "number")
  );
}

/**
 * Validate score and popularity number fields for AniListMedia
 */
function validateAniListMediaNumbersScores(candidate: Record<string, unknown>): boolean {
  return (
    (!("averageScore" in candidate) || typeof candidate["averageScore"] === "number") &&
    (!("meanScore" in candidate) || typeof candidate["meanScore"] === "number") &&
    (!("popularity" in candidate) || typeof candidate["popularity"] === "number") &&
    (!("trending" in candidate) || typeof candidate["trending"] === "number") &&
    (!("favourites" in candidate) || typeof candidate["favourites"] === "number")
  );
}

/**
 * Validate optional number fields for AniListMedia
 */
function validateAniListMediaNumbers(candidate: Record<string, unknown>): boolean {
  return (
    validateAniListMediaNumbersBasic(candidate) &&
    validateAniListMediaNumbersCounts(candidate) &&
    validateAniListMediaNumbersScores(candidate)
  );
}

/**
 * Validate optional string fields for AniListMedia
 */
function validateAniListMediaStrings(candidate: Record<string, unknown>): boolean {
  return (
    (!("description" in candidate) || typeof candidate["description"] === "string") &&
    (!("countryOfOrigin" in candidate) || typeof candidate["countryOfOrigin"] === "string") &&
    (!("source" in candidate) || typeof candidate["source"] === "string") &&
    (!("hashtag" in candidate) || typeof candidate["hashtag"] === "string") &&
    (!("bannerImage" in candidate) || typeof candidate["bannerImage"] === "string") &&
    (!("siteUrl" in candidate) || typeof candidate["siteUrl"] === "string") &&
    (!("modNotes" in candidate) || typeof candidate["modNotes"] === "string")
  );
}

/**
 * Validate optional boolean fields for AniListMedia
 */
function validateAniListMediaBooleans(candidate: Record<string, unknown>): boolean {
  return (
    (!("isLicensed" in candidate) || typeof candidate["isLicensed"] === "boolean") &&
    (!("isLocked" in candidate) || typeof candidate["isLocked"] === "boolean") &&
    (!("isFavourite" in candidate) || typeof candidate["isFavourite"] === "boolean") &&
    (!("isAdult" in candidate) || typeof candidate["isAdult"] === "boolean") &&
    (!("autoCreateForumThread" in candidate) || typeof candidate["autoCreateForumThread"] === "boolean") &&
    (!("isRecommendationBlocked" in candidate) || typeof candidate["isRecommendationBlocked"] === "boolean")
  );
}

/**
 * Validate optional array fields for AniListMedia
 */
function validateAniListMediaArrays(candidate: Record<string, unknown>): boolean {
  return (
    (!("genres" in candidate) || Array.isArray(candidate["genres"]) && candidate["genres"].every((x: unknown) => typeof x === "string")) &&
    (!("synonyms" in candidate) || Array.isArray(candidate["synonyms"]) && candidate["synonyms"].every((x: unknown) => typeof x === "string")) &&
    (!("tags" in candidate) || Array.isArray(candidate["tags"])) &&
    (!("externalLinks" in candidate) || Array.isArray(candidate["externalLinks"])) &&
    (!("streamingEpisodes" in candidate) || Array.isArray(candidate["streamingEpisodes"])) &&
    (!("rankings" in candidate) || Array.isArray(candidate["rankings"]))
  );
}

/**
 * Validate optional object/enum fields for AniListMedia
 */
function validateAniListMediaObjects(candidate: Record<string, unknown>): boolean {
  return (
    (!("type" in candidate) || "type" in candidate) &&
    (!("format" in candidate) || "format" in candidate) &&
    (!("status" in candidate) || "status" in candidate) &&
    (!("startDate" in candidate) || "startDate" in candidate) &&
    (!("endDate" in candidate) || "endDate" in candidate) &&
    (!("season" in candidate) || "season" in candidate) &&
    (!("trailer" in candidate) || "trailer" in candidate) &&
    (!("coverImage" in candidate) || "coverImage" in candidate)
  );
}

/**
 * Validate optional relationship fields for AniListMedia
 */
function validateAniListMediaRelationships(candidate: Record<string, unknown>): boolean {
  return (
    (!("relations" in candidate) || "relations" in candidate) &&
    (!("characters" in candidate) || "characters" in candidate) &&
    (!("staff" in candidate) || "staff" in candidate) &&
    (!("studios" in candidate) || "studios" in candidate) &&
    (!("nextAiringEpisode" in candidate) || "nextAiringEpisode" in candidate) &&
    (!("airingSchedule" in candidate) || "airingSchedule" in candidate) &&
    (!("trends" in candidate) || "trends" in candidate) &&
    (!("mediaListEntry" in candidate) || "mediaListEntry" in candidate) &&
    (!("reviews" in candidate) || "reviews" in candidate) &&
    (!("recommendations" in candidate) || "recommendations" in candidate)
  );
}

/**
 * Check if a value is an AniListMedia
 */
export function isAniListMedia(obj: unknown): obj is AniListMedia {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateAniListMediaRequired(candidate) &&
    validateAniListMediaNumbers(candidate) &&
    validateAniListMediaStrings(candidate) &&
    validateAniListMediaBooleans(candidate) &&
    validateAniListMediaArrays(candidate) &&
    validateAniListMediaObjects(candidate) &&
    validateAniListMediaRelationships(candidate)
  );
}

/**
 * Check if a value is an AniListDate
 */
export function isAniListDate(obj: unknown): obj is AniListDate {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("year" in candidate) || typeof candidate["year"] === "number") &&
    (!("month" in candidate) || typeof candidate["month"] === "number") &&
    (!("day" in candidate) || typeof candidate["day"] === "number")
  );
}

/**
 * Check if a value is an AniListTag
 */
export function isAniListTag(obj: unknown): obj is AniListTag {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("id" in candidate) || typeof candidate["id"] === "number") &&
    (!("name" in candidate) || typeof candidate["name"] === "string") &&
    (!("description" in candidate) || typeof candidate["description"] === "string") &&
    (!("category" in candidate) || typeof candidate["category"] === "string") &&
    (!("rank" in candidate) || typeof candidate["rank"] === "number") &&
    (!("isGeneralSpoiler" in candidate) || typeof candidate["isGeneralSpoiler"] === "boolean") &&
    (!("isMediaSpoiler" in candidate) || typeof candidate["isMediaSpoiler"] === "boolean") &&
    (!("isAdult" in candidate) || typeof candidate["isAdult"] === "boolean")
  );
}

/**
 * Check if a value is an AniListCharacter
 */
export function isAniListCharacter(obj: unknown): obj is AniListCharacter {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("id" in candidate) || typeof candidate["id"] === "number") &&
    (!("name" in candidate) || "name" in candidate) &&
    (!("image" in candidate) || "image" in candidate) &&
    (!("description" in candidate) || typeof candidate["description"] === "string") &&
    (!("isFavourite" in candidate) || typeof candidate["isFavourite"] === "boolean") &&
    (!("siteUrl" in candidate) || typeof candidate["siteUrl"] === "string") &&
    (!("favourites" in candidate) || typeof candidate["favourites"] === "number")
  );
}

/**
 * Check if a value is an AniListStaff
 */
export function isAniListStaff(obj: unknown): obj is AniListStaff {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("id" in candidate) || typeof candidate["id"] === "number") &&
    (!("name" in candidate) || "name" in candidate) &&
    (!("language" in candidate) || typeof candidate["language"] === "string") &&
    (!("image" in candidate) || "image" in candidate) &&
    (!("description" in candidate) || typeof candidate["description"] === "string") &&
    (!("isFavourite" in candidate) || typeof candidate["isFavourite"] === "boolean") &&
    (!("siteUrl" in candidate) || typeof candidate["siteUrl"] === "string") &&
    (!("favourites" in candidate) || typeof candidate["favourites"] === "number")
  );
}

/**
 * Check if a value is an AniListMediaEdge
 */
export function isAniListMediaEdge(obj: unknown): obj is AniListMediaEdge {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("id" in candidate) || typeof candidate["id"] === "number") &&
    (!("relationType" in candidate) || typeof candidate["relationType"] === "string") &&
    (!("node" in candidate) || "node" in candidate)
  );
}

/**
 * Check if a value is an AniListCharacterEdge
 */
export function isAniListCharacterEdge(obj: unknown): obj is AniListCharacterEdge {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("id" in candidate) || typeof candidate["id"] === "number") &&
    (!("role" in candidate) || typeof candidate["role"] === "string") &&
    (!("node" in candidate) || "node" in candidate)
  );
}

/**
 * Check if a value is an AniListStaffEdge
 */
export function isAniListStaffEdge(obj: unknown): obj is AniListStaffEdge {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("id" in candidate) || typeof candidate["id"] === "number") &&
    (!("role" in candidate) || typeof candidate["role"] === "string") &&
    (!("node" in candidate) || "node" in candidate)
  );
}

/**
 * Check if a value is an AniListStudioEdge
 */
export function isAniListStudioEdge(obj: unknown): obj is AniListStudioEdge {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("id" in candidate) || typeof candidate["id"] === "number") &&
    (!("isMain" in candidate) || typeof candidate["isMain"] === "boolean") &&
    (!("node" in candidate) || "node" in candidate)
  );
}

/**
 * Check if a value is an AniListAiringScheduleEdge
 */
export function isAniListAiringScheduleEdge(obj: unknown): obj is AniListAiringScheduleEdge {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("id" in candidate) || typeof candidate["id"] === "number") &&
    (!("node" in candidate) || "node" in candidate)
  );
}

/**
 * Check if a value is an AniListMediaTrendEdge
 */
export function isAniListMediaTrendEdge(obj: unknown): obj is AniListMediaTrendEdge {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("node" in candidate) || "node" in candidate)
  );
}

/**
 * Check if a value is an AniListReviewEdge
 */
export function isAniListReviewEdge(obj: unknown): obj is AniListReviewEdge {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("node" in candidate) || "node" in candidate)
  );
}

/**
 * Check if a value is an AniListRecommendationEdge
 */
export function isAniListRecommendationEdge(obj: unknown): obj is AniListRecommendationEdge {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("node" in candidate) || "node" in candidate)
  );
}

/**
 * Check if a value is an AniListStudio
 */
export function isAniListStudio(obj: unknown): obj is AniListStudio {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("id" in candidate) || typeof candidate["id"] === "number") &&
    (!("name" in candidate) || typeof candidate["name"] === "string") &&
    (!("isAnimationStudio" in candidate) || typeof candidate["isAnimationStudio"] === "boolean") &&
    (!("siteUrl" in candidate) || typeof candidate["siteUrl"] === "string") &&
    (!("isFavourite" in candidate) || typeof candidate["isFavourite"] === "boolean") &&
    (!("favourites" in candidate) || typeof candidate["favourites"] === "number")
  );
}

/**
 * Check if a value is an AniListAiringSchedule
 */
export function isAniListAiringSchedule(obj: unknown): obj is AniListAiringSchedule {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("id" in candidate) || typeof candidate["id"] === "number") &&
    (!("airingAt" in candidate) || typeof candidate["airingAt"] === "number") &&
    (!("timeUntilAiring" in candidate) || typeof candidate["timeUntilAiring"] === "number") &&
    (!("episode" in candidate) || typeof candidate["episode"] === "number") &&
    (!("mediaId" in candidate) || typeof candidate["mediaId"] === "number")
  );
}

/**
 * Check if a value is an AniListMediaTrend
 */
export function isAniListMediaTrend(obj: unknown): obj is AniListMediaTrend {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("mediaId" in candidate) || typeof candidate["mediaId"] === "number") &&
    (!("date" in candidate) || typeof candidate["date"] === "number") &&
    (!("trending" in candidate) || typeof candidate["trending"] === "number") &&
    (!("averageScore" in candidate) || typeof candidate["averageScore"] === "number") &&
    (!("popularity" in candidate) || typeof candidate["popularity"] === "number") &&
    (!("episode" in candidate) || typeof candidate["episode"] === "number") &&
    (!("releasing" in candidate) || typeof candidate["releasing"] === "boolean") &&
    (!("inProgress" in candidate) || typeof candidate["inProgress"] === "number") &&
    (!("media" in candidate) || "media" in candidate)
  );
}

/**
 * Check if a value is an AniListExternalLink
 */
export function isAniListExternalLink(obj: unknown): obj is AniListExternalLink {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("id" in candidate) || typeof candidate["id"] === "number") &&
    (!("url" in candidate) || typeof candidate["url"] === "string") &&
    (!("site" in candidate) || typeof candidate["site"] === "string") &&
    (!("siteId" in candidate) || typeof candidate["siteId"] === "number") &&
    (!("type" in candidate) || typeof candidate["type"] === "string") &&
    (!("language" in candidate) || typeof candidate["language"] === "string") &&
    (!("color" in candidate) || typeof candidate["color"] === "string") &&
    (!("icon" in candidate) || typeof candidate["icon"] === "string")
  );
}

/**
 * Check if a value is an AniListStreamingEpisode
 */
export function isAniListStreamingEpisode(obj: unknown): obj is AniListStreamingEpisode {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("title" in candidate) || typeof candidate["title"] === "string") &&
    (!("thumbnail" in candidate) || typeof candidate["thumbnail"] === "string") &&
    (!("url" in candidate) || typeof candidate["url"] === "string") &&
    (!("site" in candidate) || typeof candidate["site"] === "string")
  );
}

/**
 * Check if a value is an AniListMediaRank
 */
export function isAniListMediaRank(obj: unknown): obj is AniListMediaRank {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("id" in candidate) || typeof candidate["id"] === "number") &&
    (!("rank" in candidate) || typeof candidate["rank"] === "number") &&
    (!("type" in candidate) || typeof candidate["type"] === "string") &&
    (!("format" in candidate) || typeof candidate["format"] === "string") &&
    (!("year" in candidate) || typeof candidate["year"] === "number") &&
    (!("season" in candidate) || typeof candidate["season"] === "string") &&
    (!("allTime" in candidate) || typeof candidate["allTime"] === "boolean") &&
    (!("context" in candidate) || typeof candidate["context"] === "string")
  );
}

/**
 * Validate optional number fields for AniListMediaListEntry
 */
function validateMediaListEntryNumbers(candidate: Record<string, unknown>): boolean {
  return (
    (!("id" in candidate) || typeof candidate["id"] === "number") &&
    (!("mediaId" in candidate) || typeof candidate["mediaId"] === "number") &&
    (!("score" in candidate) || typeof candidate["score"] === "number") &&
    (!("progress" in candidate) || typeof candidate["progress"] === "number") &&
    (!("progressVolumes" in candidate) || typeof candidate["progressVolumes"] === "number") &&
    (!("repeat" in candidate) || typeof candidate["repeat"] === "number") &&
    (!("priority" in candidate) || typeof candidate["priority"] === "number") &&
    (!("updatedAt" in candidate) || typeof candidate["updatedAt"] === "number") &&
    (!("createdAt" in candidate) || typeof candidate["createdAt"] === "number")
  );
}

/**
 * Validate optional boolean/string/object fields for AniListMediaListEntry
 */
function validateMediaListEntryOthers(candidate: Record<string, unknown>): boolean {
  return (
    (!("status" in candidate) || typeof candidate["status"] === "string") &&
    (!("private" in candidate) || typeof candidate["private"] === "boolean") &&
    (!("notes" in candidate) || typeof candidate["notes"] === "string") &&
    (!("hiddenFromStatusLists" in candidate) || typeof candidate["hiddenFromStatusLists"] === "boolean") &&
    (!("customLists" in candidate) || "customLists" in candidate) &&
    (!("startedAt" in candidate) || "startedAt" in candidate) &&
    (!("completedAt" in candidate) || "completedAt" in candidate)
  );
}

/**
 * Check if a value is an AniListMediaListEntry
 */
export function isAniListMediaListEntry(obj: unknown): obj is AniListMediaListEntry {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateMediaListEntryNumbers(candidate) &&
    validateMediaListEntryOthers(candidate)
  );
}

/**
 * Validate optional number fields for AniListReview
 */
function validateReviewNumbers(candidate: Record<string, unknown>): boolean {
  return (
    (!("id" in candidate) || typeof candidate["id"] === "number") &&
    (!("userId" in candidate) || typeof candidate["userId"] === "number") &&
    (!("mediaId" in candidate) || typeof candidate["mediaId"] === "number") &&
    (!("rating" in candidate) || typeof candidate["rating"] === "number") &&
    (!("ratingAmount" in candidate) || typeof candidate["ratingAmount"] === "number") &&
    (!("score" in candidate) || typeof candidate["score"] === "number") &&
    (!("createdAt" in candidate) || typeof candidate["createdAt"] === "number") &&
    (!("updatedAt" in candidate) || typeof candidate["updatedAt"] === "number")
  );
}

/**
 * Validate optional string/boolean fields for AniListReview
 */
function validateReviewOthers(candidate: Record<string, unknown>): boolean {
  return (
    (!("mediaType" in candidate) || typeof candidate["mediaType"] === "string") &&
    (!("summary" in candidate) || typeof candidate["summary"] === "string") &&
    (!("body" in candidate) || typeof candidate["body"] === "string") &&
    (!("userRating" in candidate) || typeof candidate["userRating"] === "string") &&
    (!("private" in candidate) || typeof candidate["private"] === "boolean") &&
    (!("siteUrl" in candidate) || typeof candidate["siteUrl"] === "string")
  );
}

/**
 * Check if a value is an AniListReview
 */
export function isAniListReview(obj: unknown): obj is AniListReview {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateReviewNumbers(candidate) &&
    validateReviewOthers(candidate)
  );
}

/**
 * Check if a value is an AniListRecommendation
 */
export function isAniListRecommendation(obj: unknown): obj is AniListRecommendation {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("id" in candidate) || typeof candidate["id"] === "number") &&
    (!("rating" in candidate) || typeof candidate["rating"] === "number") &&
    (!("userRating" in candidate) || typeof candidate["userRating"] === "string") &&
    (!("media" in candidate) || "media" in candidate) &&
    (!("mediaRecommendation" in candidate) || "mediaRecommendation" in candidate)
  );
}

/**
 * Check if a value is a PageInfo
 */
export function isPageInfo(obj: unknown): obj is PageInfo {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("total" in candidate) || typeof candidate["total"] === "number") &&
    (!("perPage" in candidate) || typeof candidate["perPage"] === "number") &&
    (!("currentPage" in candidate) || typeof candidate["currentPage"] === "number") &&
    (!("lastPage" in candidate) || typeof candidate["lastPage"] === "number") &&
    (!("hasNextPage" in candidate) || typeof candidate["hasNextPage"] === "boolean")
  );
}

/**
 * Check if a value is an AniListConfig
 */
export function isAniListConfig(obj: unknown): obj is AniListConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string"
  );
}