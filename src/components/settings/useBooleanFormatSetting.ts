/**
 * Shared hook for the EbookFormatSettings + AudiobookFormatSettings
 * components — both used to be ~200-line near-duplicates of the same
 * "load a single boolean setting, toggle it, optimistic-update with rollback"
 * flow. After Phase 3 of the media-management audit they followed identical
 * patterns; this hook consolidates that pattern so the components only own
 * presentation (JSX, copy, format-specific alerts).
 *
 * Wire-format quirk: settings UI components historically pass booleans as
 * `String(value)` (so the wire payload is `"true"` / `"false"`). The Phase 2
 * server-side validator accepts both shapes, but the optimistic cache write
 * here matches the existing wire format so a subsequent re-fetch sees the
 * same value.
 *
 * @module components/settings/useBooleanFormatSetting
 */
import React from 'react';

import { showNotification } from '@mantine/notifications';

import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client';

/** AsyncResult success shape returned by `settings.get`. */
type SettingsGetSuccess = { status: 'success'; data: unknown };

function isSuccess(value: unknown): value is SettingsGetSuccess {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    (value as { status: unknown }).status === 'success' &&
    'data' in value
  );
}

function parseBool(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') return raw === 'true';
  return false;
}

export interface UseBooleanFormatSettingResult {
  /** Current toggled value, derived directly from query data — no useState mirror. */
  enabled: boolean;
  /** True while the initial settings.get query is in flight. */
  isLoading: boolean;
  /** True while a settings.set mutation is in flight (use to disable controls). */
  isPending: boolean;
  /** Last save error (cleared on success or by caller via clearError). */
  error: string | null;
  /** Bind to the Switch's onChange. */
  toggle: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Programmatically dismiss the error alert. */
  clearError: () => void;
}

/**
 * @param settingKey - Config key (e.g. `'media.enableEbookFormats'`)
 * @param logTag - Prefix for log lines so per-component traces stay distinguishable
 * @param successMessage - Toast message shown after a successful save
 */
export function useBooleanFormatSetting(
  settingKey: string,
  logTag: string,
  successMessage: string,
): UseBooleanFormatSettingResult {
  const utils = trpc.useUtils();
  const [error, setError] = React.useState<string | null>(null);

  const { data: settingsData, isLoading } = trpc.settings.get.useQuery(
    { key: settingKey },
    { refetchOnWindowFocus: false },
  );

  const enabled = isSuccess(settingsData) ? parseBool(settingsData.data) : false;

  const updateSetting = trpc.settings.set.useMutation({
    onMutate: async ({ value }) => {
      await utils.settings.get.cancel({ key: settingKey });
      const previous = utils.settings.get.getData({ key: settingKey });
      utils.settings.get.setData(
        { key: settingKey },
        { status: 'success', data: value } as SettingsGetSuccess,
      );
      return { previous };
    },
    onError: (err, _input, context) => {
      if (context && 'previous' in context) {
        utils.settings.get.setData({ key: settingKey }, context.previous);
      }
      logger.error(`${logTag} Failed to save setting:`, err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to update setting: ${errorMessage}`);
    },
    onSuccess: () => {
      setError(null);
      logger.info(`${logTag} Setting saved successfully`);
      showNotification({
        title: 'Saved',
        message: successMessage,
        color: 'green',
      });
    },
    onSettled: () => {
      void utils.settings.get.invalidate({ key: settingKey });
    },
  });

  const toggle = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const newValue = event.currentTarget.checked;
      updateSetting.mutate({ key: settingKey, value: String(newValue) });
      logger.info(`${logTag} Setting changed`, { value: newValue });
    },
    [settingKey, logTag, updateSetting],
  );

  const clearError = React.useCallback(() => setError(null), []);

  return {
    enabled,
    isLoading,
    isPending: updateSetting.isPending,
    error,
    toggle,
    clearError,
  };
}
