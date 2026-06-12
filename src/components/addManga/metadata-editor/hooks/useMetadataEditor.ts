/**
 * Main metadata editor state management hook
 *
 * @module metadata-editor/hooks/useMetadataEditor
 */

import { useState, useCallback } from 'react';

import { showNotification } from '@mantine/notifications';

import { trpc } from '@/utils/trpc-client';

import { extractFieldFromParsedData } from '../data-extractors';

import type { MetadataField, MetadataEditorProps } from '../types';

interface UseMetadataEditorReturn {
  editedFields: Record<string, MetadataField>;
  activeTab: string | null;
  previewMode: boolean;
  bulkParseUrl: string;
  isBulkParsing: boolean;
  handleFieldUpdate: (field: string, value: unknown, source: string, customUrl?: string) => void;
  handleUrlParse: (field: string, url: string) => Promise<void>;
  handleBulkParse: () => Promise<void>;
  handleSave: () => void;
  setActiveTab: (tab: string | null) => void;
  setPreviewMode: (enabled: boolean) => void;
  setBulkParseUrl: (url: string) => void;
}

const FIELDS_TO_CHECK = [
  'title',
  'description',
  'cover',
  'banner',
  'alternativeTitles',
  'genres',
  'authors',
  'status',
  'volumes',
  'chapters',
  'startDate',
  'endDate',
  'publisher',
  'averageScore',
  'popularity',
];

export function useMetadataEditor(props: MetadataEditorProps): UseMetadataEditorReturn {
  const { fieldSelections, onSave, onClose } = props;

  const [editedFields, setEditedFields] = useState<Record<string, MetadataField>>({});
  const [activeTab, setActiveTab] = useState<string | null>('basic');
  const [previewMode, setPreviewMode] = useState(false);
  const [bulkParseUrl, setBulkParseUrl] = useState('');
  const [isBulkParsing, setIsBulkParsing] = useState(false);

  const parseUrlMutation = trpc.metadata.parseMetadataUrl.useMutation();

  const handleFieldUpdate = useCallback(
    (field: string, value: unknown, source: string, customUrl?: string) => {
      setEditedFields((prev) => ({
        ...prev,
        [field]: {
          fieldName: field,
          value,
          source,
          ...(customUrl !== undefined ? { customUrl } : {}),
          isEdited: true,
          originalValue: fieldSelections[field]?.value,
        },
      }));
    },
    [fieldSelections]
  );

  const handleUrlParse = useCallback(async (_field: string, _url: string) => {
    // This is handled directly in the FieldEditor component now
    // Keeping this for compatibility
  }, []);

  const handleBulkParse = async (): Promise<void> => {
    if (!bulkParseUrl.trim()) {
      return;
    }

    setIsBulkParsing(true);
    try {
      const result = await parseUrlMutation.mutateAsync({
        url: bulkParseUrl,
        field: undefined, // Parse for all fields
      });

      const { type, data: rawData } = result;
      const data =
        rawData && typeof rawData === 'object' && !Array.isArray(rawData)
          ? (rawData as Record<string, unknown>)
          : {};

      let fieldsUpdated = 0;

      for (const field of FIELDS_TO_CHECK) {
        const value = extractFieldFromParsedData(field, data, type);
        if (value !== null) {
          handleFieldUpdate(field, value, `bulk:${type}`, bulkParseUrl);
          fieldsUpdated++;
        }
      }

      if (fieldsUpdated > 0) {
        showNotification({
          title: 'Bulk Parse Successful',
          message: `Updated ${fieldsUpdated} fields from ${type} source`,
          color: 'green',
        });
        setBulkParseUrl('');
      } else {
        showNotification({
          title: 'No Data Extracted',
          message: 'Could not extract any metadata from the URL',
          color: 'yellow',
        });
      }
    } catch (error: unknown) {
      showNotification({
        title: 'Parse Failed',
        message: error instanceof Error ? error.message : 'Could not parse the URL',
        color: 'red',
      });
    } finally {
      setIsBulkParsing(false);
    }
  };

  const handleSave = (): void => {
    const updatedFields: Record<
      string,
      {
        source: string;
        value: unknown;
        customUrl?: string;
      }
    > = {
      ...fieldSelections,
    };

    Object.entries(editedFields).forEach(([field, data]) => {
      updatedFields[field] = {
        source: data.source,
        value: data.value,
        ...(data.customUrl !== undefined ? { customUrl: data.customUrl } : {}),
      };
    });

    onSave(updatedFields);
    onClose();
  };

  return {
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
  };
}
