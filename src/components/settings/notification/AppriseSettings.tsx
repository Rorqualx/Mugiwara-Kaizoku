/**
 * Apprise Settings Component
 *
 * Settings panel for Apprise notification configuration
 *
 * @module components/settings/notification/AppriseSettings
 */
import React from 'react';

import { ArrayItem, SwitchItem, TextItem } from '../SettingsFormItems';

import { SettingRow } from './SettingRow';

import type { NotificationAppConfig, NotificationUpdateHandler } from './types';

interface AppriseSettingsProps {
  config: NotificationAppConfig;
  onUpdate: NotificationUpdateHandler;
}

/**
 * Apprise notification settings panel
 *
 * @param props - Component props
 * @returns Rendered Apprise settings
 */
export function AppriseSettings({ config, onUpdate }: AppriseSettingsProps): React.ReactElement {
  return (
    <>
      <SettingRow
        label="Enabled"
        description="Enable Apprise notifications"
      >
        <SwitchItem
          configKey="appriseEnabled"
          onUpdate={onUpdate}
          initialValue={config.appriseEnabled}
        />
      </SettingRow>

      <SettingRow
        label="Host"
        description="Apprise host name or IP"
      >
        <TextItem
          configKey="appriseHost"
          onUpdate={onUpdate}
          initialValue={config.appriseHost}
        />
      </SettingRow>

      <SettingRow
        label="Urls"
        description="Apprise URLs"
      >
        <ArrayItem
          configKey="appriseUrls"
          onUpdate={onUpdate}
          initialValue={config.appriseUrls}
          itemName="URL"
        />
      </SettingRow>
    </>
  );
}
