/**
 * Tests for List Page Extractor
 */

import { describe, expect, it } from '@jest/globals';

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import { extractListPageData, isListPage } from '../index';
import { buildRelations, validateRelations } from '../relation-builder';
import { detectVolumes, detectVolumeSections } from '../volume-detector';

// ============================================================================
// Mock Data
// ============================================================================

function createMockToken(overrides: Partial<LinearizedToken> & { id: string; text: string }): LinearizedToken {
  const { id, text, ...rest } = overrides;
  return {
    id,
    text,
    normalizedText: text.toLowerCase(),
    tagName: 'span',
    xpath: '/html/body',
    cssPath: 'body',
    domDepth: 1,
    siblingIndex: 0,
    parentId: null,
    childIds: [],
    isBold: false,
    isItalic: false,
    isHeader: false,
    headerLevel: 0,
    isInTable: false,
    isInList: false,
    isInInfobox: false,
    isLink: false,
    linkHref: null,
    tableRow: null,
    tableCol: null,
    isTableHeader: false,
    documentPosition: 0,
    charOffset: 0,
    textLength: text.length,
    wordCount: 1,
    sourceHtml: `<span>${text}</span>`,
    classes: [],
    elementId: null,
    isImage: false,
    imageSrc: null,
    imageAlt: null,
    imageWidth: null,
    imageHeight: null,
    tokenType: 'word',
    isNumeric: false,
    isDate: false,
    isPunctuation: false,
    isCJK: false,
    isAllCaps: false,
    matchesDatePattern: false,
    matchesVolumePattern: false,
    matchesChapterPattern: false,
    matchesNamePattern: false,
    precedingText: null,
    followingText: null,
    distanceFromLabel: 0,
    nearestLabelText: null,
    sectionType: 'main_content',
    isFirstInElement: true,
    isLastInElement: true,
    fontSize: null,
    fontWeight: null,
    color: null,
    backgroundColor: null,
    htmlContext: '',
    ...rest,
  };
}

const mockTokensWithVolumeSections: LinearizedToken[] = [
  createMockToken({ id: '0', text: 'Volume 1', tagName: 'h2', xpath: '/html/body/h2[1]', isHeader: true }),
  createMockToken({ id: '1', text: 'Chapter 1', tagName: 'p', xpath: '/html/body/p[1]' }),
  createMockToken({ id: '2', text: 'Volume 2', tagName: 'h2', xpath: '/html/body/h2[2]', isHeader: true }),
  createMockToken({ id: '3', text: 'Chapter 2', tagName: 'p', xpath: '/html/body/p[2]' }),
];

// ============================================================================
// Tests
// ============================================================================

describe('Volume Detector', () => {
  it('should detect volume sections from H2 headers', () => {
    const sections = detectVolumeSections(mockTokensWithVolumeSections);

    expect(sections).toHaveLength(2);
    expect(sections[0]?.volumeNumber).toBe(1);
    expect(sections[0]?.headerTokenIndex).toBe(0);
    expect(sections[1]?.volumeNumber).toBe(2);
    expect(sections[1]?.headerTokenIndex).toBe(2);
  });

  it('should return empty array when no volume headers', () => {
    const tokens = [
      createMockToken({ id: '0', text: 'Some text', tagName: 'p' }),
    ];
    const sections = detectVolumeSections(tokens);
    expect(sections).toHaveLength(0);
  });

  it('should detect volumes from tokens and tables', () => {
    const { volumes, sections } = detectVolumes(mockTokensWithVolumeSections, []);

    expect(sections).toHaveLength(2);
    expect(volumes).toHaveLength(2);
    expect(volumes[0]?.volumeNumber).toBe(1);
    expect(volumes[1]?.volumeNumber).toBe(2);
  });
});

describe('Relation Builder', () => {
  it('should build relations from chapters with volume assignments', () => {
    const chapters = [
      {
        chapterNumber: 1,
        belongsToVolume: 1,
        relationSource: 'VOLUME_SECTION' as const,
        tokenSpans: { number: { start: 0, end: 0 } },
        tableId: 'test',
        tableRow: 1,
        confidence: 0.9,
      },
      {
        chapterNumber: 2,
        belongsToVolume: 1,
        relationSource: 'VOLUME_SECTION' as const,
        tokenSpans: { number: { start: 1, end: 1 } },
        tableId: 'test',
        tableRow: 2,
        confidence: 0.9,
      },
    ];

    const volumes = [
      {
        volumeNumber: 1,
        tokenSpans: { number: { start: 10, end: 10 } },
        tableId: 'test',
        tableRow: 0,
        confidence: 0.9,
      },
    ];

    const relations = buildRelations(chapters, volumes);

    expect(relations).toHaveLength(2);
    expect(relations[0]?.chapterNumber).toBe(1);
    expect(relations[0]?.volumeNumber).toBe(1);
    expect(relations[0]?.source).toBe('VOLUME_SECTION');
  });

  it('should validate relations correctly', () => {
    const relations = [
      {
        chapterNumber: 1,
        volumeNumber: 1,
        chapterTokenIndex: 0,
        volumeTokenIndex: 10,
        source: 'VOLUME_SECTION' as const,
        confidence: 0.9,
      },
    ];

    const volumes = [
      {
        volumeNumber: 1,
        tokenSpans: { number: { start: 10, end: 10 } },
        tableId: 'test',
        tableRow: 0,
        confidence: 0.9,
      },
    ];

    const validation = validateRelations(relations, volumes);
    expect(validation.valid).toBe(true);
    expect(validation.issues).toHaveLength(0);
  });

  it('should detect missing volume in validation', () => {
    const relations = [
      {
        chapterNumber: 1,
        volumeNumber: 99, // Non-existent volume
        chapterTokenIndex: 0,
        volumeTokenIndex: 10,
        source: 'INFERRED' as const,
        confidence: 0.5,
      },
    ];

    const volumes = [
      {
        volumeNumber: 1,
        tokenSpans: {},
        tableId: 'test',
        tableRow: 0,
        confidence: 0.9,
      },
    ];

    const validation = validateRelations(relations, volumes);
    expect(validation.valid).toBe(false);
    expect(validation.issues.length).toBeGreaterThan(0);
  });
});

describe('isListPage', () => {
  it('should detect list page URLs', () => {
    expect(isListPage('/wiki/Manga/Chapters_and_Volumes', [])).toBe(true);
    expect(isListPage('/wiki/Series/Chapter_List', [])).toBe(true);
    expect(isListPage('/wiki/Series/Volume_List', [])).toBe(true);
  });

  it('should return false for non-list URLs without table markers', () => {
    expect(isListPage('/wiki/Manga', [])).toBe(false);
  });
});

describe('extractListPageData', () => {
  it('should return extraction result with stats', () => {
    const result = extractListPageData(mockTokensWithVolumeSections, [], []);

    expect(result.stats).toBeDefined();
    expect(result.stats.volumeCount).toBe(2);
    expect(result.volumes).toHaveLength(2);
    expect(result.chapters).toHaveLength(0); // No chapter tables in mock
    expect(result.relations).toHaveLength(0);
  });
});
