/**
 * Tests for the agentic loop: search scoring, budget tracking, and URL probing.
 */



import { logAction, recordAction } from '@/server/ai-agent/orchestrator/phase-orchestrator/agentic-loop/loop-state';
import type { AgenticLoopState } from '@/server/ai-agent/orchestrator/phase-orchestrator/agentic-loop/loop-types';
import {
  rankSearchResults,
  scoreSearchResult,
  parseSearchSuggestion,
} from '@/server/ai-agent/orchestrator/phase-orchestrator/agentic-loop/search-helpers';

// ============================================================================
// scoreSearchResult — Fix 3: Expanded scoring patterns
// ============================================================================

describe('scoreSearchResult', () => {
  test('scores exact "Chapters" title highest', () => {
    expect(scoreSearchResult({ title: 'Chapters' })).toBe(150); // 100 (exact) + 50 (contains)
  });

  test('scores exact "Volumes" title high', () => {
    expect(scoreSearchResult({ title: 'Volumes' })).toBe(90);
  });

  test('scores "Chapter List" page high', () => {
    const score = scoreSearchResult({ title: 'Chapter List' });
    expect(score).toBeGreaterThanOrEqual(80);
  });

  test('scores "Chapters and Volumes" high', () => {
    const score = scoreSearchResult({ title: 'Chapters and Volumes' });
    expect(score).toBeGreaterThanOrEqual(80);
  });

  test('scores "List of chapters" with list-of bonus', () => {
    const score = scoreSearchResult({ title: 'List of One Piece chapters' });
    expect(score).toBeGreaterThanOrEqual(70);
  });

  test('scores "Volume List" with volume list bonus', () => {
    const score = scoreSearchResult({ title: 'Volume List' });
    expect(score).toBeGreaterThanOrEqual(70);
  });

  test('scores "Story Arcs" with arc bonus', () => {
    const score = scoreSearchResult({ title: 'Story Arcs' });
    expect(score).toBe(60);
  });

  test('penalizes individual chapter pages', () => {
    expect(scoreSearchResult({ title: 'Chapter 22' })).toBeLessThan(0);
  });

  test('penalizes individual volume pages', () => {
    expect(scoreSearchResult({ title: 'Volume 5' })).toBeLessThan(0);
  });

  test('penalizes individual episode pages', () => {
    expect(scoreSearchResult({ title: 'Episode 12' })).toBeLessThan(0);
  });

  test('penalizes character/location pages', () => {
    expect(scoreSearchResult({ title: 'Character: Luffy' })).toBeLessThan(0);
    expect(scoreSearchResult({ title: 'Location: Grand Line' })).toBeLessThan(0);
  });

  test('adds size bonus for large pages', () => {
    const smallPage = scoreSearchResult({ title: 'Chapters', size: 5000 });
    const mediumPage = scoreSearchResult({ title: 'Chapters', size: 25000 });
    const largePage = scoreSearchResult({ title: 'Chapters', size: 60000 });

    expect(largePage).toBeGreaterThan(mediumPage);
    expect(mediumPage).toBeGreaterThan(smallPage);
  });

  test('handles missing title gracefully', () => {
    expect(scoreSearchResult({})).toBe(0);
    expect(scoreSearchResult({ title: 123 })).toBe(0);
  });
});

// ============================================================================
// rankSearchResults — should sort by score descending
// ============================================================================

describe('rankSearchResults', () => {
  test('ranks chapter list pages above individual chapters', () => {
    const results = [
      { title: 'Chapter 3', url: '/wiki/Chapter_3' },
      { title: 'Chapters', url: '/wiki/Chapters', size: 50000 },
      { title: 'Chapter 1', url: '/wiki/Chapter_1' },
    ];

    const ranked = rankSearchResults(results);
    expect((ranked[0] as Record<string, unknown>)['title']).toBe('Chapters');
  });

  test('ranks "Volumes" above individual chapters', () => {
    const results = [
      { title: 'Chapter 5', url: '/wiki/Chapter_5' },
      { title: 'Volumes', url: '/wiki/Volumes' },
      { title: 'Chapter 2', url: '/wiki/Chapter_2' },
    ];

    const ranked = rankSearchResults(results);
    expect((ranked[0] as Record<string, unknown>)['title']).toBe('Volumes');
  });

  test('filters out null/undefined items', () => {
    const results = [null, { title: 'Chapters' }, undefined, { title: 'Chapter 1' }];
    const ranked = rankSearchResults(results as unknown[]);
    expect(ranked.length).toBe(2);
  });
});

// ============================================================================
// parseSearchSuggestion
// ============================================================================

describe('parseSearchSuggestion', () => {
  test('parses valid wiki_page_search JSON', () => {
    const response = '{"tool": "wiki_page_search", "params": {"wikiBaseUrl": "https://test.fandom.com", "query": "Volumes"}, "reasoning": "test"}';
    const result = parseSearchSuggestion(response);
    expect(result).not.toBeNull();
    expect(result?.tool).toBe('wiki_page_search');
    expect(result?.params['query']).toBe('Volumes');
  });

  test('parses valid wiki_url_search JSON', () => {
    const response = '{"tool": "wiki_url_search", "params": {"query": "Punpun chapters wiki"}, "reasoning": "test"}';
    const result = parseSearchSuggestion(response);
    expect(result).not.toBeNull();
    expect(result?.tool).toBe('wiki_url_search');
  });

  test('rejects invalid tool name', () => {
    const response = '{"tool": "invalid_tool", "params": {"query": "test"}}';
    expect(parseSearchSuggestion(response)).toBeNull();
  });

  test('rejects malformed JSON', () => {
    expect(parseSearchSuggestion('not json at all')).toBeNull();
  });

  test('extracts JSON from surrounding text', () => {
    const response = 'Here is my suggestion: {"tool": "wiki_page_search", "params": {"wikiBaseUrl": "https://test.fandom.com", "query": "Episodes"}, "reasoning": "test"} hope this helps';
    const result = parseSearchSuggestion(response);
    expect(result).not.toBeNull();
    expect(result?.params['query']).toBe('Episodes');
  });
});

// ============================================================================
// logAction vs recordAction — Fix 6: Assessment doesn't burn budget
// ============================================================================

describe('logAction vs recordAction', () => {
  function makeState(): AgenticLoopState {
    return {
      mangaId: 1,
      title: 'Test',
      expectedChapterCount: 100,
      preferredLanguage: 'en',
      budget: { maxCalls: 8, callsUsed: 0, startTimeMs: Date.now(), maxDurationMs: 300000 },
      coverage: { titlePercent: 0, volumePercent: 0, coverPercent: 0 },
      actionHistory: [],
      aiOverrides: { titleOverrides: {}, volumeOverrides: {}, coverSelections: {}, coverRejections: [] },
    };
  }

  test('recordAction increments callsUsed', () => {
    const state = makeState();
    recordAction(state, { iteration: 1, action: 'search', resultSummary: 'test', durationMs: 0 });
    expect(state.budget.callsUsed).toBe(1);
    expect(state.actionHistory).toHaveLength(1);
  });

  test('logAction does NOT increment callsUsed', () => {
    const state = makeState();
    logAction(state, { iteration: 1, action: 'assess', resultSummary: 'test', durationMs: 0 });
    expect(state.budget.callsUsed).toBe(0);
    expect(state.actionHistory).toHaveLength(1);
  });

  test('mixed usage tracks budget correctly', () => {
    const state = makeState();
    logAction(state, { iteration: 1, action: 'assess', resultSummary: 'assess', durationMs: 0 });
    logAction(state, { iteration: 1, action: 'search', resultSummary: 'no results', durationMs: 10 });
    recordAction(state, { iteration: 1, action: 'search+scrape', resultSummary: 'found', durationMs: 100 });
    logAction(state, { iteration: 2, action: 'probe', resultSummary: 'failed', durationMs: 5 });

    expect(state.budget.callsUsed).toBe(1); // Only 1 recordAction
    expect(state.actionHistory).toHaveLength(4); // All 4 logged
  });
});
