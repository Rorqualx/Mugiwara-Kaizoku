/**
 * Component for displaying application system information
 * 
 * This component shows key information about the running application,
 * including version, environment, runtime details, and server status.
 * It supports both a concise and detailed view mode.
 * 
 * @remarks
 * Display Modes:
 * - Normal: Shows basic information with icons
 * - Detailed: Adds runtime details section
 * 
 * Visual States:
 * - Loading: Shows loading message
 * - Production: Green environment badge
 * - Development: Blue environment badge
 * 
 * Information Categories:
 * - Version information
 * - Server configuration
 * - Runtime environment
 * - System uptime
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <ApplicationInfo
 *   data={{
 *     version: '1.0.0',
 *     nodeEnv: 'production',
 *     port: 3000,
 *     nodeVersion: '18.x',
 *     startTime: new Date().toISOString()
 *   }}
 * />
 * 
 * // With detailed view
 * <ApplicationInfo
 *   data={appInfo}
 *   detailed={true}
 * />
 * ```
 */
import React from "react";

import { Paper, Title, Text, Group, Stack, Badge, Divider } from "@mantine/core";
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconInfoCircle } from '@tabler/icons-react';
import { IconCode } from '@tabler/icons-react';
import { IconCalendar } from '@tabler/icons-react';
import { IconDatabase } from '@tabler/icons-react';

import { formatDate } from '@/utils/formatters';

/**
 * Props for the ApplicationInfo component
 */
interface ApplicationInfoProps {
  /** Application system information */
  data: {
    /** Application version string */
    version: string;
    /** Node environment (production/development) */
    nodeEnv: string;
    /** Server port number */
    port: number;
    /** Node.js version string */
    nodeVersion: string;
    /** Application start timestamp */
    startTime: string;
  };
  /** Whether to show detailed runtime information */
  detailed?: boolean;
}

export default function ApplicationInfo({ data, detailed = false }: ApplicationInfoProps): JSX.Element {
  // data is required in props, so this check is unnecessary
  // TypeScript ensures data is always provided

  return (
    <Paper p="md" withBorder>
      {/* Header with environment badge */}
      <Group justify="space-between" mb="md">
        <Title order={3}>Application Information</Title>
        <Badge color={data.nodeEnv === 'production' ? 'green' : 'blue'}>
          {data.nodeEnv}
        </Badge>
      </Group>

      {/* Basic information with icons */}
      <Stack gap="md">
        <Group gap="xs">
          <IconInfoCircle size={18} />
          <Text fw={500}>Version:</Text>
          <Text>{data.version}</Text>
        </Group>

        <Group gap="xs">
          <IconDatabase size={18} />
          <Text fw={500}>Port:</Text>
          <Text>{data.port}</Text>
        </Group>

        <Group gap="xs">
          <IconCode size={18} />
          <Text fw={500}>Node.js Version:</Text>
          <Text>{data.nodeVersion}</Text>
        </Group>

        <Group gap="xs">
          <IconCalendar size={18} />
          <Text fw={500}>Started At:</Text>
          <Text>{formatDate(data.startTime)}</Text>
        </Group>
      </Stack>

      {/* Detailed runtime information - only shown in detailed mode */}
      {detailed &&
      <>
          <Divider my="md" />
          <Title order={4} mb="md">Runtime Details</Title>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={500}>Environment:</Text>
              <Text>{data.nodeEnv}</Text>
            </Group>
            <Group justify="space-between">
              <Text fw={500}>Node.js Version:</Text>
              <Text>{data.nodeVersion}</Text>
            </Group>
            <Group justify="space-between">
              <Text fw={500}>Server Port:</Text>
              <Text>{data.port}</Text>
            </Group>
            <Group justify="space-between">
              <Text fw={500}>Application Version:</Text>
              <Text>{data.version}</Text>
            </Group>
            <Group justify="space-between">
              <Text fw={500}>Start Time:</Text>
              <Text>{formatDate(data.startTime)}</Text>
            </Group>
          </Stack>
        </>
      }
    </Paper>);

}