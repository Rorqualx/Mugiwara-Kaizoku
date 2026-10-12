/**
 * Fetch outcomes and unvoted provider values.
 *
 * The fetch phase reports `ok` for any provider that returned an object, and
 * `no_match` for every null — including a client that swallowed an outage.
 * This module turns that, plus the notes taken during the run, into the
 * outcome the claims table stores: `ok` only when usable data survived.
 *
 * Pure: no database, no network.
 */

import type { ClaimFetchOutcome, ClaimJson } from '@/server/services/metadata/provider-claims/claim-types';

import type { FandomSnapshot, FetchPhaseSnapshot, PreGateSnapshot, WikipediaSnapshot } from './recorder';
import type { ScalarFragment } from './selector-rows';

export interface FetchVerdict {
  provider: string;
  outcome: ClaimFetchOutcome;
  recordId: string | null;
  detail: { [key: string]: ClaimJson };
}

/** Notes taken while the run was in flight. */
export interface FetchNotes {
  /** provider → reason, for failures the phase's own tracker cannot see. */
  failures: ReadonlyMap<string, string>;
  /** provider → gate reason. */
  gated: ReadonlyMap<string, string>;
  preGate: PreGateSnapshot;
}

type Verdict = { outcome: ClaimFetchOutcome; reason?: string };

function isUnbound(provider: string, snapshot: FetchPhaseSnapshot): boolean {
  const { directives } = snapshot;
  if (provider === 'mal') return directives.malUnbound;
  if (provider === 'mangadex') return directives.mangadex.pin.kind === 'unbound';
  if (provider === 'mangaupdates') return directives.mangaupdates.pin.kind === 'unbound';
  if (provider === 'kitsu') return directives.kitsu.pin.kind === 'unbound';
  if (provider === 'comicvine') return directives.comicvine.pin.kind === 'unbound';
  return false;
}

function hasMalId(snapshot: FetchPhaseSnapshot): boolean {
  const fromAniList = snapshot.anilist?.details.idMal;
  const fromMangaDex = snapshot.mangadex?.malId;
  return (typeof fromAniList === 'number' && fromAniList > 0) || (typeof fromMangaDex === 'number' && fromMangaDex > 0);
}

/** An object came back — did anything usable come with it? */
function verdictForAnswer(provider: string, snapshot: FetchPhaseSnapshot): Verdict {
  if (provider === 'fandom' && snapshot.fandom) {
    const { parseSuccess, chapterList, volumeList } = snapshot.fandom;
    if (!parseSuccess) return { outcome: 'failed', reason: 'parse_failed' };
    if (chapterList.length === 0 && volumeList.length === 0) return { outcome: 'no_match', reason: 'empty_lists' };
  }
  if (provider === 'wikipedia' && snapshot.wikipedia) {
    const { data, chapterList } = snapshot.wikipedia;
    const stated = (data.chapters ?? 0) > 0 || (data.volumes ?? 0) > 0;
    if (!stated && chapterList.length === 0 && (data.volumeList ?? []).length === 0) {
      return { outcome: 'no_match', reason: 'empty_article' };
    }
  }
  return { outcome: 'ok' };
}

function verdictForNoAnswer(provider: string, snapshot: FetchPhaseSnapshot, notes: FetchNotes): Verdict {
  const failure = notes.failures.get(provider);
  if (failure !== undefined) return { outcome: 'failed', reason: failure };
  if (isUnbound(provider, snapshot)) return { outcome: 'skipped', reason: 'unbound' };
  // MAL has no search of its own: without an id from AniList or MangaDex it was never asked.
  if (provider === 'mal' && !hasMalId(snapshot)) return { outcome: 'skipped', reason: 'no_mal_id' };
  return { outcome: 'no_match' };
}

function resolveVerdict(provider: string, status: string, snapshot: FetchPhaseSnapshot, notes: FetchNotes): Verdict {
  const gateReason = notes.gated.get(provider);
  if (gateReason !== undefined) return { outcome: 'gated', reason: gateReason };
  if (status === 'disabled') return { outcome: 'skipped', reason: 'disabled' };
  if (status === 'timeout' || status === 'error') return { outcome: 'failed', reason: status };
  if (status === 'ok') return verdictForAnswer(provider, snapshot);
  if (status === 'no_match') return verdictForNoAnswer(provider, snapshot, notes);
  return { outcome: 'failed', reason: `unknown_status:${status}` };
}

function wikipediaRecordId(wikipedia: WikipediaSnapshot | undefined | null): string | null {
  if (!wikipedia) return null;
  return wikipedia.data.volumeListUrl ?? wikipedia.data.wikipediaUrl ?? wikipedia.data.title;
}

function idText(id: number | string | undefined): string | null {
  return id === undefined ? null : String(id);
}

type RecordIdReader = (snapshot: FetchPhaseSnapshot, preGate: PreGateSnapshot) => string | null;

const RECORD_ID_READERS: Readonly<Record<string, RecordIdReader>> = {
  anilist: snapshot => idText(snapshot.anilist?.id),
  mangadex: snapshot => idText(snapshot.mangadex?.mangaId),
  comicvine: snapshot => idText(snapshot.comicvine?.volumeId),
  mangaupdates: snapshot => idText(snapshot.mangaupdates?.seriesId),
  kitsu: snapshot => idText(snapshot.kitsu?.kitsuId),
  mal: snapshot => idText(snapshot.mal?.malId),
  fandom: (snapshot, preGate) => idText((preGate.fandom ?? snapshot.fandom)?.url),
  wikipedia: (snapshot, preGate) => wikipediaRecordId(preGate.wikipedia ?? snapshot.wikipedia),
};

function recordIdFor(provider: string, snapshot: FetchPhaseSnapshot, preGate: PreGateSnapshot): string | null {
  return RECORD_ID_READERS[provider]?.(snapshot, preGate) ?? null;
}

function sizesFor(provider: string, snapshot: FetchPhaseSnapshot, preGate: PreGateSnapshot): { [key: string]: ClaimJson } {
  if (provider === 'fandom') {
    const fandom = preGate.fandom ?? snapshot.fandom;
    return fandom
      ? { parseSuccess: fandom.parseSuccess, chapterListLength: fandom.chapterList.length, volumeListLength: fandom.volumeList.length }
      : {};
  }
  if (provider === 'wikipedia') {
    const wikipedia = preGate.wikipedia ?? snapshot.wikipedia;
    return wikipedia
      ? { chapterListLength: wikipedia.chapterList.length, volumeListLength: (wikipedia.data.volumeList ?? []).length }
      : {};
  }
  if (provider === 'mangadex' && snapshot.mangadex) {
    return {
      chapterListLength: snapshot.mangadex.chapterList.length,
      aggregateVolumes: snapshot.mangadex.aggregate?.volumes.length ?? 0,
    };
  }
  if (provider === 'comicvine' && snapshot.comicvine) return { issueCount: snapshot.comicvine.issues.length };
  return {};
}

/** One verdict per provider the fetch phase reported on, in its order. */
export function resolveFetchVerdicts(snapshot: FetchPhaseSnapshot, notes: FetchNotes): FetchVerdict[] {
  return Object.entries(snapshot.providerStatus).map(([provider, status]) => {
    const verdict = resolveVerdict(provider, status, snapshot, notes);
    return {
      provider,
      outcome: verdict.outcome,
      recordId: recordIdFor(provider, snapshot, notes.preGate),
      detail: {
        phaseStatus: status,
        ...(verdict.reason !== undefined ? { reason: verdict.reason } : {}),
        ...sizesFor(provider, snapshot, notes.preGate),
      },
    };
  });
}

function highestNumber(list: ReadonlyArray<{ number: number }>): number | null {
  let highest: number | null = null;
  for (const item of list) {
    if (typeof item.number === 'number' && Number.isFinite(item.number) && (highest === null || item.number > highest)) {
      highest = item.number;
    }
  }
  return highest;
}

function unvoted(provider: string, field: string, value: ClaimJson | null | undefined): ScalarFragment[] {
  if (value === null || value === undefined) return [];
  // MangaDex sends "" for a last chapter/volume it does not know: not a value.
  if (typeof value === 'string' && value.trim().length === 0) return [];
  return [{
    provider, field, value,
    selectorOutcome: 'not_compared', inWinningGroup: null, matchConfidence: null, fieldConfidence: null,
  }];
}

function positive(n: number | undefined): number | undefined {
  return typeof n === 'number' && n > 0 ? n : undefined;
}

function fandomUnvoted(fandom: FandomSnapshot | null | undefined): ScalarFragment[] {
  if (!fandom || fandom.chapterList.length === 0) return [];
  return [
    ...unvoted('fandom', 'chapterListLength', fandom.chapterList.length),
    ...unvoted('fandom', 'highestChapter', highestNumber(fandom.chapterList)),
  ];
}

function wikipediaUnvoted(wikipedia: WikipediaSnapshot | null | undefined): ScalarFragment[] {
  if (!wikipedia) return [];
  // `chapterList` is padded up to another provider's count, so its length is
  // not Wikipedia's claim; `ownChapterCount` and the stated totals are.
  return [
    ...unvoted('wikipedia', 'chapters', positive(wikipedia.data.chapters)),
    ...unvoted('wikipedia', 'volumes', positive(wikipedia.data.volumes)),
    ...unvoted('wikipedia', 'ownChapterCount', positive(wikipedia.ownChapterCount)),
  ];
}

/**
 * Values a provider stated that the selector never votes on: MangaDex's
 * stated last chapter/volume, ComicVine's issue count, the wikis' own counts.
 * Wiki values are read from the pre-gate result when the gate fired.
 */
export function buildUnvotedFragments(snapshot: FetchPhaseSnapshot, preGate: PreGateSnapshot): ScalarFragment[] {
  const { mangadex, comicvine } = snapshot;
  return [
    ...(mangadex ? [
      ...unvoted('mangadex', 'lastChapter', mangadex.lastChapter),
      ...unvoted('mangadex', 'lastVolume', mangadex.lastVolume),
      ...unvoted('mangadex', 'chapterListLength', positive(mangadex.chapterList.length)),
      ...unvoted('mangadex', 'highestChapter', highestNumber(mangadex.chapterList)),
    ] : []),
    ...(comicvine ? unvoted('comicvine', 'issueCount', comicvine.issues.length) : []),
    ...fandomUnvoted(preGate.fandom ?? snapshot.fandom),
    ...wikipediaUnvoted(preGate.wikipedia ?? snapshot.wikipedia),
  ];
}
