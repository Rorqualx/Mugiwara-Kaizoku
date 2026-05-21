/**
 * Annotation Export Page
 *
 * Export training data with sentence context for ML model training.
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
  Switch,
  NumberInput,
  Text,
  Alert,
  Code,
  Divider,
  Badge,
  Card,
} from '@mantine/core';
import {
  IconDownload,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { api } from '@/utils/api';

type ExportFormat = 'jsonl' | 'json' | 'csv';
type StatusFilter = 'REVIEWED' | 'GOLD' | 'BOOTSTRAP' | 'IN_PROGRESS' | 'REJECTED';

interface ExportToken {
  text: string;
  label: string;
  entityType: string | null;
  context: { before: string; after: string };
  tokenIndex: number;
  pageId: string;
  mangaTitle: string | null;
  sourceType: string;
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadExport(tokens: ExportToken[], fmt: ExportFormat): void {
  let content: string;
  let mimeType: string;
  let extension: string;

  if (fmt === 'jsonl') {
    content = tokens.map((t) => JSON.stringify(t)).join('\n');
    mimeType = 'application/jsonl';
    extension = 'jsonl';
  } else if (fmt === 'json') {
    content = JSON.stringify(tokens, null, 2);
    mimeType = 'application/json';
    extension = 'json';
  } else {
    const headers = ['text', 'label', 'entityType', 'contextBefore', 'contextAfter', 'tokenIndex', 'pageId', 'mangaTitle', 'sourceType'];
    const rows = tokens.map((t) => [
      escapeCsv(t.text),
      escapeCsv(t.label),
      escapeCsv(t.entityType ?? ''),
      escapeCsv(t.context.before),
      escapeCsv(t.context.after),
      t.tokenIndex.toString(),
      escapeCsv(t.pageId),
      escapeCsv(t.mangaTitle ?? ''),
      escapeCsv(t.sourceType),
    ].join(','));
    content = [headers.join(','), ...rows].join('\n');
    mimeType = 'text/csv';
    extension = 'csv';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `training-data-${new Date().toISOString().split('T')[0]}.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ExportPage(): React.ReactElement {
  const router = useRouter();
  const [format, setFormat] = React.useState<ExportFormat>('jsonl');
  const [includeContext, setIncludeContext] = React.useState(true);
  const [contextSentences, setContextSentences] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter[]>(['REVIEWED', 'GOLD']);
  const [isExporting, setIsExporting] = React.useState(false);

  const { data: exportData, isLoading, refetch } = api.annotation.exportTrainingData.useQuery(
    { status: statusFilter, includeContext, contextSentences },
    { enabled: false }
  );

  const handleExport = async (): Promise<void> => {
    setIsExporting(true);
    try {
      const result = await refetch();
      if (result.data) {
        downloadExport(result.data.tokens, format);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const toggleStatus = (status: StatusFilter): void => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  return (
    <Container size="lg" py="xl">
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2}>Export Training Data</Title>
          <Text c="dimmed" size="sm">Export annotated tokens with sentence context for ML training</Text>
        </div>
        <Button variant="subtle" onClick={() => void router.push('/annotation')}>Back to Annotations</Button>
      </Group>

      <Group grow align="flex-start" gap="lg" style={{ flexWrap: 'wrap' }}>
        <ExportOptions
          format={format}
          setFormat={setFormat}
          includeContext={includeContext}
          setIncludeContext={setIncludeContext}
          contextSentences={contextSentences}
          setContextSentences={setContextSentences}
          statusFilter={statusFilter}
          toggleStatus={toggleStatus}
        />
        <PreviewDownload
          exportData={exportData}
          isExporting={isExporting}
          isLoading={isLoading}
          statusFilter={statusFilter}
          contextSentences={contextSentences}
          handleExport={handleExport}
        />
      </Group>

      <ExampleOutput />
    </Container>
  );
}

interface ExportOptionsProps {
  format: ExportFormat;
  setFormat: (f: ExportFormat) => void;
  includeContext: boolean;
  setIncludeContext: (v: boolean) => void;
  contextSentences: number;
  setContextSentences: (v: number) => void;
  statusFilter: StatusFilter[];
  toggleStatus: (s: StatusFilter) => void;
}

function ExportOptions(props: ExportOptionsProps): React.ReactElement {
  const { format, setFormat, includeContext, setIncludeContext, contextSentences, setContextSentences, statusFilter, toggleStatus } = props;

  return (
    <Paper withBorder p="lg">
      <Title order={4} mb="md">Export Options</Title>
      <Stack gap="md">
        <Select
          label="Export Format"
          data={[
            { value: 'jsonl', label: 'JSONL (recommended for training)' },
            { value: 'json', label: 'JSON (single file)' },
            { value: 'csv', label: 'CSV (spreadsheet compatible)' },
          ]}
          value={format}
          onChange={(value) => setFormat((value as ExportFormat) ?? 'jsonl')}
        />
        <Switch
          label="Include sentence context"
          description="Add surrounding sentences for each token"
          checked={includeContext}
          onChange={(e) => setIncludeContext(e.currentTarget.checked)}
        />
        {includeContext && (
          <NumberInput
            label="Context sentences"
            description="Number of sentences before and after each token"
            min={0}
            max={3}
            value={contextSentences}
            onChange={(value) => setContextSentences(typeof value === 'number' ? value : 1)}
          />
        )}
        <Divider label="Status Filter" labelPosition="center" />
        <Group gap="xs">
          {(['GOLD', 'REVIEWED', 'IN_PROGRESS', 'BOOTSTRAP'] as const).map((status) => (
            <Badge
              key={status}
              color={statusFilter.includes(status) ? 'blue' : 'gray'}
              variant={statusFilter.includes(status) ? 'filled' : 'outline'}
              style={{ cursor: 'pointer' }}
              onClick={() => toggleStatus(status)}
            >
              {status}
            </Badge>
          ))}
        </Group>
        <Text size="xs" c="dimmed">Click to toggle. Export will include pages with selected statuses.</Text>
      </Stack>
    </Paper>
  );
}

interface PreviewDownloadProps {
  exportData: { stats: { pages: number; tokens: number; entities: Record<string, number> } } | undefined;
  isExporting: boolean;
  isLoading: boolean;
  statusFilter: StatusFilter[];
  contextSentences: number;
  handleExport: () => Promise<void>;
}

function PreviewDownload(props: PreviewDownloadProps): React.ReactElement {
  const { exportData, isExporting, isLoading, statusFilter, contextSentences, handleExport } = props;

  return (
    <Paper withBorder p="lg">
      <Title order={4} mb="md">Preview & Download</Title>
      <Stack gap="md">
        <Alert icon={<IconInfoCircle size={16} />} color="blue">
          Each token includes: token text and BIO label, entity type, {contextSentences} sentence(s) context, and page metadata.
        </Alert>
        {exportData && (
          <Card withBorder>
            <Group grow>
              <div><Text size="sm" c="dimmed">Pages</Text><Text fw={500}>{exportData.stats.pages}</Text></div>
              <div><Text size="sm" c="dimmed">Tokens</Text><Text fw={500}>{exportData.stats.tokens.toLocaleString()}</Text></div>
            </Group>
            <Divider my="sm" />
            <Text size="sm" c="dimmed" mb="xs">Entity Distribution</Text>
            <Group gap="xs">
              {Object.entries(exportData.stats.entities).map(([entity, count]) => (
                <Badge key={entity} variant="light">{entity}: {count}</Badge>
              ))}
            </Group>
          </Card>
        )}
        <Button
          leftSection={isExporting ? undefined : <IconDownload size={16} />}
          loading={isExporting || isLoading}
          onClick={() => void handleExport()}
          disabled={statusFilter.length === 0}
          fullWidth
        >
          {isExporting ? 'Preparing export...' : 'Export Training Data'}
        </Button>
        {statusFilter.length === 0 && <Text size="sm" c="red" ta="center">Please select at least one status to export</Text>}
      </Stack>
    </Paper>
  );
}

function ExampleOutput(): React.ReactElement {
  return (
    <Paper withBorder p="lg" mt="lg">
      <Title order={4} mb="md">Example Output</Title>
      <Code block>
        {JSON.stringify({
          text: 'Eiichiro',
          label: 'B-AUTHOR',
          entityType: 'AUTHOR',
          context: { before: 'One Piece is a manga series written by', after: 'Oda . It has been serialized since 1997 .' },
          tokenIndex: 42,
          pageId: 'abc123',
          mangaTitle: 'One Piece',
          sourceType: 'FANDOM',
        }, null, 2)}
      </Code>
    </Paper>
  );
}
