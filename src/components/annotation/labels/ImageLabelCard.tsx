/**
 * Image Label Card Component
 *
 * Displays and allows editing of image labels for training data review.
 */

import React from 'react';

import {
  Card,
  Image,
  Badge,
  Group,
  Stack,
  Text,
  Select,
  Textarea,
  Switch,
  Collapse,
  ActionIcon,
  Tooltip,
  Paper,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconChevronDown,
  IconChevronUp,
  IconCheck,
  IconX,
  IconEye,
} from '@tabler/icons-react';

import type {
  ImageType,
  ImageQuality,
  ImageContentType,
  ImageLabel,
} from '@/types/training/image-labels';

// ============================================================================
// Types
// ============================================================================

export interface ImageLabelCardProps {
  label: ImageLabel;
  imageSrc?: string | null | undefined;
  imageAlt?: string | null | undefined;
  onChange?: ((updates: Partial<ImageLabel>) => void) | undefined;
  readonly?: boolean | undefined;
}

export interface ImageLabelSummaryProps {
  labels: ImageLabel[];
  showStats?: boolean | undefined;
}

// ============================================================================
// Constants
// ============================================================================

const IMAGE_TYPE_OPTIONS: Array<{ value: ImageType; label: string }> = [
  { value: 'COVER', label: 'Cover' },
  { value: 'VOLUME_COVER', label: 'Volume Cover' },
  { value: 'CHAPTER_COVER', label: 'Chapter Cover' },
  { value: 'PANEL', label: 'Panel' },
  { value: 'CHARACTER', label: 'Character' },
  { value: 'AUTHOR_PHOTO', label: 'Author Photo' },
  { value: 'PROMOTIONAL', label: 'Promotional' },
  { value: 'SCREENSHOT', label: 'Screenshot' },
  { value: 'LOGO', label: 'Logo' },
  { value: 'ICON', label: 'Icon' },
  { value: 'BANNER', label: 'Banner' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

const IMAGE_QUALITY_OPTIONS: Array<{ value: ImageQuality; label: string; color: string }> = [
  { value: 'HIGH', label: 'High', color: 'green' },
  { value: 'MEDIUM', label: 'Medium', color: 'yellow' },
  { value: 'LOW', label: 'Low', color: 'orange' },
  { value: 'EXCLUDE', label: 'Exclude', color: 'red' },
];

const CONTENT_TYPE_OPTIONS: Array<{ value: ImageContentType; label: string }> = [
  { value: 'ARTWORK', label: 'Artwork' },
  { value: 'PHOTOGRAPH', label: 'Photograph' },
  { value: 'DIAGRAM', label: 'Diagram' },
  { value: 'TEXT_HEAVY', label: 'Text Heavy' },
  { value: 'DECORATIVE', label: 'Decorative' },
];

// ============================================================================
// Helper Functions
// ============================================================================

function emptyToUndefined(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

// ============================================================================
// Main Component
// ============================================================================

export function ImageLabelCard({
  label,
  imageSrc,
  imageAlt,
  onChange,
  readonly = false,
}: ImageLabelCardProps): React.ReactElement {
  const [expanded, { toggle }] = useDisclosure(false);
  const qualityConfig = IMAGE_QUALITY_OPTIONS.find((q) => q.value === label.quality);

  const handleChange = <K extends keyof ImageLabel>(key: K, value: ImageLabel[K]): void => {
    if (onChange && !readonly) {
      onChange({ [key]: value } as Partial<ImageLabel>);
    }
  };

  return (
    <Card withBorder padding="sm" radius="md">
      <ImagePreviewSection imageSrc={imageSrc} imageAlt={imageAlt} />
      <Stack gap="xs" mt="sm">
        <ImageLabelHeader label={label} qualityColor={qualityConfig?.color} onToggle={toggle} expanded={expanded} />
        {label.caption && <Text size="xs" c="dimmed" lineClamp={2}>{label.caption}</Text>}
        {label.confidence !== undefined && (
          <Text size="xs" c="dimmed">Confidence: {(label.confidence * 100).toFixed(0)}%</Text>
        )}
        <Collapse in={expanded}>
          <ImageLabelEditForm label={label} onChange={handleChange} readonly={readonly} />
        </Collapse>
      </Stack>
    </Card>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface ImagePreviewSectionProps {
  imageSrc?: string | null | undefined;
  imageAlt?: string | null | undefined;
}

function ImagePreviewSection({ imageSrc, imageAlt }: ImagePreviewSectionProps): React.ReactElement {
  return (
    <Card.Section>
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={imageAlt ?? 'Image'}
          height={120}
          fit="contain"
          fallbackSrc="https://placehold.co/200x120?text=No+Image"
        />
      ) : (
        <Paper h={120} bg="gray.1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text c="dimmed" size="sm">No image source</Text>
        </Paper>
      )}
    </Card.Section>
  );
}

interface ImageLabelHeaderProps {
  label: ImageLabel;
  qualityColor?: string | undefined;
  onToggle: () => void;
  expanded: boolean;
}

function ImageLabelHeader({ label, qualityColor, onToggle, expanded }: ImageLabelHeaderProps): React.ReactElement {
  return (
    <Group justify="space-between">
      <Group gap="xs">
        <Badge color={qualityColor ?? 'gray'} size="sm">{label.quality}</Badge>
        <Badge variant="outline" size="sm">{label.imageType}</Badge>
        {label.isRelevant ? (
          <Tooltip label="Relevant for training">
            <Badge color="green" variant="light" size="sm" leftSection={<IconCheck size={10} />}>Relevant</Badge>
          </Tooltip>
        ) : (
          <Tooltip label="Not relevant for training">
            <Badge color="gray" variant="light" size="sm" leftSection={<IconX size={10} />}>Skip</Badge>
          </Tooltip>
        )}
      </Group>
      <ActionIcon variant="subtle" onClick={onToggle} size="sm">
        {expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
      </ActionIcon>
    </Group>
  );
}

interface ImageLabelEditFormProps {
  label: ImageLabel;
  onChange: <K extends keyof ImageLabel>(key: K, value: ImageLabel[K]) => void;
  readonly: boolean;
}

function ImageLabelEditForm({ label, onChange, readonly }: ImageLabelEditFormProps): React.ReactElement {
  return (
    <Stack gap="xs" mt="xs">
      <Select
        label="Image Type"
        size="xs"
        data={IMAGE_TYPE_OPTIONS}
        value={label.imageType}
        onChange={(value) => value && onChange('imageType', value as ImageType)}
        disabled={readonly}
      />
      <Select
        label="Quality"
        size="xs"
        data={IMAGE_QUALITY_OPTIONS.map((q) => ({ value: q.value, label: q.label }))}
        value={label.quality}
        onChange={(value) => value && onChange('quality', value as ImageQuality)}
        disabled={readonly}
      />
      <Select
        label="Content Type"
        size="xs"
        data={CONTENT_TYPE_OPTIONS}
        value={label.contentType}
        onChange={(value) => value && onChange('contentType', value as ImageContentType)}
        disabled={readonly}
      />
      <Switch
        label="Relevant for training"
        size="xs"
        checked={label.isRelevant}
        onChange={(e) => onChange('isRelevant', e.currentTarget.checked)}
        disabled={readonly}
      />
      <Textarea
        label="Caption"
        size="xs"
        value={label.caption ?? ''}
        onChange={(e) => onChange('caption', emptyToUndefined(e.currentTarget.value))}
        placeholder="Add a caption..."
        minRows={2}
        disabled={readonly}
      />
      <Textarea
        label="Improved Alt Text"
        size="xs"
        value={label.improvedAlt ?? ''}
        onChange={(e) => onChange('improvedAlt', emptyToUndefined(e.currentTarget.value))}
        placeholder="Improved alt text..."
        minRows={2}
        disabled={readonly}
      />
    </Stack>
  );
}

// ============================================================================
// Summary Component
// ============================================================================

export function ImageLabelSummary({ labels, showStats = true }: ImageLabelSummaryProps): React.ReactElement {
  const stats = React.useMemo(() => {
    const byType: Record<string, number> = {};
    const byQuality: Record<string, number> = {};
    let relevant = 0;

    for (const label of labels) {
      byType[label.imageType] = (byType[label.imageType] ?? 0) + 1;
      byQuality[label.quality] = (byQuality[label.quality] ?? 0) + 1;
      if (label.isRelevant) relevant++;
    }

    return { byType, byQuality, relevant, total: labels.length };
  }, [labels]);

  if (labels.length === 0) {
    return <Text c="dimmed" size="sm">No image labels</Text>;
  }

  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Badge variant="light" leftSection={<IconEye size={12} />}>{stats.total} images</Badge>
        <Badge color="green" variant="light">{stats.relevant} relevant</Badge>
      </Group>
      {showStats && <ImageLabelStatsDisplay byType={stats.byType} byQuality={stats.byQuality} />}
    </Stack>
  );
}

// ============================================================================
// Stats Display Sub-component
// ============================================================================

interface ImageLabelStatsDisplayProps {
  byType: Record<string, number>;
  byQuality: Record<string, number>;
}

function ImageLabelStatsDisplay({ byType, byQuality }: ImageLabelStatsDisplayProps): React.ReactElement {
  return (
    <>
      <Text size="xs" fw={500}>By Type:</Text>
      <Group gap={4}>
        {Object.entries(byType).map(([type, count]) => (
          <Badge key={type} size="xs" variant="outline">{type}: {count}</Badge>
        ))}
      </Group>
      <Text size="xs" fw={500}>By Quality:</Text>
      <Group gap={4}>
        {Object.entries(byQuality).map(([quality, count]) => {
          const config = IMAGE_QUALITY_OPTIONS.find((q) => q.value === quality);
          return (
            <Badge key={quality} size="xs" color={config?.color ?? 'gray'} variant="light">{quality}: {count}</Badge>
          );
        })}
      </Group>
    </>
  );
}

// ============================================================================
// Exports
// ============================================================================

export { IMAGE_TYPE_OPTIONS, IMAGE_QUALITY_OPTIONS, CONTENT_TYPE_OPTIONS };
