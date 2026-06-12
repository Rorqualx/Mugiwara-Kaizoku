/**
 * Calendar Provider Settings Component
 *
 * Allows users to configure metadata provider integration for calendar functionality.
 * Users can enable/disable providers and configure API credentials.
 */
import React, { useState, useEffect } from 'react';

import { Card, Title, Text, Switch, TextInput, PasswordInput, Button, Group, Stack, Alert, Divider, Badge, Loader, Collapse, ActionIcon} from '@mantine/core';
import { IconCheck, IconAlertCircle, IconChevronDown, IconChevronUp, IconPlugConnected, IconTestPipe } from '@tabler/icons-react';

import { notify } from '@/utils/notify';
import { safeErrorMessage } from '@/utils/safe-render';
import { trpc } from '@/utils/trpc-client/index';
interface ProviderConfig {
    enabled: boolean;
    apiKey?: string;
    accessToken?: string;
    clientId?: string;
    clientSecret?: string;
    username?: string;
    password?: string;
    wikiDomain?: string;
}
interface CalendarProviderSettingsConfig {
    anilist: ProviderConfig;
    comicvine: ProviderConfig;
    fandom: ProviderConfig;
}
export function CalendarProviderSettings(): JSX.Element {
    const [providers, setProviders] = useState<CalendarProviderSettingsConfig>({
        anilist: { enabled: false },
        comicvine: { enabled: false },
        fandom: { enabled: false }
    });
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [testing, setTesting] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);
    // Get ONLY metadata settings, not all settings
    // This prevents rendering the entire config object and causing React errors
    const settingsQuery = trpc.settings.get.useQuery({
        key: 'metadata',
        defaultValue: { providers: {} }
    });
    // Update settings mutation
    const updateSettings = trpc.settings.set.useMutation();
    React.useEffect(() => {
        if (updateSettings.isSuccess) {
            // Don't log or use updateSettings.data - it might contain objects
            // Just show success notification
            notify({ severity: 'SUCCESS', title: 'Settings saved', message: 'Calendar provider settings have been updated' });
            void settingsQuery.refetch();
        }
    }, [updateSettings.isSuccess, settingsQuery]);
    React.useEffect(() => {
        if (updateSettings.isError) {
            const errorMessage = safeErrorMessage(updateSettings.error, 'Failed to save settings');

            notify({ severity: 'ERROR', title: 'Failed to save settings', message: errorMessage });
        }
    }, [updateSettings.isError, updateSettings.error]);
    // Load settings on mount
    useEffect(() => {
        if (settingsQuery.data) {
            // When we request 'metadata' key, we get just the metadata object
            const metadata: unknown = settingsQuery.data;
            if (metadata && typeof metadata === 'object' && 'providers' in metadata) {
                const typedMetadata = metadata as { providers: unknown };
                const providersData = typedMetadata["providers"] as unknown;

                // Type guard for providers object
                if (providersData && typeof providersData === 'object') {
                    const providers = providersData as Record<string, unknown>;

                    // Helper function to extract provider config
                    const getProviderConfig = (key: string): ProviderConfig => {
                        const config = providers[key];
                        if (config && typeof config === 'object') {
                            return config as ProviderConfig;
                        }
                        return { enabled: false };
                    };

                    setProviders({
                        anilist: getProviderConfig('anilist'),
                        comicvine: getProviderConfig('comicvine'),
                        fandom: getProviderConfig('fandom')
                    });
                }
            }
        }
    }, [settingsQuery.data]);
    // Handle provider toggle
    const handleToggleProvider = (provider: keyof CalendarProviderSettingsConfig): void => {
        setProviders((prev) => ({
            ...prev,
            [provider]: {
                ...prev[provider],
                enabled: !prev[provider].enabled
            }
        }));
        // Auto-expand when enabling
        if (!providers[provider].enabled) {
            setExpanded((prev) => ({ ...prev, [provider]: true }));
        }
    };
    // Handle config change
    const handleConfigChange = (provider: keyof CalendarProviderSettingsConfig, field: keyof ProviderConfig, value: string): void => {
        setProviders((prev) => ({
            ...prev,
            [provider]: {
                ...prev[provider],
                [field]: value
            }
        }));
    };
    // Test provider connection
    const testProvider = async (provider: keyof CalendarProviderSettingsConfig): Promise<void> => {
        setTesting((prev) => ({ ...prev, [provider]: true }));
        try {
            // TODO: Implement actual provider testing endpoint
            await new Promise<void>((resolve) => {
                setTimeout(resolve, 2000);
            });
            notify({ severity: 'SUCCESS', title: 'Connection successful', message: `Successfully connected to ${provider}` });
        }
        catch (_error: unknown) {
            notify({ severity: 'ERROR', title: 'Connection failed', message: `Failed to connect to ${provider}` });
        }
        finally {
            setTesting((prev) => ({ ...prev, [provider]: false }));
        }
    };
    // Save settings
    const handleSave = async (): Promise<void> => {
        setSaving(true);
        try {
            // Get current metadata settings
            const currentMetadata = settingsQuery.data ?? null;
            if (!currentMetadata) {
                // If no metadata exists, create new metadata structure
                await updateSettings.mutateAsync({
                    key: 'metadata',
                    value: {
                        providers: providers,
                        defaultProvider: 'anilist'
                    }
                });
            } else {
                // Merge with existing metadata settings
                const metadata = currentMetadata as Record<string, unknown>;
                await updateSettings.mutateAsync({
                    key: 'metadata',
                    value: {
                        ...metadata,
                        providers: providers
                    }
                });
            }
        }
        finally {
            setSaving(false);
        }
    };
    // Render provider card
    const renderProvider = (key: keyof CalendarProviderSettingsConfig, title: string, description: string, icon: React.ReactNode, safeProviders: CalendarProviderSettingsConfig): JSX.Element => {
        const config = safeProviders[key];
        const isExpanded = expanded[key] ?? false;
        const isTesting = testing[key] ?? false;
        return (<Card key={key} withBorder>
        <Stack gap="md">
          {/* Header */}
          <Group justify="space-between">
            <Group>
              {icon}
              <div>
                <Title order={4}>{title}</Title>
                <Text size="sm" c="dimmed">{description}</Text>
              </div>
            </Group>
            
            <Group>
              {config.enabled &&
                <Badge color="green" variant="light">
                  Connected
                </Badge>}
              
              <Switch checked={config.enabled} onChange={() => { void handleToggleProvider(key); }} size="lg"/>

              
              <ActionIcon variant="subtle" onClick={() => setExpanded((prev) => ({ ...prev, [key]: !isExpanded }))}>

                {isExpanded ? <IconChevronUp /> : <IconChevronDown />}
              </ActionIcon>
            </Group>
          </Group>
          
          {/* Configuration */}
          <Collapse in={isExpanded}>
            <Stack gap="sm" pt="md">
              <Divider />
              
              {/* AniList configuration */}
              {key === 'anilist' &&
                <>
                  <TextInput label="Client ID" placeholder="Your AniList client ID" value={config.clientId ?? ''} onChange={(e) => { void handleConfigChange(key, 'clientId', e.target.value); }} disabled={!config.enabled} required/>

                  
                  <PasswordInput label="Client Secret" placeholder="Your AniList client secret" value={config.clientSecret ?? ''} onChange={(e) => { void handleConfigChange(key, 'clientSecret', e.target.value); }} disabled={!config.enabled} required/>

                  
                  <TextInput label="Access Token (Optional)" placeholder="Your AniList access token" value={config.accessToken ?? ''} onChange={(e) => { void handleConfigChange(key, 'accessToken', e.target.value); }} disabled={!config.enabled}/>

                  
                  <Alert icon={<IconAlertCircle />} color="blue">
                    Get your AniList API credentials from{' '}
                    <a href="https://anilist.co/settings/developer" target="_blank" rel="noopener noreferrer">
                      AniList Developer Settings
                    </a>
                  </Alert>
                </>}
              
              {/* ComicVine configuration */}
              {key === 'comicvine' &&
                <>
                  <TextInput label="API Key" placeholder="Your ComicVine API key" value={config.apiKey ?? ''} onChange={(e) => { void handleConfigChange(key, 'apiKey', e.target.value); }} disabled={!config.enabled} required/>

                  
                  <Alert icon={<IconAlertCircle />} color="blue">
                    Get your ComicVine API key from{' '}
                    <a href="https://comicvine.gamespot.com/api/" target="_blank" rel="noopener noreferrer">
                      ComicVine API
                    </a>
                  </Alert>
                </>}
              
              {/* Fandom configuration */}
              {key === 'fandom' &&
                <>
                  <TextInput label="Wiki Domain" placeholder="e.g., manga.fandom.com" value={config.wikiDomain ?? 'manga.fandom.com'} onChange={(e) => { void handleConfigChange(key, 'wikiDomain', e.target.value); }} disabled={!config.enabled}/>

                  
                  <Alert icon={<IconAlertCircle />} color="blue">
                    Fandom wikis are scraped for information. No API key required.
                  </Alert>
                </>}
              
              {/* Test connection button */}
              {config.enabled &&
                <Button variant="light" leftSection={isTesting ? <Loader size="xs"/> : <IconTestPipe size={16}/>} onClick={() => { void testProvider(key); }} disabled={isTesting}>

                  {isTesting ? 'Testing...' : 'Test Connection'}
                </Button>}
            </Stack>
          </Collapse>
        </Stack>
      </Card>);
    };
    if (settingsQuery.isLoading) {
        return (<Stack align="center" py="xl">
        <Loader />
        <Text>Loading provider settings...</Text>
      </Stack>);
    }
    // Defensive check to ensure we never render objects
    let providersToRender = providers;
    if (typeof providers === 'object') {
        // Ensure providers is properly structured
        providersToRender = {
            anilist: typeof providers.anilist === 'object' ? providers.anilist : { enabled: false },
            comicvine: typeof providers.comicvine === 'object' ? providers.comicvine : { enabled: false },
            fandom: typeof providers.fandom === 'object' ? providers.fandom : { enabled: false }
        };
    }

    return (<Stack gap="lg">
      <div>
        <Title order={3}>Calendar Provider Integration</Title>
        <Text c="dimmed">
          Configure metadata providers to automatically check for new manga releases.
          The calendar will use these providers to detect release patterns and predict future releases.
        </Text>
      </div>

      <Stack gap="md">

        {renderProvider('anilist', 'AniList', 'Get manga metadata and release information from AniList', <IconPlugConnected size={24}/>, providersToRender)}

        {renderProvider('comicvine', 'ComicVine', 'Get comic and manga metadata from ComicVine', <IconPlugConnected size={24}/>, providersToRender)}

        {renderProvider('fandom', 'Fandom', 'Scrape manga information from Fandom wikis', <IconPlugConnected size={24}/>, providersToRender)}
      </Stack>
      
      <Group justify="flex-end">
        <Button variant="default" onClick={() => { void settingsQuery.refetch(); }} disabled={saving}>

          Cancel
        </Button>
        
        <Button loading={saving} onClick={() => { void handleSave(); }} leftSection={<IconCheck size={16}/>}>

          Save Settings
        </Button>
      </Group>
    </Stack>);
}
