/**
 * Manga Metadata Editor
 *
 * Integration example showing how users correct manga metadata
 * in the actual application UI with ML learning.
 */

import React, { useState } from 'react';

import {
  Card,
  Text,
  Button,
  Group,
  Stack,
  Badge,
  Tooltip,
  ActionIcon,
  Modal,
  Divider } from
'@mantine/core';
// @ts-ignore - TypeScript has issues resolving some icon exports
import { IconEdit, IconRefresh, IconClock, IconCpu } from '@tabler/icons-react';

import { usePatternLearning } from '@/hooks/usePatternLearning';
// Import types from usePatternLearning
import type { ExtractedData } from '@/hooks/usePatternLearning';
import { notify } from '@/utils/notify';

import { DataCorrectionPanel, InlineCorrection } from '../pattern-recognition/DataCorrectionPanel';

type CorrectionFeedback = {
  corrections: Record<string, unknown>;
  userConfidence: number;
  teachingMode: boolean;
  url: string;
  patternsUsed: string[];
  originalConfidence: number;
};

interface MangaData {
  id: number;
  title: string;
  description?: string;
  author?: string[];
  artist?: string[];
  genres?: string[];
  status?: string;
  chapters?: number;
  volumes?: number;
  coverImage?: string;
  // ML metadata
  mlExtracted?: boolean;
  mlConfidence?: number;
  patternsUsed?: string[];
  extractionUrl?: string;
}

interface MangaMetadataEditorProps {
  manga: MangaData;
  onUpdate: (updatedManga: MangaData) => void;
  allowMLCorrections?: boolean;
}

// Sub-component: Metadata Header
interface MetadataHeaderProps {
  manga: MangaData;
  allowMLCorrections: boolean;
  isEditing: boolean;
  onToggleEdit: () => void;
  onGetSuggestions: () => void;
  onViewHistory: () => void;
}

const MetadataHeader: React.FC<MetadataHeaderProps> = ({
  manga,
  allowMLCorrections,
  isEditing,
  onToggleEdit,
  onGetSuggestions,
  onViewHistory
}) => {
  const mlConfidence = manga.mlConfidence ?? 0;
  const confidenceColor = mlConfidence > 0.8 ? 'green' : mlConfidence > 0.5 ? 'yellow' : 'red';

  return (
    <Group justify="space-between" mb="md">
      <Group>
        <Text size="lg" fw={700}>{manga.title}</Text>
        {manga.mlExtracted && (
          <Tooltip label={`ML Confidence: ${mlConfidence * 100}%`}>
            <Badge
              color={confidenceColor}
              variant="dot"
              leftSection={<IconCpu size={14} />}>
              ML Extracted
            </Badge>
          </Tooltip>
        )}
      </Group>

      <Group>
        {allowMLCorrections && manga.mlExtracted && (
          <Tooltip label="Get AI suggestions">
            <ActionIcon onClick={onGetSuggestions} color="blue" variant="light">
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        )}

        {allowMLCorrections && (
          <Tooltip label="View correction history">
            <ActionIcon onClick={onViewHistory} variant="light">
              <IconClock size={18} />
            </ActionIcon>
          </Tooltip>
        )}

        <Button
          leftSection={<IconEdit size={16} />}
          size="sm"
          onClick={onToggleEdit}>
          {isEditing ? 'Done' : 'Edit'}
        </Button>
      </Group>
    </Group>
  );
};

// Sub-component: Metadata Fields Editor
interface MetadataFieldsProps {
  manga: MangaData;
  isEditing: boolean;
  onFieldCorrect: (field: string, value: unknown) => Promise<void>;
}

const MetadataFields: React.FC<MetadataFieldsProps> = ({
  manga,
  isEditing,
  onFieldCorrect
}) => (
  <Stack gap="sm">
    <Group justify="space-between">
      <Text fw={500}>Chapters:</Text>
      {isEditing ? (
        <InlineCorrection
          field="chapters"
          value={manga.chapters}
          onCorrect={(value) => { void onFieldCorrect('chapters', value); }} />
      ) : (
        <Text>{manga.chapters ?? 'Unknown'}</Text>
      )}
    </Group>

    <Group justify="space-between">
      <Text fw={500}>Volumes:</Text>
      {isEditing ? (
        <InlineCorrection
          field="volumes"
          value={manga.volumes}
          onCorrect={(value) => { void onFieldCorrect('volumes', value); }} />
      ) : (
        <Text>{manga.volumes ?? 'Unknown'}</Text>
      )}
    </Group>

    <Group justify="space-between">
      <Text fw={500}>Status:</Text>
      {isEditing ? (
        <InlineCorrection
          field="status"
          value={manga.status}
          onCorrect={(value) => { void onFieldCorrect('status', value); }} />
      ) : (
        <Badge color={manga.status === 'ONGOING' ? 'green' : 'gray'}>
          {manga.status ?? 'Unknown'}
        </Badge>
      )}
    </Group>

    <Group justify="space-between">
      <Text fw={500}>Author:</Text>
      {isEditing ? (
        <InlineCorrection
          field="author"
          value={manga.author?.join(', ')}
          onCorrect={(value: unknown) => {
            if (typeof value === 'string') {
              void onFieldCorrect('author', value.split(',').map((a: string) => a.trim()));
            }
          }} />
      ) : (
        <Text>{manga.author?.join(', ') ?? 'Unknown'}</Text>
      )}
    </Group>

    <Group justify="space-between">
      <Text fw={500}>Genres:</Text>
      {isEditing ? (
        <InlineCorrection
          field="genres"
          value={manga.genres?.join(', ')}
          onCorrect={(value: unknown) => {
            if (typeof value === 'string') {
              void onFieldCorrect('genres', value.split(',').map((g: string) => g.trim()));
            }
          }} />
      ) : (
        <Group gap="xs">
          {manga.genres?.map((genre) => (
            <Badge key={genre} variant="light">{genre}</Badge>
          )) ?? <Text color="dimmed">No genres</Text>}
        </Group>
      )}
    </Group>
  </Stack>
);

// Sub-component: Learning Metrics Footer
interface LearningMetricsProps {
  learningMetrics: {
    totalCorrections: number;
    averageConfidence: number;
    patternsLearned: number;
  };
}

const LearningMetrics: React.FC<LearningMetricsProps> = ({ learningMetrics }) => (
  <Card.Section p="md" mt="md" withBorder>
    <Group justify="space-between">
      <Text size="xs" color="dimmed">
        ML Learning Stats
      </Text>
      <Group gap="xs">
        <Badge size="sm" variant="dot">
          {learningMetrics.totalCorrections} corrections
        </Badge>
        <Badge size="sm" variant="dot" color="green">
          {(learningMetrics.averageConfidence * 100).toFixed(0)}% avg confidence
        </Badge>
        <Badge size="sm" variant="dot" color="blue">
          {learningMetrics.patternsLearned} patterns
        </Badge>
      </Group>
    </Group>
  </Card.Section>
);

export const MangaMetadataEditor: React.FC<MangaMetadataEditorProps> = ({
  manga,
  onUpdate,
  allowMLCorrections = true
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showCorrectionPanel, setShowCorrectionPanel] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const {
    submitCorrections,
    getSuggestions,
    validateCorrections,
    getCorrectionHistory,
    learningMetrics,
    isSubmitting: _isSubmitting
  } = usePatternLearning();

  // Handle inline field correction
  const handleInlineCorrection = async (field: string, value: unknown): Promise<void> => {
    const originalData = { ...manga };
    const correctedData = { ...manga, [field]: value };

    // Validate
    const validation = validateCorrections(originalData, correctedData);
    if (!validation.isValid) {
      notify({ severity: 'ERROR', title: 'Invalid Correction', message: validation.errors.join(', ') });
      return;
    }

    // Submit correction
    if (allowMLCorrections && manga.mlExtracted) {
      // Safe field access with type guard - use double assertion for index signature
      const mangaAsRecord = manga as unknown as Record<string, unknown>;
      const fromValue = mangaAsRecord[field];

      await submitCorrections({
        originalData,
        correctedData,
        feedback: {
          corrections: { [field]: { from: fromValue, to: value } },
          userConfidence: 0.9,
          teachingMode: true,
          url: manga.extractionUrl ?? '',
          patternsUsed: manga.patternsUsed ?? [],
          originalConfidence: manga.mlConfidence ?? 0
        }
      });
    }

    // Update local data
    onUpdate(correctedData);

    notify({ severity: 'SUCCESS', title: 'Field Updated', message: allowMLCorrections ? 'The AI is learning from your correction' : 'Field updated' });
  };

  // Type guard for CorrectionFeedback
  const isCorrectionFeedback = (value: unknown): value is CorrectionFeedback => {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return (
      typeof obj['corrections'] === 'object' &&
      obj['corrections'] !== null &&
      typeof obj['userConfidence'] === 'number' &&
      typeof obj['teachingMode'] === 'boolean' &&
      typeof obj['url'] === 'string' &&
      Array.isArray(obj['patternsUsed']) &&
      typeof obj['originalConfidence'] === 'number'
    );
  };

  // Convert MangaData to ExtractedData
  const toExtractedData = (data: MangaData): ExtractedData => {
    const result: ExtractedData = {
      title: data.title
    };

    // Only include properties that have defined values
    if (data.description !== undefined) result.description = data.description;
    if (data.author !== undefined) result.author = data.author;
    if (data.chapters !== undefined) result.chapters = data.chapters;
    if (data.volumes !== undefined) result.volumes = data.volumes;
    if (data.status !== undefined) result.status = data.status;

    return result;
  };

  // Handle full correction panel submission
  const handlePanelCorrections = async (correctedData: ExtractedData, feedback: unknown): Promise<void> => {
    if (!isCorrectionFeedback(feedback)) {
      notify({ severity: 'ERROR', title: 'Invalid Feedback', message: 'Feedback data is invalid' });
      return;
    }

    await submitCorrections({
      originalData: toExtractedData(manga),
      correctedData,
      feedback
    });

    // Merge correctedData with existing manga data to preserve required fields like id
    onUpdate({ ...manga, ...correctedData });
    setShowCorrectionPanel(false);
  };

  // Get AI suggestions
  const handleGetSuggestions = async (): Promise<void> => {
    const suggestions = await getSuggestions(toExtractedData(manga), manga.extractionUrl ?? '');

    if (suggestions.length > 0) {
      notify({ severity: 'INFO', title: 'AI Suggestions Available', message: `Found ${suggestions.length} potential improvements` });

      // Apply high-confidence suggestions
      const updates: Record<string, unknown> = {};
      suggestions.forEach((suggestion) => {
        if (suggestion.confidence > 0.8) {
          updates[suggestion.field] = suggestion.suggestedValue;
        }
      });

      if (Object.keys(updates).length > 0) {
        onUpdate({ ...manga, ...updates });
      }
    }
  };

  // View correction history
  const viewHistory = async (): Promise<void> => {
    const _history = await getCorrectionHistory(manga.extractionUrl ?? '');
    setShowHistory(true);
    // History would be displayed in a modal
  };

  const mlConfidence = manga.mlConfidence ?? 0;

  return (
    <>
      <Card shadow="sm" p="lg" radius="md">
        {/* Header with ML indicators */}
        <MetadataHeader
          manga={manga}
          allowMLCorrections={allowMLCorrections}
          isEditing={isEditing}
          onToggleEdit={() => setIsEditing(!isEditing)}
          onGetSuggestions={() => { void handleGetSuggestions(); }}
          onViewHistory={() => { void viewHistory(); }}
        />

        <Divider mb="md" />

        {/* Metadata fields with inline editing */}
        <MetadataFields
          manga={manga}
          isEditing={isEditing}
          onFieldCorrect={handleInlineCorrection}
        />

        {/* Learning metrics footer */}
        {allowMLCorrections && (
          <LearningMetrics learningMetrics={learningMetrics} />
        )}

        {/* Full correction button for ML-extracted data */}
        {allowMLCorrections && manga.mlExtracted && mlConfidence < 0.8 && (
          <Button
            fullWidth
            mt="md"
            leftSection={<IconCpu />}
            variant="light"
            color="blue"
            onClick={() => setShowCorrectionPanel(true)}>
            Help Improve ML Extraction
          </Button>
        )}
      </Card>

      {/* Full correction panel modal */}
      <Modal
        opened={showCorrectionPanel}
        onClose={() => setShowCorrectionPanel(false)}
        size="xl"
        title="Correct Extracted Data">
        <DataCorrectionPanel
          originalData={toExtractedData(manga)}
          mlConfidence={mlConfidence}
          patternsUsed={manga.patternsUsed ?? []}
          url={manga.extractionUrl ?? ''}
          onSubmitCorrections={handlePanelCorrections}
          onSkip={() => setShowCorrectionPanel(false)}
          showAdvanced={true} />
      </Modal>

      {/* History modal */}
      <Modal
        opened={showHistory}
        onClose={() => setShowHistory(false)}
        title="Correction History">
        {/* History content would go here */}
        <Text>Correction history for this manga...</Text>
      </Modal>
    </>
  );
};
