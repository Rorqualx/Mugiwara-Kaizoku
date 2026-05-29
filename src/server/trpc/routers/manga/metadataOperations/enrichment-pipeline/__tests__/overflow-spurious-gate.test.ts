/**
 * @jest-environment node
 *
 * Guards the overflow-deletion gate: spurious integer overflow is only deleted for a FINISHED series
 * with a cross-validated (multi-source) volume structure — never for ongoing or single-source manga,
 * whose overflow may be genuine not-yet-volumized chapters.
 */
import { shouldDeleteSpuriousOverflow } from '../phase-volume-overflow';

describe('shouldDeleteSpuriousOverflow', () => {
  it('deletes overflow for a finished series with a multi-source final volume (Dorohedoro)', () => {
    expect(shouldDeleteSpuriousOverflow('COMPLETED', 'comicvine+wikipedia+mangadex')).toBe(true);
    expect(shouldDeleteSpuriousOverflow('CANCELLED', 'comicvine+mangadex')).toBe(true);
  });

  it('keeps overflow for an ongoing series (latest chapters may be real)', () => {
    expect(shouldDeleteSpuriousOverflow('ONGOING', 'comicvine+wikipedia+mangadex')).toBe(false);
    expect(shouldDeleteSpuriousOverflow('HIATUS', 'comicvine+wikipedia+mangadex')).toBe(false);
  });

  it('keeps overflow when the final volume is single-source (low confidence it is complete)', () => {
    expect(shouldDeleteSpuriousOverflow('COMPLETED', 'comicvine')).toBe(false);
    expect(shouldDeleteSpuriousOverflow('COMPLETED', 'reconciliation')).toBe(false);
  });

  it('keeps overflow for unknown status or missing source', () => {
    expect(shouldDeleteSpuriousOverflow('UNKNOWN', 'comicvine+mangadex')).toBe(false);
    expect(shouldDeleteSpuriousOverflow(null, null)).toBe(false);
    expect(shouldDeleteSpuriousOverflow('COMPLETED', null)).toBe(false);
  });
});
