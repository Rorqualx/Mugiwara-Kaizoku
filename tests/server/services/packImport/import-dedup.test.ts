/**
 * @jest-environment node
 *
 * Pack-import de-duplication policy
 *
 * Pins the source-agnostic rule that keeps a late-finishing torrent pack from
 * clobbering chapters another provider (Suwayomi/MangaDex) already delivered,
 * and the orphan set-difference the cleanup audit relies on.
 */

import {
  shouldSkipRedundantImport,
  findOrphanedFiles,
  type DedupCandidate,
} from '@/server/services/packImport/import-dedup';

describe('shouldSkipRedundantImport', () => {
  it('skips a COMPLETED chapter whose file is on disk (already satisfied)', () => {
    const ch: DedupCandidate = { downloadStatus: 'COMPLETED', filePath: '/lib/Bleach/c1.cbz' };
    expect(shouldSkipRedundantImport(ch, true)).toBe(true);
  });

  it('does NOT skip when the COMPLETED file is missing from disk (allow re-fill)', () => {
    const ch: DedupCandidate = { downloadStatus: 'COMPLETED', filePath: '/lib/Bleach/c1.cbz' };
    expect(shouldSkipRedundantImport(ch, false)).toBe(false);
  });

  it('does NOT skip a PENDING chapter (the pack should fill the gap)', () => {
    const ch: DedupCandidate = { downloadStatus: 'PENDING', filePath: null };
    expect(shouldSkipRedundantImport(ch, false)).toBe(false);
  });

  it('does NOT skip an ERROR chapter even if a stale path lingers', () => {
    const ch: DedupCandidate = { downloadStatus: 'ERROR', filePath: '/lib/Bleach/c1.cbz' };
    expect(shouldSkipRedundantImport(ch, true)).toBe(false);
  });

  it('does NOT skip a COMPLETED row with a null filePath', () => {
    const ch: DedupCandidate = { downloadStatus: 'COMPLETED', filePath: null };
    expect(shouldSkipRedundantImport(ch, true)).toBe(false);
  });
});

describe('findOrphanedFiles', () => {
  it('returns disk files that no chapter references', () => {
    const onDisk = ['/lib/a.cbz', '/lib/b.cbz', '/lib/old-suwayomi.cbz'];
    const referenced = new Set(['/lib/a.cbz', '/lib/b.cbz']);
    expect(findOrphanedFiles(onDisk, referenced)).toEqual(['/lib/old-suwayomi.cbz']);
  });

  it('returns nothing when every disk file is referenced', () => {
    const onDisk = ['/lib/a.cbz', '/lib/b.cbz'];
    const referenced = new Set(['/lib/a.cbz', '/lib/b.cbz', '/lib/c.cbz']);
    expect(findOrphanedFiles(onDisk, referenced)).toEqual([]);
  });

  it('returns all when nothing is referenced', () => {
    const onDisk = ['/lib/a.cbz', '/lib/b.cbz'];
    expect(findOrphanedFiles(onDisk, new Set())).toEqual(['/lib/a.cbz', '/lib/b.cbz']);
  });
});
