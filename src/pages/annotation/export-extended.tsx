/**
 * Extended Annotation Export Page
 *
 * Export training data with advanced filtering by quality tier,
 * document category, and use cases. Supports multiple export formats.
 */

import React from 'react';

import {
  Container,
  Title,
  Paper,
  Stack,
  Group,
  Button,
  Select,
  Text,
  Alert,
  Code,
  Badge,
  Card,
  Tabs,
  Progress,
} from '@mantine/core';
import { IconDownload, IconInfoCircle, IconFileText, IconDatabase } from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { DocumentLabelFilters } from '@/components/annotation/labels';
import type { DocumentCategory, QualityTier, UseCaseLabel } from '@/types/training/document-labels';
import { api } from '@/utils/api';


// ============================================================================
// Types
// ============================================================================

type ExtendedExportFormat = 'jsonl' | 'alpaca' | 'sharegpt' | 'qa' | 'markdown' | 'ner';

interface FormatOption {
  value: ExtendedExportFormat;
  label: string;
  description: string;
}

// ============================================================================
// Constants
// ============================================================================

const FORMAT_OPTIONS: FormatOption[] = [
  { value: 'jsonl', label: 'JSONL', description: 'Standard JSON Lines format' },
  { value: 'alpaca', label: 'Alpaca', description: 'Instruction-input-output format' },
  { value: 'sharegpt', label: 'ShareGPT', description: 'Conversational Q&A format' },
  { value: 'qa', label: 'Q&A Pairs', description: 'Simple question-answer pairs' },
  { value: 'markdown', label: 'Markdown', description: 'Human-readable markdown' },
  { value: 'ner', label: 'NER/BIO', description: 'Token-level NER annotations' },
];

// ============================================================================
// Main Component
// ============================================================================

export default function ExportExtendedPage(): React.ReactElement {
  const router = useRouter();
  const [format, setFormat] = React.useState<ExtendedExportFormat>('jsonl');
  const [minQualityTier, setMinQualityTier] = React.useState<QualityTier | null>(null);
  const [categories, setCategories] = React.useState<DocumentCategory[]>([]);
  const [useCases, setUseCases] = React.useState<UseCaseLabel[]>([]);
  const [requireAllUseCases, setRequireAllUseCases] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);

  const { data: exportData, isLoading, refetch } = api.annotation.exportExtended.useQuery(
    {
      format,
      minQualityTier: minQualityTier ?? undefined,
      categories: categories.length > 0 ? categories : undefined,
      useCases: useCases.length > 0 ? useCases : undefined,
      limit: 1000,
    },
    { enabled: false }
  );

  const handleExport = async (): Promise<void> => {
    setIsExporting(true);
    try {
      const result = await refetch();
      if (result.data) {
        downloadExportData(result.data.content, format);
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Container size="xl" py="xl">
      <PageHeader onBack={() => void router.push('/annotation')} />
      <ExportTabs
        format={format}
        onFormatChange={setFormat}
        minQualityTier={minQualityTier}
        onMinQualityTierChange={setMinQualityTier}
        categories={categories}
        onCategoriesChange={setCategories}
        useCases={useCases}
        onUseCasesChange={setUseCases}
        requireAllUseCases={requireAllUseCases}
        onRequireAllUseCasesChange={setRequireAllUseCases}
      />
      <Group grow align="flex-start" gap="lg" style={{ flexWrap: 'wrap' }}>
        <ExportPreview exportData={exportData} isLoading={isLoading} format={format} onPreview={() => void refetch()} />
        <ExportActions isExporting={isExporting} isLoading={isLoading} onExport={() => void handleExport()} exportData={exportData} />
      </Group>
      <FormatExamples format={format} />
    </Container>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface PageHeaderProps {
  onBack: () => void;
}

function PageHeader({ onBack }: PageHeaderProps): React.ReactElement {
  return (
    <Group justify="space-between" mb="xl">
      <div>
        <Title order={2}>Extended Export</Title>
        <Text c="dimmed" size="sm">Export training data with quality filtering and multiple formats</Text>
      </div>
      <Button variant="subtle" onClick={onBack}>Back to Annotations</Button>
    </Group>
  );
}

interface ExportTabsProps {
  format: ExtendedExportFormat;
  onFormatChange: (format: ExtendedExportFormat) => void;
  minQualityTier: QualityTier | null;
  onMinQualityTierChange: (tier: QualityTier | null) => void;
  categories: DocumentCategory[];
  onCategoriesChange: (categories: DocumentCategory[]) => void;
  useCases: UseCaseLabel[];
  onUseCasesChange: (useCases: UseCaseLabel[]) => void;
  requireAllUseCases: boolean;
  onRequireAllUseCasesChange: (value: boolean) => void;
}

function ExportTabs(props: ExportTabsProps): React.ReactElement {
  return (
    <Tabs defaultValue="filters" mb="lg">
      <Tabs.List>
        <Tabs.Tab value="filters" leftSection={<IconDatabase size={14} />}>Filters</Tabs.Tab>
        <Tabs.Tab value="format" leftSection={<IconFileText size={14} />}>Format</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="filters" pt="md">
        <DocumentLabelFilters
          minQualityTier={props.minQualityTier}
          onMinQualityTierChange={props.onMinQualityTierChange}
          categories={props.categories}
          onCategoriesChange={props.onCategoriesChange}
          useCases={props.useCases}
          onUseCasesChange={props.onUseCasesChange}
          requireAllUseCases={props.requireAllUseCases}
          onRequireAllUseCasesChange={props.onRequireAllUseCasesChange}
        />
      </Tabs.Panel>
      <Tabs.Panel value="format" pt="md">
        <FormatSelector format={props.format} onFormatChange={props.onFormatChange} />
      </Tabs.Panel>
    </Tabs>
  );
}

interface FormatSelectorProps {
  format: ExtendedExportFormat;
  onFormatChange: (format: ExtendedExportFormat) => void;
}

function FormatSelector({ format, onFormatChange }: FormatSelectorProps): React.ReactElement {
  const currentFormat = FORMAT_OPTIONS.find((f) => f.value === format);
  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Select
          label="Export Format"
          description="Choose the output format for your training data"
          data={FORMAT_OPTIONS.map((f) => ({ value: f.value, label: `${f.label} - ${f.description}` }))}
          value={format}
          onChange={(value) => value && onFormatChange(value as ExtendedExportFormat)}
        />
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          <Text size="sm"><strong>{currentFormat?.label}:</strong> {currentFormat?.description}</Text>
        </Alert>
        <FormatFeatures format={format} />
      </Stack>
    </Paper>
  );
}

function FormatFeatures({ format }: { format: ExtendedExportFormat }): React.ReactElement {
  const features: Record<ExtendedExportFormat, string[]> = {
    jsonl: ['One JSON object per line', 'Streaming-friendly', 'Standard ML format'],
    alpaca: ['instruction/input/output structure', 'Fine-tuning ready', 'Clear task format'],
    sharegpt: ['Conversational turns', 'Multi-turn dialogs', 'Chat model training'],
    qa: ['Question-answer pairs', 'Simple structure', 'Easy to validate'],
    markdown: ['Human-readable', 'Documentation friendly', 'Easy review'],
    ner: ['Token-level labels', 'BIO tagging', 'Sequence labeling'],
  };
  return (
    <Group gap="xs">
      {features[format].map((feature) => (
        <Badge key={feature} variant="outline" size="sm">{feature}</Badge>
      ))}
    </Group>
  );
}

interface ExportPreviewProps {
  exportData: { content: string; recordCount: number; pageCount: number } | undefined;
  isLoading: boolean;
  format: ExtendedExportFormat;
  onPreview: () => void;
}

function ExportPreview({ exportData, isLoading, format, onPreview }: ExportPreviewProps): React.ReactElement {
  return (
    <Paper withBorder p="lg">
      <Group justify="space-between" mb="md">
        <Title order={4}>Preview</Title>
        <Button size="xs" variant="light" onClick={onPreview} loading={isLoading}>Load Preview</Button>
      </Group>
      {exportData ? (
        <Stack gap="md">
          <Group grow>
            <Card withBorder p="sm"><Text size="xs" c="dimmed">Pages</Text><Text fw={500}>{exportData.pageCount}</Text></Card>
            <Card withBorder p="sm"><Text size="xs" c="dimmed">Records</Text><Text fw={500}>{exportData.recordCount}</Text></Card>
          </Group>
          <Text size="sm" fw={500}>Sample Output ({format}):</Text>
          <Code block style={{ maxHeight: 200, overflow: 'auto' }}>
            {exportData.content.slice(0, 1000)}{exportData.content.length > 1000 && '\n... (truncated)'}
          </Code>
        </Stack>
      ) : (
        <Text c="dimmed" size="sm" ta="center" py="xl">Click &quot;Load Preview&quot; to see a sample</Text>
      )}
    </Paper>
  );
}

interface ExportActionsProps {
  isExporting: boolean;
  isLoading: boolean;
  onExport: () => void;
  exportData: { content: string; recordCount: number; pageCount: number } | undefined;
}

function ExportActions({ isExporting, isLoading, onExport, exportData }: ExportActionsProps): React.ReactElement {
  return (
    <Paper withBorder p="lg">
      <Title order={4} mb="md">Export</Title>
      <Stack gap="md">
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          Export will generate training data based on your filter settings.
        </Alert>
        {exportData && (
          <Card withBorder>
            <Text size="sm" c="dimmed" mb="xs">Ready to export:</Text>
            <Group gap="xs">
              <Badge color="green">{exportData.pageCount} pages</Badge>
              <Badge color="blue">{exportData.recordCount} records</Badge>
            </Group>
          </Card>
        )}
        <Button
          leftSection={isExporting ? undefined : <IconDownload size={16} />}
          loading={isExporting || isLoading}
          onClick={onExport}
          fullWidth
          size="lg"
        >
          {isExporting ? 'Exporting...' : 'Download Export'}
        </Button>
        {isExporting && <Progress value={100} animated striped />}
      </Stack>
    </Paper>
  );
}

function FormatExamples({ format }: { format: ExtendedExportFormat }): React.ReactElement {
  const examples: Record<ExtendedExportFormat, object> = {
    jsonl: { text: 'One Piece', label: 'B-TITLE', context: { before: 'The manga', after: 'is written by Oda.' } },
    alpaca: { instruction: 'What is the title of this manga?', input: 'A popular shonen manga...', output: 'One Piece' },
    sharegpt: { conversations: [{ from: 'human', value: 'What is the author?' }, { from: 'gpt', value: 'Eiichiro Oda' }] },
    qa: { question: 'Who wrote One Piece?', answer: 'Eiichiro Oda', context: 'One Piece is written by Eiichiro Oda.' },
    markdown: { title: 'One Piece', content: '## Summary\nA manga about pirates...' },
    ner: { tokens: ['One', 'Piece', 'by', 'Oda'], labels: ['B-TITLE', 'I-TITLE', 'O', 'B-AUTHOR'] },
  };
  return (
    <Paper withBorder p="lg" mt="lg">
      <Title order={4} mb="md">Example {FORMAT_OPTIONS.find((f) => f.value === format)?.label} Output</Title>
      <Code block>{JSON.stringify(examples[format], null, 2)}</Code>
    </Paper>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function downloadExportData(content: string, format: ExtendedExportFormat): void {
  const extensions: Record<ExtendedExportFormat, string> = {
    jsonl: 'jsonl', alpaca: 'json', sharegpt: 'json', qa: 'json', markdown: 'md', ner: 'jsonl',
  };
  const mimeTypes: Record<ExtendedExportFormat, string> = {
    jsonl: 'application/jsonl', alpaca: 'application/json', sharegpt: 'application/json',
    qa: 'application/json', markdown: 'text/markdown', ner: 'application/jsonl',
  };
  const blob = new Blob([content], { type: mimeTypes[format] });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `training-data-${format}-${new Date().toISOString().split('T')[0]}.${extensions[format]}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
