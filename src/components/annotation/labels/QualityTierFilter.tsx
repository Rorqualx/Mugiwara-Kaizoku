/**
 * Quality Tier Filter Component
 *
 * Filter control for selecting quality tiers in export/query interfaces.
 */

import React from 'react';

import {
  Paper,
  Stack,
  Text,
  SegmentedControl,
  Group,
  Badge,
  Tooltip,
  Checkbox,
  Divider,
  MultiSelect,
} from '@mantine/core';
import {
  IconStarFilled,
  IconStarHalf,
  IconStar,
  IconX,
} from '@tabler/icons-react';

import type {
  QualityTier,
  DocumentCategory,
  UseCaseLabel,
} from '@/types/training/document-labels';

// ============================================================================
// Types
// ============================================================================

export interface QualityTierFilterProps {
  value: QualityTier | null;
  onChange: (tier: QualityTier | null) => void;
  label?: string | undefined;
  description?: string | undefined;
}

export interface DocumentLabelFiltersProps {
  minQualityTier: QualityTier | null;
  onMinQualityTierChange: (tier: QualityTier | null) => void;
  categories: DocumentCategory[];
  onCategoriesChange: (categories: DocumentCategory[]) => void;
  useCases: UseCaseLabel[];
  onUseCasesChange: (useCases: UseCaseLabel[]) => void;
  requireAllUseCases: boolean;
  onRequireAllUseCasesChange: (value: boolean) => void;
}

// ============================================================================
// Constants
// ============================================================================

const QUALITY_OPTIONS: Array<{ value: QualityTier | 'any'; label: string; icon: React.ReactNode; color: string }> = [
  { value: 'any', label: 'Any', icon: null, color: 'gray' },
  { value: 'HIGH', label: 'High', icon: <IconStarFilled size={14} />, color: 'green' },
  { value: 'MEDIUM', label: 'Medium', icon: <IconStarHalf size={14} />, color: 'yellow' },
  { value: 'LOW', label: 'Low', icon: <IconStar size={14} />, color: 'orange' },
  { value: 'EXCLUDE', label: 'Exclude', icon: <IconX size={14} />, color: 'red' },
];

const CATEGORY_OPTIONS: Array<{ value: DocumentCategory; label: string }> = [
  { value: 'SYNOPSIS', label: 'Synopsis' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'ANALYSIS', label: 'Analysis' },
  { value: 'NEWS', label: 'News' },
  { value: 'REFERENCE', label: 'Reference' },
  { value: 'DISCUSSION', label: 'Discussion' },
  { value: 'METADATA', label: 'Metadata' },
  { value: 'MIXED', label: 'Mixed' },
];

const USE_CASE_OPTIONS: Array<{ value: UseCaseLabel; label: string }> = [
  { value: 'INSTRUCTION_TUNING', label: 'Instruction Tuning' },
  { value: 'SUMMARIZATION', label: 'Summarization' },
  { value: 'QA', label: 'Question Answering' },
  { value: 'CLASSIFICATION', label: 'Classification' },
  { value: 'ENTITY_EXTRACTION', label: 'Entity Extraction' },
  { value: 'RECOMMENDATION', label: 'Recommendation' },
  { value: 'TRANSLATION', label: 'Translation' },
];

// ============================================================================
// Quality Tier Filter (Simple)
// ============================================================================

export function QualityTierFilter({
  value,
  onChange,
  label = 'Minimum Quality',
  description,
}: QualityTierFilterProps): React.ReactElement {
  const handleChange = (val: string): void => {
    onChange(val === 'any' ? null : (val as QualityTier));
  };

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>{label}</Text>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      <SegmentedControl
        value={value ?? 'any'}
        onChange={handleChange}
        data={QUALITY_OPTIONS.map((opt) => ({
          value: opt.value,
          label: (
            <Tooltip label={opt.value === 'any' ? 'Include all quality tiers' : `Minimum: ${opt.label} quality`}>
              <Group gap={4} wrap="nowrap">
                {opt.icon}
                <span>{opt.label}</span>
              </Group>
            </Tooltip>
          ),
        }))}
        size="sm"
      />
    </Stack>
  );
}

// ============================================================================
// Full Document Label Filters Panel
// ============================================================================

export function DocumentLabelFilters({
  minQualityTier,
  onMinQualityTierChange,
  categories,
  onCategoriesChange,
  useCases,
  onUseCasesChange,
  requireAllUseCases,
  onRequireAllUseCasesChange,
}: DocumentLabelFiltersProps): React.ReactElement {
  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Text fw={500}>Document Label Filters</Text>

        <QualityTierFilter
          value={minQualityTier}
          onChange={onMinQualityTierChange}
          description="Only include pages meeting this quality threshold"
        />

        <Divider />

        <MultiSelect
          label="Document Categories"
          description="Filter by document type (leave empty for all)"
          placeholder="All categories"
          data={CATEGORY_OPTIONS}
          value={categories}
          onChange={(values) => onCategoriesChange(values as DocumentCategory[])}
          clearable
          searchable
        />

        <MultiSelect
          label="Use Cases"
          description="Filter by training use case"
          placeholder="All use cases"
          data={USE_CASE_OPTIONS}
          value={useCases}
          onChange={(values) => onUseCasesChange(values as UseCaseLabel[])}
          clearable
          searchable
        />

        {useCases.length > 1 && (
          <Checkbox
            label="Require all selected use cases"
            description="If checked, only pages matching ALL selected use cases will be included"
            checked={requireAllUseCases}
            onChange={(e) => onRequireAllUseCasesChange(e.currentTarget.checked)}
          />
        )}

        <FilterSummary
          minQualityTier={minQualityTier}
          categories={categories}
          useCases={useCases}
          requireAllUseCases={requireAllUseCases}
        />
      </Stack>
    </Paper>
  );
}

// ============================================================================
// Filter Summary
// ============================================================================

interface FilterSummaryProps {
  minQualityTier: QualityTier | null;
  categories: DocumentCategory[];
  useCases: UseCaseLabel[];
  requireAllUseCases: boolean;
}

function FilterSummary({
  minQualityTier,
  categories,
  useCases,
  requireAllUseCases,
}: FilterSummaryProps): React.ReactElement {
  const hasFilters = minQualityTier || categories.length > 0 || useCases.length > 0;

  if (!hasFilters) {
    return (
      <Text size="xs" c="dimmed" ta="center">
        No filters applied - all pages will be included
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      <Text size="xs" c="dimmed">Active filters:</Text>
      <Group gap="xs">
        {minQualityTier && (
          <Badge color="green" variant="light" size="sm">
            Quality ≥ {minQualityTier}
          </Badge>
        )}
        {categories.length > 0 && (
          <Badge color="blue" variant="light" size="sm">
            {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
          </Badge>
        )}
        {useCases.length > 0 && (
          <Badge color="violet" variant="light" size="sm">
            {useCases.length} use case{useCases.length === 1 ? '' : 's'}
            {requireAllUseCases && useCases.length > 1 ? ' (all)' : ''}
          </Badge>
        )}
      </Group>
    </Stack>
  );
}

// ============================================================================
// Exports
// ============================================================================

export { QUALITY_OPTIONS, CATEGORY_OPTIONS, USE_CASE_OPTIONS };
