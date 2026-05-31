/**
 * Table-driven tests for the Prowlarr relevance gate.
 *
 * The Akira incident (manga 80) is the seed case: a search for "Akira"
 * surfaced "Akira Failing in Love" and "Momose Akira no Hatsukoi
 * Hatan-chuu" — both scored 145, both wrong. The gate must reject those
 * while leaving every other realistic release untouched.
 *
 * Each row covers a single canonical (title + synonyms) and a release
 * title; the `expect` column is the function's return value (true =
 * REJECT, false = ALLOW).
 */

import { describe, it, expect } from '@jest/globals';

import { shouldRejectByForeignTokens } from '../relevance-gate';

interface Case {
  name: string;
  canonical: string;
  synonyms: string[];
  release: string;
  reject: boolean;
}

const cases: Case[] = [
  // ─── The Akira incident ─────────────────────────────────────────────
  {
    name: 'Akira: drops "Akira Failing in Love" (the wrong-target hit)',
    canonical: 'Akira', synonyms: ['アキラ', 'AKIRA'],
    release: 'Akira Failing in Love v01-02 (2026) (Digital) (Rillant)',
    reject: true,
  },
  {
    name: 'Akira: drops "Momose Akira no Hatsukoi" (the other wrong-target hit)',
    canonical: 'Akira', synonyms: ['アキラ', 'AKIRA'],
    release: 'Momose Akira no Hatsukoi Hatan-chuu. | Akira Failing in Love v01 + 041-074 (2025-2026) (Digital) (1r0n)',
    reject: true,
  },
  {
    name: 'Akira: allows a real Otomo-pack release',
    canonical: 'Akira', synonyms: ['アキラ', 'AKIRA'],
    release: 'Akira v01-06 (Otomo) (Digital)',
    reject: false,
  },
  {
    name: 'Akira: allows a scanlator-bracketed chapter release',
    canonical: 'Akira', synonyms: ['アキラ'],
    release: '[Group] Akira c001 (2024)',
    reject: false,
  },
  {
    name: 'Akira: allows a year-only release',
    canonical: 'Akira', synonyms: [],
    release: 'Akira (1982)',
    reject: false,
  },

  // ─── Multi-token canonical: pass-through ───────────────────────────
  {
    name: 'Attack on Titan: synonym match lets Shingeki no Kyojin through',
    canonical: 'Attack on Titan', synonyms: ['Shingeki no Kyojin'],
    release: 'Shingeki no Kyojin (Attack on Titan) - Vol. 09',
    reject: false,
  },
  {
    name: 'One Piece: classic v01-95 pack passes (multi-token canonical)',
    canonical: 'One Piece', synonyms: [],
    release: 'One Piece v01-95 (2020) (Digital)',
    reject: false,
  },

  // ─── Single-token, long: escape via length ─────────────────────────
  {
    name: 'Berserk: Deluxe Edition release survives (7 chars > gate)',
    canonical: 'Berserk', synonyms: [],
    release: 'Berserk Deluxe Edition v01 (2019)',
    reject: false,
  },
  {
    name: 'Vagabond: 8-char canonical escapes regardless of qualifiers',
    canonical: 'Vagabond', synonyms: [],
    release: 'Vagabond Color Edition v01 [HQ]',
    reject: false,
  },

  // ─── Single-token, exactly at the threshold ────────────────────────
  {
    name: 'Naruto: bare v01-72 pack passes',
    canonical: 'Naruto', synonyms: [],
    release: 'Naruto v01-72 (2003-2014) (Digital)',
    reject: false,
  },
  {
    name: 'Naruto: rejects "Naruto Gaiden" spinoff (foreign token)',
    canonical: 'Naruto', synonyms: [],
    release: 'Naruto Gaiden v01',
    reject: true,
  },
  {
    name: 'Bleach: allows Color Edition (qualifiers are not foreign)',
    canonical: 'Bleach', synonyms: [],
    release: 'Bleach Color Edition v01-10',
    reject: false,
  },
  {
    name: 'Bleach: rejects "Bleach Burn the Witch" crossover',
    canonical: 'Bleach', synonyms: [],
    release: 'Bleach Burn the Witch v01',
    reject: true,
  },

  // ─── Single-token, short: classic Goku-class wrong target ──────────
  {
    name: 'Goku: drops "Goku Midnight Eye" (different work, same first token)',
    canonical: 'Goku', synonyms: ['孫悟空'],
    release: 'Goku Midnight Eye v01-02',
    reject: true,
  },

  // ─── Defensive: no canonical → never reject ────────────────────────
  {
    name: 'Empty accepted titles → never reject (pure discovery)',
    canonical: '', synonyms: [],
    release: 'Anything Goes Here v01',
    reject: false,
  },
  {
    name: 'Empty release title → never reject (no tokens to evaluate)',
    canonical: 'Akira', synonyms: [],
    release: '',
    reject: false,
  },
];

describe('shouldRejectByForeignTokens', () => {
  for (const c of cases) {
    it(c.name, () => {
      const accepted = [c.canonical, ...c.synonyms].filter((t) => t.length > 0);
      expect(shouldRejectByForeignTokens(c.release, accepted)).toBe(c.reject);
    });
  }
});
