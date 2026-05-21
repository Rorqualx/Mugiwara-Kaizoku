/**
 * EditLibraryModal component for editing library settings
 *
 * This component provides a modal interface for editing library
 * configuration including name, path, and advanced options.
 */
import React, { useState, useCallback } from 'react';

import { Modal, TextInput, Stack, Button, Group, Text, Divider, Checkbox, Select, NumberInput, Tabs, LoadingOverlay, Alert } from '@mantine/core';
import { IconFolder, IconSettings, IconAlertCircle, IconDeviceFloppy, IconX, IconBook } from '@tabler/icons-react';

import { useLibraryViewStore } from '@/store/index';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';
interface EditLibraryModalProps {
    opened: boolean;
    onClose: () => void;
    library: {
        id: number;
        name: string;
        path: string;
    };
}
export function EditLibraryModal({ opened, onClose, library }: EditLibraryModalProps): React.ReactElement {
    // Form state
    const [name, setName] = useState(library["name"]);
    const [path, setPath] = useState(library.path);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    // Advanced options from store
    const autoDownloadNewChapters = useLibraryViewStore((state) => state.autoDownloadNewChapters);
    const sendUpdateNotifications = useLibraryViewStore((state) => state.sendUpdateNotifications);
    const autoMarkAsRead = useLibraryViewStore((state) => state.autoMarkAsRead);
    const enableMetadataEnhancement = useLibraryViewStore((state) => state.enableMetadataEnhancement);
    const skipEmptyVolumes = useLibraryViewStore((state) => state.skipEmptyVolumes);
    const setAutoDownloadNewChapters = useLibraryViewStore((state) => state.setAutoDownloadNewChapters);
    const setSendUpdateNotifications = useLibraryViewStore((state) => state.setSendUpdateNotifications);
    const setAutoMarkAsRead = useLibraryViewStore((state) => state.setAutoMarkAsRead);
    const setEnableMetadataEnhancement = useLibraryViewStore((state) => state.setEnableMetadataEnhancement);
    const setSkipEmptyVolumes = useLibraryViewStore((state) => state.setSkipEmptyVolumes);
    // Additional library-specific settings
    const [scanInterval, setScanInterval] = useState('daily');
    const [preferredLanguage, setPreferredLanguage] = useState('en');
    const [downloadQuality, setDownloadQuality] = useState('high');
    const [maxConcurrentDownloads, setMaxConcurrentDownloads] = useState(3);
    // Get mutation
    const updateLibraryMutation = trpc.library.update.useMutation();
    const validateForm = useCallback((): boolean => {
        const newErrors: Record<string, string> = {};
        if (!name.trim()) {
            newErrors["name"] = 'Library name is required';
        }
        if (!path.trim()) {
            newErrors["path"] = 'Library path is required';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [name, path]);
    const handleSave = useCallback(async () => {
        if (!validateForm()) {
            return;
        }
        setIsLoading(true);
        try {
            // Update library name (path is typically not editable after creation)
            await updateLibraryMutation.mutateAsync({
                id: library["id"],
                name: name.trim()
            });
            // Save advanced options to store (they persist via localStorage)
            // In a real implementation, these might be saved to the backend
            notify({ severity: 'SUCCESS', title: 'Library Updated', message: 'Library settings have been saved successfully' });
            onClose();
        }
        catch (error: unknown) {
            notify({ severity: 'ERROR', title: 'Update Failed', message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Failed to update library' });
        }
        finally {
            setIsLoading(false);
        }
    }, [validateForm, updateLibraryMutation, library, name, onClose]);
    const handleCancel = useCallback(() => {
        // Reset form to original values
        setName(library["name"]);
        setPath(library.path);
        setErrors({});
        onClose();
    }, [library, onClose]);
    return (<Modal opened={opened} onClose={() => { void handleCancel(); }} title="Edit Library" size="lg" closeOnClickOutside={!isLoading} closeOnEscape={!isLoading}>

      <LoadingOverlay visible={isLoading}/>
      
      <Tabs defaultValue="general">
        <Tabs.List>
          <Tabs.Tab value="general" leftSection={<IconBook size={14}/>}>
            General
          </Tabs.Tab>
          <Tabs.Tab value="scanning" leftSection={<IconFolder size={14}/>}>
            Scanning
          </Tabs.Tab>
          <Tabs.Tab value="advanced" leftSection={<IconSettings size={14}/>}>
            Advanced
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="general" pt="md">
          <Stack gap="md">
            <TextInput label="Library Name" placeholder="Enter library name" value={name} onChange={(e) => setName(e.currentTarget.value)} error={errors["name"]} required leftSection={<IconBook size={16}/>}/>

            
            <TextInput label="Library Path" placeholder="/path/to/library" value={path} onChange={(e) => setPath(e.currentTarget.value)} error={errors["path"]} required disabled // Path typically cannot be changed after creation
     leftSection={<IconFolder size={16}/>}/>

            
            {path !== library.path &&
            <Alert icon={<IconAlertCircle size={16}/>} title="Path Change" color="yellow">

                Library path cannot be changed after creation. Create a new library to use a different path.
              </Alert>}
            
            <Select label="Scan Interval" placeholder="Select scan interval" value={scanInterval} onChange={(value) => setScanInterval(value ?? 'daily')} data={[
            { value: 'hourly', label: 'Every Hour' },
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'manual', label: 'Manual Only' }
        ]}/>

          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="scanning" pt="md">
          <Stack gap="md">
            <Text size="sm" fw={500}>Scanning Options</Text>
            
            <Checkbox label="Skip volumes without chapters" checked={skipEmptyVolumes} onChange={(event) => setSkipEmptyVolumes(event.currentTarget.checked)}/>

            
            <Checkbox label="Enable metadata enhancement" description="Automatically fetch and update metadata from online sources" checked={enableMetadataEnhancement} onChange={(event) => setEnableMetadataEnhancement(event.currentTarget.checked)}/>

            
            <Select label="Preferred Language" placeholder="Select language" value={preferredLanguage} onChange={(value) => setPreferredLanguage(value ?? 'en')} data={[
            { value: 'en', label: 'English' },
            { value: 'jp', label: 'Japanese' },
            { value: 'es', label: 'Spanish' },
            { value: 'fr', label: 'French' },
            { value: 'de', label: 'German' },
            { value: 'it', label: 'Italian' },
            { value: 'pt', label: 'Portuguese' }
        ]}/>

          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="advanced" pt="md">
          <Stack gap="md">
            <Text size="sm" fw={500}>Download Settings</Text>
            
            <Checkbox label="Auto-download new chapters" description="Automatically download new chapters when they are found" checked={autoDownloadNewChapters} onChange={(event) => setAutoDownloadNewChapters(event.currentTarget.checked)}/>

            
            <Checkbox label="Automatically mark as read when downloaded" description="Mark chapters as read after successful download" checked={autoMarkAsRead} onChange={(event) => setAutoMarkAsRead(event.currentTarget.checked)}/>

            
            <Select label="Download Quality" placeholder="Select quality" value={downloadQuality} onChange={(value) => setDownloadQuality(value ?? 'high')} data={[
            { value: 'high', label: 'High Quality' },
            { value: 'medium', label: 'Medium Quality' },
            { value: 'low', label: 'Low Quality' },
            { value: 'original', label: 'Original' }
        ]}/>


            <NumberInput label="Max Concurrent Downloads" description="Maximum number of simultaneous downloads" value={maxConcurrentDownloads} onChange={(value) => setMaxConcurrentDownloads(Number(value) || 3)} min={1} max={10}/>

            
            <Divider />
            
            <Text size="sm" fw={500}>Notification Settings</Text>
            
            <Checkbox label="Send notifications for updates" description="Notify when new chapters are available" checked={sendUpdateNotifications} onChange={(event) => setSendUpdateNotifications(event.currentTarget.checked)}/>

          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Divider my="md"/>
      
      {/* Footer */}
      <Group gap="sm" justify="flex-end">
        <Button variant="outline" onClick={() => { void handleCancel(); }} disabled={isLoading} leftSection={<IconX size={16}/>}>

          Cancel
        </Button>
        <Button onClick={() => { void handleSave(); }} loading={updateLibraryMutation.isPending || isLoading} leftSection={<IconDeviceFloppy size={16}/>}>

          Save Changes
        </Button>
      </Group>
    </Modal>);
}
