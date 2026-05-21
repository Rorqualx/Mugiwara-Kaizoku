/**
 * Component for displaying database status and statistics
 * 
 * This component shows comprehensive information about the database connection
 * and statistics. It supports both a basic and detailed view mode with
 * additional statistics.
 * 
 * @remarks
 * Display Sections:
 * - Database connection info
 * - Database statistics (in detailed mode)
 * 
 * Status Indicators:
 * - Connected/Disconnected state
 * 
 * Color Coding:
 * - Green: Connected
 * - Red: Disconnected
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <DatabaseStatus
 *   data={{
 *     name: "manga_db",
 *     host: "localhost",
 *     port: "5432",
 *     user: "admin",
 *     isConnected: true
 *   }}
 * />
 * 
 * // With detailed statistics
 * <DatabaseStatus
 *   data={{
 *     ...dbInfo,
 *     stats: {
 *       mangaCount: 1000,
 *       chapterCount: 50000,
 *       libraryCount: 5,
 *       // ...other stats
 *     }
 *   }}
 *   detailed={true}
 * />
 * ```
 */
import React from "react";

import { Paper, Title, Text, Group, Badge, Stack, Divider } from "@mantine/core";
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconDatabase } from '@tabler/icons-react';
/**
 * Props for the DatabaseStatus component
 */
interface DatabaseStatusProps {
  /** Database status data */
  data: {
    /** Database name */
    name: string;
    /** Database host address */
    host: string;
    /** Database port */
    port: string;
    /** Database user */
    user: string;
    /** Whether database is connected */
    isConnected: boolean;
    /** Optional database statistics */
    stats?: {
      /** Total number of manga */
      mangaCount: number;
      /** Total number of chapters */
      chapterCount: number;
      /** Number of libraries */
      libraryCount: number;
      /** Number of active tasks */
      taskCount: number;
      /** Number of queued operations */
      queueCount: number;
    };
    // Integration status has been removed from this component
  };
  /** Whether to show detailed statistics */
  detailed?: boolean;
}

export default function DatabaseStatus({ data, detailed = false }: DatabaseStatusProps): React.JSX.Element {
  return (
    <Paper p="md" withBorder>
      {/* Database Connection Status */}
      <Group justify="space-between" mb="md">
        <Title order={3}>Database</Title>
        <Badge color={data.isConnected ? "green" : "red"} size="lg">
          {data.isConnected ? "Connected" : "Disconnected"}
        </Badge>
      </Group>

      {/* Basic Database Information */}
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <IconDatabase size={18} />
            <Text fw={500}>Database Name:</Text>
          </Group>
          <Text>{data["name"]}</Text>
        </Group>

        <Group justify="space-between">
          <Group gap="xs">
            <IconDatabase size={18} />
            <Text fw={500}>Host:</Text>
          </Group>
          <Text>{data.host}:{data.port}</Text>
        </Group>

        <Group justify="space-between">
          <Text fw={500}>User:</Text>
          <Text>{data.user}</Text>
        </Group>
      </Stack>

      {/* Detailed Statistics Section */}
      {detailed && data.stats && (
        <>
          <Divider my="md" />
          <Title order={4} mb="md">Database Statistics</Title>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={500}>Manga Count:</Text>
              <Text>{data.stats.mangaCount.toLocaleString()}</Text>
            </Group>
            <Group justify="space-between">
              <Text fw={500}>Chapter Count:</Text>
              <Text>{data.stats.chapterCount.toLocaleString()}</Text>
            </Group>
            <Group justify="space-between">
              <Text fw={500}>Library Count:</Text>
              <Text>{data.stats.libraryCount.toLocaleString()}</Text>
            </Group>
            <Group justify="space-between">
              <Text fw={500}>Task Count:</Text>
              <Text>{data.stats.taskCount.toLocaleString()}</Text>
            </Group>
            <Group justify="space-between">
              <Text fw={500}>Queue Count:</Text>
              <Text>{data.stats.queueCount.toLocaleString()}</Text>
            </Group>
          </Stack>
        </>
      )}
      
      {/* Integration status section has been removed */}
    </Paper>
  );
}
