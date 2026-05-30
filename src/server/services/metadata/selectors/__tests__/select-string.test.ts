import { selectString } from '../select-string';

import type { Candidate, SelectorContext } from '../types';

function ctx(field: SelectorContext['field'], candidates: Candidate[]): SelectorContext {
  return {
    mangaId: 1,
    field,
    fieldType: 'string',
    candidates,
    existingValue: null,
    existingProvider: null,
  };
}

function cand(provider: Candidate['provider'], value: unknown, field: Candidate['field']): Candidate {
  return { field, provider, value, matchConfidence: 0.95 };
}

const SHORT_SUMMARY = 'Too short.'; // < 80 chars
const LONG_AL_SUMMARY = 'Monkey D. Luffy and his crew sail the Grand Line in search of the legendary One Piece treasure that would make him the next Pirate King — a sprawling story of friendship, dreams, and the freedom of the open sea.';
const LONG_MD_SUMMARY = 'Luffy is a boy whose body has stretched like rubber after he ate the Gum-Gum fruit. He and his crew now travel the world in search of the legendary treasure called One Piece. (MangaDex description, English-localized.)';
const JP_SUMMARY = 'モンキー・D・ルフィは海賊王を目指して仲間とともに大海原に乗り出した。'.repeat(4); // long but Japanese

describe('selectString', () => {
  describe('summary', () => {
    it('rejects summaries shorter than the 80-char gate', () => {
      const result = selectString(ctx('summary', [cand('anilist', SHORT_SUMMARY, 'summary')]));
      expect(result.winner).toBeNull();
    });

    it('picks the higher-richness candidate even when authorities are close', () => {
      const result = selectString(ctx('summary', [
        cand('anilist',  LONG_AL_SUMMARY, 'summary'),
        cand('mangadex', LONG_MD_SUMMARY, 'summary'),
      ]));
      expect(result.winner).not.toBeNull();
      expect(result.alternatives).toHaveLength(1);
    });

    it('prefers English text to native-script when both meet the length gate', () => {
      const result = selectString(ctx('summary', [
        cand('anilist',  LONG_AL_SUMMARY, 'summary'),
        cand('mangadex', JP_SUMMARY,      'summary'),
      ]));
      // English signal pushes AL above MD.
      expect(result.winner?.provider).toBe('anilist');
    });

    it('rejects "TBA" / "Unknown" / "Description not available" placeholders', () => {
      const result = selectString(ctx('summary', [
        cand('anilist',  'TBA', 'summary'),
        cand('mangadex', 'Description not available', 'summary'),
      ]));
      expect(result.winner).toBeNull();
    });
  });

  describe('cover', () => {
    it('prefers durable AL/MD CDN URLs over Fandom static URLs', () => {
      const result = selectString(ctx('cover', [
        cand('fandom',  'https://static.wikia.nocookie.net/onepiece/images/x/large.png', 'cover'),
        cand('anilist', 'https://anilist.co/cover/large.jpg', 'cover'),
      ]));
      expect(result.winner?.provider).toBe('anilist');
    });

    it('rejects non-URL strings', () => {
      const result = selectString(ctx('cover', [cand('anilist', 'not a url', 'cover')]));
      expect(result.winner).toBeNull();
    });
  });

  describe('reject', () => {
    it('returns winner=null when all are placeholders', () => {
      const result = selectString(ctx('summary', [
        cand('anilist',  'TBA',     'summary'),
        cand('mangadex', 'unknown', 'summary'),
      ]));
      expect(result.winner).toBeNull();
      expect(result.reason).toContain('no candidates');
    });
  });
});
