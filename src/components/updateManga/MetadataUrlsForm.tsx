"use client";
/**
 * Metadata URLs Form Component
 *
 * Allows users to manually specify metadata source URLs for better data extraction.
 * Particularly useful for Fandom wikis where the volume/chapters page might not be
 * automatically detected.
 */
import React, { useState } from 'react';

import { TextInput, Button, Stack, Text, Alert, Group, ActionIcon, Paper, Title, Badge, Divider, Collapse, Box } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { IconLink, IconPlus, IconTrash, IconInfoCircle, IconRefresh, IconCheck, IconBook, IconChevronDown, IconChevronUp } from '@tabler/icons-react';

import type { MangaWithRelations } from '@/types/search.types';
import { getErrorMessage } from '@/utils/errors/helpers';
import { toNumberId } from '@/utils/id-converters';
import { trpc } from '@/utils/trpc-client';
interface MetadataUrlsFormProps {
    manga: MangaWithRelations;
    onUpdate: () => void;
}
interface UrlEntry {
    url: string;
    type: 'volumes' | 'chapters' | 'custom';
    description: string;
    parseData?: {
        volumes: number;
        chapters: number;
        volumeDetails?: Array<{
            volumeNumber: number;
            title: string;
            chapterCount: number;
        }>;
    };
}
export function MetadataUrlsForm({ manga, onUpdate }: MetadataUrlsFormProps): React.ReactElement {
    const [urls, setUrls] = useState<UrlEntry[]>(() => {
        // Initialize with existing URLs from metadata
        const existingUrls: UrlEntry[] = [];
        if (manga.Metadata?.urls) {
            manga.Metadata.urls.forEach((url) => {
                // Try to determine type from URL
                let type: 'volumes' | 'chapters' | 'custom' = 'custom';
                let description = 'Custom URL';
                if (url.toLowerCase().includes('volume') || url.toLowerCase().includes('chapters_and_volumes')) {
                    type = 'volumes';
                    description = 'Volumes and Chapters Page';
                }
                else if (url.toLowerCase().includes('chapter')) {
                    type = 'chapters';
                    description = 'Chapters List Page';
                }
                existingUrls.push({ url, type, description });
            });
        }
        return existingUrls;
    });
    const [newUrl, setNewUrl] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [expandedUrls, setExpandedUrls] = useState<Set<number>>(new Set());
    // Update metadata mutation
    const updateMetadataMutation = trpc.metadata.updateUrls.useMutation({
        onSuccess: () => {
            showNotification({
                title: 'URLs Updated',
                message: 'Metadata URLs have been updated successfully',
                color: 'teal',
                icon: <IconCheck size={18}/>
            });
            onUpdate();
        },
        onError: (error: unknown) => {
            showNotification({
                title: 'Update Failed',
                message: getErrorMessage(error) || 'Failed to update metadata URLs',
                color: 'red'
            });
        }
    });
    // Refresh metadata mutation
    const refreshMetadataMutation = trpc.manga.refreshMetaData.useMutation({
        onSuccess: () => {
            showNotification({
                title: 'Metadata Refreshed',
                message: 'Metadata has been refreshed with the new URLs',
                color: 'teal',
                icon: <IconCheck size={18}/>
            });
            onUpdate();
        },
        onError: (error: unknown) => {
            showNotification({
                title: 'Refresh Failed',
                message: getErrorMessage(error) || 'Failed to refresh metadata',
                color: 'red'
            });
        }
    });
    // Parse Fandom URL mutation
    const parseFandomUrlMutation = trpc.metadata.parseFandomUrl.useMutation({
        onError: (error: unknown) => {
            showNotification({
                title: 'Parse Failed',
                message: getErrorMessage(error) || 'Failed to parse Fandom URL',
                color: 'red'
            });
        }
    });
    const addUrl = async (): Promise<void> => {
        if (!newUrl.trim())
            return;
        // Validate URL
        try {
            new URL(newUrl);
        }
        catch {
            showNotification({
                title: 'Invalid URL',
                message: 'Please enter a valid URL',
                color: 'red'
            });
            return;
        }
        // Determine type
        let type: 'volumes' | 'chapters' | 'custom' = 'custom';
        let description = 'Custom URL';
        if (newUrl.toLowerCase().includes('list_of_volumes') ||
            newUrl.toLowerCase().includes('chapters_and_volumes') ||
            newUrl.toLowerCase().includes('volumes')) {
            type = 'volumes';
            description = 'Volumes and Chapters Page';
        }
        else if (newUrl.toLowerCase().includes('chapter')) {
            type = 'chapters';
            description = 'Chapters List Page';
        }
        const urlEntry: UrlEntry = { url: newUrl, type, description };
        // If it's a Fandom URL and looks like a volumes page, try to parse it
        if (newUrl.includes('fandom.com') && type === 'volumes') {
            setIsParsing(true);
            try {
                const result = await parseFandomUrlMutation.mutateAsync({ url: newUrl });
                if (result.status === 'success') {
                    urlEntry.parseData = {
                        volumes: result.data.volumes,
                        chapters: result.data.chapters,
                        volumeDetails: result.data.volumeDetails.slice(0, 5) // Show first 5 volumes
                    };
                    showNotification({
                        title: 'Parse Successful',
                        message: `Found ${result.data.volumes} volumes with ${result.data.chapters} chapters`,
                        color: 'teal',
                        icon: <IconCheck size={18}/>
                    });
                }
            }
            catch (_error: unknown) { /* empty */ }
            finally {
                setIsParsing(false);
            }
        }
        setUrls([...urls, urlEntry]);
        setNewUrl('');
    };
    const removeUrl = (index: number): void => {
        setUrls(urls.filter((_, i) => i !== index));
    };
    const handleUpdate = async (): Promise<void> => {
        setIsUpdating(true);
        try {
            // Update the metadata URLs
            await updateMetadataMutation.mutateAsync({
                mangaId: toNumberId(manga["id"]),
                urls: urls.map((u) => u.url)
            });
            // If it's a Fandom source, refresh metadata to use the new URLs
            if (manga["source"].toLowerCase().includes('fandom')) {
                await refreshMetadataMutation.mutateAsync({
                    id: toNumberId(manga["id"]),
                    forceRefresh: true
                });
            }
        }
        finally {
            setIsUpdating(false);
        }
    };
    return (<Stack gap="md">
      <div>
        <Title order={4} mb="xs">Metadata Source URLs</Title>
        <Text size="sm" c="dimmed">
          Add URLs to help extract better metadata. For Fandom wikis, add the "List of Volumes" 
          or "Chapters and Volumes" page URL for accurate volume/chapter counts.
        </Text>
      </div>
      
      {manga["source"].toLowerCase().includes('fandom') &&
            <Alert icon={<IconInfoCircle size={18}/>} title="Fandom Wiki Tip" color="blue" mb="md">

          For best results with {manga["title"]}, look for a page titled "List of Volumes", 
          "Chapters and Volumes", or similar. This page usually contains tables with 
          detailed volume and chapter information.
        </Alert>}
      
      <Paper p="md" withBorder>
        <Stack gap="sm">
          <Group>
            <TextInput placeholder="https://example.fandom.com/wiki/List_of_Volumes" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onKeyDown={(e) => {
            if (e.key === 'Enter') {
                void addUrl();
            }
        }} style={{ flex: 1 }} leftSection={<IconLink size={18}/>}/>

            <ActionIcon variant="filled" color="blue" size="lg" onClick={() => { void addUrl(); }} disabled={!newUrl.trim() || isParsing} loading={isParsing}>

              <IconPlus size={18}/>
            </ActionIcon>
          </Group>
          
          {urls.length > 0 &&
            <>
              <Divider label="Added URLs" labelPosition="center"/>
              <Stack gap="sm">
                {urls.map((urlEntry, index) => <Box key={index}>
                    <Group gap="xs">
                      <Badge color={urlEntry.type === 'volumes' ? 'green' :
                        urlEntry.type === 'chapters' ? 'blue' :
                            'gray'} variant="light" size="sm">

                        {urlEntry.description}
                      </Badge>
                      <Text size="sm" style={{ flex: 1 }} truncate>
                        {urlEntry.url}
                      </Text>
                      {urlEntry.parseData &&
                        <ActionIcon variant="subtle" size="sm" onClick={() => {
                                const newExpanded = new Set(expandedUrls);
                                if (newExpanded.has(index)) {
                                    newExpanded.delete(index);
                                }
                                else {
                                    newExpanded.add(index);
                                }
                                setExpandedUrls(newExpanded);
                            }}>

                          {expandedUrls.has(index) ? <IconChevronUp size={16}/> : <IconChevronDown size={16}/>}
                        </ActionIcon>}
                      <ActionIcon variant="subtle" color="red" size="sm" onClick={() => removeUrl(index)}>

                        <IconTrash size={16}/>
                      </ActionIcon>
                    </Group>
                    
                    {urlEntry.parseData &&
                        <>
                        <Group gap="xs" mt="xs">
                          <Badge color="blue" variant="filled" size="sm">
                            {urlEntry.parseData.volumes} volumes
                          </Badge>
                          <Badge color="teal" variant="filled" size="sm">
                            {urlEntry.parseData.chapters} chapters
                          </Badge>
                        </Group>
                        
                        <Collapse in={expandedUrls.has(index)}>
                          <Paper p="xs" mt="xs" withBorder>
                            <Text size="xs" fw={500} mb="xs">First 5 volumes:</Text>
                            <Stack gap={4}>
                              {urlEntry.parseData.volumeDetails?.map((vol) => <Group key={vol.volumeNumber} gap="xs">
                                  <IconBook size={14}/>
                                  <Text size="xs">
                                    Volume {vol.volumeNumber}: {vol.title} ({vol.chapterCount} chapters)
                                  </Text>
                                </Group>)}
                            </Stack>
                          </Paper>
                        </Collapse>
                      </>}
                  </Box>)}
              </Stack>
            </>}
        </Stack>
      </Paper>
      
      <Group justify="flex-end">
        <Button variant="outline" leftSection={<IconRefresh size={18}/>} onClick={() => {
            setUrls([]);
            setNewUrl('');
        }} disabled={isUpdating}>

          Reset
        </Button>
        <Button leftSection={<IconCheck size={18}/>} onClick={() => { void handleUpdate(); }} loading={isUpdating} disabled={urls.length === 0}>

          Update URLs{manga["source"].toLowerCase().includes('fandom') ? ' & Refresh' : ''}
        </Button>
      </Group>
    </Stack>);
}
