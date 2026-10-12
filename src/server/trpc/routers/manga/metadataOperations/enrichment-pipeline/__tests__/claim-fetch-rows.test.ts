/**
 * @jest-environment node
 */
import { buildUnvotedFragments, resolveFetchVerdicts, type FetchNotes, type FetchVerdict } from '../claim-run/fetch-rows';

import { ALL_OK, fandomSnapshot, snapshot, wikipediaSnapshot } from './claim-test-fixtures';

import type { FetchPhaseSnapshot } from '../claim-run/recorder';

function notes(overrides: Partial<FetchNotes> = {}): FetchNotes {
  return { failures: new Map(), gated: new Map(), preGate: {}, ...overrides };
}

function verdictOf(provider: string, snap: FetchPhaseSnapshot, taken: FetchNotes = notes()): FetchVerdict | undefined {
  return resolveFetchVerdicts(snap, taken).find(v => v.provider === provider);
}

function status(overrides: Record<string, string>): Readonly<Record<string, string>> {
  return { ...ALL_OK, ...overrides };
}

describe('fetch outcome per provider', () => {
  it('records ok with the provider record id when usable data came back', () => {
    const verdict = verdictOf('anilist', snapshot());
    expect(verdict?.outcome).toBe('ok');
    expect(verdict?.recordId).toBe('30012');
  });

  it('records a MAL outage as failed, not as no_match', () => {
    const snap = snapshot({ providerStatus: status({ mal: 'no_match' }), mal: null });
    const verdict = verdictOf('mal', snap, notes({ failures: new Map([['mal', 'This operation was aborted']]) }));
    expect(verdict?.outcome).toBe('failed');
    expect(verdict?.detail['reason']).toBe('This operation was aborted');
  });

  it('names the MAL record that was asked for on a failed MAL row', () => {
    const base = snapshot();
    const fromAniList = snapshot({ providerStatus: status({ mal: 'no_match' }), mal: null });
    const fromMangaDex = snapshot({
      providerStatus: status({ mal: 'no_match' }), mal: null,
      anilist: { id: 30012, details: { idMal: null } },
      mangadex: base.mangadex ? { ...base.mangadex, malId: 4455 } : null,
    });
    const failed = notes({ failures: new Map([['mal', 'http_403']]) });

    expect(verdictOf('mal', fromAniList, failed)?.recordId).toBe('12');
    expect(verdictOf('mal', fromMangaDex, failed)?.recordId).toBe('4455');
  });

  it('records no_match when MAL was asked, answered, and has nothing', () => {
    const snap = snapshot({ providerStatus: status({ mal: 'no_match' }), mal: null });
    expect(verdictOf('mal', snap)?.outcome).toBe('no_match');
  });

  it('records MAL as skipped when no provider supplied a MAL id to ask with', () => {
    const base = snapshot();
    const snap = snapshot({
      providerStatus: status({ mal: 'no_match' }), mal: null,
      anilist: { id: 30012, details: { idMal: null } },
      mangadex: base.mangadex ? { ...base.mangadex, malId: undefined } : null,
    });
    const verdict = verdictOf('mal', snap);
    expect(verdict?.outcome).toBe('skipped');
    expect(verdict?.detail['reason']).toBe('no_mal_id');
  });

  it('records a disabled provider and a user-unbound provider as skipped', () => {
    const base = snapshot();
    const snap = snapshot({
      providerStatus: status({ kitsu: 'disabled', comicvine: 'no_match' }), kitsu: null, comicvine: null,
      directives: { ...base.directives, comicvine: { pin: { kind: 'unbound' } } },
    });
    expect(verdictOf('kitsu', snap)?.detail['reason']).toBe('disabled');
    expect(verdictOf('kitsu', snap)?.outcome).toBe('skipped');
    expect(verdictOf('comicvine', snap)?.outcome).toBe('skipped');
    expect(verdictOf('comicvine', snap)?.detail['reason']).toBe('unbound');
  });

  it('records a timeout and a thrown error as failed', () => {
    const snap = snapshot({ providerStatus: status({ mangadex: 'timeout', mangaupdates: 'error' }), mangadex: null, mangaupdates: null });
    expect(verdictOf('mangadex', snap)?.outcome).toBe('failed');
    expect(verdictOf('mangadex', snap)?.detail['reason']).toBe('timeout');
    expect(verdictOf('mangaupdates', snap)?.outcome).toBe('failed');
  });

  it('records a fetch the cross-series gate emptied as gated, with what it held before the gate', () => {
    const preGate = fandomSnapshot(700, [[1, 1, 7], [2, 8, 16]]);
    const snap = snapshot({ fandom: { ...preGate, chapterList: [], volumeList: [] } });
    const verdict = verdictOf('fandom', snap, notes({
      gated: new Map([['fandom', '>2x AniList (700 vs 147)']]), preGate: { fandom: preGate },
    }));

    expect(verdict?.outcome).toBe('gated');
    expect(verdict?.detail).toMatchObject({ reason: '>2x AniList (700 vs 147)', chapterListLength: 700, volumeListLength: 2 });
    expect(verdict?.recordId).toBe(preGate.url);
  });

  it('does not record ok for a Fandom page the parser got nothing from', () => {
    const failedParse = verdictOf('fandom', snapshot({ fandom: fandomSnapshot(0, [], false) }));
    const emptyParse = verdictOf('fandom', snapshot({ fandom: fandomSnapshot(0, []) }));
    expect(failedParse?.outcome).toBe('failed');
    expect(failedParse?.detail['reason']).toBe('parse_failed');
    expect(emptyParse?.outcome).toBe('no_match');
  });

  it('does not record ok for a Wikipedia article with no counts and no lists', () => {
    expect(verdictOf('wikipedia', snapshot({ wikipedia: wikipediaSnapshot() }))?.outcome).toBe('no_match');
    expect(verdictOf('wikipedia', snapshot({ wikipedia: wikipediaSnapshot({ volumes: 74 }) }))?.outcome).toBe('ok');
  });

  it('keeps the phase\'s own status beside the recorded outcome', () => {
    const snap = snapshot({ providerStatus: status({ mal: 'no_match' }), mal: null });
    const verdict = verdictOf('mal', snap, notes({ failures: new Map([['mal', 'http_503']]) }));
    expect(verdict?.detail['phaseStatus']).toBe('no_match');
  });
});

describe('values no selector votes on', () => {
  it('records MangaDex\'s stated last chapter and volume and ComicVine\'s issue count as the providers gave them', () => {
    const rows = buildUnvotedFragments(snapshot(), {});
    const value = (provider: string, field: string): unknown => rows.find(r => r.provider === provider && r.field === field)?.value;

    expect(value('mangadex', 'lastChapter')).toBe('686');
    expect(value('mangadex', 'lastVolume')).toBe('74');
    expect(value('comicvine', 'issueCount')).toBe(3);
    expect(value('wikipedia', 'chapters')).toBe(686);
    expect(rows.every(r => r.selectorOutcome === 'not_compared')).toBe(true);
  });

  it('reads a gated wiki\'s counts from before the gate', () => {
    const preGate = fandomSnapshot(700, []);
    const rows = buildUnvotedFragments(snapshot({ fandom: { ...preGate, chapterList: [] } }), { fandom: preGate });
    expect(rows.find(r => r.provider === 'fandom' && r.field === 'highestChapter')?.value).toBe(700);
  });

  it('writes no row for a value the provider did not state', () => {
    const base = snapshot();
    const rows = buildUnvotedFragments(snapshot({
      mangadex: base.mangadex ? { ...base.mangadex, lastChapter: undefined, lastVolume: '' } : null,
      wikipedia: wikipediaSnapshot({ chapters: 0 }),
    }), {});
    expect(rows.some(r => r.provider === 'mangadex' && r.field === 'lastChapter')).toBe(false);
    // MangaDex reports an unknown last volume as an empty string.
    expect(rows.some(r => r.provider === 'mangadex' && r.field === 'lastVolume')).toBe(false);
    expect(rows.some(r => r.provider === 'wikipedia' && r.field === 'chapters')).toBe(false);
  });
});
