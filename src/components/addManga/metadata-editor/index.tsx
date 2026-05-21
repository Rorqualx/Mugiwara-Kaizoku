/**
 * MetadataEditor component - Main orchestrator
 *
 * A comprehensive metadata editing interface with URL parsing, inline editing,
 * and preview capabilities for all metadata fields.
 *
 * @module metadata-editor
 */

import React from 'react';

import {
  Modal,
  Stack,
  Group,
  TextInput,
  Button,
  Tabs,
  Text,
  Paper,
  Tooltip,
  Alert,
  Loader,
  Divider,
  ScrollArea,
  Switch,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import {
  IconLink,
  IconPhoto,
  IconCheck,
  IconDownload,
  IconUpload,
  IconRefresh,
  IconDatabase,
  IconBook,
  IconCalendar,
  IconTags,
  IconWorld,
  IconAlertCircle,
  IconCopy,
} from '@tabler/icons-react';

import { editorFieldCategories } from '@/components/metadata/fieldCategories';

import { FieldEditor } from './FieldEditor';
import { useMetadataEditor } from './hooks/useMetadataEditor';

import type { MetadataEditorProps } from './types';

export const MetadataEditor: React.FC<MetadataEditorProps> = (props) => {
  const { opened, onClose, fieldSelections, allSources } = props;

  const {
    editedFields,
    activeTab,
    previewMode,
    bulkParseUrl,
    isBulkParsing,
    handleFieldUpdate,
    handleUrlParse,
    handleBulkParse,
    handleSave,
    setActiveTab,
    setPreviewMode,
    setBulkParseUrl,
  } = useMetadataEditor(props);

  const fieldCategories = editorFieldCategories;

  const handleCopyAll = (): void => {
    const allData = {
      ...fieldSelections,
      ...Object.fromEntries(Object.entries(editedFields).map(([k, v]) => [k, v.value])),
    };

    if (typeof navigator !== 'undefined') {
      void navigator.clipboard.writeText(JSON.stringify(allData, null, 2));
      showNotification({
        title: 'Copied',
        message: 'Metadata copied to clipboard',
        color: 'green',
      });
    }
  };

  const handleExport = (): void => {
    const allData = {
      ...fieldSelections,
      ...Object.fromEntries(Object.entries(editedFields).map(([k, v]) => [k, v.value])),
    };

    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manga-metadata.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (): void => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string) as Record<string, unknown>;
            Object.entries(data).forEach(([field, value]) => {
              if (typeof value === 'object' && value !== null && 'value' in value) {
                const valueObj = value as Record<string, unknown>;
                handleFieldUpdate(
                  field,
                  valueObj['value'],
                  typeof valueObj['source'] === 'string' ? valueObj['source'] : 'imported',
                  typeof valueObj['customUrl'] === 'string' ? valueObj['customUrl'] : undefined
                );
              } else {
                handleFieldUpdate(field, value, 'imported');
              }
            });
            showNotification({
              title: 'Imported',
              message: 'Metadata imported successfully',
              color: 'green',
            });
          } catch {
            showNotification({
              title: 'Import Failed',
              message: 'Invalid JSON file',
              color: 'red',
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <Modal
      opened={opened}
      onClose={() => void onClose()}
      size="xl"
      title={
        <Group>
          <IconDatabase size={20} />
          <Text fw={600}>Metadata Editor</Text>
        </Group>
      }
    >
      <Stack>
        {/* Bulk Parse Section */}
        <Paper p="sm" withBorder>
          <Stack gap="xs">
            <Group gap="xs">
              <IconLink size={18} />
              <Text size="sm" fw={500}>
                Bulk Import from URL
              </Text>
            </Group>
            <Group gap="xs">
              <TextInput
                placeholder="Paste a Fandom, AniList, ComicVine, Wikipedia, or image URL..."
                value={bulkParseUrl}
                onChange={(e) => setBulkParseUrl(e.target.value)}
                style={{ flex: 1 }}
                rightSection={isBulkParsing && <Loader size="xs" />}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleBulkParse();
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => void handleBulkParse()}
                loading={isBulkParsing}
                leftSection={<IconRefresh size={14} />}
              >
                Parse All Fields
              </Button>
            </Group>
            <Text size="xs" c="dimmed">
              Automatically extract and update multiple metadata fields from a single URL
            </Text>
          </Stack>
        </Paper>

        <Divider />

        <Group justify="space-between">
          <Switch
            label="Preview Mode"
            checked={previewMode}
            onChange={(e) => setPreviewMode(e.currentTarget.checked)}
          />

          <Group gap="xs">
            <Tooltip label="Copy all metadata as JSON">
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconCopy size={14} />}
                onClick={handleCopyAll}
              >
                Copy All
              </Button>
            </Tooltip>
            <Tooltip label="Export metadata to file">
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconDownload size={14} />}
                onClick={handleExport}
              >
                Export
              </Button>
            </Tooltip>
            <Tooltip label="Import metadata from file">
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconUpload size={14} />}
                onClick={handleImport}
              >
                Import
              </Button>
            </Tooltip>
          </Group>
        </Group>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="basic" leftSection={<IconBook size={14} />}>
              Basic
            </Tabs.Tab>
            <Tabs.Tab value="media" leftSection={<IconPhoto size={14} />}>
              Media
            </Tabs.Tab>
            <Tabs.Tab value="volumes" leftSection={<IconDatabase size={14} />}>
              Volumes
            </Tabs.Tab>
            <Tabs.Tab value="metadata" leftSection={<IconTags size={14} />}>
              Metadata
            </Tabs.Tab>
            <Tabs.Tab value="dates" leftSection={<IconCalendar size={14} />}>
              Dates
            </Tabs.Tab>
            <Tabs.Tab value="additional" leftSection={<IconWorld size={14} />}>
              Additional
            </Tabs.Tab>
          </Tabs.List>

          {Object.entries(fieldCategories).map(([category, fields]) => (
            <Tabs.Panel key={category} value={category} pt="md">
              <ScrollArea h={400}>
                <Stack gap="md">
                  {fields.map((field) => (
                    <FieldEditor
                      key={field}
                      field={field}
                      value={editedFields[field]?.value ?? fieldSelections[field]?.value}
                      source={
                        editedFields[field]?.source ??
                        fieldSelections[field]?.source ??
                        'UNKNOWN'
                      }
                      allSources={allSources}
                      onUpdate={(value, source, customUrl) =>
                        handleFieldUpdate(field, value, source, customUrl)
                      }
                      onUrlParse={(url) => handleUrlParse(field, url)}
                    />
                  ))}
                </Stack>
              </ScrollArea>
            </Tabs.Panel>
          ))}
        </Tabs>

        {Object.keys(editedFields).length > 0 && (
          <Alert icon={<IconAlertCircle size={16} />} color="blue">
            {Object.keys(editedFields).length} field(s) modified
          </Alert>
        )}

        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => void onClose()}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={Object.keys(editedFields).length === 0}>
            <IconCheck size={16} /> Save Changes
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
