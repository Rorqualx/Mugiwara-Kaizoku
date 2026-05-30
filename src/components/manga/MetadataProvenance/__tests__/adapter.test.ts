import { buildEnhancedProvenance } from '../adapter';

describe('buildEnhancedProvenance', () => {
  it('returns null when no provenance exists for the field', () => {
    expect(buildEnhancedProvenance('status', null, null, null)).toBeNull();
    expect(buildEnhancedProvenance('status', { metadataProvenance: {} }, null, null)).toBeNull();
  });

  it('reads the Phase 0 bare-string provenance shape', () => {
    const result = buildEnhancedProvenance(
      'status',
      { metadataProvenance: { status: 'anilist' } },
      null,
      null,
    );
    expect(result?.provider).toBe('anilist');
    // Pre-Phase-1.5 default confidence = 0.9 → 90%.
    expect(result?.confidence).toBe(90);
  });

  it('reads the Phase 0 object shape with confidence', () => {
    const result = buildEnhancedProvenance(
      'status',
      { metadataProvenance: { status: { provider: 'mangadex', confidence: 0.72 } } },
      null,
      null,
    );
    expect(result?.provider).toBe('mangadex');
    expect(result?.confidence).toBe(72);
  });

  it('prefers the Phase 1.5 selection winner when present', () => {
    const result = buildEnhancedProvenance(
      'status',
      { metadataProvenance: { status: 'anilist' } }, // legacy says anilist
      { selections: { status: { winner: 'mangadex', winnerConfidence: 0.88, dissenterCount: 1 } }, shadowDeltas: null },
      null,
    );
    // Selection winner overrides provenance.
    expect(result?.provider).toBe('mangadex');
    expect(result?.confidence).toBe(88);
  });

  it('populates alternatives from Metadata.fieldAlternatives when available', () => {
    const result = buildEnhancedProvenance(
      'status',
      { metadataProvenance: { status: 'mangadex' } },
      null,
      { status: [{ provider: 'anilist', value: 'RELEASING', confidence: 0.5 }] },
    );
    expect(result?.alternatives).toHaveLength(1);
    expect(result?.alternatives?.[0]?.provider).toBe('anilist');
    expect(result?.alternatives?.[0]?.confidence).toBe(50); // 0.5 → 50%
  });

  it('omits alternatives when neither column nor provenance carries them', () => {
    const result = buildEnhancedProvenance(
      'status',
      { metadataProvenance: { status: 'anilist' } },
      null,
      null,
    );
    expect(result?.alternatives).toBeUndefined();
  });

  it('rejects fieldAlternatives wholesale when any entry is malformed (Zod boundary)', () => {
    const result = buildEnhancedProvenance(
      'status',
      { metadataProvenance: { status: 'mangadex' } },
      null,
      { status: [
        { provider: 'anilist', value: 'X', confidence: 0.5 },
        { provider: 123, confidence: 0.4 }, // wrong type
      ] },
    );
    expect(result?.alternatives).toBeUndefined();
  });

  it('accepts a fully-valid fieldAlternatives payload', () => {
    const result = buildEnhancedProvenance(
      'status',
      { metadataProvenance: { status: 'mangadex' } },
      null,
      { status: [
        { provider: 'anilist', value: 'RELEASING', confidence: 0.5 },
        { provider: 'mal',     value: 'Publishing', confidence: 0.45 },
      ] },
    );
    expect(result?.alternatives).toHaveLength(2);
  });
});
