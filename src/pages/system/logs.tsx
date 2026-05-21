/**
 * System Logs Page
 * 
 * Provides a comprehensive interface for viewing and managing system logs.
 * Features both live log streaming and historical log file management.
 * Uses domain types for consistent type safety across the application.
 * 
 * Features:
 * - Live log streaming view
 * - Historical log file browsing
 * - Log file content viewing
 * - Log file download
 * - Log file clearing
 * - Auto-refresh capabilities
 * 
 * @module pages/system/logs
 * @requires @mantine/core - UI components
 * @requires @tabler/icons-react - Icons
 * @requires @/utils/trpcClient - API client
 * @requires @/components/system/LogViewer - Live log viewer
 * @requires @/types/domain-types - Domain type definitions
 */

import type { ReactElement } from 'react';
import React from "react";
import { useState } from "react";

import { Box, Paper, Group, Text, Button, Stack, Tabs, Code, Loader } from "@mantine/core";
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconFile } from '@tabler/icons-react';
import { IconDownload } from '@tabler/icons-react';
import { IconTrash } from '@tabler/icons-react';
import { IconRefresh } from '@tabler/icons-react';
import { IconList } from '@tabler/icons-react';
import { IconCode } from '@tabler/icons-react';
import { IconSettings } from '@tabler/icons-react';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SystemLayout from '@/components/layouts/SystemLayout';
import LogViewer from '@/components/system/LogViewer';
import { useSystemLogs } from '@/hooks/useSystemLogs';
// Define LogFileInfo locally since it's not in Prisma
interface LogFileInfo {
  name: string;
  path: string;
  size: number;
  modifiedAt: Date;
}

/**
 * System Logs Page Component
 * 
 * Renders the logs management interface with tabs for live logs
 * and historical log files. Provides functionality for viewing,
 * downloading, and clearing log files.
 * 
 * State Management:
 * - Active tab selection
 * - Selected log file
 * - Log content display
 * - Loading states
 * 
 * @component
 * @example
 * ```tsx
 * // In router/navigation
 * <Route path="/system/logs" component={SystemLogs} />
 * ```
 */
export default function SystemLogs(): React.ReactElement {
  /**
   * UI State
   * Manages tab selection and content display
   */
  const [activeTab, setActiveTab] = useState<string | null>('live');

  /**
   * Use the standardized system logs hook to manage logs
   */
  const {
    selectedLogFile,
    setSelectedLogFile: _setSelectedLogFile,
    logContent,
    isLoadingContent,
    contentError,
    logFiles,
    isLoadingFiles,
    refreshLogFiles,
    clearLogFile,
    isClearingLogFile,
    downloadLogFile,
    viewLogFile,
    totalLines,
    hasMore,
    loadMore,
    isLoadingMore,
    displayMode,
    selectedFileSize,
    logConfig,
    isLoadingConfig
  } = useSystemLogs();

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size string
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  };

  /**
   * Get file size badge color based on size
   * @param {number} bytes - File size in bytes
   * @returns {string} Mantine color name
   */
  const getFileSizeBadgeColor = (bytes: number): string => {
    if (bytes < 500 * 1024) {
      return 'green';  // Small files (<500KB)
    } else if (bytes < 2 * 1024 * 1024) {
      return 'yellow'; // Medium files (500KB-2MB)
    } else {
      return 'red';    // Large files (>2MB)
    }
  };

  /**
   * Log File Selection Handler
   * Uses the hook's viewLogFile function
   *
   * @param {string} filePath - Path to selected log file
   */
  const handleLogFileSelect = (filePath: string): void => {
    viewLogFile(filePath);
  };

  /**
   * Log File Download Handler
   * Uses the hook's downloadLogFile function
   */
  const handleDownloadLog = (): void => {
    if (selectedLogFile) {
      downloadLogFile(selectedLogFile);
    }
  };

  /**
   * Log File Clear Handler
   * Uses the hook's clearLogFile function with confirmation
   */
  const handleClearLog = (): void => {
    if (!selectedLogFile || !window.confirm('Are you sure you want to clear this log file? This action cannot be undone.')) {
      return;
    }

    void clearLogFile(selectedLogFile);
  };

  return (
    <SystemLayout title="Log Files">
      {/* Tabs with active tab management */}
      <Tabs value={activeTab} onChange={setActiveTab} mb="xl">
        <Tabs.List>
          <Tabs.Tab value="live" leftSection={<IconCode size={16} />}>
            Live Logs
          </Tabs.Tab>
          <Tabs.Tab value="files" leftSection={<IconList size={16} />}>
            Log Files
          </Tabs.Tab>
        </Tabs.List>
        
        <Tabs.Panel value="live" pt="md">
          <LogViewer />
        </Tabs.Panel>
        
        <Tabs.Panel value="files" pt="md">
          <Paper withBorder p="md" mb="xl">
            <Group justify="space-between" mb="md">
              <Box>
                <Text fw={500}>System Log Files</Text>
                <Text size="sm" c="dimmed">View and manage system log files</Text>
              </Box>
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => { void refreshLogFiles(); }}
                loading={isLoadingFiles}>

                Refresh
              </Button>
            </Group>
          </Paper>

          {/* Log Rotation Settings Panel */}
          <Paper withBorder p="md" mb="xl">
            <Group gap="sm" mb="md">
              <IconSettings size={20} />
              <Text fw={500}>Log Rotation Settings</Text>
            </Group>
            {isLoadingConfig ? (
              <Group justify="center" py="md">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">Loading configuration...</Text>
              </Group>
            ) : logConfig ? (
              <Group grow gap="xl">
                <Box>
                  <Text size="sm" c="dimmed">Log Path</Text>
                  <Text size="sm" fw={500}>{logConfig.logPath}</Text>
                </Box>
                <Box>
                  <Text size="sm" c="dimmed">Max File Size</Text>
                  <Text size="sm" fw={500}>{logConfig.maxSize}</Text>
                </Box>
                <Box>
                  <Text size="sm" c="dimmed">Max Files</Text>
                  <Text size="sm" fw={500}>{logConfig.maxFiles}</Text>
                </Box>
                <Box>
                  <Text size="sm" c="dimmed">Compression</Text>
                  <Text size="sm" fw={500} c={logConfig.compress ? 'green' : 'dimmed'}>
                    {logConfig.compress ? 'Enabled ✓' : 'Disabled'}
                  </Text>
                </Box>
                <Box>
                  <Text size="sm" c="dimmed">Retention</Text>
                  <Text size="sm" fw={500}>{logConfig.retentionDays} days</Text>
                </Box>
              </Group>
            ) : (
              <Text size="sm" c="dimmed">Unable to load configuration</Text>
            )}
          </Paper>

          <Group align="flex-start" style={{ gap: '20px' }}>
            {/* Log files list */}
            <Stack style={{ width: '300px' }}>
              {isLoadingFiles ?
              <Paper withBorder p="xl" ta="center">
                  <Loader size="sm" />
                  <Text size="sm" mt="md">Loading log files...</Text>
                </Paper> :
              !logFiles || logFiles.length === 0 ?
              <Paper withBorder p="xl" ta="center">
                  <Text c="dimmed">No log files found</Text>
                </Paper> :

              logFiles.map((log: LogFileInfo) =>
              <Paper
                key={log.path}
                withBorder
                p="md"
                style={{
                  cursor: 'pointer',
                  backgroundColor: selectedLogFile === log.path ? 'var(--mantine-color-blue-0)' : undefined
                }}
                onClick={() => { void handleLogFileSelect(log.path); }}>

                    <Group justify="space-between">
                      <Group>
                        <IconFile size={24} />
                        <Box>
                          <Text fw={500}>{log["name"]}</Text>
                          <Text size="sm" c="dimmed">
                            Last Modified: {log.modifiedAt.toLocaleDateString()}
                          </Text>
                        </Box>
                      </Group>
                      <Box>
                        <Text size="sm" fw={500} c={getFileSizeBadgeColor(log.size)}>
                          {formatFileSize(log.size)}
                        </Text>
                      </Box>
                    </Group>
                  </Paper>
              )
              }
            </Stack>
            
            {/* Log file content */}
            <Paper withBorder p="md" style={{ flex: 1 }}>
              {selectedLogFile ?
              <>
                  <Group justify="space-between" mb="md">
                    <Text fw={500}>
                      {selectedLogFile.split('/').pop()}
                    </Text>
                    <Group>
                      <Button
                      variant="light"
                      size="xs"
                      leftSection={<IconDownload size={14} />}
                      onClick={() => { void handleDownloadLog(); }}>

                        Download
                      </Button>
                      <Button
                      variant="light"
                      color="red"
                      size="xs"
                      leftSection={<IconTrash size={14} />}
                      onClick={() => { void handleClearLog(); }}
                      loading={isClearingLogFile}>

                        Clear
                      </Button>
                    </Group>
                  </Group>
                  
                  {/* Display content based on mode */}
                  {displayMode === 'download-only' ? (
                    /* Download-Only Mode - Large files (>2MB) */
                    <Box ta="center" py="xl">
                      <Stack gap="md" align="center">
                        <Text size="xl" fw={500}>📊 Large Log File</Text>
                        <Text size="sm" c="dimmed">This file is too large to display in the browser</Text>

                        <Paper withBorder p="lg" style={{ maxWidth: '400px' }}>
                          <Stack gap="sm">
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">File:</Text>
                              <Text size="sm" fw={500}>{selectedLogFile.split('/').pop()}</Text>
                            </Group>
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">Size:</Text>
                              <Text size="sm" fw={500} c="red">{formatFileSize(selectedFileSize)}</Text>
                            </Group>
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">Lines:</Text>
                              <Text size="sm" fw={500}>{totalLines > 0 ? totalLines.toLocaleString() : '—'}</Text>
                            </Group>
                          </Stack>
                        </Paper>

                        <Text size="sm" c="yellow" fw={500} mt="md">
                          ⚠️ This file is too large to display in browser
                        </Text>
                        <Text size="xs" c="dimmed">
                          Download the file to view its contents
                        </Text>

                        <Button
                          variant="filled"
                          size="lg"
                          leftSection={<IconDownload size={20} />}
                          onClick={() => { void handleDownloadLog(); }}
                          mt="md">
                          Download Full File
                        </Button>
                      </Stack>
                    </Box>
                  ) : displayMode === 'preview' ? (
                    /* Preview Mode - Medium files (500KB-2MB) */
                    <>
                      <Paper withBorder p="sm" mb="md" style={{ backgroundColor: 'var(--mantine-color-yellow-0)' }}>
                        <Group justify="space-between">
                          <Box>
                            <Text size="sm" fw={500} c="yellow">⚠️ Preview Mode</Text>
                            <Text size="xs" c="dimmed">
                              Showing first 50 lines only. File size: {formatFileSize(selectedFileSize)}
                            </Text>
                          </Box>
                          <Button
                            variant="light"
                            size="xs"
                            leftSection={<IconDownload size={14} />}
                            onClick={() => { void handleDownloadLog(); }}>
                            Download Full File
                          </Button>
                        </Group>
                      </Paper>

                      {isLoadingContent ? (
                        <Box ta="center" py="xl">
                          <Loader size="sm" />
                          <Text size="sm" mt="md">Loading preview...</Text>
                        </Box>
                      ) : contentError ? (
                        <Box ta="center" py="xl">
                          <Text c="red" fw={500}>Error loading preview</Text>
                          <Text size="sm" c="dimmed" mt="xs">{contentError.message}</Text>
                        </Box>
                      ) : (
                        <>
                          <Code block style={{ maxHeight: '500px', overflow: 'auto' }}>
                            {logContent ?? 'No content in log file'}
                          </Code>
                          <Text size="xs" c="dimmed" mt="sm" ta="center">
                            Preview limited to 50 lines • Download full file to see all {totalLines} lines
                          </Text>
                        </>
                      )}
                    </>
                  ) : (
                    /* Full Mode - Small files (<500KB) */
                    <>
                      {isLoadingContent ? (
                        <Box ta="center" py="xl">
                          <Loader size="sm" />
                          <Text size="sm" mt="md">Loading log content...</Text>
                        </Box>
                      ) : contentError ? (
                        <Box ta="center" py="xl">
                          <Text c="red" fw={500}>Error loading log file</Text>
                          <Text size="sm" c="dimmed" mt="xs">{contentError.message}</Text>
                        </Box>
                      ) : (
                        <>
                          <Code block style={{ maxHeight: '500px', overflow: 'auto' }}>
                            {logContent ?? 'No content in log file'}
                          </Code>

                          {/* Pagination Info and Load More Button */}
                          {logContent && (
                            <Box mt="md">
                              <Group justify="space-between">
                                <Text size="sm" c="dimmed">
                                  Showing {logContent.split('\n').length} of {totalLines} lines
                                </Text>
                                {hasMore && (
                                  <Button
                                    variant="light"
                                    size="sm"
                                    onClick={() => { void loadMore(); }}
                                    loading={isLoadingMore}>
                                    Load More
                                  </Button>
                                )}
                              </Group>
                            </Box>
                          )}
                        </>
                      )}
                    </>
                  )}
                </> :

              <Box ta="center" py="xl">
                  <Text c="dimmed">Select a log file to view its content</Text>
                </Box>
              }
            </Paper>
          </Group>
        </Tabs.Panel>
      </Tabs>
    </SystemLayout>);

}

// Use MainLayout for this page to get the full navigation
SystemLogs.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};