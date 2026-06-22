/**
 * @jest-environment node
 *
 * media-format-guard — classifies a download's file list to catch video
 * releases (anime .mkv packs) that slipped past pre-download title/size/
 * category filtering. Conservative by design: a list is only "video-only"
 * when no manga-format file is present.
 */

import { classifyDownloadFiles, isVideoOnlyDownload } from '@/server/services/download/media-format-guard';

const mkv = (n: number): { name: string } => ({
  name: `JoJo Part 1/[Some-stuffs]_Jojo's_Bizarre_Adventure_${String(n).padStart(2, '0')}_(1080p).mkv`,
});

describe('classifyDownloadFiles', () => {
  it('flags an all-mkv pack as video-only (the JoJo job 13168 case)', () => {
    const files = Array.from({ length: 26 }, (_, i) => mkv(i + 1));
    const v = classifyDownloadFiles(files);
    expect(v).toMatchObject({ total: 26, videoCount: 26, mangaCount: 0, isVideoOnly: true });
    expect(isVideoOnlyDownload(files)).toBe(true);
  });

  it('does NOT flag a cbz manga pack', () => {
    const files = [{ name: 'Naruto/Naruto v01.cbz' }, { name: 'Naruto/Naruto v02.cbz' }];
    expect(classifyDownloadFiles(files).isVideoOnly).toBe(false);
  });

  it('does NOT flag a mixed pack containing any manga file', () => {
    const files = [{ name: 'ep01.mkv' }, { name: 'bonus_chapter.cbz' }];
    const v = classifyDownloadFiles(files);
    expect(v.mangaCount).toBe(1);
    expect(v.isVideoOnly).toBe(false);
  });

  it('is safe against a video pack carrying a stray poster image', () => {
    // poster.jpg counts as a manga-format file -> not flagged (false-negative
    // is acceptable; wrongly removing a real manga torrent is not).
    const files = [{ name: 'movie.mkv' }, { name: 'poster.jpg' }];
    expect(classifyDownloadFiles(files).isVideoOnly).toBe(false);
  });

  it('returns isVideoOnly false for an empty / unresolved file list', () => {
    expect(classifyDownloadFiles([]).isVideoOnly).toBe(false);
  });

  it('handles files with no extension', () => {
    const files = [{ name: 'README' }, { name: 'data' }];
    expect(classifyDownloadFiles(files)).toMatchObject({ videoCount: 0, mangaCount: 0, isVideoOnly: false });
  });
});
