/**
 * @jest-environment node
 *
 * auto-convert-trigger tests — mock prisma + getConversionService +
 * ConverterFactory.isConversionSupported so we exercise the decision
 * logic without touching the DB or running converters.
 */

const supportedMock = jest.fn();
const findFirstMock = jest.fn();
const createJobMock = jest.fn();
const mangaFindUniqueMock = jest.fn();

jest.mock('@/server/db', () => ({
  prisma: {
    conversionJob: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
    },
    manga: {
      findUnique: (...args: unknown[]) => mangaFindUniqueMock(...args),
    },
  },
}));

jest.mock('@/server/services/conversion/ConverterFactory', () => ({
  ConverterFactory: {
    isConversionSupported: (...args: unknown[]) => supportedMock(...args),
  },
}));

jest.mock('@/server/services/conversion/FormatConversionService', () => ({
  getConversionService: () => ({
    createConversionJob: (req: unknown) => createJobMock(req),
  }),
}));

import { maybeEnqueueConversion } from '@/server/services/conversion/auto-convert-trigger';

beforeEach(() => {
  supportedMock.mockReset().mockReturnValue(true);
  findFirstMock.mockReset().mockResolvedValue(null);
  createJobMock.mockReset().mockResolvedValue({ status: 'success', data: 'job-123' });
  mangaFindUniqueMock.mockReset().mockResolvedValue({ Metadata: { format: 'MANGA' } });
});

describe('maybeEnqueueConversion', () => {
  it('enqueues a job for an EPUB chapter targeting cbz', async () => {
    const result = await maybeEnqueueConversion({
      chapterId: 100, mangaId: 9,
      sourceFile: '/lib/Re-ZERO/Volumes/V01/Re-ZERO V01.epub',
    });
    expect(result).toEqual({ enqueued: true, reason: 'enqueued', jobId: 'job-123' });
    expect(createJobMock).toHaveBeenCalledTimes(1);
    expect(createJobMock).toHaveBeenCalledWith(expect.objectContaining({
      chapterId: 100, mangaId: 9,
      sourceFormat: 'epub', targetFormat: 'cbz',
      sourceFile: '/lib/Re-ZERO/Volumes/V01/Re-ZERO V01.epub',
      targetFile: '/lib/Re-ZERO/Volumes/V01/Re-ZERO V01.cbz',
    }));
  });

  it('enqueues a job for a PDF chapter', async () => {
    const result = await maybeEnqueueConversion({
      chapterId: 200, mangaId: 10,
      sourceFile: '/lib/X/chapter-001.pdf',
    });
    expect(result.enqueued).toBe(true);
    expect(createJobMock).toHaveBeenCalledWith(expect.objectContaining({
      sourceFormat: 'pdf', targetFormat: 'cbz',
      targetFile: '/lib/X/chapter-001.cbz',
    }));
  });

  it('uses explicit sourceFormat over filename inference', async () => {
    await maybeEnqueueConversion({
      chapterId: 300, mangaId: 11,
      sourceFile: '/lib/random-name-no-ext',
      sourceFormat: 'EPUB',
    });
    expect(createJobMock).toHaveBeenCalledWith(expect.objectContaining({ sourceFormat: 'epub' }));
  });

  it('aliases .rar source to cbr (already-canonical-adjacent: cbr→cbz supported)', async () => {
    await maybeEnqueueConversion({
      chapterId: 400, mangaId: 12,
      sourceFile: '/lib/Naruto V01.rar',
    });
    expect(createJobMock).toHaveBeenCalledWith(expect.objectContaining({ sourceFormat: 'cbr' }));
  });

  it('short-circuits when source already matches target (cbz → cbz)', async () => {
    const result = await maybeEnqueueConversion({
      chapterId: 500, mangaId: 13,
      sourceFile: '/lib/X/already.cbz',
    });
    expect(result).toEqual({ enqueued: false, reason: 'already-canonical' });
    expect(createJobMock).not.toHaveBeenCalled();
  });

  it('returns unknown-source-format for unrecognized extensions', async () => {
    const result = await maybeEnqueueConversion({
      chapterId: 600, mangaId: 14,
      sourceFile: '/lib/X/file.xyz',
    });
    expect(result).toEqual({ enqueued: false, reason: 'unknown-source-format' });
    expect(createJobMock).not.toHaveBeenCalled();
  });

  it('returns unsupported-conversion when ConverterFactory says no', async () => {
    supportedMock.mockReturnValue(false);
    const result = await maybeEnqueueConversion({
      chapterId: 700, mangaId: 15,
      sourceFile: '/lib/X/file.mobi',
    });
    expect(result.reason).toBe('unsupported-conversion');
    expect(createJobMock).not.toHaveBeenCalled();
  });

  it('idempotency: returns already-in-progress when a PENDING job exists for the same chapter+target', async () => {
    findFirstMock.mockResolvedValue({ id: 'pre-existing-job-456' });
    const result = await maybeEnqueueConversion({
      chapterId: 800, mangaId: 16,
      sourceFile: '/lib/X/file.epub',
    });
    expect(result).toEqual({
      enqueued: false, reason: 'already-in-progress', jobId: 'pre-existing-job-456',
    });
    expect(createJobMock).not.toHaveBeenCalled();
  });

  it('returns enqueue-error when createConversionJob fails', async () => {
    createJobMock.mockResolvedValue({ status: 'error', error: new Error('boom') });
    const result = await maybeEnqueueConversion({
      chapterId: 900, mangaId: 17,
      sourceFile: '/lib/X/file.epub',
    });
    expect(result).toEqual({ enqueued: false, reason: 'enqueue-error', error: 'boom' });
  });

  it('skips when manga format=NOVEL (light-novel epub stays as epub)', async () => {
    mangaFindUniqueMock.mockResolvedValue({ Metadata: { format: 'NOVEL' } });
    const result = await maybeEnqueueConversion({
      chapterId: 1100, mangaId: 29,
      sourceFile: '/lib/Re-ZERO/Volumes/V01/Re-ZERO V01.epub',
    });
    expect(result).toEqual({ enqueued: false, reason: 'novel-skip' });
    expect(createJobMock).not.toHaveBeenCalled();
  });

  it('non-novel formats (MANGA / null / missing Metadata) proceed to enqueue', async () => {
    const cases: Array<unknown> = [
      { Metadata: { format: 'MANGA' } },
      { Metadata: { format: null } },
      { Metadata: null },
      null, // manga not found
    ];
    for (const m of cases) {
      createJobMock.mockClear();
      mangaFindUniqueMock.mockResolvedValue(m);
      const result = await maybeEnqueueConversion({
        chapterId: 1200, mangaId: 99,
        sourceFile: '/lib/X/file.epub',
      });
      expect(result.enqueued).toBe(true);
    }
  });

  it('respects an explicit targetFormat override (cbz default supersession)', async () => {
    await maybeEnqueueConversion({
      chapterId: 1000, mangaId: 18,
      sourceFile: '/lib/X/file.cbz',
      targetFormat: 'pdf',
    });
    // cbz → pdf: source != target, will go through enqueue branch
    expect(createJobMock).toHaveBeenCalledWith(expect.objectContaining({
      sourceFormat: 'cbz', targetFormat: 'pdf',
      targetFile: '/lib/X/file.pdf',
    }));
  });
});
