/**
 * Document Label Badges Component
 *
 * Displays document-level labels (category, quality tier, use cases)
 * in a compact badge format.
 */

import React from 'react';

import { Badge, Group, Tooltip, Stack, Text } from '@mantine/core';
import {
  IconStarFilled,
  IconStar,
  IconStarHalf,
  IconX,
  IconBook,
  IconMessageCircle,
  IconFileText,
  IconDatabase,
  IconAlertCircle,
  IconTable,
} from '@tabler/icons-react';

import type {
  DocumentCategory,
  QualityTier,
  UseCaseLabel,
} from '@/types/training/document-labels';

// ============================================================================
// Types
// ============================================================================

export interface DocumentLabelBadgesProps {
  category?: DocumentCategory | null | undefined;
  qualityTier?: QualityTier | null | undefined;
  useCases?: UseCaseLabel[] | null | undefined;
  showLabels?: boolean | undefined;
  size?: 'xs' | 'sm' | 'md' | undefined;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_CONFIG: Record<DocumentCategory, { color: string; icon: React.ReactNode; label: string }> = {
  SYNOPSIS: { color: 'blue', icon: <IconBook size={12} />, label: 'Synopsis' },
  REVIEW: { color: 'violet', icon: <IconMessageCircle size={12} />, label: 'Review' },
  ANALYSIS: { color: 'cyan', icon: <IconFileText size={12} />, label: 'Analysis' },
  NEWS: { color: 'orange', icon: <IconFileText size={12} />, label: 'News' },
  REFERENCE: { color: 'teal', icon: <IconDatabase size={12} />, label: 'Reference' },
  DISCUSSION: { color: 'pink', icon: <IconMessageCircle size={12} />, label: 'Discussion' },
  METADATA: { color: 'gray', icon: <IconDatabase size={12} />, label: 'Metadata' },
  MIXED: { color: 'indigo', icon: <IconTable size={12} />, label: 'Mixed' },
};

const QUALITY_CONFIG: Record<QualityTier, { color: string; icon: React.ReactNode; label: string }> = {
  HIGH: { color: 'green', icon: <IconStarFilled size={12} />, label: 'High Quality' },
  MEDIUM: { color: 'yellow', icon: <IconStarHalf size={12} />, label: 'Medium Quality' },
  LOW: { color: 'orange', icon: <IconStar size={12} />, label: 'Low Quality' },
  EXCLUDE: { color: 'red', icon: <IconX size={12} />, label: 'Exclude' },
};

const USE_CASE_CONFIG: Record<UseCaseLabel, { color: string; abbrev: string; label: string }> = {
  INSTRUCTION_TUNING: { color: 'blue', abbrev: 'IT', label: 'Instruction Tuning' },
  SUMMARIZATION: { color: 'teal', abbrev: 'SUM', label: 'Summarization' },
  QA: { color: 'violet', abbrev: 'QA', label: 'Question Answering' },
  CLASSIFICATION: { color: 'pink', abbrev: 'CLS', label: 'Classification' },
  ENTITY_EXTRACTION: { color: 'cyan', abbrev: 'NER', label: 'Entity Extraction' },
  RECOMMENDATION: { color: 'orange', abbrev: 'REC', label: 'Recommendation' },
  TRANSLATION: { color: 'grape', abbrev: 'TRN', label: 'Translation' },
};

// ============================================================================
// Component
// ============================================================================

export function DocumentLabelBadges({
  category,
  qualityTier,
  useCases,
  showLabels = false,
  size = 'sm',
}: DocumentLabelBadgesProps): React.ReactElement {
  const hasAnyLabel = category || qualityTier || (useCases && useCases.length > 0);

  if (!hasAnyLabel) {
    return (
      <Badge color="gray" variant="outline" size={size}>
        <Group gap={4}>
          <IconAlertCircle size={12} />
          {showLabels && 'Unlabeled'}
        </Group>
      </Badge>
    );
  }

  return (
    <Group gap="xs">
      {category && <CategoryBadge category={category} showLabel={showLabels} size={size} />}
      {qualityTier && <QualityBadge tier={qualityTier} showLabel={showLabels} size={size} />}
      {useCases && useCases.length > 0 && (
        <UseCaseBadges useCases={useCases} showLabels={showLabels} size={size} />
      )}
    </Group>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface CategoryBadgeProps {
  category: DocumentCategory;
  showLabel?: boolean | undefined;
  size?: 'xs' | 'sm' | 'md' | undefined;
}

function CategoryBadge({ category, showLabel = false, size = 'sm' }: CategoryBadgeProps): React.ReactElement {
  const config = CATEGORY_CONFIG[category];

  return (
    <Tooltip label={config.label} disabled={showLabel}>
      <Badge color={config.color} variant="light" size={size} leftSection={config.icon}>
        {showLabel ? config.label : category}
      </Badge>
    </Tooltip>
  );
}

interface QualityBadgeProps {
  tier: QualityTier;
  showLabel?: boolean | undefined;
  size?: 'xs' | 'sm' | 'md' | undefined;
}

function QualityBadge({ tier, showLabel = false, size = 'sm' }: QualityBadgeProps): React.ReactElement {
  const config = QUALITY_CONFIG[tier];

  return (
    <Tooltip label={config.label} disabled={showLabel}>
      <Badge color={config.color} variant="filled" size={size} leftSection={config.icon}>
        {showLabel ? config.label : tier}
      </Badge>
    </Tooltip>
  );
}

interface UseCaseBadgesProps {
  useCases: UseCaseLabel[];
  showLabels?: boolean | undefined;
  size?: 'xs' | 'sm' | 'md' | undefined;
  maxDisplay?: number | undefined;
}

function UseCaseBadges({
  useCases,
  showLabels = false,
  size = 'sm',
  maxDisplay = 3,
}: UseCaseBadgesProps): React.ReactElement {
  const displayCases = useCases.slice(0, maxDisplay);
  const remaining = useCases.length - maxDisplay;

  return (
    <Group gap={4}>
      {displayCases.map((useCase) => {
        const config = USE_CASE_CONFIG[useCase];
        return (
          <Tooltip key={useCase} label={config.label}>
            <Badge color={config.color} variant="outline" size={size}>
              {showLabels ? config.label : config.abbrev}
            </Badge>
          </Tooltip>
        );
      })}
      {remaining > 0 && (
        <Tooltip
          label={
            <Stack gap={4}>
              {useCases.slice(maxDisplay).map((uc) => (
                <Text key={uc} size="xs">{USE_CASE_CONFIG[uc].label}</Text>
              ))}
            </Stack>
          }
        >
          <Badge color="gray" variant="outline" size={size}>
            +{remaining}
          </Badge>
        </Tooltip>
      )}
    </Group>
  );
}

// ============================================================================
// Exports
// ============================================================================

export { CategoryBadge, QualityBadge, UseCaseBadges };
export { CATEGORY_CONFIG, QUALITY_CONFIG, USE_CASE_CONFIG };
