/**
 * @jest-environment node
 *
 * Guards the chapter-release-date fallback for Metadata publication dates.
 *
 * Regression target: endDate was filled from the latest chapter release for
 * every series. Production had it on 15 of 18 ongoing/hiatus titles (Dandadan,
 * One Piece, Berserk…). A stored endDate is read by the phantom prune and the
 * trusted ceiling as "finished", so the next enrichment would cap and prune an
 * ongoing series at its current latest chapter.
 */
import { isTerminalStatus, planChapterDateFill } from '../chapter-date-fill';

const first = new Date('2021-04-06T00:00:00Z');
const latest = new Date('2026-05-23T12:57:12Z');

describe('planChapterDateFill', () => {
  it.each(['ONGOING', 'HIATUS', 'UPCOMING', 'NOT_YET_PUBLISHED', 'NOT_YET_RELEASED', 'UNKNOWN'] as const)(
    'does not synthesise endDate for a %s series',
    status => {
      expect(planChapterDateFill({ status, startDate: null, endDate: null, earliestRelease: first, latestRelease: latest }))
        .toEqual({ startDate: first });
    },
  );

  it.each(['COMPLETED', 'CANCELLED'] as const)('fills endDate for a %s series', status => {
    expect(planChapterDateFill({ status, startDate: null, endDate: null, earliestRelease: first, latestRelease: latest }))
      .toEqual({ startDate: first, endDate: latest });
  });

  it('does not synthesise endDate when status is missing', () => {
    expect(planChapterDateFill({ status: null, startDate: first, endDate: null, earliestRelease: first, latestRelease: latest }))
      .toEqual({});
  });

  it('never overwrites dates a provider already supplied', () => {
    const providerStart = new Date('2020-01-01T00:00:00Z');
    const providerEnd = new Date('2024-01-01T00:00:00Z');
    expect(planChapterDateFill({
      status: 'COMPLETED', startDate: providerStart, endDate: providerEnd, earliestRelease: first, latestRelease: latest,
    })).toEqual({});
  });

  it('fills nothing when no chapter has a release date', () => {
    expect(planChapterDateFill({ status: 'COMPLETED', startDate: null, endDate: null, earliestRelease: null, latestRelease: null }))
      .toEqual({});
  });

  it('treats only COMPLETED and CANCELLED as terminal', () => {
    expect(isTerminalStatus('COMPLETED')).toBe(true);
    expect(isTerminalStatus('CANCELLED')).toBe(true);
    expect(isTerminalStatus('HIATUS')).toBe(false);
    expect(isTerminalStatus(undefined)).toBe(false);
  });
});
