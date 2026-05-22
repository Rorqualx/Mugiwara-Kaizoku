/**
 * Per-key Zod validators for `settings.set` writes.
 *
 * The `set` mutation accepts arbitrary keys with `z.unknown()` values for
 * back-compat with the dozens of existing call sites across the app. This
 * registry adds a defensive layer: when a key is registered here, the value
 * is parsed against the schema before reaching `configService.set`, and the
 * mutation rejects with BAD_REQUEST on a parse failure.
 *
 * Unknown keys still pass through unchanged — adding a key here is a strict
 * tightening, never a regression. As other settings surfaces are audited the
 * registry should grow.
 *
 * Wire-format note: settings UI components historically pass booleans through
 * `String(value)` (so the wire payload is `"true"` / `"false"`). Numbers come
 * through as native numbers via the typed download/retry hooks, but a Zod
 * `coerce` is still used so a stringified number from a future caller doesn't
 * fail validation. JSON blobs (e.g. `fileOrganization`) arrive as
 * `JSON.stringify(...)` strings; `fileOrgSchema` accepts both shapes.
 */
import path from 'node:path';

import { z } from 'zod';

/** Boolean wire format: native `true`/`false` OR `"true"`/`"false"` string */
const boolValue = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((v) => v === 'true'),
]);

/**
 * Filesystem path validator — must be absolute and contain no `..` segments
 * after normalisation. Defense-in-depth: every reader of these values is
 * already required to be auth'd, but we never want a path-traversal value
 * sitting in the Config table waiting to be substituted into a file op.
 */
const absolutePathString = z
  .string()
  .max(500)
  .refine((s) => path.isAbsolute(s), 'Path must be absolute')
  // Check the raw input — path.normalize() collapses `..` to a real directory
  // (so `/data/../etc` would normalize to `/etc` and pass), which is exactly
  // the path-traversal we want to reject. Match the segment in the raw string.
  .refine((s) => !s.split(/[/\\]/).includes('..'), 'Path must not contain ".." segments');

/**
 * 5-field cron with the alphabet POSIX cron expects. Doesn't validate that
 * the schedule is sensible (that needs a real parser), but rejects obvious
 * garbage and command injection attempts before they reach the scheduler.
 */
const cronExpression = z
  .string()
  .max(120)
  .regex(/^[\s0-9*\-,/]+$/, 'Cron expression contains invalid characters')
  .refine((s) => s.trim().split(/\s+/).length === 5, 'Cron expression must have 5 fields');

/** Allowed placeholders inside file-org templates. */
const TEMPLATE_PLACEHOLDERS = ['title', 'chapter', 'volume', 'year', 'publisher', 'author'] as const;
const templateString = z
  .string()
  .max(500)
  .refine(
    (s) => {
      const matches = s.matchAll(/\{([^}]+)\}/g);
      for (const m of matches) {
        if (!TEMPLATE_PLACEHOLDERS.includes(m[1] as (typeof TEMPLATE_PLACEHOLDERS)[number])) {
          return false;
        }
      }
      return true;
    },
    `Template may only reference {${TEMPLATE_PLACEHOLDERS.join('}, {')}}`,
  );

const fileOrgShape = z
  .object({
    folderStructure: z.enum(['flat', 'byTitle', 'byTitleYear', 'byPublisher', 'custom']).optional(),
    customFolderTemplate: templateString.optional(),
    volumeNamingTemplate: templateString.optional(),
    chapterNamingTemplate: templateString.optional(),
    fileNamingTemplate: templateString.optional(), // deprecated, still accepted on the read path
    // Empty string is a legitimate "no library base path set yet" value —
    // the field is hidden in keep-in-place mode and not required until
    // the user picks move/copy. Validate as: empty OR valid absolute path.
    libraryBasePath: z.union([z.literal(''), absolutePathString]).optional(),
    // Behavior toggles. These were missing from the schema, so the .strict()
    // shape silently rejected every save that included them — the UI's
    // optimistic state flip made it look like saves were succeeding right
    // up until a reboot reloaded the unchanged DB value.
    fileMode: z.enum(['keep_in_place', 'move', 'copy']).optional(),
    createMetadataFiles: z.boolean().optional(),
    organizeOnImport: z.boolean().optional(),
    createVolumeFolders: z.boolean().optional(),
    splitVolumeFiles: z.boolean().optional(),
  })
  .strict();

/** FileOrg blob arrives as `JSON.stringify(...)` from the UI; accept both. */
const fileOrgSchema = z.union([
  fileOrgShape,
  z.string().transform((s, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(s);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid JSON' });
      return z.NEVER;
    }
    const result = fileOrgShape.safeParse(parsed);
    if (!result.success) {
      for (const issue of result.error.issues) ctx.addIssue(issue);
      return z.NEVER;
    }
    return result.data;
  }),
]);

/**
 * Provider credential strings (Client IDs, secrets, OAuth tokens, API keys).
 * Bounded length keeps a malformed payload from sitting in the Config table
 * waiting to be substituted into an outbound HTTP header.
 */
const credentialString = z.string().max(512);

/** Provider language preference — short alpha code (e.g. `en`, `ja`, `pt-br`). */
const languageCode = z
  .string()
  .max(16)
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, 'Invalid language code');

/** MangaDex content rating values used by the metadata-side download router. */
const mangaDexContentRating = z.array(
  z.enum(['safe', 'suggestive', 'erotica', 'pornographic']),
).max(4);

/**
 * Registry of typed validators. Keys not present here keep the legacy
 * `z.unknown()` behaviour. A `key` lookup is constant-time.
 */
export const CONFIG_KEY_VALIDATORS: Record<string, z.ZodTypeAny> = {
  // /settings/media-management writers
  fileOrganization: fileOrgSchema,
  'media.enableEbookFormats': boolValue,
  'media.enableAudiobooks': boolValue,
  'download.autoDownload': boolValue,
  'download.interval': z.enum(['hourly', 'every2hours', 'every4hours', 'every6hours', 'daily', 'custom']),
  'download.customCron': cronExpression,
  'download.downloadPath': absolutePathString,
  'download.retryAttempts': z.coerce.number().int().min(0).max(10),
  'download.retry.enabled': boolValue,
  'download.retry.maxAttempts': z.coerce.number().int().min(0).max(20),
  'download.retry.stallTimeoutMinutes': z.coerce.number().int().min(5).max(120),
  'download.retry.minSeeders': z.coerce.number().int().min(0).max(100),
  'download.retry.autoBlockFailed': boolValue,
  'download.retry.blockExpiryDays': z.coerce.number().int().min(0).max(365),
  'download.retry.delayBetweenRetriesSeconds': z.coerce.number().int().min(10).max(600),
  'download.mode': z.enum(['mix', 'prefer-volume', 'prefer-chapter']),

  // /settings/metadata writers — per-provider enable booleans
  'anilist.enabled': boolValue,
  'mangadex.enabled': boolValue,
  'comicvine.enabled': boolValue,
  'fandom.enabled': boolValue,
  'wikipedia.enabled': boolValue,
  'mal.enabled': boolValue,
  'mangaupdates.enabled': boolValue,
  'kitsu.enabled': boolValue,

  // AniList — credential blob + experimental toggles
  'anilist.useForMetadata': boolValue,
  'anilist.useEnhancedProvider': boolValue,
  'anilist.filterAdultContent': boolValue,
  'anilist.filterWebtoons': boolValue,
  'anilist.filterKoreanManhwa': boolValue,
  'anilist.clientId': credentialString,
  'anilist.clientSecret': credentialString,
  'anilist.accessToken': credentialString,

  // ComicVine
  'comicvine.apiKey': credentialString,
  'comicvine.priority': z.coerce.number().int().min(1).max(10),
  'comicvine.preferredLanguage': languageCode,
  'comicvine.comicbookTrackingEnabled': boolValue,

  // MAL (Jikan)
  'mal.filterAdultContent': boolValue,

  // MangaDex metadata-side defaults (parallel to the download-side ones)
  'mangadex.preferredLanguage': languageCode,
  'mangadex.includeAdult': boolValue,
  'mangadex.defaultContentRating': mangaDexContentRating,
};

/**
 * Validate a settings.set payload. Returns the (possibly transformed) value
 * for known keys, or the original value untouched for unknown keys. Throws a
 * Zod error on schema-mismatch — the caller maps that to BAD_REQUEST.
 */
export function validateConfigKey(key: string, value: unknown): unknown {
  const schema = CONFIG_KEY_VALIDATORS[key];
  if (!schema) return value;
  return schema.parse(value);
}
