/**
 * @jest-environment node
 *
 * Volume Reconciliation Regression Tests
 *
 * Validates that volume reconciliation (Phase 3.6) correctly handles:
 * 1. Bleach-like scenario: 75 ComicVine volumes with ranges, Fandom breaks assignments
 * 2. Call of the Night-like scenario: gap volumes created + chapters split correctly
 * 3. Tiered correction: high-confidence (multi-source) vs low-confidence (single-source)
 * 4. Edge cases: no ranges, < 3 volumes, vol 0 specials, null chapters
 *
 * These tests guard against regressions when adding new parsing patterns.
 */

import { prisma } from '@/server/db';

import {
  reconcileMissingVolumeRecords,
  correctVolumeAssignments,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-reconciliation';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@/server/db', () => ({
  prisma: {
    volume: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    chapter: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      aggregate: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
  },
}));

// ============================================================================
// Test Helpers
// ============================================================================

const MANGA_ID = 262; // Bleach

/** Volume record shape returned by correctVolumeAssignments query */
interface TestVolume {
  id: number;
  number: number;
  chapterStart: number;
  chapterEnd: number;
  source: string;
}

/** Chapter record shape returned by correctVolumeAssignments query */
interface TestChapter {
  filePath: string | null;
  id: number;
  chapterNumber: number;
  volume: number | null;
  volumeId: number | null;
}

/** Build a Volume record with a chapter range.
 *  id defaults to number; source defaults to 'comicvine+wikipedia' (high-confidence). */
function makeVolume(
  number: number,
  chapterStart: number,
  chapterEnd: number,
  source: string = 'comicvine+wikipedia',
): TestVolume {
  return { id: number, number, chapterStart, chapterEnd, source };
}

/** Build a chapter row with id, chapterNumber, and volume assignment.
 *  volumeId is auto-derived from volume (matching makeVolume's id = number).
 *  filePath defaults to null (PENDING/enrichment chapter). */
function makeChapter(
  id: number,
  chapterNumber: number,
  volume: number | null,
  filePath: string | null = null,
): TestChapter {
  return { id, chapterNumber, volume, volumeId: volume, filePath };
}

/**
 * Generate Bleach-like Volume records (75 volumes, multi-source).
 * Vol 1: ch 1-7, Vol 2: ch 8-16, Vol 3: ch 17-25, ...
 * Vol 27: ch 233-241, Vol 28: ch 242-250, ... Vol 75: ch 665-686
 */
function generateBleachVolumes(): TestVolume[] {
  const volumes: TestVolume[] = [];
  volumes.push(makeVolume(1, 1, 7));
  let chStart = 8;
  for (let v = 2; v <= 74; v++) {
    const chEnd = chStart + 8;
    volumes.push(makeVolume(v, chStart, chEnd));
    chStart = chEnd + 1;
  }
  volumes.push(makeVolume(75, chStart, 686));
  return volumes;
}

/**
 * Generate Bleach-like chapters with Fandom's broken volume assignments.
 *
 * Simulates the regression: Fandom's tab-based parsing lumps chapters into
 * the wrong volumes. Wikipedia fixes vols 2-26 but leaves the rest broken.
 *
 * - Ch 1-8: null (Wikipedia reset but not re-applied)
 * - Ch 9-232: correctly assigned (vols 2-26 by Wikipedia)
 * - Ch 233-423: Fandom lumped into vol 27 (only ch 233-241 should be vol 27)
 * - Ch 424-685: Fandom lumped into vol 1 (should be vols 48-75)
 * - Ch 686: null
 */
function generateBleachBrokenChapters(): TestChapter[] {
  const chapters: TestChapter[] = [];
  let id = 1;

  // Chapters 1-8: null (Wikipedia reset but not re-applied)
  for (let ch = 1; ch <= 8; ch++) {
    chapters.push(makeChapter(id++, ch, null));
  }

  // Chapters 9-232: correctly assigned by Wikipedia (vols 2-26)
  let chNum = 9;
  for (let v = 2; v <= 26; v++) {
    const end = v === 2 ? 16 : chNum + 8;
    while (chNum <= end && chNum <= 232) {
      chapters.push(makeChapter(id++, chNum, v));
      chNum++;
    }
  }

  // Chapters 233-423: Fandom lumped into vol 27
  for (let ch = 233; ch <= 423; ch++) {
    chapters.push(makeChapter(id++, ch, 27));
  }

  // Chapters 424-685: Fandom lumped into vol 1
  for (let ch = 424; ch <= 685; ch++) {
    chapters.push(makeChapter(id++, ch, 1));
  }

  // Chapter 686: null
  chapters.push(makeChapter(id++, 686, null));

  return chapters;
}

/** Collect corrections from updateMany mock calls into a Map<volNum, chapterNumbers[]>. */
function collectCorrections(mock: jest.Mock): Map<number, number[]> {
  const corrections = new Map<number, number[]>();
  for (const call of mock.mock.calls) {
    const volNum = call[0].data.volume as number;
    const chNums = call[0].where.chapterNumber.in as number[];
    corrections.set(volNum, [...(corrections.get(volNum) ?? []), ...chNums]);
  }
  return corrections;
}

/** Generate Call of the Night volumes (18 from ComicVine, 19-20 missing). */
function generateCotnVolumes(): TestVolume[] {
  const volumes: TestVolume[] = [];
  let chStart = 1;
  for (let v = 1; v <= 18; v++) {
    const chEnd = chStart + 9;
    volumes.push(makeVolume(v, chStart, chEnd));
    chStart = chEnd + 1;
  }
  return volumes;
}

// ============================================================================
// Tests: correctVolumeAssignments
// ============================================================================

describe('correctVolumeAssignments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.chapter.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
  });

  it('should fix Bleach-like broken volume assignments from Fandom', async () => {
    const volumes = generateBleachVolumes();
    const chapters = generateBleachBrokenChapters();

    (prisma.volume.findMany as jest.Mock).mockResolvedValue(volumes);
    (prisma.chapter.findMany as jest.Mock).mockResolvedValue(chapters);

    await correctVolumeAssignments(MANGA_ID);

    const updateCalls = (prisma.chapter.updateMany as jest.Mock).mock.calls;
    expect(updateCalls.length).toBeGreaterThan(0);

    const corrections = collectCorrections(prisma.chapter.updateMany as jest.Mock);

    // Vol 1 (range 1-7): ch 1-7 were null -> should be corrected to vol 1
    // Ch 424-685 were wrongly assigned to vol 1 -> should NOT remain in vol 1
    const vol1Chs = corrections.get(1) ?? [];
    for (let ch = 1; ch <= 7; ch++) {
      expect(vol1Chs).toContain(ch);
    }
    expect(vol1Chs.filter(ch => ch > 7)).toHaveLength(0);

    // Vol 27 (range 233-241): ch 233-241 were already assigned to vol 27 -> correct
    // No corrections needed for vol 27 itself
    // Ch 242-423 were wrongly in vol 27 -> corrected to vols 28+
    const vol27Chs = corrections.get(27) ?? [];
    expect(vol27Chs.filter(ch => ch > 241)).toHaveLength(0);

    // Vol 28 (range 242-250): ch 242-250 were in vol 27 -> corrected to vol 28
    const vol28Chs = corrections.get(28) ?? [];
    expect(vol28Chs.length).toBeGreaterThan(0);
    for (const ch of vol28Chs) {
      expect(ch).toBeGreaterThanOrEqual(242);
      expect(ch).toBeLessThanOrEqual(250);
    }

    // Ch 8 was null -> should be corrected to vol 2 (range 8-16)
    const vol2Chs = corrections.get(2) ?? [];
    expect(vol2Chs).toContain(8);

    // Ch 424-685 were in vol 1 -> should be corrected to vols 48+
    const highVolCorrections = [...corrections.entries()].filter(([v]) => v >= 48);
    const totalHighCorrected = highVolCorrections.reduce((sum, [, chs]) => sum + chs.length, 0);
    expect(totalHighCorrected).toBeGreaterThan(200);

    // Ch 686 was null -> should be corrected to vol 75 (range 665-686)
    const vol75Chs = corrections.get(75) ?? [];
    expect(vol75Chs).toContain(686);
  });

  it('should assign null chapters when they fall within a Volume range', async () => {
    const volumes = [
      makeVolume(1, 1, 10),
      makeVolume(2, 11, 20),
      makeVolume(3, 21, 30),
    ];
    const chapters = [
      makeChapter(1, 5, null),  // Null, but falls in vol 1 range
      makeChapter(2, 15, null), // Null, but falls in vol 2 range
      makeChapter(3, 25, 2),    // Wrong volume, falls in vol 3 range
    ];

    (prisma.volume.findMany as jest.Mock).mockResolvedValue(volumes);
    (prisma.chapter.findMany as jest.Mock).mockResolvedValue(chapters);

    await correctVolumeAssignments(MANGA_ID);

    const corrections = collectCorrections(prisma.chapter.updateMany as jest.Mock);

    expect(corrections.get(1)).toContain(5);
    expect(corrections.get(2)).toContain(15);
    expect(corrections.get(3)).toContain(25);
  });

  it('should leave chapters without matching Volume ranges as-is', async () => {
    const volumes = [
      makeVolume(1, 1, 10),
      makeVolume(2, 11, 20),
      makeVolume(3, 21, 30),
    ];
    const chapters = [
      makeChapter(1, 5, 1),    // Correct
      makeChapter(2, 15, 2),   // Correct
      makeChapter(3, 35, null), // No range covers ch 35
      makeChapter(4, 201, null), // No range covers ch 201
    ];

    (prisma.volume.findMany as jest.Mock).mockResolvedValue(volumes);
    (prisma.chapter.findMany as jest.Mock).mockResolvedValue(chapters);

    await correctVolumeAssignments(MANGA_ID);

    expect(prisma.chapter.updateMany).not.toHaveBeenCalled();
  });

  it('should skip when fewer than 3 volumes have ranges', async () => {
    (prisma.volume.findMany as jest.Mock).mockResolvedValue([
      makeVolume(1, 1, 10),
      makeVolume(2, 11, 20),
    ]);

    await correctVolumeAssignments(MANGA_ID);

    expect(prisma.chapter.findMany).not.toHaveBeenCalled();
    expect(prisma.chapter.updateMany).not.toHaveBeenCalled();
  });

  it('should include real Vol 0 (with ranges) in reconciliation', async () => {
    // Vol 0 is now reserved for real published prequel volumes (HxH
    // "Kurapika's Memories", JJK 0). The reconciliation no longer filters
    // by `number: { gt: 0 }` — only volumes with chapterStart/chapterEnd
    // ranges are considered, and Vol 0 with a real range qualifies.
    (prisma.volume.findMany as jest.Mock).mockResolvedValue([]);

    await correctVolumeAssignments(MANGA_ID);

    const findManyCall = (prisma.volume.findMany as jest.Mock).mock.calls[0];
    expect(findManyCall[0].where.number).toBeUndefined();
    expect(findManyCall[0].where.chapterStart).toEqual({ not: null });
    expect(findManyCall[0].where.chapterEnd).toEqual({ not: null });
  });

  it('should not modify chapters already correctly assigned', async () => {
    const volumes = [
      makeVolume(1, 1, 10),
      makeVolume(2, 11, 20),
      makeVolume(3, 21, 30),
    ];
    const chapters = [
      makeChapter(1, 1, 1),
      makeChapter(2, 10, 1),
      makeChapter(3, 11, 2),
      makeChapter(4, 20, 2),
      makeChapter(5, 21, 3),
      makeChapter(6, 30, 3),
    ];

    (prisma.volume.findMany as jest.Mock).mockResolvedValue(volumes);
    (prisma.chapter.findMany as jest.Mock).mockResolvedValue(chapters);

    await correctVolumeAssignments(MANGA_ID);

    expect(prisma.chapter.updateMany).not.toHaveBeenCalled();
  });

  it('should handle overlapping volume ranges (first/lower volume wins)', async () => {
    const volumes = [
      makeVolume(1, 1, 12),  // Overlaps with vol 2
      makeVolume(2, 10, 20), // Ch 10-12 overlap
      makeVolume(3, 21, 30),
    ];
    const chapters = [
      makeChapter(1, 11, 2),  // In overlap zone: vol 1 should win (lower)
      makeChapter(2, 12, 2),  // In overlap zone: vol 1 should win
      makeChapter(3, 13, 1),  // In vol 2 only: should be corrected to vol 2
    ];

    (prisma.volume.findMany as jest.Mock).mockResolvedValue(volumes);
    (prisma.chapter.findMany as jest.Mock).mockResolvedValue(chapters);

    await correctVolumeAssignments(MANGA_ID);

    const corrections = collectCorrections(prisma.chapter.updateMany as jest.Mock);

    expect(corrections.get(1)).toContain(11);
    expect(corrections.get(1)).toContain(12);
    expect(corrections.get(2)).toContain(13);
  });
});

// ============================================================================
// Tests: reconcileMissingVolumeRecords
// ============================================================================

describe('reconcileMissingVolumeRecords', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.volume.createMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.chapter.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
  });

  it('should create missing Volume records for Call of the Night-like gaps', async () => {
    const COTN_ID = 273;
    const existingVolumes = generateCotnVolumes();

    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { volume: 21, count: BigInt(21), min_ch: 181, max_ch: 200 },
    ]);
    (prisma.volume.findMany as jest.Mock).mockResolvedValue(existingVolumes);

    (prisma.chapter.findMany as jest.Mock).mockResolvedValue(
      Array.from({ length: 21 }, (_, i) => ({ chapterNumber: 181 + i, filePath: null })),
    );

    await reconcileMissingVolumeRecords(COTN_ID, 20);

    expect(prisma.volume.createMany).toHaveBeenCalled();
    const createCall = (prisma.volume.createMany as jest.Mock).mock.calls[0];
    const created = createCall[0].data as Array<{ number: number; source: string }>;

    const createdNumbers = created.map((v: { number: number }) => v.number).sort((a: number, b: number) => a - b);
    expect(createdNumbers).toContain(19);
    expect(createdNumbers).toContain(20);
  });

  it('should be a no-op when all volumes exist (Bleach case)', async () => {
    const volumes = generateBleachVolumes();

    const groups = volumes.map(v => ({
      volume: v.number,
      count: BigInt(v.chapterEnd - v.chapterStart + 1),
      min_ch: v.chapterStart,
      max_ch: v.chapterEnd,
    }));

    (prisma.$queryRaw as jest.Mock).mockResolvedValue(groups);
    (prisma.volume.findMany as jest.Mock).mockResolvedValue(volumes);

    await reconcileMissingVolumeRecords(MANGA_ID, 75);

    expect(prisma.volume.createMany).not.toHaveBeenCalled();
    expect(prisma.chapter.updateMany).not.toHaveBeenCalled();
  });

  it('should handle empty chapter groups gracefully', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

    await reconcileMissingVolumeRecords(MANGA_ID, null);

    expect(prisma.volume.findMany).not.toHaveBeenCalled();
    expect(prisma.volume.createMany).not.toHaveBeenCalled();
  });

  it('should create simple Volume record when orphan count is within average', async () => {
    const existingVolumes = [
      makeVolume(1, 1, 10),
      makeVolume(2, 11, 20),
    ];

    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { volume: 3, count: BigInt(8), min_ch: 21, max_ch: 28 },
    ]);
    (prisma.volume.findMany as jest.Mock).mockResolvedValue(existingVolumes);

    await reconcileMissingVolumeRecords(MANGA_ID, null);

    expect(prisma.volume.createMany).toHaveBeenCalled();
    const created = (prisma.volume.createMany as jest.Mock).mock.calls[0][0].data;
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      mangaId: MANGA_ID,
      number: 3,
      chapterStart: 21,
      chapterEnd: 28,
      totalChapters: 8,
      source: 'reconciliation',
    });
  });
});

// ============================================================================
// Tests: Full Pipeline (reconcile + correct together)
// ============================================================================

describe('reconcile + correct pipeline integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.volume.createMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.chapter.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
  });

  it('should fix Bleach end-to-end: reconcile is no-op, correct fixes assignments', async () => {
    const volumes = generateBleachVolumes();
    const chapters = generateBleachBrokenChapters();

    // Phase 3.6 Step 1: reconcileMissingVolumeRecords
    const groups = [
      { volume: 1, count: BigInt(262), min_ch: 424, max_ch: 685 },
      { volume: 27, count: BigInt(191), min_ch: 233, max_ch: 423 },
      ...Array.from({ length: 25 }, (_, i) => ({
        volume: i + 2,
        count: BigInt(9),
        min_ch: volumes[i + 1]!.chapterStart,
        max_ch: volumes[i + 1]!.chapterEnd,
      })),
    ];
    (prisma.$queryRaw as jest.Mock).mockResolvedValue(groups);
    (prisma.volume.findMany as jest.Mock).mockResolvedValue(volumes);

    await reconcileMissingVolumeRecords(MANGA_ID, 75);

    // Reconcile should be no-op
    expect(prisma.volume.createMany).not.toHaveBeenCalled();

    // Phase 3.6 Step 2: correctVolumeAssignments
    jest.clearAllMocks();
    (prisma.volume.findMany as jest.Mock).mockResolvedValue(volumes);
    (prisma.chapter.findMany as jest.Mock).mockResolvedValue(chapters);
    (prisma.chapter.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    await correctVolumeAssignments(MANGA_ID);

    const updateCalls = (prisma.chapter.updateMany as jest.Mock).mock.calls;
    expect(updateCalls.length).toBeGreaterThan(0);

    let totalCorrected = 0;
    for (const call of updateCalls) {
      totalCorrected += (call[0].where.chapterNumber.in as number[]).length;
    }

    // Broken: ch 1-8 null, ch 242-423 wrong, ch 424-685 wrong, ch 686 null
    expect(totalCorrected).toBeGreaterThan(400);
  });

  it('should handle Call of the Night: reconcile creates vols, correct assigns chapters', async () => {
    const COTN_ID = 273;
    const existingVolumes = generateCotnVolumes();

    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { volume: 21, count: BigInt(21), min_ch: 181, max_ch: 200 },
    ]);
    (prisma.volume.findMany as jest.Mock).mockResolvedValue(existingVolumes);
    (prisma.chapter.findMany as jest.Mock).mockResolvedValue(
      Array.from({ length: 21 }, (_, i) => ({ chapterNumber: 181 + i, filePath: null })),
    );

    await reconcileMissingVolumeRecords(COTN_ID, 20);

    const createCall = (prisma.volume.createMany as jest.Mock).mock.calls[0];
    expect(createCall).toBeDefined();

    // Step 2: correct
    jest.clearAllMocks();

    const allVolumes = [
      ...existingVolumes,
      makeVolume(19, 181, 187),
      makeVolume(20, 188, 194),
    ];
    (prisma.volume.findMany as jest.Mock).mockResolvedValue(allVolumes);
    (prisma.chapter.findMany as jest.Mock).mockResolvedValue([
      ...Array.from({ length: 7 }, (_, i) => makeChapter(200 + i, 181 + i, 21)),
      ...Array.from({ length: 7 }, (_, i) => makeChapter(210 + i, 188 + i, 21)),
      makeChapter(300, 201, null),
      makeChapter(301, 202, null),
      makeChapter(302, 203, null),
    ]);
    (prisma.chapter.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    await correctVolumeAssignments(COTN_ID);

    const corrections = collectCorrections(prisma.chapter.updateMany as jest.Mock);

    const vol19Chs = corrections.get(19) ?? [];
    for (let ch = 181; ch <= 187; ch++) {
      expect(vol19Chs).toContain(ch);
    }

    const vol20Chs = corrections.get(20) ?? [];
    for (let ch = 188; ch <= 194; ch++) {
      expect(vol20Chs).toContain(ch);
    }

    const allCorrectedChapters = [...corrections.values()].flat();
    expect(allCorrectedChapters).not.toContain(201);
    expect(allCorrectedChapters).not.toContain(202);
    expect(allCorrectedChapters).not.toContain(203);
  });
});

// ============================================================================
// Tests: Source-protected volume ranges (Chainsaw Man scenario)
// ============================================================================

describe('correctVolumeAssignments with preserved ComicVine ranges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.chapter.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
  });

  it('should fix Fandom lumping when multi-source ranges are intact (Chainsaw Man scenario)', async () => {
    // Chainsaw Man: 23 volumes with multi-source ranges (high confidence)
    // Fandom lumps ch 71-231 into vol 9 (should only be ch 71-79)
    const volumes = [
      makeVolume(1, 1, 7),
      makeVolume(2, 8, 16),
      makeVolume(3, 17, 25),
      makeVolume(4, 26, 34),
      makeVolume(5, 35, 43),
      makeVolume(6, 44, 52),
      makeVolume(7, 53, 61),
      makeVolume(8, 62, 70),
      makeVolume(9, 71, 79),
      makeVolume(10, 80, 88),
      makeVolume(11, 89, 97),
      makeVolume(12, 98, 103),
      makeVolume(13, 104, 112),
      makeVolume(14, 113, 122),
      makeVolume(15, 123, 133),
      makeVolume(16, 134, 143),
      makeVolume(17, 144, 153),
      makeVolume(18, 154, 164),
      makeVolume(19, 165, 175),
      makeVolume(20, 176, 186),
      makeVolume(21, 187, 198),
      makeVolume(22, 199, 210),
      makeVolume(23, 211, 230),
    ];

    // Simulate Fandom's broken state: ch 1-70 correct, ch 71-231 all in vol 9
    const chapters: TestChapter[] = [];
    let id = 1;

    // Ch 1-70: correct assignments (vols 1-8)
    for (let ch = 1; ch <= 7; ch++) chapters.push(makeChapter(id++, ch, 1));
    for (let ch = 8; ch <= 16; ch++) chapters.push(makeChapter(id++, ch, 2));
    for (let ch = 17; ch <= 25; ch++) chapters.push(makeChapter(id++, ch, 3));
    for (let ch = 26; ch <= 34; ch++) chapters.push(makeChapter(id++, ch, 4));
    for (let ch = 35; ch <= 43; ch++) chapters.push(makeChapter(id++, ch, 5));
    for (let ch = 44; ch <= 52; ch++) chapters.push(makeChapter(id++, ch, 6));
    for (let ch = 53; ch <= 61; ch++) chapters.push(makeChapter(id++, ch, 7));
    for (let ch = 62; ch <= 70; ch++) chapters.push(makeChapter(id++, ch, 8));

    // Ch 71-231: Fandom lumped into vol 9
    for (let ch = 71; ch <= 231; ch++) {
      chapters.push(makeChapter(id++, ch, 9));
    }

    (prisma.volume.findMany as jest.Mock).mockResolvedValue(volumes);
    (prisma.chapter.findMany as jest.Mock).mockResolvedValue(chapters);

    await correctVolumeAssignments(179);

    const corrections = collectCorrections(prisma.chapter.updateMany as jest.Mock);

    // Vol 9 (range 71-79): ch 71-79 already correct — no correction needed
    const vol9Chs = corrections.get(9) ?? [];
    expect(vol9Chs).toHaveLength(0);

    // Vol 10 (range 80-88): ch 80-88 were in vol 9 → corrected to vol 10
    const vol10Chs = corrections.get(10) ?? [];
    for (let ch = 80; ch <= 88; ch++) {
      expect(vol10Chs).toContain(ch);
    }

    // Vol 21 (range 187-198): ch 187-198 were in vol 9 → corrected to vol 21
    const vol21Chs = corrections.get(21) ?? [];
    for (let ch = 187; ch <= 198; ch++) {
      expect(vol21Chs).toContain(ch);
    }

    // Vol 23 (range 211-230): ch 211-230 were in vol 9 → corrected to vol 23
    const vol23Chs = corrections.get(23) ?? [];
    for (let ch = 211; ch <= 230; ch++) {
      expect(vol23Chs).toContain(ch);
    }

    // Ch 231 has no Volume range covering it → unlinked (volume set to null)
    // collectCorrections includes orphan unlinking calls, so 231 appears in results
    const allCorrectedChapters = [...corrections.values()].flat();
    expect(allCorrectedChapters).toContain(231);

    // Total: ch 80-230 moved (151) + ch 231 unlinked (1) = 152
    const totalCorrected = allCorrectedChapters.length;
    expect(totalCorrected).toBe(152);
  });

  it('should only fill unassigned chapters when ranges are single-source (Berserk scenario)', async () => {
    // Berserk: single-source ComicVine ranges (low confidence)
    // Existing assignments should be preserved, only null chapters get assigned
    const volumes = [
      makeVolume(1, 1, 10, 'comicvine'),
      makeVolume(2, 11, 20, 'comicvine'),
      makeVolume(3, 21, 30, 'comicvine'),
      makeVolume(4, 31, 40, 'comicvine'),
      makeVolume(5, 41, 50, 'comicvine'),
    ];

    const chapters: TestChapter[] = [
      // Correctly assigned — should NOT be touched
      makeChapter(1, 5, 1),
      makeChapter(2, 15, 2),
      makeChapter(3, 25, 3),
      // Wrongly assigned — low confidence should leave these alone
      makeChapter(4, 35, 2),   // Should be vol 4 but is vol 2 — preserved
      makeChapter(5, 45, 1),   // Should be vol 5 but is vol 1 — preserved
      // Unassigned — should be filled even in low-confidence mode
      makeChapter(6, 32, null), // Falls in vol 4 range → assigned
      makeChapter(7, 42, null), // Falls in vol 5 range → assigned
      // Outside all ranges — should NOT be unlinked in low-confidence mode
      makeChapter(8, 55, 3),   // Has assignment but no range covers ch 55 — preserved
    ];

    (prisma.volume.findMany as jest.Mock).mockResolvedValue(volumes);
    (prisma.chapter.findMany as jest.Mock).mockResolvedValue(chapters);

    await correctVolumeAssignments(999);

    const corrections = collectCorrections(prisma.chapter.updateMany as jest.Mock);
    const allCorrectedChapters = [...corrections.values()].flat();

    // Only null chapters should be assigned
    expect(corrections.get(4)).toContain(32);
    expect(corrections.get(5)).toContain(42);

    // Wrong assignments should NOT be corrected (low confidence)
    expect(allCorrectedChapters).not.toContain(35);
    expect(allCorrectedChapters).not.toContain(45);

    // Ch 55 outside ranges should NOT be unlinked (low confidence)
    expect(allCorrectedChapters).not.toContain(55);

    // Total: only 2 null chapters assigned
    expect(allCorrectedChapters).toHaveLength(2);
  });
});

// ============================================================================
// Tests: File-backed chapter protection (Chainsaw Man volume-file scenario)
// ============================================================================

describe('correctVolumeAssignments file-backed protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.chapter.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
  });

  it('should never overwrite volume for file-backed chapters with existing volumes', async () => {
    // Chainsaw Man: 11 volume files imported → chapters correctly assigned to vols 1-11
    // Enrichment then tries to reassign based on provider ranges
    const volumes = [
      makeVolume(1, 1, 7),
      makeVolume(2, 8, 16),
      makeVolume(3, 17, 25),
      makeVolume(4, 26, 34),
      makeVolume(5, 35, 43),
      makeVolume(6, 44, 52),
      makeVolume(7, 53, 61),
      makeVolume(8, 62, 70),
      makeVolume(9, 71, 79),
      makeVolume(10, 80, 88),
      makeVolume(11, 89, 97),
    ];

    const chapters: TestChapter[] = [];
    let id = 1;

    // File-backed chapters (vols 1-11): should be PROTECTED
    for (let ch = 1; ch <= 7; ch++) chapters.push(makeChapter(id++, ch, 1, '/manga/csm/vol01.cbz'));
    for (let ch = 8; ch <= 16; ch++) chapters.push(makeChapter(id++, ch, 2, '/manga/csm/vol02.cbz'));
    for (let ch = 17; ch <= 25; ch++) chapters.push(makeChapter(id++, ch, 3, '/manga/csm/vol03.cbz'));
    for (let ch = 26; ch <= 34; ch++) chapters.push(makeChapter(id++, ch, 4, '/manga/csm/vol04.cbz'));
    for (let ch = 35; ch <= 43; ch++) chapters.push(makeChapter(id++, ch, 5, '/manga/csm/vol05.cbz'));
    for (let ch = 44; ch <= 52; ch++) chapters.push(makeChapter(id++, ch, 6, '/manga/csm/vol06.cbz'));
    for (let ch = 53; ch <= 61; ch++) chapters.push(makeChapter(id++, ch, 7, '/manga/csm/vol07.cbz'));
    for (let ch = 62; ch <= 70; ch++) chapters.push(makeChapter(id++, ch, 8, '/manga/csm/vol08.cbz'));
    for (let ch = 71; ch <= 79; ch++) chapters.push(makeChapter(id++, ch, 9, '/manga/csm/vol09.cbz'));
    for (let ch = 80; ch <= 88; ch++) chapters.push(makeChapter(id++, ch, 10, '/manga/csm/vol10.cbz'));
    for (let ch = 89; ch <= 97; ch++) chapters.push(makeChapter(id++, ch, 11, '/manga/csm/vol11.cbz'));

    // PENDING chapters (no file): should still be correctable by enrichment
    for (let ch = 98; ch <= 130; ch++) {
      chapters.push(makeChapter(id++, ch, null)); // filePath = null
    }

    (prisma.volume.findMany as jest.Mock).mockResolvedValue(volumes);
    (prisma.chapter.findMany as jest.Mock).mockResolvedValue(chapters);

    await correctVolumeAssignments(179);

    const corrections = collectCorrections(prisma.chapter.updateMany as jest.Mock);
    const allCorrectedChapters = [...corrections.values()].flat();

    // File-backed chapters (1-97) should NEVER appear in corrections
    for (let ch = 1; ch <= 97; ch++) {
      expect(allCorrectedChapters).not.toContain(ch);
    }

    // PENDING chapters within ranges should be assigned
    // Ch 98-97 falls in vol 11 range (89-97) — ch 98+ has no range, stays null
    // No corrections expected for ch 98+ since no volume range covers them
    expect(allCorrectedChapters.filter(ch => ch >= 98)).toHaveLength(0);
  });

  it('should allow enrichment to assign volumes to file-backed chapters with null volume', async () => {
    // Edge case: file-backed chapter but volume is null (e.g., chapter file, not volume file)
    const volumes = [
      makeVolume(1, 1, 10),
      makeVolume(2, 11, 20),
      makeVolume(3, 21, 30),
    ];

    const chapters: TestChapter[] = [
      // File-backed but no volume assigned — enrichment SHOULD assign
      makeChapter(1, 5, null, '/manga/aot/ch005.cbz'),
      makeChapter(2, 15, null, '/manga/aot/ch015.cbz'),
      // File-backed WITH volume — enrichment should NOT touch
      makeChapter(3, 25, 3, '/manga/aot/vol03.cbz'),
    ];

    (prisma.volume.findMany as jest.Mock).mockResolvedValue(volumes);
    (prisma.chapter.findMany as jest.Mock).mockResolvedValue(chapters);

    await correctVolumeAssignments(42);

    const corrections = collectCorrections(prisma.chapter.updateMany as jest.Mock);

    // Ch 5 and 15: file-backed but null volume → should be assigned
    expect(corrections.get(1)).toContain(5);
    expect(corrections.get(2)).toContain(15);

    // Ch 25: file-backed WITH volume → should NOT be touched
    const allCorrectedChapters = [...corrections.values()].flat();
    expect(allCorrectedChapters).not.toContain(25);
  });
});
