/**
 * @jest-environment jsdom
 *
 * Behavior baseline for useProviderConfig.
 *
 * These tests lock in the current public API + behavior so a complexity
 * refactor (per-provider sub-hook extraction) can be verified to introduce
 * zero divergence. Each assertion captures a distinct piece of behavior:
 *  - the 12 useConfigValue calls happen with the right keys + defaults
 *  - the returned config object has the expected shape
 *  - isLoading / saving / error aggregate via OR (any single source flips them)
 *  - updateProviderSetting dispatches to the right field
 *  - setDefaultProvider, updateConfig, refresh hit the right setValues/refetches
 *  - getProvidersByPriority + getEnabledProviders derive correctly
 */

import { act, renderHook } from '@testing-library/react';

// Mock notifications so success/error toasts don't throw in jsdom.
jest.mock('@mantine/notifications', () => ({
  notifications: { show: jest.fn() },
}));

interface MockedField {
  value: unknown;
  isLoading: boolean;
  saving: boolean;
  error: Error | null;
  setValue: jest.Mock;
  refetch: jest.Mock;
}

const calls: Array<{ key: string; defaultValue: unknown }> = [];
const fields = new Map<string, MockedField>();

function makeField(value: unknown): MockedField {
  return {
    value,
    isLoading: false,
    saving: false,
    error: null,
    setValue: jest.fn().mockResolvedValue(undefined),
    refetch: jest.fn().mockResolvedValue(undefined),
  };
}

jest.mock('../useConfigValue', () => ({
  useConfigValue: (key: string, defaultValue: unknown) => {
    calls.push({ key, defaultValue });
    let field = fields.get(key);
    if (!field) {
      field = makeField(defaultValue);
      fields.set(key, field);
    }
    return field;
  },
}));

import { useProviderConfig } from '../useProviderConfig';

beforeEach(() => {
  calls.length = 0;
  fields.clear();
});

const EXPECTED_KEYS: ReadonlyArray<{ key: string; defaultValue: unknown }> = [
  { key: 'providers.defaultProvider', defaultValue: 'anilist' },
  { key: 'providers.anilist.enabled', defaultValue: true },
  { key: 'providers.anilist.strength', defaultValue: 90 },
  { key: 'providers.anilist.priority', defaultValue: 1 },
  { key: 'providers.fandom.enabled', defaultValue: true },
  { key: 'providers.fandom.strength', defaultValue: 70 },
  { key: 'providers.fandom.priority', defaultValue: 2 },
  { key: 'providers.comicvine.enabled', defaultValue: true },
  { key: 'providers.comicvine.strength', defaultValue: 60 },
  { key: 'providers.comicvine.priority', defaultValue: 3 },
  { key: 'providers.prowlarr.enabled', defaultValue: false },
  { key: 'providers.prowlarr.strength', defaultValue: 50 },
  { key: 'providers.prowlarr.priority', defaultValue: 4 },
];

describe('useProviderConfig — behavior baseline', () => {
  test('subscribes to the 13 config keys with the documented defaults, in order', () => {
    renderHook(() => useProviderConfig());
    expect(calls).toEqual(EXPECTED_KEYS);
  });

  test('returns a config tree with all 4 providers and their defaults', () => {
    const { result } = renderHook(() => useProviderConfig());
    expect(result.current.config.defaultProvider).toBe('anilist');
    expect(Object.keys(result.current.config.providers).sort()).toEqual(
      ['anilist', 'comicvine', 'fandom', 'prowlarr'],
    );
    expect(result.current.config.providers['anilist']).toEqual({
      enabled: true, strength: 90, priority: 1,
      description: 'Official AniList API for manga metadata',
    });
    expect(result.current.config.providers['prowlarr']).toMatchObject({
      enabled: false, strength: 50, priority: 4,
    });
  });

  test('isLoading is false when all sources are settled', () => {
    const { result } = renderHook(() => useProviderConfig());
    expect(result.current.isLoading).toBe(false);
  });

  test('isLoading flips true when ANY single source is loading', () => {
    renderHook(() => useProviderConfig()); // populate `fields`
    for (const { key } of EXPECTED_KEYS) {
      // Reset all then set just this one loading
      for (const f of fields.values()) f.isLoading = false;
      const target = fields.get(key);
      expect(target).toBeDefined();
      target!.isLoading = true;
      const { result } = renderHook(() => useProviderConfig());
      expect(result.current.isLoading).toBe(true);
    }
  });

  test('saving flips true when ANY single source is saving', () => {
    renderHook(() => useProviderConfig());
    for (const { key } of EXPECTED_KEYS) {
      for (const f of fields.values()) f.saving = false;
      fields.get(key)!.saving = true;
      const { result } = renderHook(() => useProviderConfig());
      expect(result.current.saving).toBe(true);
    }
  });

  test('error returns the first non-null source error message', () => {
    renderHook(() => useProviderConfig());
    fields.get('providers.fandom.strength')!.error = new Error('fandom strength fetch failed');
    const { result } = renderHook(() => useProviderConfig());
    expect(result.current.error).toBe('fandom strength fetch failed');
  });

  test('error is null when no source has an error', () => {
    const { result } = renderHook(() => useProviderConfig());
    expect(result.current.error).toBeNull();
  });

  test('updateProviderSetting writes "enabled" to the correct field', async () => {
    const { result } = renderHook(() => useProviderConfig());
    await act(async () => {
      await result.current.updateProviderSetting('comicvine', 'enabled', false);
    });
    expect(fields.get('providers.comicvine.enabled')!.setValue).toHaveBeenCalledWith(false);
    expect(fields.get('providers.anilist.enabled')!.setValue).not.toHaveBeenCalled();
  });

  test('updateProviderSetting writes "strength" to the correct field', async () => {
    const { result } = renderHook(() => useProviderConfig());
    await act(async () => {
      await result.current.updateProviderSetting('fandom', 'strength', 42);
    });
    expect(fields.get('providers.fandom.strength')!.setValue).toHaveBeenCalledWith(42);
  });

  test('updateProviderSetting writes "priority" to the correct field', async () => {
    const { result } = renderHook(() => useProviderConfig());
    await act(async () => {
      await result.current.updateProviderSetting('prowlarr', 'priority', 99);
    });
    expect(fields.get('providers.prowlarr.priority')!.setValue).toHaveBeenCalledWith(99);
  });

  test('updateProviderSetting("description", _) is a no-op (per hook contract)', async () => {
    const { result } = renderHook(() => useProviderConfig());
    await act(async () => {
      await result.current.updateProviderSetting('anilist', 'description', 'new desc');
    });
    expect(fields.get('providers.anilist.enabled')!.setValue).not.toHaveBeenCalled();
    expect(fields.get('providers.anilist.strength')!.setValue).not.toHaveBeenCalled();
    expect(fields.get('providers.anilist.priority')!.setValue).not.toHaveBeenCalled();
  });

  test('updateProviderSetting on unknown provider throws', async () => {
    const { result } = renderHook(() => useProviderConfig());
    await expect(
      act(async () => {
        await result.current.updateProviderSetting('nonexistent', 'enabled', true);
      }),
    ).rejects.toThrow(/Provider nonexistent does not exist/);
  });

  test('setDefaultProvider writes to providers.defaultProvider', async () => {
    const { result } = renderHook(() => useProviderConfig());
    await act(async () => {
      await result.current.setDefaultProvider('fandom');
    });
    expect(fields.get('providers.defaultProvider')!.setValue).toHaveBeenCalledWith('fandom');
  });

  test('setDefaultProvider on unknown provider throws', async () => {
    const { result } = renderHook(() => useProviderConfig());
    await expect(
      act(async () => {
        await result.current.setDefaultProvider('nonexistent');
      }),
    ).rejects.toThrow(/Provider nonexistent does not exist/);
  });

  test('updateConfig writes default provider + every supplied per-provider field', async () => {
    const { result } = renderHook(() => useProviderConfig());
    await act(async () => {
      await result.current.updateConfig({
        defaultProvider: 'comicvine',
        providers: {
          anilist: { enabled: false, strength: 11, priority: 2, description: 'ignored' },
          fandom: { strength: 22 } as Partial<import('../useProviderConfig').ProviderConfig> as never,
        },
      });
    });
    expect(fields.get('providers.defaultProvider')!.setValue).toHaveBeenCalledWith('comicvine');
    expect(fields.get('providers.anilist.enabled')!.setValue).toHaveBeenCalledWith(false);
    expect(fields.get('providers.anilist.strength')!.setValue).toHaveBeenCalledWith(11);
    expect(fields.get('providers.anilist.priority')!.setValue).toHaveBeenCalledWith(2);
    expect(fields.get('providers.fandom.strength')!.setValue).toHaveBeenCalledWith(22);
    // Non-supplied fandom fields untouched
    expect(fields.get('providers.fandom.enabled')!.setValue).not.toHaveBeenCalled();
    expect(fields.get('providers.fandom.priority')!.setValue).not.toHaveBeenCalled();
    // Other providers untouched
    expect(fields.get('providers.comicvine.enabled')!.setValue).not.toHaveBeenCalled();
    expect(fields.get('providers.prowlarr.enabled')!.setValue).not.toHaveBeenCalled();
  });

  test('refresh refetches all 13 sources', async () => {
    const { result } = renderHook(() => useProviderConfig());
    await act(async () => {
      await result.current.refresh();
    });
    for (const { key } of EXPECTED_KEYS) {
      expect(fields.get(key)!.refetch).toHaveBeenCalledTimes(1);
    }
  });

  test('getProvidersByPriority sorts ascending by priority', () => {
    const { result } = renderHook(() => useProviderConfig());
    expect(result.current.getProvidersByPriority()).toEqual(
      ['anilist', 'fandom', 'comicvine', 'prowlarr'],
    );
  });

  test('getEnabledProviders returns only providers with enabled=true', () => {
    const { result } = renderHook(() => useProviderConfig());
    // prowlarr defaults to enabled=false
    expect(result.current.getEnabledProviders().sort()).toEqual(
      ['anilist', 'comicvine', 'fandom'],
    );
  });
});
