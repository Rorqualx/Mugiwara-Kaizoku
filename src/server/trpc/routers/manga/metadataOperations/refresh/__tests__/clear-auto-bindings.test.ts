/**
 * @jest-environment node
 *
 * Guards reidentify's volume-clearing predicate: cross-validation compounds and reconciliation
 * phantoms must be clearable, while preserved-provider compounds and user/ambiguous sources survive.
 */
import { shouldClearVolumeSource } from '../clear-auto-bindings';

// fandom is preserved (e.g. a manual binding); the rest are being cleared.
const CLEARED = new Set(['comicvine', 'wikipedia', 'mangadex']);

describe('shouldClearVolumeSource', () => {
  it('clears an exact single cleared-provider source', () => {
    expect(shouldClearVolumeSource('mangadex', CLEARED)).toBe(true);
  });

  it('clears a compound composed entirely of cleared providers (the Dorohedoro gap)', () => {
    expect(shouldClearVolumeSource('comicvine+wikipedia+mangadex', CLEARED)).toBe(true);
  });

  it('clears reconciliation phantom volumes', () => {
    expect(shouldClearVolumeSource('reconciliation', CLEARED)).toBe(true);
  });

  it('keeps a compound that includes a preserved provider', () => {
    expect(shouldClearVolumeSource('comicvine+fandom', CLEARED)).toBe(false);
  });

  it('keeps null / empty / unknown-custom sources', () => {
    expect(shouldClearVolumeSource(null, CLEARED)).toBe(false);
    expect(shouldClearVolumeSource('', CLEARED)).toBe(false);
    expect(shouldClearVolumeSource('manual-upload', CLEARED)).toBe(false);
  });
});
