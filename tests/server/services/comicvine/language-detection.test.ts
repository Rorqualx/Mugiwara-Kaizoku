/**
 * @jest-environment node
 *
 * ComicVine language-detection gate tests
 *
 * Locks in the 2026-06-12 language-gate audit fixes. The user-visible bug:
 * Polish (and other unmodeled-language) editions were bound under an
 * English preference because:
 *   1. The ASCII-script fallback voted 'en' for any Polish edition that
 *      keeps the romaji title (Waneko's "Kaiju No. 8" → en @ 0.6).
 *   2. LANGUAGE_CONFIGS had no Polish publishers even though
 *      NON_ENGLISH_PUBLISHERS (constants.ts) lists them — the bridge added
 *      in this fix returns 'unknown' @ 0.8 for that catalog, which fails
 *      the matcher's `=== preferredLanguage` gate.
 *   3. Substring publisher matching produced authoritative misdetections
 *      ("Viking Press" → zh via 'king', "Shueisha" → de via 'eis', any
 *      "* Comics" publisher → ja via 'comi').
 */

import {
  detectFromContent,
  detectFromPublisher,
  detectFromVolumeName,
  normalizeForWordMatch,
} from '@/server/services/comicvine/language-detection/content-detection';
import { detectNonEnglishVariant } from '@/server/services/search/providers/comicvine-language-filter';

describe('detectFromPublisher — unmodeled non-English publishers bridge to unknown', () => {
  it.each([
    'Waneko',
    'Studio JG',
    'Kotori',
    'Hanami',
    'Japonica Polonica Fantastica',
    'J.P.Fantastica', // ComicVine's styling of JPF
  ])('Polish publisher "%s" → unknown (authoritative)', (publisher) => {
    const result = detectFromPublisher(publisher);
    expect(result.match).toBe(true);
    expect(result.language).toBe('unknown');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('modeled languages still win over the bridge', () => {
    expect(detectFromPublisher('VIZ Media').language).toBe('en');
    expect(detectFromPublisher('Shueisha').language).toBe('ja');
    expect(detectFromPublisher('Glénat Manga').language).toBe('fr');
    expect(detectFromPublisher('Kodansha Comics USA').language).toBe('en');
  });
});

describe('detectFromPublisher — word-boundary matching (no substring false positives)', () => {
  it('"Viking Press" no longer matches Chinese entry "king"', () => {
    expect(detectFromPublisher('Viking Press').language).not.toBe('zh');
  });

  it('"Samurai Comics" no longer matches Korean entry "sam"', () => {
    expect(detectFromPublisher('Samurai Comics').language).not.toBe('ko');
  });

  it('publishers containing "Comics" no longer match Japanese entry "comi"', () => {
    // Titan Comics is not in any list — must not be detected as Japanese.
    const result = detectFromPublisher('Titan Comics');
    expect(result.language).not.toBe('ja');
  });

  it('multi-word entries still match across punctuation', () => {
    expect(detectFromPublisher('BOOM! Studios').language).toBe('en');
    expect(detectFromPublisher('Dark Horse Comics').language).toBe('en');
  });
});

describe('detectFromContent — Polish editions rejected under English preference', () => {
  it('Waneko volume keeping the romaji title is NOT detected as English', () => {
    const result = detectFromContent('Waneko', 'Kaiju No. 8', '', 'Kaiju No. 8');
    expect(result.detectedLanguage).toBe('unknown');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('Studio JG volume with self-identifying description stays unknown', () => {
    const result = detectFromContent(
      'Studio JG',
      'Kaiju No. 8',
      'Polish edition of Kaiju No. 8 manga published by Studio JG.',
      'Kaiju No. 8',
    );
    expect(result.detectedLanguage).toBe('unknown');
  });

  it('J.P.Fantastica with a Polish-language title is NOT detected as English', () => {
    const result = detectFromContent('Japonica Polonica Fantastica', 'Czarodziejka z Księżyca', '');
    expect(result.detectedLanguage).toBe('unknown');
  });

  it('genuine English edition is still detected as English', () => {
    const result = detectFromContent('VIZ Media', 'Kaiju No. 8', 'The English edition.');
    expect(result.detectedLanguage).toBe('en');
  });

  it('unknown publisher with plain ASCII title still defaults to English (unchanged)', () => {
    // Publishers in neither catalog keep the legacy script-fallback behavior;
    // rejecting these would throw away legitimate English indie volumes.
    const result = detectFromContent('Some Tiny Indie Press', 'A Plain Title', '');
    expect(result.detectedLanguage).toBe('en');
  });
});

describe('detectFromVolumeName — edition markers', () => {
  it('detects "VF" case-insensitively as French', () => {
    expect(detectFromVolumeName('One Piece VF').language).toBe('fr');
    expect(detectFromVolumeName('one piece vf').language).toBe('fr');
  });

  it('detects Polish edition markers as unknown', () => {
    expect(detectFromVolumeName('Kaiju No. 8 (Polish Edition)').language).toBe('unknown');
    expect(detectFromVolumeName('Atak Tytanów — wydanie polskie').language).toBe('unknown');
  });

  it('still detects modeled edition markers', () => {
    expect(detectFromVolumeName('One Piece (French Edition)').language).toBe('fr');
    expect(detectFromVolumeName('Naruto English Edition').language).toBe('en');
  });
});

describe('detectNonEnglishVariant (search filter) — word-boundary publisher matching', () => {
  it('flags Polish publishers as non-English', () => {
    expect(detectNonEnglishVariant('Kaiju No. 8', 'Waneko').isNonEnglish).toBe(true);
    expect(detectNonEnglishVariant('Naruto', 'JPF').isNonEnglish).toBe(true);
  });

  it('does not flag English publishers via substring collision', () => {
    // 'conrad' is a non-English entry; "Conrad Press Ltd" would match on the
    // word, but "Viking Press" must not match 'king' nor "Shueisha USA" 'eis'.
    expect(detectNonEnglishVariant('Some Book', 'Viking Press').isNonEnglish).toBe(false);
  });

  it('English allowlist still wins over parent-publisher names', () => {
    expect(detectNonEnglishVariant('Attack on Titan', 'Kodansha Comics USA').isNonEnglish).toBe(false);
    expect(detectNonEnglishVariant('Spy x Family', 'VIZ Media LLC').isNonEnglish).toBe(false);
  });

  it('diacritic folding still matches accented list entries', () => {
    expect(detectNonEnglishVariant('One Piece', 'Glenat').isNonEnglish).toBe(true);
    expect(detectNonEnglishVariant('One Piece', 'Glénat Manga').isNonEnglish).toBe(true);
  });
});

describe('normalizeForWordMatch', () => {
  it('pads, lowercases, folds diacritics, collapses punctuation', () => {
    expect(normalizeForWordMatch('Glénat Manga')).toBe(' glenat manga ');
    expect(normalizeForWordMatch('BOOM! Studios')).toBe(' boom studios ');
    expect(normalizeForWordMatch('J-Novel Club')).toBe(' j novel club ');
  });

  it('empty input yields no spurious matches', () => {
    expect(normalizeForWordMatch('').includes(normalizeForWordMatch('viz'))).toBe(false);
  });
});
