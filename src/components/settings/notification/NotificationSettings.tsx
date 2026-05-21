/**
 * Notification Settings Component
 *
 * Main component for configuring notification settings.
 * Supports Telegram and Apprise notification providers.
 *
 * @module components/settings/notification/NotificationSettings
 */
import React from 'react';

import { Accordion } from '@mantine/core';

import { AppriseSettings } from './AppriseSettings';
import { useNotificationConfig } from './hooks';
import { ProviderAccordionItem } from './ProviderAccordionItem';
import { TelegramSettings } from './TelegramSettings';

/**
 * Notification settings component with Telegram and Apprise integration
 *
 * @returns The rendered notification settings or null while loading
 *
 * @example
 * ```tsx
 * <NotificationSettings />
 * ```
 */
export function NotificationSettings(): React.ReactElement | null {
  const { config, handleUpdate, isPending } = useNotificationConfig();

  if (isPending) {
    return null;
  }

  return (
    <Accordion variant="contained">
      <ProviderAccordionItem
        value="telegram"
        logoSrc="/brand/telegram.png"
        logoAlt="Telegram logo"
        title="Telegram"
      >
        <TelegramSettings config={config} onUpdate={handleUpdate} />
      </ProviderAccordionItem>

      <ProviderAccordionItem
        value="apprise"
        logoSrc="/brand/apprise.png"
        logoAlt="Apprise logo"
        title="Apprise"
      >
        <AppriseSettings config={config} onUpdate={handleUpdate} />
      </ProviderAccordionItem>
    </Accordion>
  );
}
