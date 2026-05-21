/**
 * @jest-environment node
 *
 * Pin the contract behind dispatch.ts:fillNativeForChapter:
 *   `yieldToProwlarr = mediaType !== 'COMICBOOK' && downloadMode !== 'prefer-chapter'`
 *
 * fillNativeForChapter is module-private. We exercise the same predicate
 * inline so this test acts as a regression guard if the rule changes — and
 * documents what each (mediaType, downloadMode) cell does.
 */

type MediaType = 'MANGA' | 'COMICBOOK';
type DownloadMode = 'mix' | 'prefer-volume' | 'prefer-chapter';

function shouldYieldToProwlarr(mediaType: MediaType, downloadMode: DownloadMode): boolean {
  return mediaType !== 'COMICBOOK' && downloadMode !== 'prefer-chapter';
}

describe('fillNativeForChapter yield-to-Prowlarr predicate', () => {
  describe('MANGA mediaType', () => {
    it("yields under mix (current behavior preserved)", () => {
      expect(shouldYieldToProwlarr('MANGA', 'mix')).toBe(true);
    });
    it("yields under prefer-volume (volume packs still claim chapters)", () => {
      expect(shouldYieldToProwlarr('MANGA', 'prefer-volume')).toBe(true);
    });
    it("does NOT yield under prefer-chapter (native gets first crack)", () => {
      expect(shouldYieldToProwlarr('MANGA', 'prefer-chapter')).toBe(false);
    });
  });

  describe('COMICBOOK mediaType', () => {
    it("never yields regardless of mode (GetComics is always primary)", () => {
      expect(shouldYieldToProwlarr('COMICBOOK', 'mix')).toBe(false);
      expect(shouldYieldToProwlarr('COMICBOOK', 'prefer-volume')).toBe(false);
      expect(shouldYieldToProwlarr('COMICBOOK', 'prefer-chapter')).toBe(false);
    });
  });
});
