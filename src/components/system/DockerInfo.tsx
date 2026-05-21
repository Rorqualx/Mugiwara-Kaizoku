/**
 * Component for displaying Docker container information
 * 
 * This component shows whether the application is running in a Docker container
 * and displays relevant container configuration details. It supports both a basic
 * and detailed view mode.
 * 
 * @remarks
 * Display States:
 * - Loading: Shows loading message
 * - Not in Docker: Shows non-containerized status
 * - In Docker: Shows container information
 * - Detailed: Shows additional environment details
 * 
 * Container Information:
 * - Running status
 * - Port mapping
 * - Timezone configuration
 * - Environment settings (in detailed view)
 * 
 * Visual Indicators:
 * - Blue badge: Running in Docker
 * - Gray badge: Not in Docker
 * - Docker logo with brand color
 * 
 * @example
 * ```tsx
 * // Basic usage - not in Docker
 * <DockerInfo
 *   data={{
 *     isDocker: false,
 *     containerInfo: null
 *   }}
 * />
 * 
 * // With container information
 * <DockerInfo
 *   data={{
 *     isDocker: true,
 *     containerInfo: {
 *       port: 3000,
 *       timezone: "UTC"
 *     }
 *   }}
 *   detailed={true}
 * />
 * ```
 */
import React from "react";

import { Paper, Title, Text, Group, Stack, Badge, Divider } from "@mantine/core";
import { IconDatabase } from '@tabler/icons-react';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconClock } from '@tabler/icons-react';
import { IconWorldWww } from '@tabler/icons-react';

/**
 * Props for the DockerInfo component
 */
interface DockerInfoProps {
  /** Docker status and container information */
  data: {
    /** Whether application is running in Docker */
    isDocker: boolean;
    /** Container configuration details */
    containerInfo: {
      /** Exposed container port */
      port: number;
      /** Container timezone setting */
      timezone: string;
    } | null;
  };
  /** Whether to show detailed environment information */
  detailed?: boolean;
}

export default function DockerInfo({ data, detailed = false }: DockerInfoProps): JSX.Element {
  // data is required in props, so this check is unnecessary
  // TypeScript ensures data is always provided

  // Not running in Docker
  if (!data.isDocker) {
    return (
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3}>Docker Information</Title>
          <Badge color="gray">Not Running in Docker</Badge>
        </Group>
        <Text c="dimmed">This application is not running in a Docker container.</Text>
      </Paper>);

  }

  // Running in Docker with container info
  return (
    <Paper p="md" withBorder>
      {/* Header with Docker status */}
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <IconDatabase size={24} color="#2496ED" />
          <Title order={3}>Docker Information</Title>
        </Group>
        <Badge color="blue">Running in Docker</Badge>
      </Group>

      <Stack gap="md">
        {/* Basic container information */}
        {data.containerInfo &&
        <>
            <Group gap="xs">
              <IconWorldWww size={18} />
              <Text fw={500}>Container Port:</Text>
              <Text>{data.containerInfo.port}</Text>
            </Group>

            <Group gap="xs">
              <IconClock size={18} />
              <Text fw={500}>Timezone:</Text>
              <Text>{data.containerInfo.timezone}</Text>
            </Group>
          </>
        }

        {/* Detailed environment information */}
        {detailed &&
        <>
            <Divider my="md" />
            <Title order={4} mb="md">Container Environment</Title>
            <Text>
              Running in a Docker container provides isolation and portability for the application.
              The container is configured with the following settings:
            </Text>
            <Stack gap="xs" mt="md">
              <Group justify="space-between">
                <Text fw={500}>Container Port:</Text>
                <Text>{data.containerInfo?.port ?? 'Unknown'}</Text>
              </Group>
              <Group justify="space-between">
                <Text fw={500}>Timezone:</Text>
                <Text>{data.containerInfo?.timezone ?? 'Unknown'}</Text>
              </Group>
              <Group justify="space-between">
                <Text fw={500}>Environment:</Text>
                <Text>Production</Text>
              </Group>
            </Stack>
          </>
        }
      </Stack>
    </Paper>);

}