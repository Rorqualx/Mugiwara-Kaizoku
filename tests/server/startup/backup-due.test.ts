import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/server/db', () => ({ prisma: {} }));
jest.mock('@/server/queue/backup', () => ({ scheduleBackupTask: jest.fn() }));
jest.mock('@/server/services/config/globalConfigService', () => ({ getAllConfigServices: jest.fn() }));

import { isBackupDue } from '@/server/startup/initializers/backup-initializer';

const HOUR = 60 * 60 * 1000;
const now = new Date('2026-10-10T12:00:00Z');
const ago = (ms: number): Date => new Date(now.getTime() - ms);

describe('isBackupDue', () => {
  it('is due when no scheduled backup exists yet', () => {
    expect(isBackupDue(null, 'daily', now)).toBe(true);
  });

  it('respects the daily, weekly and monthly intervals', () => {
    expect(isBackupDue(ago(23 * HOUR), 'daily', now)).toBe(false);
    expect(isBackupDue(ago(24 * HOUR), 'daily', now)).toBe(true);
    expect(isBackupDue(ago(6 * 24 * HOUR), 'weekly', now)).toBe(false);
    expect(isBackupDue(ago(7 * 24 * HOUR), 'weekly', now)).toBe(true);
    expect(isBackupDue(ago(29 * 24 * HOUR), 'monthly', now)).toBe(false);
    expect(isBackupDue(ago(30 * 24 * HOUR), 'monthly', now)).toBe(true);
  });

  it('falls back to daily for an unknown frequency', () => {
    expect(isBackupDue(ago(25 * HOUR), 'fortnightly', now)).toBe(true);
    expect(isBackupDue(ago(2 * HOUR), 'fortnightly', now)).toBe(false);
  });
});
