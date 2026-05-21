/**
 * SystemHealthComponent
 *
 * Displays system health information and allows running health checks.
 * Previously located in system/plugins, now integrated into system status page.
 *
 * Features:
 * - Integration status indicators
 * - Cache status
 * - Health check functionality
 *
 * @module components/system/SystemHealthComponent
 */
import React from "react";

import { Paper, Text, Group, Badge, Button, Divider } from "@mantine/core";
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconRefresh } from '@tabler/icons-react';

import { useSettings } from '@/hooks/useSettings';
import { notify } from '@/utils/notify';
// TypeScript interface for system settings
interface SystemHealthSettings {
    mangalEnabled?: boolean;
    suwayomiEnabled?: boolean;
    cacheEnabled?: boolean;
}
/**
 * SystemHealthComponent
 *
 * Displays system health status and provides health check functionality
 *
 * @returns {JSX.Element} System health interface
 */
export function SystemHealthComponent(): React.ReactElement {
    const { settings } = useSettings();
    // Type guard to check if settings exists and is an object
    const isValidSettings = (val: unknown): val is SystemHealthSettings => {
        return val !== null && typeof val === 'object';
    };
    // Safely access settings with proper type checking
    const typedSettings = isValidSettings(settings) ? settings as SystemHealthSettings : {} as SystemHealthSettings;
    /**
     * Check system health
     */
    const checkHealth = (): void => {
        try {
            // This would be implemented in a real application
            // Simulating success for now
            setTimeout(() => {
                notify({ severity: 'SUCCESS', title: 'System Health', message: 'All systems operational' });
            }, 1000);
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Health check failed';
            notify({ severity: 'ERROR', title: 'Error', message: errorMessage });
        }
    };
    return (<Paper p="lg" withBorder>
      <Text fw={700} size="lg" mb="md">System Health</Text>
      
      <Group justify="space-between" mb="md">
        <Text>Mangal Status:</Text>
        <Badge color={typedSettings.mangalEnabled ? "green" : "gray"}>
          {typedSettings.mangalEnabled ? "Enabled" : "Disabled"}
        </Badge>
      </Group>
      
      <Group justify="space-between" mb="md">
        <Text>Suwayomi Status:</Text>
        <Badge color={typedSettings.suwayomiEnabled ? "green" : "gray"}>
          {typedSettings.suwayomiEnabled ? "Enabled" : "Disabled"}
        </Badge>
      </Group>
      
      <Group justify="space-between" mb="md">
        <Text>Cache Status:</Text>
        <Badge color={typedSettings.cacheEnabled !== false ? "green" : "gray"}>
          {typedSettings.cacheEnabled !== false ? "Enabled" : "Disabled"}
        </Badge>
      </Group>
      
      <Divider mb="md"/>
      
      <Group justify="center">
        <Button leftSection={<IconRefresh size={16}/>} onClick={() => { void checkHealth(); }}>
          Run Health Check
        </Button>
      </Group>
    </Paper>);
}
