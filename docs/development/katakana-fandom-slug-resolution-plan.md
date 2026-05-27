# Katakana → Fandom Slug Resolution — Design Plan

*Status: Draft (2026-05-27)*
*Closes the last Fandom miss in the bind-loop harness (#2127 Strike Witches → `worldwitches`)*

## Problem statement

The bind-loop harness's last Fandom miss is **#2127 Strike Witches → `worldwitches.fandom.com`**.

After Stage A.0 (Wikidata in `backfill-merged-synonyms.ts`), the manga's
`Metadata.synonyms` now contains:

```
ワールドウィッチーズ    ← franchise alias (JP katakana, sourced from Wikidata Q1202631)
ストライクウィッチーズ  ← franchise canonical (JP katakana)
Strike Witches          ← franchise English name
Strike Witches Zero…    ← work-specific titles
(+ 30 more variants in 8 languages)
```

`enrich-fandom-slugs.ts:slugVariants()` strips all non-ASCII characters
before slugging, so the only Latin-script source for a "worldwitches"-style
slug is the canonical English name **"Strike Witches"** — which slugs to
`strikewitches`, not `worldwitches`. The franchise alias is the only string
in the entire DB that would give us the right subdomain, and it's in JP
katakana.

We need the slug-guess to derive `worldwitches` from `ワールドウィッチーズ`.

---

## Why this is hard

`ワールドウィッチーズ` is **English written in katakana**, not a Japanese
word. Mechanical Hepburn romanization gives:

- Strict Hepburn: `Wārudo Witchīzu` → slug `waarudowitchiizu`
- Waapuro romaji: `Waarudo Witchiizu` → slug `waarudowitchiizu`
- Modified Hepburn no-macron: `Warudo Witchizu` → slug `warudowitchizu`

None of these match the Fandom subdomain `worldwitches`. The wiki uses
the **source English words** ("World" + "Witches"), not the romanized
katakana.

This is the **katakana-as-English-loanword** problem. Roughly 50% of
common katakana terms are loanwords from English (and another 30% from
other European languages). Recovering the source English requires either
a curated mapping or external lookup.

---

## Proposed solution: 4-layer fall-through strategy

For each katakana ref, the slug-guess tries strategies in order and
stops at the first match that resolves to a live Fandom wiki.

### Layer 1 — Wikidata graph traversal (cheap, often skips need for transliteration)

Before mechanical transliteration, check whether Wikidata exposes a Latin
alias on a **related entity**:

```
Given mangaQid (e.g. Q98823959 Strike Witches Zero: 1937):
  for each Q in (forward P361/P179/P1434, reverse P527/P361):
    for each label/alias on Q across all languages:
      if it's Latin-script:
        slug it and try as Fandom subdomain
```

For Strike Witches, `Q1202631` (franchise) does NOT have "World Witches"
in any Latin-script label, but `Q98821914` (anime TV series) or
`Q112623791` (universe) might via their own aliases. Worth checking before
falling back to mechanical romanization.

This costs **0 extra API calls** beyond what Stage A.0 already fetched
(we already have the franchise entities cached).

### Layer 2 — Strict katakana → Hepburn romaji (mechanical)

Use a small katakana → romaji table (~50 entries). Implementation either
inline or via a tiny dep like `wanakana`. Generates candidates:

```
ワールドウィッチーズ → Hepburn `Wārudo Witchīzu` → slug `waarudowitchiizu`
                    → no-macron `Warudo Witchizu` → slug `warudowitchizu`
                    → no-spaces `Waarudowitchiizu` → slug `waarudowitchiizu`
```

Doesn't catch Strike Witches but DOES catch other cases like
katakana titles that ARE proper Japanese words (not English loanwords).

### Layer 3 — English-loanword back-transliteration (curated dictionary)

Maintain a small dictionary of common katakana → English mappings for
words that appear in franchise/wiki names. Initial seed (~50 entries):

```ts
const KATAKANA_TO_ENGLISH: Record<string, string[]> = {
  'ワールド':       ['world'],
  'ウィッチ':       ['witch'],
  'ウィッチーズ':   ['witches'],
  'ヒーロー':       ['hero'],
  'ヒーローズ':     ['heroes'],
  'ガール':         ['girl'],
  'ガールズ':       ['girls'],
  'ボーイ':         ['boy'],
  'ボーイズ':       ['boys'],
  'プロジェクト':   ['project'],
  'ストーリー':     ['story'],
  'マスター':       ['master'],
  'ファイト':       ['fight'],
  'バトル':         ['battle'],
  'ファンタジー':   ['fantasy'],
  'マジック':       ['magic'],
  'クラブ':         ['club'],
  'スクール':       ['school'],
  'ハイ':           ['high'],
  'スター':         ['star'],
  'スターズ':       ['stars'],
  'ライト':         ['light'],
  'ナイト':         ['night', 'knight'],
  'ファイア':       ['fire'],
  'アイス':         ['ice'],
  // … extend over time as new cases surface in the bind-loop
};
```

Algorithm — tokenize on `ー` (long-vowel marker) and katakana word
boundaries, look up each token, generate cross-product:

```
ワールドウィッチーズ
  → tokens: [ワールド, ウィッチーズ]
  → lookups: [[world], [witches]]
  → candidates: ['worldwitches', 'world-witches', 'world witches']
  → try each as Fandom subdomain
```

For Strike Witches this immediately gives `worldwitches` → ✅ match.

Catches franchise/wiki names that AniList doesn't expose in English
(e.g. anything with a katakana-only franchise umbrella).

### Layer 4 — Wiktionary loanword lookup (last resort, rate-limited)

For any katakana token NOT in the curated dictionary, query Wiktionary:

```
https://en.wiktionary.org/api/rest_v1/page/definition/ワールド
→ JSON with etymology[] entries
→ look for "From English world" patterns
→ extract "world"
```

Expensive (1 API call per unknown token), so cache results in a sidecar
JSON file that the script reads/writes:

```
scripts/surveys/bind-loop/katakana-loanword-cache.json
{
  "ワールド": "world",
  "ウィッチーズ": "witches",
  // …
}
```

Auto-populates the curated dictionary over time. New tokens trigger
1 Wiktionary call; subsequent runs hit the cache.

---

## Algorithm — putting it together

```ts
async function katakanaToFandomSlugs(refs: string[], mangaQid: string | null): Promise<string[]> {
  const slugs = new Set<string>();

  // Layer 1: Wikidata sibling/parent Latin aliases (free, uses cached entities)
  if (mangaQid !== null) {
    for (const relatedQid of getRelatedQids(mangaQid)) {
      for (const latin of latinAliasesOf(cachedEntity(relatedQid))) {
        for (const s of slugify(latin)) slugs.add(s);
      }
    }
  }

  // Layers 2, 3, 4 — only for katakana refs
  for (const ref of refs.filter(isKatakana)) {

    // Layer 2: strict Hepburn
    slugs.add(slugify(katakanaToHepburn(ref)));
    slugs.add(slugify(katakanaToHepburn(ref, { noMacron: true })));

    // Layer 3: English back-transliteration via curated dictionary
    const tokens = tokenizeKatakana(ref);
    const lookups = tokens.map(t => KATAKANA_TO_ENGLISH[t] ?? null);
    if (lookups.every(l => l !== null)) {
      for (const combo of crossProduct(lookups)) {
        slugs.add(combo.join(''));
        slugs.add(combo.join('-'));
      }
    }

    // Layer 4: fill in unknowns via Wiktionary (rate-limited + cached)
    if (lookups.some(l => l === null)) {
      const resolved = await Promise.all(tokens.map(t =>
        KATAKANA_TO_ENGLISH[t]?.[0] ?? wiktionaryLoanwordCached(t)
      ));
      if (resolved.every(r => r !== null)) {
        slugs.add(resolved.join(''));
        slugs.add(resolved.join('-'));
      }
    }
  }

  return [...slugs].filter(s => s.length >= 3 && s.length <= 40);
}
```

---

## New files

| File | Purpose |
|---|---|
| `scripts/surveys/bind-loop/katakana-romanizer.ts` | Pure: Layer 2 strict Hepburn (table-based, ~80 LOC) |
| `scripts/surveys/bind-loop/katakana-loanwords.ts` | Curated dictionary (Layer 3) — seeded with ~50 entries, grows over time |
| `scripts/surveys/bind-loop/katakana-loanword-cache.json` | Layer-4 Wiktionary cache (auto-managed) |
| `scripts/surveys/bind-loop/wiktionary-client.ts` | Pure: Wiktionary REST API client + etymology parser |
| `scripts/surveys/bind-loop/__tests__/katakana.test.ts` | Unit tests for each layer |

## Modified files

| File | Change |
|---|---|
| `scripts/surveys/bind-loop/enrich-fandom-slugs.ts` | Wire `katakanaToFandomSlugs` into the candidate set, alongside existing `slugVariants` and `authorSlugs` |
| `scripts/surveys/bind-loop/enrich-fandom-slugs.ts` (signature) | Accept optional `mangaQid` per probe so Layer 1 can traverse Wikidata |

---

## Test plan

### Bind-loop integration

After implementation, re-run:

```bash
bun run scripts/surveys/bind-loop/enrich-fandom-slugs.ts
bun run scripts/surveys/bind-loop/replay.ts b25-katakana
bun run scripts/surveys/bind-loop/score.ts b25-katakana --vs b24-wikidata
```

Expected outcome:

| Probe | Before | After |
|---|---|---|
| #2127:fandom (Strike Witches → `worldwitches`) | wrong-target | ✓ correct |
| All other Fandom probes | unchanged | unchanged |
| Non-Fandom providers | unchanged | unchanged |

Final harness state: **99.1% → 99.3%** (419/422). Last 3 misses are the
#4830/#4875/#2271 cross-ID cases that Stage A.3 (separate plan) closes.

### Unit tests

```ts
describe('katakanaToHepburn', () => {
  test('macron form',     () => expect(toHepburn('ワールド')).toBe('Wārudo'));
  test('no-macron form',  () => expect(toHepburn('ワールド', { noMacron: true })).toBe('Warudo'));
  test('long-vowel chu',  () => expect(toHepburn('スクール')).toBe('Sukūru'));
  test('small kana',      () => expect(toHepburn('ファイト')).toBe('Faito'));
});

describe('katakanaLoanwordSlugs', () => {
  test('Strike Witches franchise',
    () => expect(loanwordSlugs('ワールドウィッチーズ')).toContain('worldwitches'));
  test('multi-token cross-product',
    () => expect(loanwordSlugs('スターガールズ')).toEqual(
      expect.arrayContaining(['stargirls', 'star-girls']),
    ));
  test('unknown token falls through',
    () => expect(loanwordSlugs('知らないカタカナ')).toEqual([]));
});
```

### Cache hygiene

```bash
# Wiktionary cache check — file shouldn't grow unboundedly
wc -l scripts/surveys/bind-loop/katakana-loanword-cache.json
# Expect ~50-100 entries after a few runs across the full library
```

---

## Cost analysis

| Layer | Cost per probe | When it runs |
|---|---|---|
| 1. Wikidata traversal | 0 calls (cached) | Always for katakana refs |
| 2. Strict Hepburn | 0 calls | Always for katakana refs |
| 3. Curated dictionary | 0 calls | Always for katakana refs |
| 4. Wiktionary fallback | 0–N calls (cached) | Only for tokens not in dictionary/cache |

For the 78-manga library: most katakana resolution hits Layers 1-3 (free).
Layer 4 fires for unknown tokens; once cached, subsequent runs are free.

Expected first-run cost: **~10-20 Wiktionary calls** total (only the
distinct unknown tokens across all probes). Steady-state: **0 calls**.

---

## Safeguards

| Risk | Safeguard |
|---|---|
| Wiktionary returns wrong loanword (homograph) | Curated dictionary takes precedence; Wiktionary is only fall-through |
| Cache pollution from a one-off bad lookup | Cache stores `null` for "no loanword found"; entries are timestamped; can purge old entries |
| Cross-product explodes (n tokens × m mappings each) | Cap total candidates per ref at 16 |
| Slug-guess fires a wave of false-positive HTTP HEADs against non-existent Fandom subdomains | Same 200ms inter-request sleep as existing slug-guess; same wiki-exists check before accepting |
| Curated dictionary drift / staleness | Versioned in git; PR-reviewed; add new entries from bind-loop scorecard rather than ad-hoc |

---

## Open questions

1. **Pull a dep or hand-roll the Hepburn table?**
   - `wanakana` is 18KB, MIT, well-tested. Pro: comprehensive katakana coverage. Con: another dep.
   - Hand-roll: ~80 LOC, no dep, easy to audit. Con: edge-case bugs.
   - Lean: hand-roll the ~50 katakana-to-romaji mappings inline; the corpus is small enough that we don't need wanakana's full coverage.

2. **Layer 3 dictionary maintenance:** PR-reviewed list, or auto-grow from Wiktionary?
   - PR-reviewed gives confidence at the cost of friction.
   - Auto-grow is convenient but pollutes if Wiktionary returns garbage.
   - Lean: PR-reviewed for the initial seed; auto-grow into Layer 4 cache (which is separate).

3. **Promote katakana romanizer to production?** It's currently a bind-loop harness utility. If the alt-title-merging pipeline (Stage A.2 in the bidirectional plan) eventually needs to slug katakana for discovery, the romanizer should move to `src/server/services/wikidata/` or `src/utils/`.
   - Lean: keep in bind-loop for v1; promote when a second consumer appears.

---

## Estimated effort

| Step | LOC | Effort |
|---|---|---|
| `katakana-romanizer.ts` (Hepburn table) + tests | 80 + 50 | 1.5h |
| `katakana-loanwords.ts` (seed dictionary) | 60 | 0.5h |
| `wiktionary-client.ts` + cache | 100 | 1.5h |
| Wire into `enrich-fandom-slugs.ts` (Layers 1-4) | 80 | 1.5h |
| Tests | 100 | 1h |
| Re-run bind-loop + verify scorecard | — | 0.5h |
| **Total** | **~470 LOC** | **~6.5h** |

---

## Next steps

1. Review this plan
2. Decide on open questions (esp. #1 — dep vs hand-roll)
3. Implement Layer 1 (Wikidata traversal) + Layer 2 (Hepburn) first — covers the safest cases
4. Add Layer 3 dictionary seeded with the ~10 tokens that appear in the bind-loop's failing probes (start small)
5. Run bind-loop and verify #2127 flips to ✓ correct
6. If new katakana cases surface in production, extend Layer 3 dictionary via PR
7. Layer 4 (Wiktionary fallback) can ship later if needed — Layers 1-3 likely catch all current cases
