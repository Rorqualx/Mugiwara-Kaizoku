import React, { useState } from 'react';
import type { ReactElement } from 'react';

import { Container, Tabs, Stack, Box } from '@mantine/core';
import {
  IconServer,
  IconDatabase,
  IconBrandTelegram,
  IconBell,
  IconApi
} from '@tabler/icons-react';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SettingsLayout from '@/components/layouts/SettingsLayout';
import { ApiIntegrationContent } from '@/components/settings/api-settings/ApiIntegrationContent';
import { AppriseIntegrationContent } from '@/components/settings/integrations/apprise/AppriseIntegrationContent';
import { KavitaIntegrationContent } from '@/components/settings/integrations/kavita/KavitaIntegrationContent';
import { KomgaIntegrationContent } from '@/components/settings/integrations/komga/KomgaIntegrationContent';
import { TelegramIntegrationContent } from '@/components/settings/integrations/telegram/TelegramIntegrationContent';

type IntegrationType = 'komga' | 'kavita' | 'telegram' | 'apprise' | 'api';

interface IntegrationTab {
  value: IntegrationType;
  label: string;
  icon: typeof IconServer;
}

const integrationTabs: IntegrationTab[] = [
  { value: 'komga', label: 'Komga', icon: IconServer },
  { value: 'kavita', label: 'Kavita', icon: IconDatabase },
  { value: 'telegram', label: 'Telegram', icon: IconBrandTelegram },
  { value: 'apprise', label: 'Apprise', icon: IconBell },
  { value: 'api', label: 'API Access', icon: IconApi }
];

const contentByType: Record<IntegrationType, () => ReactElement> = {
  komga: () => <KomgaIntegrationContent />,
  kavita: () => <KavitaIntegrationContent />,
  telegram: () => <TelegramIntegrationContent />,
  apprise: () => <AppriseIntegrationContent />,
  api: () => <ApiIntegrationContent />
};

interface NavTabsProps {
  active: IntegrationType;
  onSelect: (value: IntegrationType) => void;
}

function IntegrationNavTabs({ active, onSelect }: NavTabsProps): ReactElement {
  return (
    <Tabs value={active} mb="md">
      <Tabs.List>
        {integrationTabs.map((tab) => {
          const Icon = tab.icon;
          const handleClick = (): void => onSelect(tab.value);
          return (
            <Tabs.Tab
              key={tab.value}
              value={tab.value}
              leftSection={<Icon size={16} />}
              onClick={handleClick}
              style={{ cursor: 'pointer' }}
            >
              {tab.label}
            </Tabs.Tab>
          );
        })}
      </Tabs.List>
    </Tabs>
  );
}

export default function IntegrationsSettings(): ReactElement {
  const [activeIntegration, setActiveIntegration] = useState<IntegrationType>('komga');
  const renderContent = contentByType[activeIntegration];

  return (
    <SettingsLayout title="Integrations">
      <Container size="xl" px={0}>
        <Stack gap="lg">
          <IntegrationNavTabs active={activeIntegration} onSelect={setActiveIntegration} />
          <Box>{renderContent()}</Box>
        </Stack>
      </Container>
    </SettingsLayout>
  );
}

IntegrationsSettings.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};
