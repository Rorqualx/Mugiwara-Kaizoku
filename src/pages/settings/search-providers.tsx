/**
 * Search Providers Settings Page
 * 
 * This page allows users to configure search providers, set defaults, and manage
 * provider-specific settings. Implements tRPC endpoints for provider management.
 * 
 * @module pages/settings/search-providers
 */

'use client';

import React, { useState } from 'react';

import { Container, Title, Text, Stack, Card, Group, Button, Select, Switch, Badge, Tabs, TextInput, NumberInput, PasswordInput, Alert, Loader, Paper, SimpleGrid } from '@mantine/core';
import { MetadataProvider } from '@prisma/client';
import { IconSearch } from '@tabler/icons-react';
import { IconSettings } from '@tabler/icons-react';
import { IconPlugConnected } from '@tabler/icons-react';
import { IconInfoCircle } from '@tabler/icons-react';
import { } from '@tabler/icons-react';
import { } from '@tabler/icons-react';
import { IconAlertCircle } from '@tabler/icons-react';

import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';


// Helper functions for safe type handling
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Helper ready for future type checks
function isRecordType(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Provider configuration interface
 */
interface ProviderConfig {
  enabled: boolean;
  settings?: Record<string, unknown>;
}

/**
 * Prowlarr configuration interface
 */
interface ProwlarrConfig {
  enabled: boolean;
  url: string;
  apiKey: string;
  syncCategories: string[];
}
export default function SearchProvidersSettings(): React.ReactElement {
  // Fetch available providers (cached for 10 minutes - static list)
  const {
    data: providers,
    isPending: providersLoading,
    refetch: refetchProviders
  } = trpc.search.getProviders.useQuery(undefined, {
    staleTime: 10 * 60 * 1000, // 10 minutes - provider list is static
    refetchOnWindowFocus: false
  });

  // Fetch current configuration (cached for 5 minutes - matches backend cache)
  const {
    data: config,
    isPending: configLoading
  } = trpc.settings.search.getConfig.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes - matches backend 10-minute cache
    refetchOnWindowFocus: false
  });

  // Mutations
  const setDefaultProviderMutation = trpc.search.setDefaultProvider.useMutation({
    onSuccess: () => {
      notify({ severity: 'SUCCESS', title: 'Success', message: 'Default provider updated successfully' });
      void refetchProviders();
    },
    onError: error => {
      notify({ severity: 'ERROR', title: 'Error', message: (error instanceof Error ? error.message : String(error)) ?? 'Failed to update default provider' });
    }
  });
  const updateConfigMutation = trpc.settings.search.updateConfig.useMutation({
    onSuccess: () => {
      notify({ severity: 'SUCCESS', title: 'Success', message: 'Configuration updated successfully' });
    },
    onError: error => {
      notify({ severity: 'ERROR', title: 'Error', message: (error instanceof Error ? error.message : String(error)) ?? 'Failed to update configuration' });
    }
  });
  // Local state for form — config is now the bare SearchProviderConfig payload
  const searchConfig = config as { defaultProvider?: string; providers?: Record<string, ProviderConfig> } | undefined;
  const [selectedProvider, setSelectedProvider] = useState<string>(searchConfig?.defaultProvider ?? '');
  const [providerConfigs, setProviderConfigs] = useState<Record<string, ProviderConfig>>(searchConfig?.providers ?? {});
  const [prowlarrConfig, setProwlarrConfig] = useState<ProwlarrConfig>({
    enabled: false,
    url: '',
    apiKey: '',
    syncCategories: ['manga', 'comics']
  });

  // Update local state when data loads
  React.useEffect(() => {
    if (config) {
      const loadedConfig = config as { defaultProvider?: string; providers?: Record<string, ProviderConfig> } | undefined;
      setSelectedProvider(loadedConfig?.defaultProvider ?? '');
      setProviderConfigs(loadedConfig?.providers ?? {});
      setProwlarrConfig({
        enabled: false,
        url: '',
        apiKey: '',
        syncCategories: ['manga', 'comics']
      });
    }
  }, [config]);
  const handleSetDefaultProvider = (): void => {
    if (selectedProvider) {
      void setDefaultProviderMutation.mutateAsync({
        provider: selectedProvider
      });
    }
  };
  const handleUpdateProviderConfig = (providerId: string, updates: Partial<ProviderConfig>): void => {
    const existingConfig = providerConfigs[providerId];
    const newConfigs = {
      ...providerConfigs,
      [providerId]: {
        ...(existingConfig ?? {}),
        ...updates
      } as ProviderConfig
    };
    setProviderConfigs(newConfigs);
  };
  const handleSaveConfiguration = (): void => {
    void updateConfigMutation.mutateAsync({
      defaultProvider: selectedProvider,
      providers: providerConfigs
    });
  };
  if (providersLoading || configLoading) {
    return <Container>
        <Title order={2} mb="xl">Search Provider Settings</Title>
        <Text>Loading configuration...</Text>
      </Container>;
  }

  // Convert string providers to objects if needed
  const availableProviders = (providers ?? []).map(p => typeof p === 'string' ? {
    id: p,
    name: p,
    requiresAuth: false
  } : p);
  const defaultProvider = availableProviders.find(p => p["id"] === selectedProvider);
  return <Container size="lg">
      <Title order={2} mb="xl">Search Provider Settings</Title>
      
      <Tabs defaultValue="providers">
        <Tabs.List>
          <Tabs.Tab value="providers" leftSection={<IconSearch size={16} />}>
            Providers
          </Tabs.Tab>
          <Tabs.Tab value="prowlarr" leftSection={<IconPlugConnected size={16} />}>
            Prowlarr Integration
          </Tabs.Tab>
          <Tabs.Tab value="preferences" leftSection={<IconSettings size={16} />}>
            Preferences
          </Tabs.Tab>
        </Tabs.List>
        
        <Tabs.Panel value="providers" pt="xl">
          <Stack>
            {/* Default Provider Selection */}
            <Card>
              <Title order={4} mb="md">Default Provider</Title>
              <Group>
                <Select label="Select Default Provider" placeholder="Choose a provider..." data={availableProviders.map(p => ({
                value: p["id"],
                label: p["name"] ?? p.id
              }))} value={selectedProvider} onChange={value => setSelectedProvider(value ?? '')} style={{
                flex: 1
              }} />

                <Button onClick={handleSetDefaultProvider} loading={setDefaultProviderMutation.isPending} disabled={!selectedProvider} mt="xl">

                  Set Default
                </Button>
              </Group>
              {defaultProvider && <Alert icon={<IconInfoCircle />} mt="md" color="blue">
                  <Text size="sm">
                    <strong>{defaultProvider["name"]}</strong> is currently set as your default search provider.
                  </Text>
                </Alert>}
            </Card>
            
            {/* Provider Configuration */}
            <Card>
              <Title order={4} mb="md">Provider Configuration</Title>
              <Stack>
                {availableProviders.map(provider => <Card key={provider["id"]} withBorder>
                    <Group justify="space-between" mb="md">
                      <Group>
                        <Text fw={500}>{provider["name"]}</Text>
                        {provider["id"] === selectedProvider && <Badge color="blue" size="sm">Default</Badge>}
                      </Group>
                      <Group>
                        <Switch checked={providerConfigs[provider["id"]]?.enabled ?? true} onChange={event => handleUpdateProviderConfig(provider["id"], {
                      enabled: event.currentTarget.checked
                    })} />

                      </Group>
                    </Group>
                    
                    {/* Provider-specific settings */}
                    {('requiresAuth' in provider && provider.requiresAuth) && <Stack gap="sm">
                    {provider["id"] === MetadataProvider.COMICVINE && <TextInput label="API Key" placeholder="Enter ComicVine API key" value={providerConfigs[provider["id"]]?.settings?.["apiKey"] as string ?? ''} onChange={event => handleUpdateProviderConfig(provider["id"], {
                    enabled: providerConfigs[provider["id"]]?.enabled ?? true,
                    settings: {
                      ...providerConfigs[provider["id"]]?.settings,
                      apiKey: event.currentTarget.value
                    }
                  })} />}
                    
                    {provider["id"] === MetadataProvider.ANILIST && <>
                    <TextInput label="Client ID" placeholder="Enter OAuth client ID" value={providerConfigs[provider["id"]]?.settings?.["clientId"] as string ?? ''} onChange={event => handleUpdateProviderConfig(provider["id"], {
                      enabled: providerConfigs[provider["id"]]?.enabled ?? true,
                      settings: {
                        ...providerConfigs[provider["id"]]?.settings,
                        clientId: event.currentTarget.value
                      }
                    })} />

                      <PasswordInput label="Client Secret" placeholder="Enter OAuth client secret" value={providerConfigs[provider["id"]]?.settings?.["clientSecret"] as string ?? ''} onChange={event => handleUpdateProviderConfig(provider["id"], {
                      enabled: providerConfigs[provider["id"]]?.enabled ?? true,
                      settings: {
                        ...providerConfigs[provider["id"]]?.settings,
                        clientSecret: event.currentTarget.value
                      }
                    })} />

                          </>}
                      </Stack>}
                    
                    <Group mt="md">
                      <NumberInput label="Priority" description="Lower number = higher priority" value={providerConfigs[provider["id"]]?.settings?.["priority"] as number ?? 0} onChange={value => handleUpdateProviderConfig(provider["id"], {
                    enabled: providerConfigs[provider["id"]]?.enabled ?? true,
                    settings: {
                      ...providerConfigs[provider["id"]]?.settings,
                      priority: value !== null && value !== undefined ? Number(value) : 0
                    }
                  })} min={0} max={100} style={{
                    width: 120
                  }} />


                      <NumberInput label="Timeout (ms)" description="Request timeout" value={providerConfigs[provider["id"]]?.settings?.["timeout"] as number ?? 30000} onChange={value => handleUpdateProviderConfig(provider["id"], {
                    enabled: providerConfigs[provider["id"]]?.enabled ?? true,
                    settings: {
                      ...providerConfigs[provider["id"]]?.settings,
                      timeout: value !== null && value !== undefined ? Number(value) : 30000
                    }
                  })} min={1000} max={60000} step={1000} style={{
                    width: 150
                  }} />


                      <NumberInput label="Rate Limit" description="Requests per minute" value={providerConfigs[provider["id"]]?.settings?.["rateLimit"] as number ?? 60} onChange={value => handleUpdateProviderConfig(provider["id"], {
                    enabled: providerConfigs[provider["id"]]?.enabled ?? true,
                    settings: {
                      ...providerConfigs[provider["id"]]?.settings,
                      rateLimit: value !== null && value !== undefined ? Number(value) : 60
                    }
                  })} min={1} max={300} style={{
                    width: 150
                  }} />

                    </Group>
                  </Card>)}
              </Stack>
            </Card>
          </Stack>
        </Tabs.Panel>
        
        <Tabs.Panel value="prowlarr" pt="xl">
          <Card>
            <Title order={4} mb="md">Prowlarr Integration</Title>
            <Stack>
              <Switch label="Enable Prowlarr Integration" description="Use Prowlarr for unified indexer management" checked={prowlarrConfig.enabled} onChange={event => setProwlarrConfig({
              ...prowlarrConfig,
              enabled: event.currentTarget.checked
            })} />

              
              {prowlarrConfig.enabled && <>
                  <TextInput label="Prowlarr URL" placeholder="http://localhost:9696" value={prowlarrConfig.url} onChange={event => setProwlarrConfig({
                ...prowlarrConfig,
                url: event.currentTarget.value
              })} required />

                  
                  <PasswordInput label="API Key" placeholder="Enter Prowlarr API key" value={prowlarrConfig.apiKey} onChange={event => setProwlarrConfig({
                ...prowlarrConfig,
                apiKey: event.currentTarget.value
              })} required />

                  
                  <Text size="sm" fw={500}>Sync Categories</Text>
                  <Group>
                    {['manga', 'comics', 'books'].map(category => <Switch key={category} label={category.charAt(0).toUpperCase() + category.slice(1)} checked={prowlarrConfig.syncCategories.includes(category)} onChange={event => {
                  if (event.currentTarget.checked) {
                    setProwlarrConfig({
                      ...prowlarrConfig,
                      syncCategories: [...prowlarrConfig.syncCategories, category]
                    });
                  } else {
                    setProwlarrConfig({
                      ...prowlarrConfig,
                      syncCategories: prowlarrConfig.syncCategories.filter(c => c !== category)
                    });
                  }
                }} />)}
                  </Group>
                </>}
            </Stack>
          </Card>
        </Tabs.Panel>
        
        <Tabs.Panel value="preferences" pt="xl">
          <Card>
            <Title order={4} mb="md">Search Preferences</Title>
            <Stack>
              <Switch label="Auto-search on provider change" description="Automatically re-run search when switching providers" />

              
              <Switch label="Show adult content by default" description="Include adult content in search results" />

              
              <Switch label="Prefer official translations" description="Prioritize official translations in search results" />

              
              <NumberInput label="Results per page" description="Number of results to display per page" defaultValue={20} min={10} max={100} step={10} />

              
              <Select label="Default sort order" data={[{
              value: 'relevance',
              label: 'Relevance'
            }, {
              value: 'popularity',
              label: 'Popularity'
            }, {
              value: 'score',
              label: 'Score'
            }, {
              value: 'title',
              label: 'Title'
            }, {
              value: 'date',
              label: 'Release Date'
            }]} defaultValue="relevance" />

            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>
      
      {/* All Available Providers (Using listProviders endpoint) */}
      <Card withBorder shadow="sm" mt="xl">
        <Title order={3} mb="md">All Available Providers</Title>
        <Text size="sm" c="dimmed" mb="lg">
          Complete list of all providers supported by the system
        </Text>
        
        {(() => {
        // Using the listProviders endpoint
        const listProvidersQuery = trpc.settings.search.listProviders.useQuery();
        if (listProvidersQuery.isPending) {
          return <Loader size="sm" />;
        }
        if (listProvidersQuery.error) {
          return <Alert color="red" icon={<IconAlertCircle />}>
                Failed to load provider list
              </Alert>;
        }
        return <SimpleGrid cols={{
          base: 1,
          sm: 2,
          md: 3
        }}>
              {listProvidersQuery.data?.map((provider: Record<string, unknown>) => {
                const providerId = provider["id"];
                const providerName = provider["name"];
                const providerType = provider["type"];
                const providerDescription = provider["description"];

                return <Paper key={String(providerId)} p="md" withBorder>
                  <Group justify="space-between" mb="xs">
                    <Text fw={500}>{typeof providerName === 'string' ? providerName : String(providerId)}</Text>
                    <Badge size="xs" color="blue">
                      {typeof providerType === 'string' ? providerType : 'metadata'}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    ID: {String(providerId)}
                  </Text>
                  {typeof providerDescription === 'string' && <Text size="xs" c="dimmed" mt="xs">
                      {providerDescription}
                    </Text>}
                </Paper>;
              })}
            </SimpleGrid>;
      })()}
      </Card>
      
      {/* Save Button */}
      <Group justify="flex-end" mt="xl">
        <Button size="lg" onClick={handleSaveConfiguration} loading={updateConfigMutation.isPending}>

          Save Configuration
        </Button>
      </Group>
    </Container>;
}