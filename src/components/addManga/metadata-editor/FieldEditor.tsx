/**
 * FieldEditor component - Individual field editor with inline editing and URL parsing
 *
 * @module metadata-editor/FieldEditor
 */

import React, { useState } from 'react';

import {
  Paper,
  Stack,
  Group,
  TextInput,
  Button,
  Badge,
  Text,
  ActionIcon,
  Tooltip,
  Loader,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { IconEdit, IconLink } from '@tabler/icons-react';

import { isSuccess, isError } from '@/utils/async-result';
import { trpc } from '@/utils/trpc-client';

import { extractFieldFromParsedData } from './data-extractors';
import { getFieldEditor } from './field-editors';

interface FieldEditorProps {
  field: string;
  value: unknown;
  source: string;
  allSources: Record<string, unknown>;
  onUpdate: (value: unknown, source: string, customUrl?: string) => void;
  onUrlParse: (url: string) => Promise<void>;
}


export const FieldEditor: React.FC<FieldEditorProps> = ({
  field,
  value,
  source,
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [urlInput, setUrlInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const parseUrlMutation = trpc.metadata.parseMetadataUrl.useMutation();

  const handleUrlParse = async (): Promise<void> => {
    if (!urlInput.trim()) {
      return;
    }

    setIsParsing(true);
    try {
      const result = await parseUrlMutation.mutateAsync({
        url: urlInput,
        field,
      });

      if (isSuccess(result)) {
        const data = result.data.data;
        const parsedData =
          data && typeof data === 'object' && !Array.isArray(data)
            ? (data as Record<string, unknown>)
            : {};
        const extractedValue = extractFieldFromParsedData(
          field,
          parsedData,
          result.data.type
        );

        if (extractedValue !== undefined) {
          onUpdate(extractedValue, `url:${result.data.parser}`, urlInput);
          setEditValue(extractedValue);
          setUrlInput('');
          showNotification({
            title: 'URL Parsed Successfully',
            message: `Extracted ${field} from ${result.data.type} source`,
            color: 'green',
          });
        } else {
          showNotification({
            title: 'No Data Found',
            message: `Could not extract ${field} from the provided URL`,
            color: 'yellow',
          });
        }
      } else {
        showNotification({
          title: 'Parse Failed',
          message: isError(result)
            ? result.error instanceof Error
              ? result.error.message
              : String(result.error)
            : 'Could not parse the URL',
          color: 'red',
        });
      }
    } catch {
      showNotification({
        title: 'Error',
        message: 'Failed to parse URL',
        color: 'red',
      });
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <Paper p="sm" withBorder>
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <Text size="sm" fw={500}>
              {field}
            </Text>
            <Badge size="xs" color="blue">
              {source}
            </Badge>
          </Group>
          <Group gap="xs">
            <Tooltip label="Parse from URL">
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={() => setIsEditing(!isEditing)}
              >
                <IconLink size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Edit manually">
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={() => setIsEditing(!isEditing)}
              >
                <IconEdit size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {isEditing && (
          <Stack gap="xs">
            {getFieldEditor(field, editValue, setEditValue, onUpdate, setIsEditing)}

            <Group gap="xs">
              <TextInput
                placeholder="Paste URL to parse data..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                style={{ flex: 1 }}
                rightSection={isParsing && <Loader size="xs" />}
              />
              <Button size="xs" onClick={() => void handleUrlParse()} loading={isParsing}>
                Parse
              </Button>
            </Group>

            <Group gap="xs" justify="flex-end">
              <Button size="xs" variant="subtle" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button
                size="xs"
                onClick={() => {
                  onUpdate(editValue, 'custom', urlInput || undefined);
                  setIsEditing(false);
                }}
              >
                Save
              </Button>
            </Group>
          </Stack>
        )}

        {!isEditing && (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {Array.isArray(value) ? value.join(', ') : String(value ?? 'Not set')}
          </Text>
        )}
      </Stack>
    </Paper>
  );
};
