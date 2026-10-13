/**
 * @jest-environment node
 *
 * A volume re-assignment clears `volume` only on numbered, file-less rows.
 */
import { describe, it, expect, jest } from '@jest/globals';

jest.mock('@/server/db', () => ({ prisma: {} }));

import { unfiledChapterRows } from '../fandom-db-persistence';

describe('unfiledChapterRows', () => {
  it('leaves a file-less volume placeholder row (no chapter number) out of the rows whose volume is cleared (bug: Frieren gained 14 duplicate placeholder rows and kept 15 orphans after one refresh)', () => {
    expect(unfiledChapterRows(78)).toEqual({ mangaId: 78, filePath: null, chapterNumber: { not: null } });
  });
});
