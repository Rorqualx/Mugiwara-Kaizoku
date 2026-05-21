/**
 * Bulk Import Modal Component
 *
 * Allows pasting multiple URLs for batch annotation import.
 */

import React, { useState, useMemo } from 'react';

import {
  Modal,
  Stack,
  Textarea,
  Text,
  Button,
  Group,
  Badge,
  Alert,
  Progress,
} from '@mantine/core';
import { IconUpload, IconAlertCircle, IconCheck } from '@tabler/icons-react';

import { api } from '@/utils/api';

interface BulkImportModalProps {
  opened: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ParsedUrl {
  url: string;
  sourceType: 'FANDOM' | 'WIKIPEDIA' | 'ANILIST' | 'COMICVINE' | null;
}

function detectSourceType(url: string): 'FANDOM' | 'WIKIPEDIA' | 'ANILIST' | 'COMICVINE' | null {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('fandom.com') || urlLower.includes('.wikia.com')) return 'FANDOM';
  if (urlLower.includes('wikipedia.org')) return 'WIKIPEDIA';
  if (urlLower.includes('anilist.co')) return 'ANILIST';
  if (urlLower.includes('comicvine.gamespot.com')) return 'COMICVINE';
  return null;
}

function parseUrls(text: string): ParsedUrl[] {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const results: ParsedUrl[] = [];

  for (const line of lines) {
    try {
      new URL(line);
      results.push({ url: line, sourceType: detectSourceType(line) });
    } catch {
      // Skip invalid URLs
    }
  }

  return results;
}

function getSourceColor(sourceType: string | null): string {
  switch (sourceType) {
    case 'FANDOM': return 'orange';
    case 'WIKIPEDIA': return 'blue';
    case 'ANILIST': return 'cyan';
    case 'COMICVINE': return 'red';
    default: return 'gray';
  }
}

export function BulkImportModal({
  opened,
  onClose,
  onImportComplete,
}: BulkImportModalProps): React.ReactElement {
  const [urlText, setUrlText] = useState('');

  const parsedUrls = useMemo(() => parseUrls(urlText), [urlText]);
  const validUrls = parsedUrls.filter((u) => u.sourceType !== null);
  const invalidUrls = parsedUrls.filter((u) => u.sourceType === null);

  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of validUrls) {
      if (u.sourceType) {
        counts[u.sourceType] = (counts[u.sourceType] ?? 0) + 1;
      }
    }
    return counts;
  }, [validUrls]);

  const addBulkMutation = api.annotation.addBulkFromText.useMutation({
    onSuccess: () => {
      onImportComplete();
      setUrlText('');
      onClose();
    },
  });

  const handleImport = (): void => {
    addBulkMutation.mutate({ urlText });
  };

  const handleClose = (): void => {
    if (!addBulkMutation.isPending) {
      setUrlText('');
      onClose();
    }
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Bulk URL Import" size="lg">
      <Stack gap="md">
        <Textarea
          label="Paste URLs (one per line)"
          placeholder={`https://onepiece.fandom.com/wiki/One_Piece
https://en.wikipedia.org/wiki/Naruto
https://anilist.co/manga/30013/...`}
          minRows={8}
          maxRows={12}
          value={urlText}
          onChange={(e) => setUrlText(e.target.value)}
          disabled={addBulkMutation.isPending}
        />

        {parsedUrls.length > 0 && (
          <Group gap="xs">
            <Text size="sm">Detected:</Text>
            <Badge color="gray">{parsedUrls.length} total</Badge>
            {Object.entries(sourceCounts).map(([source, count]) => (
              <Badge key={source} color={getSourceColor(source)} size="sm">
                {count} {source}
              </Badge>
            ))}
            {invalidUrls.length > 0 && (
              <Badge color="red" size="sm">
                {invalidUrls.length} unsupported
              </Badge>
            )}
          </Group>
        )}

        {invalidUrls.length > 0 && (
          <Alert icon={<IconAlertCircle size={16} />} color="yellow" title="Unsupported URLs">
            <Text size="xs">
              {invalidUrls.length} URL(s) are from unsupported sources and will be skipped.
              Only Fandom, Wikipedia, AniList, and ComicVine are supported.
            </Text>
          </Alert>
        )}

        {addBulkMutation.isPending && (
          <Stack gap="xs">
            <Text size="sm">Importing URLs...</Text>
            <Progress value={50} animated />
          </Stack>
        )}

        {addBulkMutation.data && (
          <Alert icon={<IconCheck size={16} />} color="green">
            Added {addBulkMutation.data.added} pages
            {addBulkMutation.data.skipped > 0 && `, skipped ${addBulkMutation.data.skipped} duplicates`}
            {addBulkMutation.data.failed.length > 0 && (
              <Text size="xs" mt={4}>
                Failed: {addBulkMutation.data.failed.map((f) => f.url).join(', ')}
              </Text>
            )}
          </Alert>
        )}

        {addBulkMutation.isError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            {addBulkMutation.error.message}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button variant="subtle" onClick={handleClose} disabled={addBulkMutation.isPending}>
            Cancel
          </Button>
          <Button
            leftSection={<IconUpload size={16} />}
            onClick={handleImport}
            disabled={validUrls.length === 0}
            loading={addBulkMutation.isPending}
          >
            Import {validUrls.length} URLs
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
