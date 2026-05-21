/**
 * DownloadStep Component
 *
 * This component represents the download configuration step in the manga addition workflow.
 * It allows users to select a download location and monitoring interval for new manga.
 *
 * Features:
 * - Provides default download locations based on the user's platform
 * - Supports custom download paths
 * - Integrates with the File System Access API when available
 * - Configures monitoring intervals for automatic updates
 *
 * @module components/addManga/steps/downloadStep
 */
import React, { useEffect, useState } from "react";

import { Box, Stack, TextInput, Group, Button, Select, Text, Alert, SegmentedControl } from "@mantine/core";
import { showNotification } from '@mantine/notifications';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconFolderPlus, IconInfoCircle, IconX } from '@tabler/icons-react';

import { browseDirectory } from '@/utils/directoryBrowser';

import type { FormType } from "../form";
import type { UseFormReturnType } from "@mantine/form";
/**
 * Available monitoring interval options for manga updates
 */
const MONITORING_INTERVALS = [
    { value: 'never', label: 'Never' },
    { value: 'hourly', label: 'Every Hour' },
    { value: 'daily', label: 'Every Day' },
    { value: 'weekly', label: 'Every Week' },
    { value: 'monthly', label: 'Every Month' },
    { value: 'custom', label: 'Custom Schedule' }
];
/**
 * Default download paths by platform
 * Provides sensible defaults for different operating systems
 */
const DEFAULT_PATHS = {
    windows: [
        'Documents\\Manga',
        'Downloads\\Manga',
        'Manga'
    ],
    mac: [
        'Documents/Manga',
        'Downloads/Manga',
        'Manga'
    ],
    linux: [
        'Documents/Manga',
        'Downloads/Manga',
        'Manga'
    ],
    default: [
        'Manga',
        'Downloads/Manga',
        'Documents/Manga'
    ]
};
/**
 * DownloadStep component for configuring manga download settings
 *
 * This component allows users to:
 * 1. Select a download location from platform-specific defaults
 * 2. Enter a custom download path
 * 3. Use the File System Access API to browse for directories (when supported)
 * 4. Configure monitoring intervals for automatic updates
 *
 * @param {Object} props - Component props
 * @param {UseFormReturnType<FormType>} props.form - Form state from Mantine useForm hook
 * @returns {JSX.Element} The rendered download step component
 */
export function DownloadStep({ form }: {
    form: UseFormReturnType<FormType>;
}): React.ReactElement {
    /**
     * Component state variables
     */
    // Whether the user is using a default path or custom path
    const [downloadPathType, setDownloadPathType] = useState<'default' | 'custom'>('default');
    // Error message to display if directory selection fails
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    // Detected platform for showing appropriate default paths
    const [platform, setPlatform] = useState<'windows' | 'mac' | 'linux' | 'default'>('default');
    /**
     * Initialize component state on mount
     * - Detect user's platform for appropriate default paths
     * - Set initial download path from localStorage or default
     */
    useEffect(() => {
        // Detect platform
        if (typeof navigator === 'undefined') {
            setPlatform('default');
            return;
        }
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.indexOf('win') !== -1)
            setPlatform('windows');
        else if (userAgent.indexOf('mac') !== -1)
            setPlatform('mac');
        else if (userAgent.indexOf('linux') !== -1)
            setPlatform('linux');
        // Try to get the last used download path from localStorage
        const lastPath = localStorage.getItem('lastMangaDownloadPath');
        // Set a default path if none is set
        if (!form.values.downloadPath) {
            if (lastPath) {
                form.setFieldValue('downloadPath', lastPath);
            }
            else {
                form.setFieldValue('downloadPath', 'Manga');
            }
        }
    }, [form]);
    /**
     * Opens the directory picker dialog using the standardized browse utility
     *
     * @returns {Promise<void>}
     */
    const handleDirectorySelect = async (): Promise<void> => {
        const result = await browseDirectory();

        if (result.success && result.path) {
            // Extract just the directory name for the download path
            const pathParts = result.path.split('/').filter(Boolean);
            const dirName = pathParts[pathParts.length - 1] ?? result.path;
            form.setFieldValue('downloadPath', dirName);
            setErrorMessage(null);
        } else if (result.error && result.error !== 'Selection cancelled') {
            showNotification({
                title: 'Browse Failed',
                message: result.error,
                color: 'red',
                icon: <IconX />
            });
        }
    };
    /**
     * Sets the download path when a user selects one of the default paths
     *
     * @param {string} path - The selected default path
     */
    const handleDefaultPathSelect = (path: string): void => {
        form.setFieldValue('downloadPath', path);
        setErrorMessage(null);
    };
    /**
     * Renders the download step component
     */
    return (<Box>
      <Stack gap="md">
        <SegmentedControl value={downloadPathType} onChange={(value: string) => setDownloadPathType(value as 'default' | 'custom')} data={[
            { label: 'Default Location', value: 'default' },
            { label: 'Custom Location', value: 'custom' }
        ]} fullWidth/>

        
        <Box>
          <Text size="sm" c="dimmed" mb="md">
            The download path is where your manga files will be stored. The application will create this directory if it doesn&apos;t exist.
          </Text>
          
          {downloadPathType === 'default' ?
            <Box>
              <Text size="sm" fw={500} mb="xs">Select a default download location:</Text>
              <Stack gap="xs">
                {DEFAULT_PATHS[platform].map((path, index) => <Button key={index} variant={form.values.downloadPath === path ? "filled" : "light"} onClick={() => handleDefaultPathSelect(path)} fullWidth justify="flex-start">

                    {path}
                  </Button>)}
              </Stack>
            </Box> :
            <Group align="flex-end" gap="xs">
              <TextInput label="Custom Download Location" description="Enter a relative or absolute path" placeholder="Enter a directory path" style={{ flex: 1 }} {...form.getInputProps("downloadPath")}/>

              <Button onClick={() => { void handleDirectorySelect(); }} variant="light" leftSection={<IconFolderPlus size={16}/>}>
                Browse
              </Button>
            </Group>}
        </Box>
        
        {errorMessage &&
            <Alert color="red" title="Error" icon={<IconInfoCircle />}>
            {errorMessage}
          </Alert>}

        <Select label="Monitoring Interval" description="How often to check for updates" placeholder="Select interval" data={MONITORING_INTERVALS} defaultValue="daily" {...form.getInputProps("monitoringInterval")}/>


        {form.values.monitoringInterval === 'custom' &&
            <TextInput label="Custom Schedule" description="Enter a cron expression" placeholder="0 0 * * *" {...form.getInputProps("customInterval")}/>}
      </Stack>
    </Box>);
}
