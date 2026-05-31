/**
 * Score-plumbing tests for the Wikipedia branch of wiki-freshness-audit.
 *
 * The Fandom branch requires a live MediaWiki API call (or a complex
 * validateFandomWiki mock — that's covered indirectly by the validator's
 * own tests and the live-DB smoke run). The Wikipedia branch is pure
 * scoring, so its plumbing is verified here.
 */

import { prisma } from '@/server/db';

import { runWikipediaFreshnessAudit } from '../wiki-freshness-audit';

jest.mock('@/server/db', () => ({
  prisma: { manga: { findMany: jest.fn() } },
}));

const mockedFindMany = (prisma.manga.findMany as jest.Mock);

describe('runWikipediaFreshnessAudit — score plumbing', () => {
  beforeEach(() => {
    mockedFindMany.mockReset();
  });

  it('emits a stale verdict when page title and manga title diverge', async () => {
    mockedFindMany.mockResolvedValueOnce([
      {
        id: 999,
        title: 'Völundio ~Divergent Sword Saga~',
        providerMetadata: { wikipedia: { providerId: 'Helck' } },
        Metadata: { synonyms: [] },
      },
    ]);
    const summary = await runWikipediaFreshnessAudit();
    expect(summary.scanned).toBe(1);
    expect(summary.stale).toBe(1);
    expect(summary.fresh).toBe(0);
  });

  it('emits a fresh verdict when page title matches manga title', async () => {
    mockedFindMany.mockResolvedValueOnce([
      {
        id: 1,
        title: 'Dandadan',
        providerMetadata: { wikipedia: { providerId: 'Dandadan' } },
        Metadata: { synonyms: [] },
      },
    ]);
    const summary = await runWikipediaFreshnessAudit();
    expect(summary.scanned).toBe(1);
    expect(summary.stale).toBe(0);
    expect(summary.fresh).toBe(1);
  });

  it('accepts the canonical "(manga)" suffix via stripScoringSuffix', async () => {
    mockedFindMany.mockResolvedValueOnce([
      {
        id: 1,
        title: 'The Ghost in the Shell',
        providerMetadata: { wikipedia: { providerId: 'The_Ghost_in_the_Shell_(manga)' } },
        Metadata: { synonyms: [] },
      },
    ]);
    const summary = await runWikipediaFreshnessAudit();
    expect(summary.fresh).toBe(1);
    expect(summary.stale).toBe(0);
  });

  it('falls back to synonyms when the primary title is the foreign-language form', async () => {
    mockedFindMany.mockResolvedValueOnce([
      {
        id: 1,
        title: 'Boku no Hero Academia',
        providerMetadata: { wikipedia: { providerId: 'My_Hero_Academia' } },
        Metadata: { synonyms: ['My Hero Academia'] },
      },
    ]);
    const summary = await runWikipediaFreshnessAudit();
    expect(summary.fresh).toBe(1);
    expect(summary.stale).toBe(0);
  });

  it('skips manga without a wikipedia providerId', async () => {
    mockedFindMany.mockResolvedValueOnce([
      { id: 1, title: 'No Wiki Bound', providerMetadata: null, Metadata: { synonyms: [] } },
      { id: 2, title: 'Empty Wiki', providerMetadata: { wikipedia: {} }, Metadata: { synonyms: [] } },
    ]);
    const summary = await runWikipediaFreshnessAudit();
    expect(summary.scanned).toBe(0);
  });
});
