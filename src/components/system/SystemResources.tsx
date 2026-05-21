/**
 * SystemResources component for displaying system resource information
 * 
 * This component provides a comprehensive view of system resources and metrics,
 * including CPU, memory, network, and platform information. It supports both
 * summary and detailed views of system information.
 * 
 * Features:
 * - CPU information and core details
 * - Memory usage with visual progress indicator
 * - Network interface details
 * - System uptime and load averages
 * - Platform and architecture information
 * 
 * @remarks
 * Resource Metrics:
 * - Memory Usage: Shows used/free/total with color-coded progress bar
 *   - Red: > 90% usage
 *   - Yellow: > 70% usage
 *   - Blue: Normal usage
 * - CPU Information: Model, cores, and speed
 * - Network Interfaces: IP addresses, MAC addresses, and interface types
 * - System Load: 1, 5, and 15-minute load averages
 * 
 * @example
 * ```jsx
 * // Basic usage with summary view
 * <SystemResources
 *   data={{
 *     platform: 'linux',
 *     arch: 'x64',
 *     cpus: [...],
 *     totalMemory: 16000000000,
 *     freeMemory: 8000000000,
 *     uptime: 360000,
 *     loadAvg: [1.5, 1.2, 1.0],
 *     hostname: 'server-1',
 *     networkInterfaces: {...}
 *   }}
 * />
 * 
 * // Detailed view with all metrics
 * <SystemResources
 *   data={systemData}
 *   detailed={true}
 * />
 * ```
 */

import React from "react";

import { Paper, Title, Text, Group, Stack, Progress, Divider, Grid } from "@mantine/core";
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconCpu } from '@tabler/icons-react';
import { IconDeviceDesktop } from '@tabler/icons-react';
import { IconNetwork } from '@tabler/icons-react';
import { IconDatabase } from '@tabler/icons-react';

import { formatBytes, formatDuration } from '@/utils/formatters';

import type os from 'os';

/**
 * Props for the SystemResources component
 */
interface SystemResourcesProps {
  /** System resource data from Node.js os module */
  data: {
    /** Operating system platform */
    platform: NodeJS.Platform;
    /** CPU architecture */
    arch: string;
    /** CPU information array */
    cpus: os.CpuInfo[];
    /** Total system memory in bytes */
    totalMemory: number;
    /** Free system memory in bytes */
    freeMemory: number;
    /** System uptime in seconds */
    uptime: number;
    /** System load averages [1min, 5min, 15min] */
    loadAvg: number[];
    /** System hostname */
    hostname: string;
    /** Network interface information */
    networkInterfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>;
  };
  /** Whether to show detailed system information */
  detailed?: boolean;
}

export default function SystemResources({ data, detailed = false }: SystemResourcesProps): JSX.Element {
  // data is required in props, so this check is unnecessary
  // TypeScript ensures data is always provided

  const memoryUsed = data.totalMemory - data.freeMemory;
  const memoryUsedPercentage = Math.round((memoryUsed / data.totalMemory) * 100);

  return (
    <Paper 
      p="md" 
      withBorder
    >
      <Title order={3} mb="md">System Resources</Title>

      <Stack gap="md">
        <Group gap="xs">
          <IconDeviceDesktop size={20} />
          <Text fw={500}>Platform:</Text>
          <Text>{data.platform} ({data.arch})</Text>
        </Group>

        <Group gap="xs">
          <IconDatabase size={20} />
          <Text fw={500}>Hostname:</Text>
          <Text>{data.hostname}</Text>
        </Group>

        <Group gap="xs">
          <IconCpu size={20} />
          <Text fw={500}>CPU:</Text>
          <Text>{data.cpus[0]?.model ?? 'Unknown'} ({data.cpus.length} cores)</Text>
        </Group>

        <Stack gap="xs">
          <Text fw={500}>Memory Usage:</Text>
          <Group gap="xs">
            <Progress 
              value={memoryUsedPercentage} 
              size="xl" 
              w="100%" 
              color={memoryUsedPercentage > 90 ? "red" : memoryUsedPercentage > 70 ? "yellow" : "blue"}
            />
          </Group>
          <Group justify="space-between">
            <Text size="sm">{formatBytes(memoryUsed)} used</Text>
            <Text size="sm">{formatBytes(data.freeMemory)} free</Text>
            <Text size="sm">{formatBytes(data.totalMemory)} total</Text>
          </Group>
        </Stack>

        <Group gap="xs">
          <Text fw={500}>System Uptime:</Text>
          <Text>{formatDuration(data.uptime)}</Text>
        </Group>

        <Group gap="xs">
          <Text fw={500}>Load Average:</Text>
          <Text>{data.loadAvg.map(load => load.toFixed(2)).join(', ')}</Text>
        </Group>
      </Stack>

      {detailed && (
        <>
          <Divider my="md" />
          <Title order={4} mb="md">Network Interfaces</Title>
          <Grid>
            {Object.entries(data.networkInterfaces).map(([name, interfaces]) => (
              <Grid.Col span={6} key={name}>
                <Paper p="xs" withBorder>
                  <Group gap="xs" mb="xs">
                    <IconNetwork size={18} />
                    <Text fw={500}>{name}</Text>
                  </Group>
                  <Stack gap="xs">
                    {interfaces?.map((iface, index) => (
                      <div key={index}>
                        <Group justify="space-between">
                          <Text size="sm">IP Address:</Text>
                          <Text size="sm">{iface.address}</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm">MAC:</Text>
                          <Text size="sm">{iface.mac}</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm">Type:</Text>
                          <Text size="sm">{iface.family} {iface.internal ? '(internal)' : '(external)'}</Text>
                        </Group>
                        {index < interfaces.length - 1 && <Divider my="xs" />}
                      </div>
                    ))}
                  </Stack>
                </Paper>
              </Grid.Col>
            ))}
          </Grid>

          <Divider my="md" />
          <Title order={4} mb="md">CPU Information</Title>
          <Grid>
            {data.cpus.map((cpu, index) => (
              <Grid.Col span={6} key={index}>
                <Paper p="xs" withBorder>
                  <Text fw={500} mb="xs">CPU Core {index + 1}</Text>
                  <Group justify="space-between">
                    <Text size="sm">Model:</Text>
                    <Text size="sm">{cpu.model}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Speed:</Text>
                    <Text size="sm">{cpu.speed} MHz</Text>
                  </Group>
                </Paper>
              </Grid.Col>
            ))}
          </Grid>
        </>
      )}
    </Paper>
  );
}
