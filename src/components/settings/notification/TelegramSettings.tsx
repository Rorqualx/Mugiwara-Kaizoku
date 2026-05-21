/**
 * Telegram Settings Component
 *
 * Settings panel for Telegram notification configuration
 *
 * @module components/settings/notification/TelegramSettings
 */
import React from 'react';

import { SwitchItem, TextItem } from '../SettingsFormItems';

import { SettingRow } from './SettingRow';

import type { NotificationAppConfig, NotificationUpdateHandler } from './types';

interface TelegramSettingsProps {
  config: NotificationAppConfig;
  onUpdate: NotificationUpdateHandler;
}

/**
 * Telegram notification settings panel
 *
 * @param props - Component props
 * @returns Rendered Telegram settings
 */
export function TelegramSettings({ config, onUpdate }: TelegramSettingsProps): React.ReactElement {
  return (
    <>
      <SettingRow
        label="Enabled"
        description="Enable Telegram notifications"
      >
        <SwitchItem
          configKey="telegramEnabled"
          onUpdate={onUpdate}
          initialValue={config.telegramEnabled}
        />
      </SettingRow>

      <SettingRow
        label="Token"
        description="Telegram token"
      >
        <TextItem
          configKey="telegramToken"
          onUpdate={onUpdate}
          initialValue={config.telegramToken}
        />
      </SettingRow>

      <SettingRow
        label="Chat Id"
        description="Telegram chat id"
      >
        <TextItem
          configKey="telegramChatId"
          onUpdate={onUpdate}
          initialValue={config.telegramChatId}
        />
      </SettingRow>

      <SettingRow
        label="Send Silently"
        description="Send Telegram notifications silently"
      >
        <SwitchItem
          configKey="telegramSendSilently"
          onUpdate={onUpdate}
          initialValue={config.telegramSendSilently}
        />
      </SettingRow>
    </>
  );
}
