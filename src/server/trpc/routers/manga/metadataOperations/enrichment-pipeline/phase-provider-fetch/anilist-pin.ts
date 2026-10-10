/**
 * AniList pin resolution for the provider-fetch phase.
 *
 * `Manga.selectedSourceId` is the manual AniList pin, but the column has also
 * been written with other providers' ids (MangaDex UUIDs, Fandom slugs,
 * ComicVine `4050-N` ids) and with a JSON provider map from the add-manga
 * wizard. Only an all-digit value is an AniList id; anything else must not
 * mask the auto-bound id or count as a manual pin.
 */

export interface AniListPinInput {
  selectedSourceId: string | null | undefined;
  boundAlId: string | null;
  rejectedAlIds: ReadonlySet<string>;
}

export interface AniListPin {
  /** Id to fetch directly, bypassing search + matcher; null → run the matcher. */
  pinnedAlId: string | null;
  /** True only when the pin is a usable manual AniList id. */
  manualPin: boolean;
}

const ANILIST_ID_PATTERN = /^[1-9]\d*$/u;

/** Returns the value when it is a plausible AniList media id, else null. */
export function parseManualAniListId(selectedSourceId: string | null | undefined): string | null {
  if (typeof selectedSourceId !== 'string') return null;
  const trimmed = selectedSourceId.trim();
  return ANILIST_ID_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * Manual pin always wins and is never filtered by rejections. Otherwise the
 * auto-bound id is reused unless it has been rejected.
 */
export function resolveAniListPin(input: AniListPinInput): AniListPin {
  const manualId = parseManualAniListId(input.selectedSourceId);
  if (manualId !== null) return { pinnedAlId: manualId, manualPin: true };
  const { boundAlId } = input;
  const reusable = boundAlId !== null && !input.rejectedAlIds.has(boundAlId) ? boundAlId : null;
  return { pinnedAlId: reusable, manualPin: false };
}
