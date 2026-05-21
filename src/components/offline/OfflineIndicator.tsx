/**
 * Offline Indicator Component
 *
 * Displays current offline/online status with:
 * - Connection state indicator
 * - Offline content count
 * - Sync status
 * - Quick actions
 */
import React, { useState } from 'react';

import { Box, Badge, Group, Text, ActionIcon, Popover, Stack, Button, Progress, Divider, Tooltip } from '@mantine/core';
import { IconWifi, IconWifiOff, IconCloud, IconRefresh, IconTrash, IconX, IconDownload } from '@tabler/icons-react';

import { useOfflineStatus } from '@/hooks/offline/useOfflineStatus';
import { formatRelativeTime } from '@/utils/formatters';
import { logger } from '@/utils/logger';
export function OfflineIndicator(): React.ReactElement | null {
    const { status, refresh, syncNow, clearOfflineData } = useOfflineStatus();
    const [popoverOpened, setPopoverOpened] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    if (status["status"] !== 'success') {
        return null;
    }
    const { isOnline, isServiceWorkerActive, hasOfflineContent, offlineMangaCount, pendingActionsCount, lastSyncTime, isSyncing } = status.data;
    // Determine indicator color and icon
    const getIndicatorProps = (): { color: string; icon: JSX.Element; label: string } => {
        if (!isOnline) {
            return {
                color: 'orange',
                icon: <IconWifiOff size={16}/>,
                label: 'Offline'
            };
        }
        if (pendingActionsCount > 0) {
            return {
                color: 'yellow',
                icon: <IconCloud size={16}/>,
                label: 'Syncing'
            };
        }
        if (hasOfflineContent) {
            return {
                color: 'green',
                icon: <IconCloud size={16}/>,
                label: 'Online'
            };
        }
        return {
            color: 'blue',
            icon: <IconWifi size={16}/>,
            label: 'Online'
        };
    };
    const { color, icon, label } = getIndicatorProps();
    // Handle clear offline data
    const handleClearData = async (): Promise<void> => {
        if (!window.confirm('Are you sure you want to clear all offline data?')) {
            return;
        }
        setIsClearing(true);
        try {
            await clearOfflineData();
            setPopoverOpened(false);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Failed to clear offline data:', errorMessage);
        }
        finally {
            setIsClearing(false);
        }
    };
    return (<Popover width={300} position="bottom-end" withArrow shadow="md" opened={popoverOpened} onChange={setPopoverOpened}>

      <Popover.Target>
        <Tooltip label={`${label} - Click for details`}>
          <ActionIcon variant="subtle" color={color} size="lg" onClick={() => setPopoverOpened(!popoverOpened)}>

            {icon}
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      
      <Popover.Dropdown>
        <Stack gap="sm">
          {/* Connection Status */}
          <Group justify="space-between">
            <Group gap="xs">
              {isOnline ?
            <IconWifi size={20} color="var(--mantine-color-green-6)"/> :
            <IconWifiOff size={20} color="var(--mantine-color-orange-6)"/>}
              <Text fw={500}>
                {isOnline ? 'Connected' : 'No Connection'}
              </Text>
            </Group>
            
            <Badge color={isServiceWorkerActive ? 'green' : 'red'} size="sm" variant="light">

              {isServiceWorkerActive ? 'SW Active' : 'SW Inactive'}
            </Badge>
          </Group>
          
          {/* Offline Content */}
          {hasOfflineContent &&
            <>
              <Divider />
              <Box>
                <Group justify="space-between" mb="xs">
                  <Text size="sm" c="dimmed">Offline Content</Text>
                  <Badge size="sm" variant="filled">
                    {offlineMangaCount} manga
                  </Badge>
                </Group>
                
                <Button size="xs" variant="light" leftSection={<IconDownload size={14}/>} fullWidth component="a" href="/library?filter=offline">

                  View Offline Library
                </Button>
              </Box>
            </>}
          
          {/* Sync Status */}
          {(pendingActionsCount > 0 || lastSyncTime) &&
            <>
              <Divider />
              <Box>
                <Group justify="space-between" mb="xs">
                  <Text size="sm" c="dimmed">Sync Status</Text>
                  {pendingActionsCount > 0 &&
                    <Badge size="sm" color="yellow" variant="filled">
                      {pendingActionsCount} pending
                    </Badge>}
                </Group>
                
                {isSyncing &&
                    <Progress size="xs" value={100} striped animated mb="xs"/>}
                
                {lastSyncTime &&
                    <Text size="xs" c="dimmed" mb="xs">
                    Last sync: {formatRelativeTime(lastSyncTime)}
                  </Text>}
                
                {isOnline && pendingActionsCount > 0 &&
                    <Button size="xs" variant="light" leftSection={<IconRefresh size={14}/>} fullWidth onClick={() => { void syncNow(); }} loading={isSyncing}>

                    Sync Now
                  </Button>}
              </Box>
            </>}
          
          {/* Actions */}
          <Divider />
          <Group gap="xs">
            <Button size="xs" variant="subtle" leftSection={<IconRefresh size={14}/>} onClick={() => { void refresh(); }} flex={1}>

              Refresh
            </Button>
            
            {hasOfflineContent &&
            <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14}/>} onClick={() => { void handleClearData(); }} loading={isClearing} flex={1}>

                Clear Data
              </Button>}
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>);
}
/**
 * Offline banner for important messages
 */
export function OfflineBanner(): React.ReactElement | null {
    const { status } = useOfflineStatus();
    const [dismissed, setDismissed] = useState(false);
    if (status["status"] !== 'success' || status.data.isOnline || dismissed) {
        return null;
    }
    return (<Box style={{
            position: 'fixed',
            top: 56, // Below header
            left: 0,
            right: 0,
            backgroundColor: 'var(--mantine-color-orange-6)',
            color: 'white',
            padding: '8px 16px',
            zIndex: 100,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>

      <Group justify="space-between">
        <Group gap="xs">
          <IconWifiOff size={20}/>
          <Text size="sm" fw={500}>
            You're offline. Some features may be limited.
          </Text>
        </Group>
        
        <ActionIcon variant="subtle" color="white" size="sm" onClick={() => setDismissed(true)}>

          <IconX size={16}/>
        </ActionIcon>
      </Group>
    </Box>);
}
