/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';

import { useReaderProgress } from '@/hooks/reader/useReaderProgress';
import type { MangaFile } from '@/types/reader/reader-types';
import { PROGRESS_SAVE_DEBOUNCE_MS } from '@/utils/reader/constants';

const mutateAsync = jest.fn<Promise<unknown>, [unknown]>(() => Promise.resolve());

jest.mock('@/utils/trpc-client/index', () => ({
  trpc: {
    reader: {
      updateProgress: {
        useMutation: (): { mutateAsync: typeof mutateAsync } => ({ mutateAsync }),
      },
    },
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

function chapterFile(chapterId: number, totalPages = 20): MangaFile {
  return {
    id: `7-${chapterId}`,
    mangaId: 7,
    chapterId,
    chapterTitle: `Chapter ${chapterId}`,
    format: 'cbz',
    totalPages,
    metadata: { title: `Chapter ${chapterId}` },
  } as MangaFile;
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });
const AFTER_DEBOUNCE = PROGRESS_SAVE_DEBOUNCE_MS + 150;

describe('useReaderProgress', () => {
  beforeEach(() => {
    mutateAsync.mockClear();
  });

  it('saves the page that was turned to, once, after the debounce', async () => {
    const { result } = renderHook(
      (props: { file: MangaFile; chapterId: number }) =>
        useReaderProgress({ currentFile: props.file, currentChapterId: props.chapterId }),
      { initialProps: { file: chapterFile(100), chapterId: 100 } },
    );

    act(() => { result.current.saveProgress(5); });
    expect(mutateAsync).not.toHaveBeenCalled();

    await act(async () => { await wait(AFTER_DEBOUNCE); });

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({ mangaId: 7, chapterId: 100, currentPage: 5, totalPages: 20 });
  });

  it('collapses rapid page turns into one save of the last page', async () => {
    const { result, rerender } = renderHook(
      (props: { file: MangaFile; chapterId: number }) =>
        useReaderProgress({ currentFile: props.file, currentChapterId: props.chapterId }),
      { initialProps: { file: chapterFile(100), chapterId: 100 } },
    );

    // Each turn re-renders the reader with a new current page; that re-render
    // must not flush the previous page or cancel the pending save.
    for (const page of [2, 3, 4]) {
      act(() => { result.current.saveProgress(page); });
      rerender({ file: chapterFile(100), chapterId: 100 });
    }
    expect(mutateAsync).not.toHaveBeenCalled();

    await act(async () => { await wait(AFTER_DEBOUNCE); });

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ chapterId: 100, currentPage: 4 }));
  });

  it('sends the pending page for the chapter being left when the chapter changes', async () => {
    const { result, rerender } = renderHook(
      (props: { file: MangaFile; chapterId: number }) =>
        useReaderProgress({ currentFile: props.file, currentChapterId: props.chapterId }),
      { initialProps: { file: chapterFile(100), chapterId: 100 } },
    );

    act(() => { result.current.saveProgress(19); });
    rerender({ file: chapterFile(101, 30), chapterId: 101 });

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({ mangaId: 7, chapterId: 100, currentPage: 19, totalPages: 20 });

    // The cancelled debounce must not fire a second save later.
    await act(async () => { await wait(AFTER_DEBOUNCE); });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('sends the pending page on unmount and nothing when there is none', () => {
    const first = renderHook(() => useReaderProgress({ currentFile: chapterFile(100), currentChapterId: 100 }));
    act(() => { first.result.current.saveProgress(8); });
    first.unmount();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ currentPage: 8 }));

    mutateAsync.mockClear();
    const second = renderHook(() => useReaderProgress({ currentFile: chapterFile(100), currentChapterId: 100 }));
    second.unmount();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('sends the pending page when the tab is hidden', () => {
    const { result } = renderHook(() => useReaderProgress({ currentFile: chapterFile(100), currentChapterId: 100 }));
    act(() => { result.current.saveProgress(12); });

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ currentPage: 12 }));
  });
});
