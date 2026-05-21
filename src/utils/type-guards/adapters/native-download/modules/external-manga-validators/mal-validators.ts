/**
 * MyAnimeList (MAL) Manga Type Validators
 *
 * Modular validators for ExternalMALManga type guard decomposition
 */

import {
  isNumber,
  isString,
  isObject,
  hasOptionalProperty,
  hasOptionalPropertyOfType,
  hasRequiredPropertyOfType,
  hasProperty
} from "../shared-validators/basic-validators";

/**
 * Validate required MAL manga fields
 */
export function validateRequiredMALFields(
  candidate: Record<string, unknown>
): boolean {
  return (
    hasRequiredPropertyOfType(candidate, "id", isNumber) &&
    hasRequiredPropertyOfType(candidate, "title", isString)
  );
}

/**
 * Validate optional MAL manga fields with type checking
 */
export function validateOptionalMALFields(
  candidate: Record<string, unknown>
): boolean {
  return (
    hasOptionalProperty(candidate, "main_picture") &&
    hasOptionalProperty(candidate, "alternative_titles") &&
    hasOptionalPropertyOfType(candidate, "start_date", isString) &&
    hasOptionalPropertyOfType(candidate, "end_date", isString) &&
    hasOptionalPropertyOfType(candidate, "synopsis", isString) &&
    hasOptionalPropertyOfType(candidate, "mean", isNumber) &&
    hasOptionalPropertyOfType(candidate, "rank", isNumber) &&
    hasOptionalPropertyOfType(candidate, "popularity", isNumber) &&
    hasOptionalPropertyOfType(candidate, "num_list_users", isNumber) &&
    hasOptionalPropertyOfType(candidate, "num_scoring_users", isNumber) &&
    hasOptionalProperty(candidate, "nsfw") &&
    hasOptionalPropertyOfType(candidate, "created_at", isString) &&
    hasOptionalPropertyOfType(candidate, "updated_at", isString) &&
    hasOptionalPropertyOfType(candidate, "media_type", isString) &&
    hasOptionalProperty(candidate, "status") &&
    hasOptionalProperty(candidate, "genres") &&
    hasOptionalProperty(candidate, "my_list_status") &&
    hasOptionalPropertyOfType(candidate, "num_volumes", isNumber) &&
    hasOptionalPropertyOfType(candidate, "num_chapters", isNumber) &&
    hasOptionalProperty(candidate, "authors")
  );
}

/**
 * Validate MAL main picture structure
 */
export function validateMALMainPicture(
  picture: unknown
): picture is { medium?: string; large?: string } {
  if (!isObject(picture)) return false;

  const pictureObj = picture as Record<string, unknown>;
  return (
    hasOptionalProperty(pictureObj, "medium") &&
    hasOptionalProperty(pictureObj, "large")
  );
}

/**
 * Validate MAL alternative titles structure
 */
export function validateMALAlternativeTitles(
  titles: unknown
): titles is { synonyms?: string[]; en?: string; ja?: string } {
  if (!isObject(titles)) return false;

  const titlesObj = titles as Record<string, unknown>;
  return (
    hasOptionalProperty(titlesObj, "synonyms") &&
    hasOptionalProperty(titlesObj, "en") &&
    hasOptionalProperty(titlesObj, "ja")
  );
}

/**
 * Validate MAL genre structure
 */
export function validateMALGenre(
  genre: unknown
): genre is { id: number; name: string } {
  if (!isObject(genre)) return false;

  const genreObj = genre as Record<string, unknown>;
  return (
    hasRequiredPropertyOfType(genreObj, "id", isNumber) &&
    hasRequiredPropertyOfType(genreObj, "name", isString)
  );
}

/**
 * Validate MAL my list status structure
 */
export function validateMALMyListStatus(
  status: unknown
): status is {
  status?: string;
  score?: number;
  num_chapters_read?: number;
  num_volumes_read?: number;
  is_rereading?: boolean;
  updated_at?: string;
} {
  if (!isObject(status)) return false;

  const statusObj = status as Record<string, unknown>;
  return (
    hasOptionalProperty(statusObj, "status") &&
    hasOptionalProperty(statusObj, "score") &&
    hasOptionalProperty(statusObj, "num_chapters_read") &&
    hasOptionalProperty(statusObj, "num_volumes_read") &&
    hasOptionalProperty(statusObj, "is_rereading") &&
    hasOptionalProperty(statusObj, "updated_at")
  );
}

/**
 * Validate MAL author structure
 */
export function validateMALAuthor(
  author: unknown
): author is { node: { id: number; first_name?: string; last_name?: string }; role?: string } {
  if (!isObject(author)) return false;

  const authorObj = author as Record<string, unknown>;
  return (
    hasProperty(authorObj, "node") &&
    hasOptionalProperty(authorObj, "role")
  );
}