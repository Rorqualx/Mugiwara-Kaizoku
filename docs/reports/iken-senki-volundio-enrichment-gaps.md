# Enrichment Pipeline — Gap Snapshot

*Date: 2026-04-25*
*Test subject: Iken Senki Volundio (Manga.id=4844, MangaDex `4fd4f8c0-fab8-4ee5-ab9e-5907720afed9`)*

## Symptoms in the UI

The library detail page shows:
- "2 DOWNLOADED / 0 READ" — accurate.
- **Volume 0 (Specials)** with **16 CHAPTERS, 250 PAGES, 34.1 MB**. The 34.1 MB is actually the file we downloaded for chapter 71.3, which belongs in Vol 10.
- **Volume 9 (65.1–69)**: 1 chapter (only ch.69) — the 9 decimal chapters that should live here are missing from the volume's view.
- **Volume 10 (70.1–72)**: 1 chapter (only ch.72) — ch.70.1, 70.2, 71.1, 71.2, 71.3 are missing.
- **Volume 4 (24–28), Volume 5 (29–40), Volume 6 (41–41), Volume 7 (42–53), Volume 8 (54–64.1)**: 0 chapters linked.

## Root cause #1 — `assignSpecialChapters` clobbers correct decimal volume assignments

`src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/fandom-db-persistence.ts:158-180` filters chapters as "specials" using:

```typescript
const specialChapters = allChapters.filter(
  ch => ch.chapterNumber !== null &&
        (ch.chapterNumber <= 0 || !Number.isInteger(ch.chapterNumber)),
);
```

This treats **every decimal chapter** (4.1, 28.1, 65.1, 65.2, 66.1, 66.2, 66.3, 67.1, 67.2, 68.1, 68.2, 70.1, 70.2, 71.1, 71.2, 71.3) as a "special" and force-assigns them to Volume 0 via `prisma.chapter.updateMany`.

`phase-finalize.ts:77` runs `backfillChapterVolumeIds(mangaId)` first — this **correctly** maps decimals into their proper-range volumes via `chapterStart <= chapterNumber <= chapterEnd` (e.g., ch.65.1 → Vol 9 because 65.1 ≤ 65.1 ≤ 69). Twelve lines later (`phase-finalize.ts:89`) the special-chapter pass undoes that work, overwriting both `Chapter.volume` and `Chapter.volumeId` with Volume 0.

Live MangaDex API confirms the correct mapping is available in the source data — `https://api.mangadex.org/manga/.../feed` returns `attributes.volume = '9'` for ch.65.1, `attributes.volume = '10'` for ch.71.3, etc. The pipeline already has the right answer; it just throws it away.

### Suggested fix
Make `assignSpecialChapters` only match chapters that **either** sit at chapterNumber ≤ 0 **or** failed range-backfill (`volumeId IS NULL` after `backfillChapterVolumeIds` ran). Decimals like 65.1 that landed inside Vol 9's range should retain that assignment. One-line change to the filter at `fandom-db-persistence.ts:161-163`.

Comment at line 159 ("decimals (0.1, 1.5)…") is the original intent — pre-series fragments. The code drifted to capture all decimals, including legitimate split chapters within series volumes.

## Root cause #2 — `pages <= 0` filter drops MangaDex chapters

`src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/mangadex-chapter-list.ts:51`:

```typescript
const pages = typeof attrs.pages === 'number' ? attrs.pages : 0;
if (pages <= 0) return null;
```

The MangaDex `/feed` returns `pages: 0` for chapters that have a metadata entry but no uploaded scanlation pages. For Iken Senki Volundio that's ch.0 (vol 1), ch.1, ch.2, ch.3, ch.4, ch.41 — all 6 dropped by this filter even though MangaDex reports `volume: '1'` and `volume: '6'` for them respectively.

For this title the gap is partly papered over because Fandom/AniList-derived chapter lists supply ch.1–4 separately. But the volume tag from MangaDex (which is correct) gets lost, contributing to the off-by-one in Vol 1 (DB has 1–5 in Vol 1; MangaDex says Vol 1 is 0–4).

### Suggested fix
Drop the `pages <= 0` rejection, or weaken it to `attrs.pages !== null && attrs.pages < 0`. Surviving chapters with `pages: 0` still carry useful `volume`, `chapter`, `title`, `publishAt` data — the only thing they can't do is be downloaded, and downstream code should handle that anyway.

## Root cause #3 — chapter list incomplete from MangaDex (data gap, not bug)

For this title MangaDex's English feed returns 22 chapters total: ch.0–4 (Vol 1), ch.41 (Vol 6), ch.65.1–69 (Vol 9), ch.70.1–72 (Vol 10). **MangaDex has no English uploads for chapters 5–40 or 42–64**, so the empty Vols 4, 5, 7, 8 in our UI reflect reality.

The pipeline's volume-rows-without-chapters output (Vols 11–34 from re-enrichment, all empty, with `chapterStart=null`) suggests an over-eager volume creator that synthesizes Volume rows from raw provider data without verifying chapters back them. Worth cleaning up but lower priority than #1.

## Root cause #4 — Manga-level status not synced from Metadata

`Manga.publicationStatus` is `UNKNOWN` even though the joined `Metadata.status` is `ONGOING` (from AniList). `Manga.lastChecked` and `Manga.lastSyncAt` are both NULL. `Manga.fileStatus` is `PENDING` regardless of how many chapters have files.

These fields are written by separate code paths (not investigated in detail here). They're not gating any current functionality, but they're how the UI badges and filters surface enrichment state.

## Verified evidence

| Claim | Verification |
|---|---|
| Decimal chapters all in Vol 0 | `SELECT chapterNumber, volumeId FROM Chapter WHERE mangaId=4844` shows volumeId=144627 (Vol 0) for every decimal |
| Vol 9 range covers 65.1–69 correctly | `SELECT chapterStart, chapterEnd FROM Volume WHERE mangaId=4844 AND number=9` returns `65.1, 69` |
| MangaDex feed gives correct volume tags | `curl https://api.mangadex.org/manga/.../feed?translatedLanguage[]=en` returns `attributes.volume='9'` for ch.65.1 |
| 22 EN chapters total on MangaDex | API `total: 22` |
| 6 chapters dropped by pages<=0 filter | 6 entries with `attributes.pages=0` (ch.0, 1, 2, 3, 4, 41) |
| Manga.publicationStatus mismatch | `SELECT m."publicationStatus", md.status FROM Manga m JOIN Metadata md ON md.id=m."metadataId"` returns `UNKNOWN, ONGOING` |

## Recommended fix order

1. **`assignSpecialChapters` filter** — biggest visual win; ~5-line change. Restores Vol 9 and Vol 10 to their correct chapter assignments and credits the 26 MB / 34 MB downloads to the right volumes.
2. **`pages <= 0` filter on MangaDex chapter list** — clear single-line change; minor for this title but adds correctness across the library.
3. **Manga-level status sync** — write a small post-enrichment step that fans `Metadata.status` → `Manga.publicationStatus` and stamps `lastChecked`/`lastSyncAt`. Pure bookkeeping.
4. **Empty volume cleanup** — defer until #1 is shipped (it'll change the volume counts).

## Out of scope for this snapshot

- Chapter list completeness across all providers (chapters 5–40 / 42–64 are genuinely not on MangaDex; need to check Fandom/Wikipedia coverage to decide if they're recoverable).
- The 24 empty volume rows that re-enrichment creates beyond Vol 10 (Vols 11–34) — likely the volume creator synthesizing rows from a `lastVolume` field somewhere.
- Chapter 5 in Vol 1 (off-by-one): the comparison logic in `volume-id-backfill.ts:103` is correct (`<=`); the issue is upstream proposal data setting Vol 1's range to 1–5 instead of 1–4. Tied to Bug 2 — fix #2 first and re-evaluate.
