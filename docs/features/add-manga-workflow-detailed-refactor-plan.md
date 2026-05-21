# Add Manga Workflow - Detailed Refactoring Implementation Plan

## Table of Contents
1. [Pre-Implementation Checklist](#pre-implementation-checklist)
2. [Phase 1: Component Extraction - Detailed Steps](#phase-1-component-extraction---detailed-steps)
3. [Phase 2: Type Consolidation - Detailed Steps](#phase-2-type-consolidation---detailed-steps)
4. [Phase 3: State Management - Detailed Steps](#phase-3-state-management---detailed-steps)
5. [Phase 4: Performance Optimization - Detailed Steps](#phase-4-performance-optimization---detailed-steps)
6. [Phase 5: Error Handling & UX - Detailed Steps](#phase-5-error-handling--ux---detailed-steps)
7. [Phase 6: Caching Strategy - Detailed Steps](#phase-6-caching-strategy---detailed-steps)
8. [Rollback Procedures](#rollback-procedures)
9. [Validation & Testing Procedures](#validation--testing-procedures)

## Pre-Implementation Checklist

### Environment Setup
```bash
# 1. Create feature branch
git checkout -b feature/add-manga-refactor

# 2. Install required dependencies
pnpm add @tanstack/react-query@^5.0.0
pnpm add @tanstack/react-query-devtools@^5.0.0 -D
pnpm add immer@^10.0.0  # For immutable state updates
pnpm add zod@^3.22.0    # For runtime type validation

# 3. Update TypeScript config for stricter checking
# tsconfig.json additions:
{
  "compilerOptions": {
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}

# 4. Create test environment
mkdir -p src/components/addManga/__tests__
mkdir -p src/components/addManga/components/__tests__
mkdir -p src/components/addManga/__mocks__
```

### Documentation Preparation
```markdown
1. [ ] Document current API endpoints used
2. [ ] Map all current state dependencies
3. [ ] List all external hook dependencies
4. [ ] Document current user flows
5. [ ] Create component dependency graph
6. [ ] Backup current implementation
```

### Metrics Collection (Baseline)
```typescript
// src/utils/performance-metrics.ts
export function collectBaselineMetrics() {
  return {
    searchResponseTime: measureSearchTime(),
    componentRenderTime: measureRenderTime(),
    memoryUsage: measureMemoryUsage(),
    bundleSize: measureBundleSize(),
    typeErrors: countTypeErrors()
  };
}
```

---

## Phase 1: Component Extraction - Detailed Steps

### Step 1.1: Create Component Structure

```bash
# Create directory structure
mkdir -p src/components/addManga/components/{core,fields,display,providers}
mkdir -p src/components/addManga/hooks
mkdir -p src/components/addManga/utils
mkdir -p src/components/addManga/types
mkdir -p src/components/addManga/constants
```

### Step 1.2: Extract FieldSelector Component

#### 1.2.1 Create Base Component
```typescript
// src/components/addManga/components/fields/FieldSelector.tsx

import React, { useMemo, useCallback, memo } from 'react';
import { Select, TextInput, NumberInput, MultiSelect, Textarea, DateInput } from '@mantine/core';
import { Badge, Group, Text, Tooltip } from '@mantine/core';
import { ProviderBadge } from '../core/ProviderBadge';
import type { FieldOption, FieldType, FieldValue } from '../../types';

interface FieldSelectorProps {
  fieldName: string;
  fieldLabel: string;
  fieldType: FieldType;
  options: FieldOption[];
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  description?: string;
  showConfidence?: boolean;
  showSource?: boolean;
  error?: string;
}

export const FieldSelector = memo(function FieldSelector({
  fieldName,
  fieldLabel,
  fieldType,
  options,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder,
  description,
  showConfidence = true,
  showSource = true,
  error
}: FieldSelectorProps) {
  // Memoize the formatted options to prevent re-computation
  const formattedOptions = useMemo(() => {
    return options.map(opt => ({
      value: opt.value,
      label: opt.label,
      group: opt.source,
      disabled: opt.disabled,
      data: {
        source: opt.source,
        confidence: opt.confidence,
        description: opt.description
      }
    }));
  }, [options]);

  // Custom render for option with provider badge and confidence
  const renderOption = useCallback(({ option }: any) => (
    <Group spacing="xs" noWrap>
      {showSource && <ProviderBadge provider={option.data.source} size="xs" />}
      <div style={{ flex: 1 }}>
        <Text size="sm">{option.label}</Text>
        {option.data.description && (
          <Text size="xs" color="dimmed">{option.data.description}</Text>
        )}
      </div>
      {showConfidence && option.data.confidence !== undefined && (
        <Badge
          color={option.data.confidence > 80 ? 'green' : option.data.confidence > 50 ? 'yellow' : 'red'}
          size="xs"
        >
          {option.data.confidence}%
        </Badge>
      )}
    </Group>
  ), [showSource, showConfidence]);

  // Render different input types based on fieldType
  const renderField = () => {
    switch (fieldType) {
      case 'select':
        return (
          <Select
            label={fieldLabel}
            placeholder={placeholder || `Select ${fieldLabel.toLowerCase()}`}
            data={formattedOptions}
            value={value as string}
            onChange={(val) => onChange(val)}
            required={required}
            disabled={disabled}
            error={error}
            description={description}
            itemComponent={renderOption}
            searchable
            clearable
            nothingFound="No options available"
          />
        );

      case 'multiselect':
        return (
          <MultiSelect
            label={fieldLabel}
            placeholder={placeholder || `Select multiple ${fieldLabel.toLowerCase()}`}
            data={formattedOptions}
            value={value as string[]}
            onChange={(val) => onChange(val)}
            required={required}
            disabled={disabled}
            error={error}
            description={description}
            searchable
            clearable
            nothingFound="No options available"
          />
        );

      case 'text':
        return (
          <TextInput
            label={fieldLabel}
            placeholder={placeholder}
            value={value as string}
            onChange={(e) => onChange(e.currentTarget.value)}
            required={required}
            disabled={disabled}
            error={error}
            description={description}
          />
        );

      case 'textarea':
        return (
          <Textarea
            label={fieldLabel}
            placeholder={placeholder}
            value={value as string}
            onChange={(e) => onChange(e.currentTarget.value)}
            required={required}
            disabled={disabled}
            error={error}
            description={description}
            minRows={3}
            autosize
            maxRows={10}
          />
        );

      case 'number':
        return (
          <NumberInput
            label={fieldLabel}
            placeholder={placeholder}
            value={value as number}
            onChange={(val) => onChange(val)}
            required={required}
            disabled={disabled}
            error={error}
            description={description}
            min={0}
          />
        );

      case 'date':
        return (
          <DateInput
            label={fieldLabel}
            placeholder={placeholder}
            value={value as Date}
            onChange={(val) => onChange(val)}
            required={required}
            disabled={disabled}
            error={error}
            description={description}
            clearable
          />
        );

      default:
        return null;
    }
  };

  return (
    <div data-field={fieldName}>
      {renderField()}
    </div>
  );
});
```

#### 1.2.2 Create Field Configuration
```typescript
// src/components/addManga/constants/fieldConfigs.ts

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  category: 'basic' | 'metadata' | 'dates' | 'scores' | 'ids' | 'people';
  validation?: (value: any) => string | null;
  transform?: (value: any) => any;
  placeholder?: string;
  description?: string;
}

export const FIELD_CONFIGS: Record<string, FieldConfig> = {
  title: {
    name: 'title',
    label: 'Title',
    type: 'text',
    required: true,
    category: 'basic',
    validation: (value) => !value ? 'Title is required' : null
  },
  alternativeTitles: {
    name: 'alternativeTitles',
    label: 'Alternative Titles',
    type: 'multiselect',
    category: 'basic',
    description: 'Other known titles for this manga'
  },
  description: {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    category: 'basic',
    placeholder: 'Enter manga description or synopsis'
  },
  status: {
    name: 'status',
    label: 'Status',
    type: 'select',
    category: 'metadata',
    validation: (value) => {
      const valid = ['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED', 'UPCOMING'];
      return valid.includes(value) ? null : 'Invalid status';
    }
  },
  genres: {
    name: 'genres',
    label: 'Genres',
    type: 'multiselect',
    category: 'metadata'
  },
  volumes: {
    name: 'volumes',
    label: 'Volumes',
    type: 'number',
    category: 'metadata',
    validation: (value) => {
      if (value && (value < 0 || value > 10000)) {
        return 'Invalid volume count';
      }
      return null;
    }
  },
  chapters: {
    name: 'chapters',
    label: 'Chapters',
    type: 'number',
    category: 'metadata',
    validation: (value) => {
      if (value && (value < 0 || value > 50000)) {
        return 'Invalid chapter count';
      }
      return null;
    }
  },
  startDate: {
    name: 'startDate',
    label: 'Start Date',
    type: 'date',
    category: 'dates',
    transform: (value) => {
      if (!value) return null;
      if (typeof value === 'string') return value;
      if (value instanceof Date) return value.toISOString().split('T')[0];
      if (typeof value === 'object' && 'year' in value) {
        return `${value.year}-${String(value.month || 1).padStart(2, '0')}-${String(value.day || 1).padStart(2, '0')}`;
      }
      return null;
    }
  },
  endDate: {
    name: 'endDate',
    label: 'End Date',
    type: 'date',
    category: 'dates'
  },
  authors: {
    name: 'authors',
    label: 'Authors',
    type: 'multiselect',
    category: 'people'
  },
  publisher: {
    name: 'publisher',
    label: 'Publisher',
    type: 'select',
    category: 'people'
  },
  anilistId: {
    name: 'anilistId',
    label: 'AniList ID',
    type: 'text',
    category: 'ids',
    validation: (value) => {
      if (value && !/^\d+$/.test(value)) {
        return 'AniList ID must be numeric';
      }
      return null;
    }
  },
  malId: {
    name: 'malId',
    label: 'MyAnimeList ID',
    type: 'text',
    category: 'ids',
    validation: (value) => {
      if (value && !/^\d+$/.test(value)) {
        return 'MAL ID must be numeric';
      }
      return null;
    }
  },
  averageScore: {
    name: 'averageScore',
    label: 'Average Score',
    type: 'number',
    category: 'scores',
    validation: (value) => {
      if (value && (value < 0 || value > 100)) {
        return 'Score must be between 0 and 100';
      }
      return null;
    }
  },
  popularity: {
    name: 'popularity',
    label: 'Popularity',
    type: 'number',
    category: 'scores'
  }
};

// Helper function to get fields by category
export function getFieldsByCategory(category: FieldConfig['category']): FieldConfig[] {
  return Object.values(FIELD_CONFIGS).filter(field => field.category === category);
}

// Helper function to validate all fields
export function validateFields(values: Record<string, any>): Record<string, string> {
  const errors: Record<string, string> = {};
  
  Object.entries(FIELD_CONFIGS).forEach(([key, config]) => {
    if (config.validation) {
      const error = config.validation(values[key]);
      if (error) {
        errors[key] = error;
      }
    }
    
    if (config.required && !values[key]) {
      errors[key] = `${config.label} is required`;
    }
  });
  
  return errors;
}
```

### Step 1.3: Extract VolumeChapterTable Component

#### 1.3.1 Create Base Table Component
```typescript
// src/components/addManga/components/display/VolumeChapterTable.tsx

import React, { useState, useMemo, useCallback, memo } from 'react';
import {
  Table,
  ScrollArea,
  Badge,
  Group,
  Text,
  Collapse,
  ActionIcon,
  Paper,
  Stack,
  Tooltip,
  Checkbox,
  Button,
  Box
} from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconBook, IconFileText } from '@tabler/icons-react';
import { ProviderBadge } from '../core/ProviderBadge';
import type { VolumeData, ChapterData } from '../../types';

interface VolumeChapterTableProps {
  volumes: VolumeData[];
  chapters: ChapterData[];
  volumeProvider: string;
  chapterProvider: string;
  onVolumeSelect?: (volume: VolumeData) => void;
  onChapterSelect?: (chapter: ChapterData) => void;
  selectable?: boolean;
  expandable?: boolean;
  showProviderBadges?: boolean;
  maxHeight?: number;
}

export const VolumeChapterTable = memo(function VolumeChapterTable({
  volumes,
  chapters,
  volumeProvider,
  chapterProvider,
  onVolumeSelect,
  onChapterSelect,
  selectable = false,
  expandable = true,
  showProviderBadges = true,
  maxHeight = 400
}: VolumeChapterTableProps) {
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());
  const [selectedVolumes, setSelectedVolumes] = useState<Set<string>>(new Set());
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());

  // Group chapters by volume
  const chaptersByVolume = useMemo(() => {
    const grouped = new Map<number, ChapterData[]>();
    
    chapters.forEach(chapter => {
      const volumeNum = chapter.volumeNumber || 0;
      if (!grouped.has(volumeNum)) {
        grouped.set(volumeNum, []);
      }
      grouped.get(volumeNum)!.push(chapter);
    });
    
    // Sort chapters within each volume
    grouped.forEach((chaps, _) => {
      chaps.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    });
    
    return grouped;
  }, [chapters]);

  // Toggle volume expansion
  const toggleVolume = useCallback((volumeId: string) => {
    setExpandedVolumes(prev => {
      const next = new Set(prev);
      if (next.has(volumeId)) {
        next.delete(volumeId);
      } else {
        next.add(volumeId);
      }
      return next;
    });
  }, []);

  // Handle volume selection
  const handleVolumeSelect = useCallback((volume: VolumeData, checked: boolean) => {
    setSelectedVolumes(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(volume.id);
      } else {
        next.delete(volume.id);
      }
      return next;
    });
    
    if (onVolumeSelect) {
      onVolumeSelect(volume);
    }
  }, [onVolumeSelect]);

  // Handle chapter selection
  const handleChapterSelect = useCallback((chapter: ChapterData, checked: boolean) => {
    setSelectedChapters(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(chapter.id);
      } else {
        next.delete(chapter.id);
      }
      return next;
    });
    
    if (onChapterSelect) {
      onChapterSelect(chapter);
    }
  }, [onChapterSelect]);

  // Render chapter rows for a volume
  const renderChapters = (volumeNumber: number) => {
    const volumeChapters = chaptersByVolume.get(volumeNumber) || [];
    
    if (volumeChapters.length === 0) {
      return (
        <tr>
          <td colSpan={selectable ? 5 : 4}>
            <Text size="sm" color="dimmed" align="center">
              No chapters available for this volume
            </Text>
          </td>
        </tr>
      );
    }
    
    return volumeChapters.map(chapter => (
      <tr key={chapter.id} style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
        {selectable && (
          <td>
            <Checkbox
              checked={selectedChapters.has(chapter.id)}
              onChange={(e) => handleChapterSelect(chapter, e.currentTarget.checked)}
            />
          </td>
        )}
        <td style={{ paddingLeft: 40 }}>
          <Group spacing="xs">
            <IconFileText size={16} />
            <Text size="sm">Chapter {chapter.chapterNumber || '?'}</Text>
          </Group>
        </td>
        <td>
          <Text size="sm">{chapter.title || 'Untitled'}</Text>
        </td>
        <td>
          {showProviderBadges && (
            <ProviderBadge provider={chapterProvider} size="xs" />
          )}
        </td>
        <td>
          <Text size="xs" color="dimmed">
            {chapter.releaseDate ? new Date(chapter.releaseDate).toLocaleDateString() : '-'}
          </Text>
        </td>
      </tr>
    ));
  };

  // Render volume row
  const renderVolumeRow = (volume: VolumeData) => {
    const isExpanded = expandedVolumes.has(volume.id);
    const volumeChapters = chaptersByVolume.get(volume.volumeNumber) || [];
    const hasChapters = volumeChapters.length > 0;
    
    return (
      <React.Fragment key={volume.id}>
        <tr>
          {selectable && (
            <td>
              <Checkbox
                checked={selectedVolumes.has(volume.id)}
                onChange={(e) => handleVolumeSelect(volume, e.currentTarget.checked)}
              />
            </td>
          )}
          <td>
            <Group spacing="xs">
              {expandable && hasChapters && (
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={() => toggleVolume(volume.id)}
                >
                  {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                </ActionIcon>
              )}
              <IconBook size={16} />
              <Text weight={500}>Volume {volume.volumeNumber}</Text>
            </Group>
          </td>
          <td>
            <Stack spacing={2}>
              <Text size="sm">{volume.title || `Volume ${volume.volumeNumber}`}</Text>
              {volume.isbn && (
                <Text size="xs" color="dimmed">ISBN: {volume.isbn}</Text>
              )}
            </Stack>
          </td>
          <td>
            {showProviderBadges && (
              <Group spacing="xs">
                <ProviderBadge provider={volumeProvider} size="xs" />
                {hasChapters && (
                  <Badge size="xs" variant="outline">
                    {volumeChapters.length} chapters
                  </Badge>
                )}
              </Group>
            )}
          </td>
          <td>
            <Text size="xs" color="dimmed">
              {volume.releaseDate ? new Date(volume.releaseDate).toLocaleDateString() : '-'}
            </Text>
          </td>
        </tr>
        {expandable && isExpanded && hasChapters && renderChapters(volume.volumeNumber)}
      </React.Fragment>
    );
  };

  // Calculate statistics
  const stats = useMemo(() => ({
    totalVolumes: volumes.length,
    totalChapters: chapters.length,
    selectedVolumes: selectedVolumes.size,
    selectedChapters: selectedChapters.size
  }), [volumes.length, chapters.length, selectedVolumes.size, selectedChapters.size]);

  return (
    <Paper p="md" withBorder>
      <Stack spacing="md">
        {/* Header with stats */}
        <Group position="apart">
          <Group spacing="xs">
            <Text weight={500}>Volume & Chapter Data</Text>
            <Badge variant="filled">{stats.totalVolumes} volumes</Badge>
            <Badge variant="filled">{stats.totalChapters} chapters</Badge>
          </Group>
          
          {selectable && (
            <Group spacing="xs">
              <Badge variant="outline">
                {stats.selectedVolumes} volumes selected
              </Badge>
              <Badge variant="outline">
                {stats.selectedChapters} chapters selected
              </Badge>
            </Group>
          )}
        </Group>

        {/* Provider info */}
        {showProviderBadges && (
          <Group spacing="xs">
            <Text size="sm" color="dimmed">Sources:</Text>
            <ProviderBadge provider={volumeProvider} />
            <Text size="sm" color="dimmed">volumes</Text>
            <ProviderBadge provider={chapterProvider} />
            <Text size="sm" color="dimmed">chapters</Text>
          </Group>
        )}

        {/* Table */}
        <ScrollArea style={{ height: maxHeight }}>
          <Table highlightOnHover>
            <thead>
              <tr>
                {selectable && <th style={{ width: 40 }}></th>}
                <th>Volume/Chapter</th>
                <th>Title</th>
                <th>Source</th>
                <th>Release Date</th>
              </tr>
            </thead>
            <tbody>
              {volumes.length > 0 ? (
                volumes.map(volume => renderVolumeRow(volume))
              ) : (
                <tr>
                  <td colSpan={selectable ? 5 : 4}>
                    <Text align="center" color="dimmed">
                      No volume data available
                    </Text>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </ScrollArea>

        {/* Actions */}
        {selectable && (
          <Group position="right">
            <Button
              variant="subtle"
              size="xs"
              onClick={() => {
                setSelectedVolumes(new Set());
                setSelectedChapters(new Set());
              }}
            >
              Clear Selection
            </Button>
            <Button
              variant="subtle"
              size="xs"
              onClick={() => {
                setSelectedVolumes(new Set(volumes.map(v => v.id)));
                setSelectedChapters(new Set(chapters.map(c => c.id)));
              }}
            >
              Select All
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  );
});
```

### Step 1.4: Extract MetadataConfidenceDisplay Component

```typescript
// src/components/addManga/components/display/MetadataConfidenceDisplay.tsx

import React, { useMemo, memo } from 'react';
import {
  Paper,
  Stack,
  Text,
  Progress,
  Group,
  Badge,
  Tooltip,
  SimpleGrid,
  Box,
  ThemeIcon,
  RingProgress
} from '@mantine/core';
import {
  IconCheck,
  IconX,
  IconAlertCircle,
  IconInfoCircle
} from '@tabler/icons-react';
import type { FieldConfidence, MetadataQuality } from '../../types';

interface MetadataConfidenceDisplayProps {
  overallConfidence: number;
  fieldConfidences: Record<string, FieldConfidence>;
  quality: MetadataQuality;
  compact?: boolean;
  showDetails?: boolean;
}

export const MetadataConfidenceDisplay = memo(function MetadataConfidenceDisplay({
  overallConfidence,
  fieldConfidences,
  quality,
  compact = false,
  showDetails = true
}: MetadataConfidenceDisplayProps) {
  // Calculate category scores
  const categoryScores = useMemo(() => {
    const categories = {
      essential: { fields: ['title', 'description', 'cover'], score: 0, total: 0 },
      metadata: { fields: ['status', 'genres', 'volumes', 'chapters'], score: 0, total: 0 },
      dates: { fields: ['startDate', 'endDate'], score: 0, total: 0 },
      people: { fields: ['authors', 'publisher'], score: 0, total: 0 },
      ids: { fields: ['anilistId', 'malId'], score: 0, total: 0 }
    };
    
    Object.entries(fieldConfidences).forEach(([field, confidence]) => {
      Object.entries(categories).forEach(([_, category]) => {
        if (category.fields.includes(field)) {
          category.score += confidence.score;
          category.total += 1;
        }
      });
    });
    
    return Object.entries(categories).map(([name, data]) => ({
      name,
      score: data.total > 0 ? Math.round(data.score / data.total) : 0,
      fields: data.fields
    }));
  }, [fieldConfidences]);

  // Get color based on score
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    if (score >= 40) return 'orange';
    return 'red';
  };

  // Get icon based on quality
  const getQualityIcon = () => {
    switch (quality) {
      case 'excellent':
        return <IconCheck size={16} />;
      case 'good':
        return <IconCheck size={16} />;
      case 'fair':
        return <IconAlertCircle size={16} />;
      case 'poor':
        return <IconX size={16} />;
      default:
        return <IconInfoCircle size={16} />;
    }
  };

  if (compact) {
    return (
      <Group spacing="xs">
        <RingProgress
          size={40}
          thickness={4}
          sections={[
            { value: overallConfidence, color: getScoreColor(overallConfidence) }
          ]}
          label={
            <Text size="xs" align="center">
              {overallConfidence}%
            </Text>
          }
        />
        <Badge color={getScoreColor(overallConfidence)} variant="filled">
          {quality}
        </Badge>
      </Group>
    );
  }

  return (
    <Paper p="md" withBorder>
      <Stack spacing="md">
        {/* Header */}
        <Group position="apart">
          <Text weight={500}>Metadata Quality</Text>
          <Group spacing="xs">
            <ThemeIcon
              color={getScoreColor(overallConfidence)}
              variant="light"
              size="sm"
            >
              {getQualityIcon()}
            </ThemeIcon>
            <Badge color={getScoreColor(overallConfidence)} variant="filled">
              {quality.toUpperCase()}
            </Badge>
          </Group>
        </Group>

        {/* Overall Score */}
        <Box>
          <Group position="apart" mb="xs">
            <Text size="sm">Overall Confidence</Text>
            <Text size="sm" weight={500}>{overallConfidence}%</Text>
          </Group>
          <Progress
            value={overallConfidence}
            color={getScoreColor(overallConfidence)}
            size="lg"
            radius="xl"
            animate
          />
        </Box>

        {/* Category Breakdown */}
        {showDetails && (
          <>
            <Text size="sm" weight={500}>Category Breakdown</Text>
            <SimpleGrid cols={2} spacing="xs">
              {categoryScores.map(category => (
                <Tooltip
                  key={category.name}
                  label={`Fields: ${category.fields.join(', ')}`}
                  withArrow
                >
                  <Box>
                    <Group position="apart" mb={4}>
                      <Text size="xs" transform="capitalize">
                        {category.name}
                      </Text>
                      <Text size="xs" weight={500}>
                        {category.score}%
                      </Text>
                    </Group>
                    <Progress
                      value={category.score}
                      color={getScoreColor(category.score)}
                      size="sm"
                      radius="xl"
                    />
                  </Box>
                </Tooltip>
              ))}
            </SimpleGrid>
          </>
        )}

        {/* Field Details */}
        {showDetails && (
          <>
            <Text size="sm" weight={500}>Field Details</Text>
            <Stack spacing={4}>
              {Object.entries(fieldConfidences)
                .sort((a, b) => b[1].score - a[1].score)
                .slice(0, 5)
                .map(([field, confidence]) => (
                  <Group key={field} position="apart">
                    <Group spacing="xs">
                      <ThemeIcon
                        size="xs"
                        color={confidence.hasValue ? 'green' : 'gray'}
                        variant="light"
                      >
                        {confidence.hasValue ? <IconCheck size={12} /> : <IconX size={12} />}
                      </ThemeIcon>
                      <Text size="xs" transform="capitalize">
                        {field.replace(/([A-Z])/g, ' $1').trim()}
                      </Text>
                    </Group>
                    <Group spacing="xs">
                      <Badge
                        size="xs"
                        variant="outline"
                        color={confidence.hasMultipleSources ? 'blue' : 'gray'}
                      >
                        {confidence.sourceCount} source{confidence.sourceCount !== 1 ? 's' : ''}
                      </Badge>
                      <Badge
                        size="xs"
                        color={getScoreColor(confidence.score)}
                      >
                        {confidence.score}%
                      </Badge>
                    </Group>
                  </Group>
                ))}
            </Stack>
          </>
        )}
      </Stack>
    </Paper>
  );
});
```

---

## Phase 2: Type Consolidation - Detailed Steps

### Step 2.1: Create Master Types File

```typescript
// src/types/addManga.types.ts

import { z } from 'zod';

// ============================================
// Base Types
// ============================================

export type ID = string | number;
export type MangaStatus = 'ONGOING' | 'COMPLETED' | 'HIATUS' | 'CANCELLED' | 'UPCOMING';
export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'date' | 'boolean';
export type MetadataQuality = 'excellent' | 'good' | 'fair' | 'poor';

// ============================================
// Zod Schemas for Runtime Validation
// ============================================

export const MangaStatusSchema = z.enum(['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED', 'UPCOMING']);

export const DateValueSchema = z.union([
  z.string(),
  z.date(),
  z.object({
    year: z.number(),
    month: z.number().optional(),
    day: z.number().optional()
  })
]).transform(val => {
  if (typeof val === 'string') return val;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'object' && 'year' in val) {
    const { year, month = 1, day = 1 } = val;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return null;
});

export const MangaMetadataSchema = z.object({
  // Basic Information
  title: z.string(),
  alternativeTitles: z.array(z.string()).optional(),
  description: z.string().optional(),
  cover: z.string().optional(),
  bannerImage: z.string().optional(),
  
  // Publication Info
  status: MangaStatusSchema.optional(),
  format: z.string().optional(),
  volumes: z.number().nullable().optional(),
  chapters: z.number().nullable().optional(),
  
  // Categories
  genres: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  
  // Dates
  startDate: DateValueSchema.nullable().optional(),
  endDate: DateValueSchema.nullable().optional(),
  releaseYear: z.number().nullable().optional(),
  
  // People
  authors: z.array(z.string()).optional(),
  artists: z.array(z.string()).optional(),
  publisher: z.string().optional(),
  
  // IDs
  anilistId: z.string().optional(),
  malId: z.string().optional(),
  mangadexId: z.string().optional(),
  comicvineId: z.string().optional(),
  
  // Scores
  averageScore: z.number().nullable().optional(),
  popularity: z.number().nullable().optional(),
  
  // Additional
  countryOfOrigin: z.string().optional(),
  isAdult: z.boolean().optional(),
  externalLinks: z.array(z.object({
    site: z.string(),
    url: z.string()
  })).optional()
});

export type MangaMetadata = z.infer<typeof MangaMetadataSchema>;

// ============================================
// Search Result Types
// ============================================

export interface MangaSearchResult {
  id: string;
  sourceId: string;
  source: string;
  provider: string;
  title: string;
  coverUrl?: string;
  description?: string;
  status?: MangaStatus;
  metadata: Partial<MangaMetadata>;
  providerSpecific?: Record<string, any>;
  rawData?: any;
  confidence?: number;
  lastUpdated?: string;
}

// ============================================
// Field Selection Types
// ============================================

export interface FieldOption {
  value: any;
  label: string;
  source: string;
  confidence?: number;
  description?: string;
  disabled?: boolean;
}

export interface FieldSelection {
  source: string;
  value: any;
  confidence?: number;
  lastUpdated?: string;
}

export type FieldSelections = Record<string, FieldSelection>;

export interface FieldConfidence {
  score: number;
  hasValue: boolean;
  hasMultipleSources: boolean;
  sourceCount: number;
  sources: string[];
}

// ============================================
// Volume & Chapter Types
// ============================================

export interface VolumeData {
  id: string;
  volumeNumber: number;
  title?: string;
  coverUrl?: string;
  isbn?: string;
  releaseDate?: string;
  chapterCount?: number;
  startChapter?: number;
  endChapter?: number;
  provider: string;
}

export interface ChapterData {
  id: string;
  chapterNumber: number;
  volumeNumber?: number;
  title?: string;
  coverUrl?: string;
  releaseDate?: string;
  pageCount?: number;
  provider: string;
  downloadUrl?: string;
}

export interface ParsedVolumeData {
  volumes: number;
  chapters: number;
  volumeDetails?: VolumeData[];
  chapterDetails?: ChapterData[];
  provider: string;
  parseDate: string;
}

// ============================================
// Form Types
// ============================================

export interface AddMangaFormValues {
  // Search
  query: string;
  
  // Selected Manga
  mangaId: string;
  mangaTitle: string;
  source: string;
  
  // Library
  libraryId: number;
  
  // Metadata
  metadata?: Partial<MangaMetadata>;
  fieldSelections?: FieldSelections;
  parsedVolumeData?: ParsedVolumeData;
  
  // Download Configuration
  downloadPath?: string;
  autoDownload?: boolean;
  downloadQuality?: 'high' | 'medium' | 'low';
  startChapter?: number;
  endChapter?: number;
  
  // Monitoring
  monitoringInterval?: 'never' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
  customInterval?: string;
  
  // Provider Metadata
  providerMetadata?: Record<string, any>;
  additionalUrls?: string[];
}

// ============================================
// Provider Types
// ============================================

export interface ProviderSearchResult {
  provider: string;
  results: MangaSearchResult[];
  error?: string;
  isLoading: boolean;
  searchTime?: number;
  cacheHit?: boolean;
}

export interface ProviderEnhancement {
  provider: string;
  url: string;
  data: Partial<MangaMetadata>;
  confidence: number;
  enhancedAt: string;
}

// ============================================
// Type Guards
// ============================================

export function isMangaSearchResult(value: unknown): value is MangaSearchResult {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.source === 'string' &&
    typeof obj.provider === 'string'
  );
}

export function isValidMangaStatus(value: unknown): value is MangaStatus {
  return typeof value === 'string' && 
    ['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED', 'UPCOMING'].includes(value);
}

export function isValidDate(value: unknown): boolean {
  if (!value) return false;
  if (typeof value === 'string') {
    return !isNaN(Date.parse(value));
  }
  if (value instanceof Date) {
    return !isNaN(value.getTime());
  }
  if (typeof value === 'object' && 'year' in value) {
    return true;
  }
  return false;
}

// ============================================
// Utility Types
// ============================================

export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type ValueOf<T> = T[keyof T];

// ============================================
// Constants
// ============================================

export const PROVIDER_COLORS: Record<string, string> = {
  anilist: 'blue',
  mangadex: 'orange',
  comicvine: 'green',
  fandom: 'violet',
  wikipedia: 'cyan',
  default: 'gray'
};

export const CONFIDENCE_THRESHOLDS = {
  excellent: 80,
  good: 60,
  fair: 40,
  poor: 0
} as const;
```

### Step 2.2: Create Migration Helpers

```typescript
// src/components/addManga/utils/typeMigration.ts

import type { 
  MangaSearchResult, 
  AddMangaFormValues,
  MangaMetadata 
} from '../types/addManga.types';

/**
 * Migrate old search result format to new format
 */
export function migrateSearchResult(oldResult: any): MangaSearchResult {
  return {
    id: String(oldResult.id || oldResult.mangaId || ''),
    sourceId: String(oldResult.sourceId || oldResult.id || ''),
    source: oldResult.source || oldResult.provider || 'unknown',
    provider: oldResult.provider || oldResult.source || 'unknown',
    title: oldResult.title || oldResult.mangaTitle || 'Unknown',
    coverUrl: oldResult.cover || oldResult.coverImage || oldResult.coverUrl,
    description: oldResult.description || oldResult.synopsis,
    status: normalizeStatus(oldResult.status),
    metadata: extractMetadata(oldResult),
    providerSpecific: oldResult.providerSpecific || oldResult.rawData,
    rawData: oldResult.rawData,
    confidence: oldResult.confidence
  };
}

/**
 * Extract metadata from various result formats
 */
function extractMetadata(result: any): Partial<MangaMetadata> {
  const metadata: Partial<MangaMetadata> = {};
  
  // Direct properties
  if (result.alternativeTitles) metadata.alternativeTitles = result.alternativeTitles;
  if (result.genres) metadata.genres = result.genres;
  if (result.authors) metadata.authors = result.authors;
  if (result.volumes !== undefined) metadata.volumes = result.volumes;
  if (result.chapters !== undefined) metadata.chapters = result.chapters;
  
  // From metadata property
  if (result.metadata) {
    Object.assign(metadata, result.metadata);
  }
  
  // From rawData property
  if (result.rawData) {
    if (result.rawData.bannerImage) metadata.bannerImage = result.rawData.bannerImage;
    if (result.rawData.averageScore) metadata.averageScore = result.rawData.averageScore;
    if (result.rawData.popularity) metadata.popularity = result.rawData.popularity;
  }
  
  return metadata;
}

/**
 * Normalize status to valid enum value
 */
function normalizeStatus(status: any): MangaStatus | undefined {
  if (!status) return undefined;
  
  const statusMap: Record<string, MangaStatus> = {
    'ongoing': 'ONGOING',
    'completed': 'COMPLETED',
    'finished': 'COMPLETED',
    'hiatus': 'HIATUS',
    'cancelled': 'CANCELLED',
    'canceled': 'CANCELLED',
    'upcoming': 'UPCOMING',
    'not_yet_released': 'UPCOMING'
  };
  
  const normalized = statusMap[String(status).toLowerCase()];
  return normalized || undefined;
}

/**
 * Type assertion with validation
 */
export function assertMangaSearchResult(value: unknown): asserts value is MangaSearchResult {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid manga search result: not an object');
  }
  
  const obj = value as Record<string, unknown>;
  
  if (!obj.id || typeof obj.id !== 'string') {
    throw new Error('Invalid manga search result: missing or invalid id');
  }
  
  if (!obj.title || typeof obj.title !== 'string') {
    throw new Error('Invalid manga search result: missing or invalid title');
  }
  
  if (!obj.source || typeof obj.source !== 'string') {
    throw new Error('Invalid manga search result: missing or invalid source');
  }
}
```

---

## Phase 3: State Management - Detailed Steps

### Step 3.1: Create State Reducer

```typescript
// src/components/addManga/hooks/useAddMangaReducer.ts

import { useReducer, useCallback, Dispatch } from 'react';
import { produce } from 'immer';
import type {
  AddMangaFormValues,
  MangaSearchResult,
  FieldSelections,
  ProviderSearchResult,
  ParsedVolumeData
} from '../types/addManga.types';

// ============================================
// State Definition
// ============================================

export interface AddMangaState {
  // Navigation
  currentStep: number;
  maxStepReached: number;
  
  // Form Data
  formValues: AddMangaFormValues;
  formErrors: Record<string, string>;
  isDirty: boolean;
  
  // Search
  searchQuery: string;
  searchResults: Record<string, ProviderSearchResult>;
  selectedManga: MangaSearchResult | null;
  searchHistory: string[];
  
  // Metadata
  fieldSelections: FieldSelections;
  parsedVolumeData: ParsedVolumeData | null;
  metadataUrls: string[];
  enhancedMetadata: Record<string, any>;
  
  // UI State
  isLoading: boolean;
  loadingMessage?: string;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  
  // Cache
  cachedSearches: Map<string, ProviderSearchResult[]>;
  cachedMetadata: Map<string, any>;
}

// ============================================
// Action Types
// ============================================

export type AddMangaAction =
  // Navigation
  | { type: 'SET_STEP'; payload: number }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'RESET_WORKFLOW' }
  
  // Form
  | { type: 'UPDATE_FORM'; payload: Partial<AddMangaFormValues> }
  | { type: 'SET_FORM_ERROR'; payload: { field: string; error: string } }
  | { type: 'CLEAR_FORM_ERRORS' }
  | { type: 'VALIDATE_FORM' }
  
  // Search
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SEARCH_RESULTS'; payload: { provider: string; results: ProviderSearchResult } }
  | { type: 'CLEAR_SEARCH_RESULTS' }
  | { type: 'SELECT_MANGA'; payload: MangaSearchResult }
  | { type: 'ADD_TO_SEARCH_HISTORY'; payload: string }
  
  // Metadata
  | { type: 'UPDATE_FIELD_SELECTION'; payload: { field: string; selection: FieldSelection } }
  | { type: 'BULK_UPDATE_FIELD_SELECTIONS'; payload: FieldSelections }
  | { type: 'SET_PARSED_VOLUME_DATA'; payload: ParsedVolumeData }
  | { type: 'ADD_METADATA_URL'; payload: string }
  | { type: 'REMOVE_METADATA_URL'; payload: string }
  | { type: 'SET_ENHANCED_METADATA'; payload: { provider: string; data: any } }
  
  // UI State
  | { type: 'SET_LOADING'; payload: { isLoading: boolean; message?: string } }
  | { type: 'SET_ERROR'; payload: { key: string; error: string } }
  | { type: 'CLEAR_ERROR'; payload: string }
  | { type: 'SET_WARNING'; payload: { key: string; warning: string } }
  | { type: 'CLEAR_WARNING'; payload: string }
  
  // Cache
  | { type: 'CACHE_SEARCH'; payload: { query: string; results: ProviderSearchResult[] } }
  | { type: 'CACHE_METADATA'; payload: { key: string; data: any } }
  | { type: 'CLEAR_CACHE' };

// ============================================
// Initial State
// ============================================

export const initialAddMangaState: AddMangaState = {
  // Navigation
  currentStep: 0,
  maxStepReached: 0,
  
  // Form Data
  formValues: {
    query: '',
    mangaId: '',
    mangaTitle: '',
    source: '',
    libraryId: 0
  },
  formErrors: {},
  isDirty: false,
  
  // Search
  searchQuery: '',
  searchResults: {},
  selectedManga: null,
  searchHistory: [],
  
  // Metadata
  fieldSelections: {},
  parsedVolumeData: null,
  metadataUrls: [],
  enhancedMetadata: {},
  
  // UI State
  isLoading: false,
  errors: {},
  warnings: {},
  
  // Cache
  cachedSearches: new Map(),
  cachedMetadata: new Map()
};

// ============================================
// Reducer Implementation
// ============================================

export function addMangaReducer(
  state: AddMangaState,
  action: AddMangaAction
): AddMangaState {
  return produce(state, draft => {
    switch (action.type) {
      // Navigation Actions
      case 'SET_STEP':
        draft.currentStep = action.payload;
        draft.maxStepReached = Math.max(draft.maxStepReached, action.payload);
        break;
        
      case 'NEXT_STEP':
        draft.currentStep = Math.min(draft.currentStep + 1, 3);
        draft.maxStepReached = Math.max(draft.maxStepReached, draft.currentStep);
        break;
        
      case 'PREV_STEP':
        draft.currentStep = Math.max(draft.currentStep - 1, 0);
        break;
        
      case 'RESET_WORKFLOW':
        return initialAddMangaState;
        
      // Form Actions
      case 'UPDATE_FORM':
        Object.assign(draft.formValues, action.payload);
        draft.isDirty = true;
        break;
        
      case 'SET_FORM_ERROR':
        draft.formErrors[action.payload.field] = action.payload.error;
        break;
        
      case 'CLEAR_FORM_ERRORS':
        draft.formErrors = {};
        break;
        
      // Search Actions
      case 'SET_SEARCH_QUERY':
        draft.searchQuery = action.payload;
        break;
        
      case 'SET_SEARCH_RESULTS':
        draft.searchResults[action.payload.provider] = action.payload.results;
        break;
        
      case 'CLEAR_SEARCH_RESULTS':
        draft.searchResults = {};
        break;
        
      case 'SELECT_MANGA':
        draft.selectedManga = action.payload;
        draft.formValues.mangaId = action.payload.id;
        draft.formValues.mangaTitle = action.payload.title;
        draft.formValues.source = action.payload.source;
        break;
        
      case 'ADD_TO_SEARCH_HISTORY':
        if (!draft.searchHistory.includes(action.payload)) {
          draft.searchHistory.unshift(action.payload);
          if (draft.searchHistory.length > 10) {
            draft.searchHistory.pop();
          }
        }
        break;
        
      // Metadata Actions
      case 'UPDATE_FIELD_SELECTION':
        draft.fieldSelections[action.payload.field] = action.payload.selection;
        break;
        
      case 'BULK_UPDATE_FIELD_SELECTIONS':
        draft.fieldSelections = action.payload;
        break;
        
      case 'SET_PARSED_VOLUME_DATA':
        draft.parsedVolumeData = action.payload;
        break;
        
      case 'ADD_METADATA_URL':
        if (!draft.metadataUrls.includes(action.payload)) {
          draft.metadataUrls.push(action.payload);
        }
        break;
        
      case 'REMOVE_METADATA_URL':
        draft.metadataUrls = draft.metadataUrls.filter(url => url !== action.payload);
        break;
        
      case 'SET_ENHANCED_METADATA':
        draft.enhancedMetadata[action.payload.provider] = action.payload.data;
        break;
        
      // UI State Actions
      case 'SET_LOADING':
        draft.isLoading = action.payload.isLoading;
        draft.loadingMessage = action.payload.message;
        break;
        
      case 'SET_ERROR':
        draft.errors[action.payload.key] = action.payload.error;
        break;
        
      case 'CLEAR_ERROR':
        delete draft.errors[action.payload];
        break;
        
      case 'SET_WARNING':
        draft.warnings[action.payload.key] = action.payload.warning;
        break;
        
      case 'CLEAR_WARNING':
        delete draft.warnings[action.payload];
        break;
        
      // Cache Actions
      case 'CACHE_SEARCH':
        draft.cachedSearches.set(action.payload.query, action.payload.results);
        break;
        
      case 'CACHE_METADATA':
        draft.cachedMetadata.set(action.payload.key, action.payload.data);
        break;
        
      case 'CLEAR_CACHE':
        draft.cachedSearches.clear();
        draft.cachedMetadata.clear();
        break;
    }
  });
}

// ============================================
// Custom Hook
// ============================================

export function useAddMangaState() {
  const [state, dispatch] = useReducer(addMangaReducer, initialAddMangaState);
  
  // Action creators for common operations
  const actions = {
    // Navigation
    nextStep: useCallback(() => dispatch({ type: 'NEXT_STEP' }), []),
    prevStep: useCallback(() => dispatch({ type: 'PREV_STEP' }), []),
    setStep: useCallback((step: number) => 
      dispatch({ type: 'SET_STEP', payload: step }), []),
    reset: useCallback(() => dispatch({ type: 'RESET_WORKFLOW' }), []),
    
    // Form
    updateForm: useCallback((values: Partial<AddMangaFormValues>) => 
      dispatch({ type: 'UPDATE_FORM', payload: values }), []),
    setFormError: useCallback((field: string, error: string) => 
      dispatch({ type: 'SET_FORM_ERROR', payload: { field, error } }), []),
    clearFormErrors: useCallback(() => 
      dispatch({ type: 'CLEAR_FORM_ERRORS' }), []),
    
    // Search
    setSearchQuery: useCallback((query: string) => 
      dispatch({ type: 'SET_SEARCH_QUERY', payload: query }), []),
    setSearchResults: useCallback((provider: string, results: ProviderSearchResult) => 
      dispatch({ type: 'SET_SEARCH_RESULTS', payload: { provider, results } }), []),
    selectManga: useCallback((manga: MangaSearchResult) => 
      dispatch({ type: 'SELECT_MANGA', payload: manga }), []),
    
    // Metadata
    updateFieldSelection: useCallback((field: string, selection: FieldSelection) => 
      dispatch({ type: 'UPDATE_FIELD_SELECTION', payload: { field, selection } }), []),
    setParsedVolumeData: useCallback((data: ParsedVolumeData) => 
      dispatch({ type: 'SET_PARSED_VOLUME_DATA', payload: data }), []),
    addMetadataUrl: useCallback((url: string) => 
      dispatch({ type: 'ADD_METADATA_URL', payload: url }), []),
    
    // UI
    setLoading: useCallback((isLoading: boolean, message?: string) => 
      dispatch({ type: 'SET_LOADING', payload: { isLoading, message } }), []),
    setError: useCallback((key: string, error: string) => 
      dispatch({ type: 'SET_ERROR', payload: { key, error } }), []),
    clearError: useCallback((key: string) => 
      dispatch({ type: 'CLEAR_ERROR', payload: key }), [])
  };
  
  return { state, dispatch, ...actions };
}
```

---

## Phase 4: Performance Optimization - Detailed Steps

### Step 4.1: Implement Parallel Fetching

```typescript
// src/components/addManga/hooks/useParallelProviderSearch.ts

import { useState, useCallback, useRef, useEffect } from 'react';
import { trpc } from '../../../utils/trpc-client';
import type { MangaSearchResult, ProviderSearchResult } from '../types/addManga.types';
import { logger } from '../../../utils/logging';

interface UseParallelProviderSearchOptions {
  providers: string[];
  timeout?: number;
  maxConcurrent?: number;
  cacheTime?: number;
}

export function useParallelProviderSearch(options: UseParallelProviderSearchOptions) {
  const { providers, timeout = 10000, maxConcurrent = 5, cacheTime = 300000 } = options;
  
  const [results, setResults] = useState<Record<string, ProviderSearchResult>>({});
  const [isSearching, setIsSearching] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, { data: ProviderSearchResult; timestamp: number }>>(new Map());
  
  // Clean up old cache entries
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of cacheRef.current.entries()) {
        if (now - value.timestamp > cacheTime) {
          cacheRef.current.delete(key);
        }
      }
    }, 60000); // Clean every minute
    
    return () => clearInterval(interval);
  }, [cacheTime]);
  
  // Search function for a single provider
  const searchProvider = useCallback(async (
    query: string,
    provider: string,
    signal: AbortSignal
  ): Promise<ProviderSearchResult> => {
    const cacheKey = `${provider}:${query}`;
    const cached = cacheRef.current.get(cacheKey);
    
    // Return cached result if fresh
    if (cached && Date.now() - cached.timestamp < cacheTime) {
      logger.debug(`Cache hit for ${provider}:${query}`);
      return { ...cached.data, cacheHit: true };
    }
    
    const startTime = performance.now();
    
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout searching ${provider}`)), timeout);
      });
      
      // Create search promise
      const searchPromise = trpc.search.provider.mutate({
        query,
        provider,
        limit: 20
      });
      
      // Race between search and timeout
      const response = await Promise.race([searchPromise, timeoutPromise]);
      const searchTime = performance.now() - startTime;
      
      const result: ProviderSearchResult = {
        provider,
        results: response.results || [],
        isLoading: false,
        searchTime,
        cacheHit: false
      };
      
      // Cache successful result
      cacheRef.current.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      const searchTime = performance.now() - startTime;
      logger.error(`Error searching ${provider}:`, error);
      
      return {
        provider,
        results: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
        searchTime,
        cacheHit: false
      };
    }
  }, [timeout, cacheTime]);
  
  // Batch search with concurrency control
  const search = useCallback(async (query: string): Promise<Record<string, ProviderSearchResult>> => {
    if (!query.trim()) {
      return {};
    }
    
    // Cancel previous search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    setIsSearching(true);
    
    // Initialize results with loading state
    const initialResults: Record<string, ProviderSearchResult> = {};
    providers.forEach(provider => {
      initialResults[provider] = {
        provider,
        results: [],
        isLoading: true
      };
    });
    setResults(initialResults);
    
    try {
      // Create search promises with concurrency control
      const searchPromises: Promise<ProviderSearchResult>[] = [];
      const providerBatches: string[][] = [];
      
      // Split providers into batches
      for (let i = 0; i < providers.length; i += maxConcurrent) {
        providerBatches.push(providers.slice(i, i + maxConcurrent));
      }
      
      // Process batches sequentially, providers within batch in parallel
      const allResults: ProviderSearchResult[] = [];
      
      for (const batch of providerBatches) {
        if (abortController.signal.aborted) break;
        
        const batchPromises = batch.map(provider => 
          searchProvider(query, provider, abortController.signal)
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            allResults.push(result.value);
            
            // Update results incrementally
            setResults(prev => ({
              ...prev,
              [result.value.provider]: result.value
            }));
          } else {
            const provider = batch[index];
            const errorResult: ProviderSearchResult = {
              provider,
              results: [],
              error: 'Search failed',
              isLoading: false
            };
            allResults.push(errorResult);
            
            setResults(prev => ({
              ...prev,
              [provider]: errorResult
            }));
          }
        });
      }
      
      // Build final results map
      const finalResults: Record<string, ProviderSearchResult> = {};
      allResults.forEach(result => {
        finalResults[result.provider] = result;
      });
      
      return finalResults;
    } finally {
      setIsSearching(false);
      abortControllerRef.current = null;
    }
  }, [providers, maxConcurrent, searchProvider]);
  
  // Cancel ongoing search
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSearching(false);
    }
  }, []);
  
  // Clear cache
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);
  
  // Get cache statistics
  const getCacheStats = useCallback(() => {
    return {
      size: cacheRef.current.size,
      entries: Array.from(cacheRef.current.entries()).map(([key, value]) => ({
        key,
        age: Date.now() - value.timestamp
      }))
    };
  }, []);
  
  return {
    results,
    isSearching,
    search,
    cancel,
    clearCache,
    getCacheStats
  };
}
```

### Step 4.2: Request Batching Implementation

```typescript
// src/components/addManga/utils/MetadataBatcher.ts

import { trpc } from '../../../utils/trpc-client';
import type { MangaMetadata } from '../types/addManga.types';
import { logger } from '../../../utils/logging';

interface BatchRequest {
  id: string;
  provider: string;
  resolver: (data: MangaMetadata | null) => void;
  rejecter: (error: Error) => void;
}

export class MetadataBatcher {
  private queue: BatchRequest[] = [];
  private timeout: NodeJS.Timeout | null = null;
  private batchSize: number;
  private batchDelay: number;
  private processing: boolean = false;
  
  constructor(options: { batchSize?: number; batchDelay?: number } = {}) {
    this.batchSize = options.batchSize || 10;
    this.batchDelay = options.batchDelay || 50;
  }
  
  /**
   * Fetch metadata for a single item, batched with others
   */
  async fetchMetadata(id: string, provider: string): Promise<MangaMetadata | null> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        id,
        provider,
        resolver: resolve,
        rejecter: reject
      });
      
      this.scheduleBatch();
    });
  }
  
  /**
   * Schedule batch processing
   */
  private scheduleBatch(): void {
    // If already scheduled or processing, skip
    if (this.timeout || this.processing) return;
    
    // If queue is full, process immediately
    if (this.queue.length >= this.batchSize) {
      this.processBatch();
      return;
    }
    
    // Schedule batch processing
    this.timeout = setTimeout(() => {
      this.processBatch();
    }, this.batchDelay);
  }
  
  /**
   * Process the current batch
   */
  private async processBatch(): Promise<void> {
    // Clear timeout
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    // Get batch to process
    const batch = this.queue.splice(0, this.batchSize);
    if (batch.length === 0) return;
    
    this.processing = true;
    
    try {
      logger.debug(`Processing metadata batch of ${batch.length} items`);
      
      // Group by provider for efficient fetching
      const byProvider = batch.reduce((acc, item) => {
        if (!acc[item.provider]) {
          acc[item.provider] = [];
        }
        acc[item.provider].push(item);
        return acc;
      }, {} as Record<string, BatchRequest[]>);
      
      // Fetch metadata for each provider group
      const fetchPromises = Object.entries(byProvider).map(async ([provider, items]) => {
        try {
          const ids = items.map(item => item.id);
          
          // Call batch endpoint
          const results = await trpc.metadata.batchFetch.mutate({
            provider,
            ids
          });
          
          // Resolve individual promises
          items.forEach((item, index) => {
            const metadata = results[index] || null;
            item.resolver(metadata);
          });
        } catch (error) {
          // Reject all items for this provider
          const err = error instanceof Error ? error : new Error('Batch fetch failed');
          items.forEach(item => item.rejecter(err));
        }
      });
      
      await Promise.allSettled(fetchPromises);
    } catch (error) {
      logger.error('Error processing metadata batch:', error);
      
      // Reject all items in batch
      const err = error instanceof Error ? error : new Error('Batch processing failed');
      batch.forEach(item => item.rejecter(err));
    } finally {
      this.processing = false;
      
      // Schedule next batch if queue not empty
      if (this.queue.length > 0) {
        this.scheduleBatch();
      }
    }
  }
  
  /**
   * Clear the queue
   */
  clear(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    // Reject all pending requests
    this.queue.forEach(item => {
      item.rejecter(new Error('Batcher cleared'));
    });
    
    this.queue = [];
  }
  
  /**
   * Get queue statistics
   */
  getStats(): { queueSize: number; processing: boolean } {
    return {
      queueSize: this.queue.length,
      processing: this.processing
    };
  }
}

// Create singleton instance
export const metadataBatcher = new MetadataBatcher({
  batchSize: 10,
  batchDelay: 50
});
```

---

## Phase 5: Error Handling & UX - Detailed Steps

### Step 5.1: Create Error Handling System

```typescript
// src/components/addManga/hooks/useErrorHandler.ts

import { useCallback, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';
import { logger } from '../../../utils/logging';

interface ErrorHandlerOptions {
  logErrors?: boolean;
  showNotifications?: boolean;
  persistErrors?: boolean;
}

interface ErrorRecord {
  id: string;
  message: string;
  context?: string;
  timestamp: Date;
  severity: 'error' | 'warning' | 'info';
  details?: any;
}

export function useErrorHandler(options: ErrorHandlerOptions = {}) {
  const { 
    logErrors = true, 
    showNotifications = true, 
    persistErrors = false 
  } = options;
  
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  
  /**
   * Handle error with context
   */
  const handleError = useCallback((
    error: unknown,
    context?: string,
    severity: 'error' | 'warning' | 'info' = 'error'
  ) => {
    // Extract error message
    let message: string;
    let details: any = undefined;
    
    if (error instanceof Error) {
      message = error.message;
      details = {
        stack: error.stack,
        name: error.name
      };
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      message = String((error as any).message);
      details = error;
    } else {
      message = 'An unknown error occurred';
      details = error;
    }
    
    // Create error record
    const errorRecord: ErrorRecord = {
      id: `${Date.now()}-${Math.random()}`,
      message,
      context,
      timestamp: new Date(),
      severity,
      details
    };
    
    // Log error
    if (logErrors) {
      const logMessage = context ? `[${context}] ${message}` : message;
      
      switch (severity) {
        case 'error':
          logger.error(logMessage, details);
          break;
        case 'warning':
          logger.warn(logMessage, details);
          break;
        case 'info':
          logger.info(logMessage, details);
          break;
      }
    }
    
    // Show notification
    if (showNotifications) {
      const title = context || (
        severity === 'error' ? 'Error' :
        severity === 'warning' ? 'Warning' :
        'Info'
      );
      
      const icon = 
        severity === 'error' ? <IconX /> :
        severity === 'warning' ? <IconAlertCircle /> :
        <IconInfoCircle />;
      
      const color = 
        severity === 'error' ? 'red' :
        severity === 'warning' ? 'yellow' :
        'blue';
      
      notifications.show({
        title,
        message,
        color,
        icon,
        autoClose: severity === 'error' ? 5000 : 3000
      });
    }
    
    // Persist error
    if (persistErrors) {
      setErrors(prev => [...prev, errorRecord]);
    }
    
    return errorRecord;
  }, [logErrors, showNotifications, persistErrors]);
  
  /**
   * Show success message
   */
  const showSuccess = useCallback((message: string, title?: string) => {
    if (logErrors) {
      logger.info(`[Success] ${message}`);
    }
    
    if (showNotifications) {
      notifications.show({
        title: title || 'Success',
        message,
        color: 'green',
        icon: <IconCheck />,
        autoClose: 3000
      });
    }
  }, [logErrors, showNotifications]);
  
  /**
   * Show info message
   */
  const showInfo = useCallback((message: string, title?: string) => {
    handleError(message, title, 'info');
  }, [handleError]);
  
  /**
   * Show warning message
   */
  const showWarning = useCallback((message: string, title?: string) => {
    handleError(message, title, 'warning');
  }, [handleError]);
  
  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);
  
  /**
   * Clear specific error
   */
  const clearError = useCallback((id: string) => {
    setErrors(prev => prev.filter(e => e.id !== id));
  }, []);
  
  /**
   * Wrap async function with error handling
   */
  const withErrorHandling = useCallback(<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context?: string
  ) => {
    return async (...args: T): Promise<R | null> => {
      try {
        return await fn(...args);
      } catch (error) {
        handleError(error, context);
        return null;
      }
    };
  }, [handleError]);
  
  /**
   * Create error boundary handler
   */
  const createErrorBoundary = useCallback((context: string) => {
    return (error: Error, errorInfo: React.ErrorInfo) => {
      handleError({
        ...error,
        componentStack: errorInfo.componentStack
      }, `Component Error: ${context}`, 'error');
    };
  }, [handleError]);
  
  return {
    errors,
    handleError,
    showSuccess,
    showInfo,
    showWarning,
    clearErrors,
    clearError,
    withErrorHandling,
    createErrorBoundary
  };
}
```

### Step 5.2: Enhanced Loading States

```typescript
// src/components/addManga/components/LoadingOverlay.tsx

import React, { useEffect, useState } from 'react';
import {
  Overlay,
  Stack,
  Text,
  Progress,
  Loader,
  Button,
  Group,
  Paper,
  Transition,
  ThemeIcon
} from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';

interface LoadingStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  progress?: number;
  error?: string;
}

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  progress?: number;
  steps?: LoadingStep[];
  onCancel?: () => void;
  canCancel?: boolean;
  fullScreen?: boolean;
}

export function LoadingOverlay({
  visible,
  message,
  progress,
  steps,
  onCancel,
  canCancel = true,
  fullScreen = false
}: LoadingOverlayProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  
  useEffect(() => {
    if (!visible) {
      setElapsedTime(0);
      return;
    }
    
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [visible]);
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const getStepIcon = (status: LoadingStep['status']) => {
    switch (status) {
      case 'completed':
        return <IconCheck size={16} />;
      case 'error':
        return <IconX size={16} />;
      case 'loading':
        return <Loader size={16} />;
      default:
        return null;
    }
  };
  
  const getStepColor = (status: LoadingStep['status']) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'error':
        return 'red';
      case 'loading':
        return 'blue';
      default:
        return 'gray';
    }
  };
  
  const content = (
    <Paper p="xl" shadow="xl" radius="md" style={{ minWidth: 400 }}>
      <Stack spacing="md">
        {/* Main loading indicator */}
        <Group position="center">
          {progress !== undefined ? (
            <RingProgress
              size={80}
              thickness={8}
              sections={[{ value: progress, color: 'blue' }]}
              label={
                <Text size="xs" align="center">
                  {Math.round(progress)}%
                </Text>
              }
            />
          ) : (
            <Loader size="xl" />
          )}
        </Group>
        
        {/* Message */}
        {message && (
          <Text align="center" size="sm" weight={500}>
            {message}
          </Text>
        )}
        
        {/* Progress bar */}
        {progress !== undefined && (
          <Progress
            value={progress}
            size="sm"
            radius="xl"
            animate
          />
        )}
        
        {/* Steps */}
        {steps && steps.length > 0 && (
          <Stack spacing="xs">
            {steps.map(step => (
              <Group key={step.id} spacing="xs">
                <ThemeIcon
                  size="sm"
                  color={getStepColor(step.status)}
                  variant={step.status === 'loading' ? 'filled' : 'light'}
                >
                  {getStepIcon(step.status)}
                </ThemeIcon>
                <Text
                  size="sm"
                  color={step.status === 'error' ? 'red' : undefined}
                  weight={step.status === 'loading' ? 500 : 400}
                  style={{
                    flex: 1,
                    textDecoration: step.status === 'completed' ? 'line-through' : undefined
                  }}
                >
                  {step.label}
                </Text>
                {step.progress !== undefined && step.status === 'loading' && (
                  <Text size="xs" color="dimmed">
                    {step.progress}%
                  </Text>
                )}
                {step.error && (
                  <Text size="xs" color="red">
                    {step.error}
                  </Text>
                )}
              </Group>
            ))}
          </Stack>
        )}
        
        {/* Elapsed time */}
        {elapsedTime > 0 && (
          <Text size="xs" color="dimmed" align="center">
            Elapsed: {formatTime(elapsedTime)}
          </Text>
        )}
        
        {/* Cancel button */}
        {canCancel && onCancel && (
          <Group position="center">
            <Button
              variant="subtle"
              size="xs"
              onClick={onCancel}
              color="red"
            >
              Cancel Operation
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  );
  
  if (fullScreen) {
    return (
      <Transition mounted={visible} transition="fade" duration={200}>
        {(styles) => (
          <Overlay
            style={{
              ...styles,
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9999
            }}
          >
            {content}
          </Overlay>
        )}
      </Transition>
    );
  }
  
  return (
    <Transition mounted={visible} transition="fade" duration={200}>
      {(styles) => (
        <div style={styles}>
          {content}
        </div>
      )}
    </Transition>
  );
}
```

---

## Phase 6: Caching Strategy - Detailed Steps

### Step 6.1: React Query Setup

```typescript
// src/components/addManga/providers/QueryProvider.tsx

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Create query client with optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: how long before data is considered stale
      staleTime: 5 * 60 * 1000, // 5 minutes
      
      // Cache time: how long to keep unused data in cache
      cacheTime: 10 * 60 * 1000, // 10 minutes
      
      // Retry configuration
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      
      // Retry delay
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Refetch configuration
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      refetchOnMount: true
    },
    mutations: {
      // Retry configuration for mutations
      retry: 1,
      retryDelay: 1000
    }
  }
});

interface QueryProviderProps {
  children: React.ReactNode;
  showDevtools?: boolean;
}

export function QueryProvider({ children, showDevtools = false }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {showDevtools && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

// Export query client for direct access if needed
export { queryClient };
```

### Step 6.2: Search Query Hooks

```typescript
// src/components/addManga/hooks/queries/useSearchQuery.ts

import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '../../../../utils/trpc-client';
import type { MangaSearchResult, ProviderSearchResult } from '../../types/addManga.types';
import { logger } from '../../../../utils/logging';

// Query keys factory
export const searchQueryKeys = {
  all: ['mangaSearch'] as const,
  provider: (provider: string) => ['mangaSearch', provider] as const,
  query: (provider: string, query: string) => ['mangaSearch', provider, query] as const,
  metadata: (provider: string, id: string) => ['mangaMetadata', provider, id] as const
};

/**
 * Hook for searching a single provider
 */
export function useProviderSearchQuery(
  provider: string,
  query: string,
  options?: {
    enabled?: boolean;
    onSuccess?: (data: ProviderSearchResult) => void;
    onError?: (error: Error) => void;
  }
) {
  return useQuery({
    queryKey: searchQueryKeys.query(provider, query),
    queryFn: async (): Promise<ProviderSearchResult> => {
      const startTime = performance.now();
      
      try {
        const response = await trpc.search.provider.mutate({
          provider,
          query,
          limit: 20
        });
        
        return {
          provider,
          results: response.results || [],
          isLoading: false,
          searchTime: performance.now() - startTime
        };
      } catch (error) {
        logger.error(`Search failed for ${provider}:`, error);
        throw error;
      }
    },
    enabled: options?.enabled !== false && !!query && query.length > 2,
    onSuccess: options?.onSuccess,
    onError: options?.onError,
    select: (data) => {
      // Transform data if needed
      return {
        ...data,
        results: data.results.map(result => ({
          ...result,
          // Ensure consistent structure
          id: String(result.id),
          title: result.title || 'Unknown',
          source: result.source || provider
        }))
      };
    }
  });
}

/**
 * Hook for searching multiple providers in parallel
 */
export function useMultiProviderSearchQuery(
  providers: string[],
  query: string,
  options?: {
    enabled?: boolean;
    onAllSuccess?: (data: ProviderSearchResult[]) => void;
  }
) {
  const queries = useQueries({
    queries: providers.map(provider => ({
      queryKey: searchQueryKeys.query(provider, query),
      queryFn: async (): Promise<ProviderSearchResult> => {
        const startTime = performance.now();
        
        try {
          const response = await trpc.search.provider.mutate({
            provider,
            query,
            limit: 20
          });
          
          return {
            provider,
            results: response.results || [],
            isLoading: false,
            searchTime: performance.now() - startTime
          };
        } catch (error) {
          return {
            provider,
            results: [],
            error: error instanceof Error ? error.message : 'Search failed',
            isLoading: false,
            searchTime: performance.now() - startTime
          };
        }
      },
      enabled: options?.enabled !== false && !!query && query.length > 2,
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000
    }))
  });
  
  // Check if all queries are successful
  React.useEffect(() => {
    if (queries.every(q => q.isSuccess) && options?.onAllSuccess) {
      const allData = queries.map(q => q.data!);
      options.onAllSuccess(allData);
    }
  }, [queries, options]);
  
  return {
    queries,
    isLoading: queries.some(q => q.isLoading),
    isError: queries.some(q => q.isError),
    isSuccess: queries.every(q => q.isSuccess),
    data: queries.map(q => q.data).filter(Boolean) as ProviderSearchResult[]
  };
}

/**
 * Hook for fetching metadata
 */
export function useMetadataQuery(
  provider: string,
  id: string,
  options?: {
    enabled?: boolean;
  }
) {
  return useQuery({
    queryKey: searchQueryKeys.metadata(provider, id),
    queryFn: async () => {
      const response = await trpc.metadata.fetch.mutate({
        provider,
        id
      });
      return response;
    },
    enabled: options?.enabled !== false && !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000  // 30 minutes
  });
}

/**
 * Hook for prefetching search results
 */
export function usePrefetchSearch() {
  const queryClient = useQueryClient();
  
  const prefetch = React.useCallback(async (provider: string, query: string) => {
    await queryClient.prefetchQuery({
      queryKey: searchQueryKeys.query(provider, query),
      queryFn: async () => {
        const response = await trpc.search.provider.mutate({
          provider,
          query,
          limit: 20
        });
        
        return {
          provider,
          results: response.results || [],
          isLoading: false
        };
      },
      staleTime: 5 * 60 * 1000
    });
  }, [queryClient]);
  
  return { prefetch };
}

/**
 * Hook for invalidating search cache
 */
export function useInvalidateSearchCache() {
  const queryClient = useQueryClient();
  
  const invalidateAll = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: searchQueryKeys.all });
  }, [queryClient]);
  
  const invalidateProvider = React.useCallback((provider: string) => {
    queryClient.invalidateQueries({ queryKey: searchQueryKeys.provider(provider) });
  }, [queryClient]);
  
  const invalidateQuery = React.useCallback((provider: string, query: string) => {
    queryClient.invalidateQueries({ queryKey: searchQueryKeys.query(provider, query) });
  }, [queryClient]);
  
  return {
    invalidateAll,
    invalidateProvider,
    invalidateQuery
  };
}

/**
 * Mutation for enhancing metadata
 */
export function useEnhanceMetadataMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ provider, id, url }: { provider: string; id: string; url?: string }) => {
      const response = await trpc.metadata.enhance.mutate({
        provider,
        id,
        url
      });
      return response;
    },
    onSuccess: (data, variables) => {
      // Update the metadata cache
      queryClient.setQueryData(
        searchQueryKeys.metadata(variables.provider, variables.id),
        data
      );
    }
  });
}
```

---

## Rollback Procedures

### Phase-Specific Rollback Plans

#### Phase 1 Rollback (Component Extraction)
```bash
# 1. Revert to previous branch
git checkout main
git branch -D feature/add-manga-refactor

# 2. Restore original confirmationStep.tsx
git restore src/components/addManga/steps/confirmationStep.tsx

# 3. Remove new component directories
rm -rf src/components/addManga/components
rm -rf src/components/addManga/hooks
rm -rf src/components/addManga/utils
```

#### Phase 2 Rollback (Type Consolidation)
```bash
# 1. Restore original type definitions
git restore src/components/addManga/form.tsx
git restore src/components/addManga/steps/searchStep.tsx
git restore src/components/addManga/steps/confirmationStep.tsx

# 2. Remove new types file
rm src/types/addManga.types.ts
```

#### Phase 3 Rollback (State Management)
```bash
# 1. Restore original state management
git restore src/components/addManga/form.tsx

# 2. Remove reducer files
rm -rf src/components/addManga/hooks/useAddMangaReducer.ts
```

#### Phase 4 Rollback (Performance)
```bash
# 1. Restore original search implementation
git restore src/components/addManga/steps/searchStep.tsx

# 2. Remove parallel fetching
rm src/components/addManga/hooks/useParallelProviderSearch.ts
```

#### Phase 5 Rollback (Error Handling)
```bash
# 1. Restore original error handling
git restore src/components/addManga/**/*.tsx

# 2. Remove error handling utilities
rm src/components/addManga/hooks/useErrorHandler.ts
```

#### Phase 6 Rollback (Caching)
```bash
# 1. Uninstall React Query
pnpm remove @tanstack/react-query @tanstack/react-query-devtools

# 2. Remove query hooks
rm -rf src/components/addManga/hooks/queries
```

---

## Validation & Testing Procedures

### Unit Test Suite
```typescript
// src/components/addManga/__tests__/integration.test.tsx

describe('Add Manga Workflow Integration', () => {
  describe('Search Step', () => {
    it('should search multiple providers in parallel');
    it('should handle provider errors gracefully');
    it('should cache search results');
    it('should display results with correct formatting');
  });
  
  describe('Confirmation Step', () => {
    it('should display all metadata fields');
    it('should allow field-by-field selection');
    it('should calculate confidence scores correctly');
    it('should merge metadata from multiple sources');
  });
  
  describe('State Management', () => {
    it('should maintain state across steps');
    it('should handle form validation');
    it('should persist selections on navigation');
  });
  
  describe('Performance', () => {
    it('should complete search within 2 seconds');
    it('should render components within 100ms');
    it('should batch metadata requests');
  });
});
```

### Performance Benchmarks
```typescript
// src/components/addManga/__tests__/performance.bench.ts

import { bench, describe } from 'vitest';

describe('Add Manga Performance', () => {
  bench('Component render time', async () => {
    // Measure initial render
  });
  
  bench('Search response time', async () => {
    // Measure search with 5 providers
  });
  
  bench('Metadata merge time', async () => {
    // Measure merging from 3 sources
  });
  
  bench('Memory usage', async () => {
    // Measure memory with 100 results
  });
});
```

### Accessibility Testing
```typescript
// src/components/addManga/__tests__/a11y.test.tsx

describe('Accessibility', () => {
  it('should have no accessibility violations');
  it('should be keyboard navigable');
  it('should have proper ARIA labels');
  it('should support screen readers');
});
```

## Success Criteria Checklist

### Code Quality Metrics
- [ ] All components < 500 lines
- [ ] Zero TypeScript errors
- [ ] Test coverage > 80%
- [ ] Bundle size increase < 10%
- [ ] Zero duplicate type definitions
- [ ] All functions documented

### Performance Metrics
- [ ] Search time < 2 seconds
- [ ] Component render < 100ms  
- [ ] Metadata merge < 500ms
- [ ] Memory usage reduced by 30%
- [ ] Cache hit rate > 60%

### User Experience Metrics
- [ ] Error recovery rate > 95%
- [ ] Task completion > 90%
- [ ] Zero silent failures
- [ ] All errors user-visible
- [ ] Loading states for all async operations

## Final Notes

This detailed plan provides step-by-step implementation guidance for refactoring the Add Manga workflow. Each phase builds upon the previous one, allowing for incremental improvements while maintaining system stability. The rollback procedures ensure we can quickly revert if issues arise, and the comprehensive testing strategy validates improvements at each stage.

Key considerations:
1. Maintain backward compatibility throughout
2. Test thoroughly at each phase
3. Monitor performance metrics
4. Gather user feedback early
5. Document all changes

The refactoring will result in a more maintainable, performant, and user-friendly Add Manga workflow that scales better with future requirements.