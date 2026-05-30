import { collectCandidates, type ProviderClaim } from '../collect-candidates';
import { computeShadowDeltas, runShadowSelection } from '../shadow-mode';

describe('runShadowSelection', () => {
  it('emits one outcome per field that had candidates', () => {
    const claims: ProviderClaim[] = [
      { provider: 'anilist',  matchConfidence: 0.95, fields: { chapters: 100, status: 'RELEASING' } },
      { provider: 'mangadex', matchConfidence: 0.93, fields: { chapters: 100, status: 'completed' } },
      { provider: 'mal',      matchConfidence: 0.92, fields: { status: 'Finished' } },
    ];
    const shadow = runShadowSelection(collectCandidates(claims));
    expect(shadow.outcomes.size).toBe(2);
    expect(shadow.outcomes.get('chapters')?.winnerValue).toBe(100);
    expect(shadow.outcomes.get('status')?.winnerProvider).not.toBe('anilist'); // 2/3 say COMPLETED
  });
});

describe('computeShadowDeltas', () => {
  it('surfaces fields where the selector would change the legacy pick', () => {
    const claims: ProviderClaim[] = [
      { provider: 'anilist',  matchConfidence: 0.95, fields: { status: 'RELEASING' } },
      { provider: 'mangadex', matchConfidence: 0.93, fields: { status: 'completed' } },
      { provider: 'mal',      matchConfidence: 0.92, fields: { status: 'Finished' } },
    ];
    const shadow = runShadowSelection(collectCandidates(claims));
    const deltas = computeShadowDeltas(
      shadow,
      { status: 'RELEASING' },           // legacy Object.assign chain winner
      { status: 'anilist' },              // legacy provenance
    );
    expect(deltas).toHaveLength(1);
    const delta = deltas[0];
    expect(delta?.field).toBe('status');
    expect(delta?.oldProvider).toBe('anilist');
    expect(delta?.newProvider).not.toBe('anilist');
  });

  it('returns no deltas when selector picks match legacy picks', () => {
    const claims: ProviderClaim[] = [
      { provider: 'anilist', matchConfidence: 0.95, fields: { chapters: 100 } },
    ];
    const shadow = runShadowSelection(collectCandidates(claims));
    const deltas = computeShadowDeltas(
      shadow,
      { chapters: 100 },
      { chapters: 'anilist' },
    );
    expect(deltas).toHaveLength(0);
  });
});
