/**
 * Direct URL Download Modal
 *
 * Modal for pasting download URLs (magnet links, .torrent files, NZB URLs)
 * directly to send to configured download clients.
 *
 * Features:
 * - Auto-detect URL type (magnet/torrent/nzb)
 * - Filter clients by URL type compatibility
 * - Support multiple URLs (comma/newline separated)
 * - Real-time validation
 * - Drag-and-drop .torrent files (future)
 *
 * @module DirectUrlModal
 */

import * as React from 'react';
import { useState, useMemo, useCallback, useEffect } from 'react';

import {
  Modal,
  Stack,
  Textarea,
  Select,
  Button,
  Alert,
  Group,
  Text,
  Badge,
  Box,
  Loader,
  List,
  ThemeIcon,
  Collapse,
  TextInput,
  PasswordInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconLink,
  IconDownload,
  IconInfoCircle,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconLock,
} from '@tabler/icons-react';

import { toNumberId } from '@/utils/id-converters';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

import {
  parseMultipleUrls,
  getCompatibleClients,
  getUrlTypeLabel,
  getUrlTypeColor,
} from './direct-url-utils';

import type { ParsedUrl } from './direct-url-utils';
import type { DownloadContext } from './DownloadButton';

/**
 * Props for DirectUrlModal
 */
export interface DirectUrlModalProps {
  /** Whether modal is open */
  opened: boolean;
  /** Close handler */
  onClose: () => void;
  /** Download context (manga/volume/chapter) */
  context: DownloadContext;
  /** Success callback */
  onSuccess?: (() => void) | undefined;
}

/**
 * Settings data structure from API
 */
interface SettingsData {
  'download.transmission.enabled'?: boolean;
  'download.deluge.enabled'?: boolean;
  'download.qbittorrent.enabled'?: boolean;
  'download.nzbget.enabled'?: boolean;
  'download.sabnzbd.enabled'?: boolean;
  [key: string]: unknown;
}

/**
 * Gets context description for modal title
 */
function getContextDescription(context: DownloadContext): string {
  switch (context.type) {
    case 'manga':
      return context.manga.title;
    case 'volume':
      return `${context.manga.title} - Vol. ${context.volumeNumber}`;
    case 'chapter':
      return `${context.manga.title} - Ch. ${context.chapter.index}`;
    default:
      return 'Download';
  }
}

/**
 * Gets chapter IDs from context
 */
function getChapterIds(context: DownloadContext): number[] {
  switch (context.type) {
    case 'manga':
      return []; // Will download all missing - handled by server
    case 'volume':
      return context.chapters.map((ch) => toNumberId(ch.id));
    case 'chapter':
      return [toNumberId(context.chapter.id)];
    default:
      return [];
  }
}

/**
 * Direct URL Download Modal Component
 */
// eslint-disable-next-line complexity -- Modal form with URL validation, client selection, auth handling, and download mutation
export function DirectUrlModal({
  opened,
  onClose,
  context,
  onSuccess,
}: DirectUrlModalProps): React.ReactElement {
  // Form state
  const [urlInput, setUrlInput] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [authOpened, { toggle: toggleAuth }] = useDisclosure(false);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  // Get settings for enabled clients
  const { data: settings } = trpc.settings.get.useQuery({ key: 'all' });
  const queryClient = trpc.useUtils();

  // Download mutation
  const downloadMutation = trpc.manga.downloadFromUrl.useMutation({
    onSuccess: () => {
      notify({ severity: 'SUCCESS', title: 'Download Started', message: 'Download has been sent to your client' });
      setUrlInput('');
      setAuthUsername('');
      setAuthPassword('');
      void queryClient.manga.get.invalidate({ id: toNumberId(context.manga.id) });
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Download Failed', message: error instanceof Error ? error.message : String(error) });
    },
  });

  // Parse and validate URLs
  const parsedUrls = useMemo((): ParsedUrl[] => {
    if (!urlInput.trim()) return [];
    return parseMultipleUrls(urlInput);
  }, [urlInput]);

  // Single URL validation (for simple input)
  const singleParsedUrl = useMemo((): ParsedUrl | null => {
    if (parsedUrls.length === 1) {
      return parsedUrls[0] ?? null;
    }
    return null;
  }, [parsedUrls]);

  // Get enabled clients from settings
  const enabledClients = useMemo((): Array<{ value: string; label: string }> => {
    if (!settings) return [];

    const settingsData = settings as SettingsData;
    const clients: Array<{ value: string; label: string }> = [];

    // Torrent clients
    if (settingsData['download.transmission.enabled'] === true) {
      clients.push({ value: 'transmission', label: 'Transmission' });
    }
    if (settingsData['download.deluge.enabled'] === true) {
      clients.push({ value: 'deluge', label: 'Deluge' });
    }
    if (settingsData['download.qbittorrent.enabled'] === true) {
      clients.push({ value: 'qbittorrent', label: 'qBittorrent' });
    }

    // Usenet clients
    if (settingsData['download.nzbget.enabled'] === true) {
      clients.push({ value: 'nzbget', label: 'NZBGet' });
    }
    if (settingsData['download.sabnzbd.enabled'] === true) {
      clients.push({ value: 'sabnzbd', label: 'SABnzbd' });
    }

    return clients;
  }, [settings]);

  // Filter clients by URL type compatibility
  const compatibleClients = useMemo((): Array<{ value: string; label: string }> => {
    if (!singleParsedUrl?.isValid) {
      return enabledClients;
    }

    const compatibleNames = getCompatibleClients(
      singleParsedUrl.type,
      enabledClients.map((c) => c.value)
    );

    return enabledClients.filter((c) => compatibleNames.includes(c.value));
  }, [enabledClients, singleParsedUrl]);

  // Auto-select first compatible client when URL changes
  useEffect(() => {
    if (compatibleClients.length > 0) {
      const firstClient = compatibleClients[0];
      const isCurrentClientCompatible = compatibleClients.some((c) => c.value === selectedClient);
      if (firstClient && !isCurrentClientCompatible) {
        setSelectedClient(firstClient.value);
      }
    }
  }, [compatibleClients, selectedClient]);

  // Reset form when modal opens
  useEffect(() => {
    if (opened) {
      setUrlInput('');
      setSelectedClient('');
      setAuthUsername('');
      setAuthPassword('');
    }
  }, [opened]);

  // Validation state
  const hasValidUrl = parsedUrls.some((p) => p.isValid);
  const hasInvalidUrls = parsedUrls.some((p) => !p.isValid);
  const validUrlCount = parsedUrls.filter((p) => p.isValid).length;
  const canDownload = hasValidUrl && selectedClient && !downloadMutation.isPending;

  // Handle download
  const handleDownload = useCallback((): void => {
    if (!canDownload) return;

    const validUrls = parsedUrls.filter((p) => p.isValid);
    if (validUrls.length === 0) return;

    const chapterIds = getChapterIds(context);

    // For now, download first valid URL (TODO: support batch)
    const firstUrl = validUrls[0];
    if (!firstUrl) return;

    downloadMutation.mutate({
      mangaId: toNumberId(context.manga.id),
      chapterIds: chapterIds.length > 0 ? chapterIds : [0], // Use 0 as placeholder for pack downloads
      url: firstUrl.url,
      clientType: selectedClient,
    });
  }, [canDownload, parsedUrls, context, selectedClient, downloadMutation]);

  // Handle paste from clipboard
  const handlePaste = useCallback((_e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    // Let default paste happen, validation is automatic
  }, []);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconLink size={20} />
          <Text fw={600}>Direct URL Download</Text>
        </Group>
      }
      size="lg"
    >
      <Stack gap="md">
        {/* Context Info */}
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          <Text size="sm">
            Downloading for: <strong>{getContextDescription(context)}</strong>
          </Text>
        </Alert>

        {/* URL Input */}
        <Textarea
          label="Download URL"
          placeholder="Paste magnet link, .torrent URL, or NZB URL here..."
          description="Supports magnet links, .torrent files, and NZB URLs. Multiple URLs can be separated by commas or newlines."
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onPaste={handlePaste}
          minRows={3}
          maxRows={6}
          autosize
          autoFocus
          error={singleParsedUrl && !singleParsedUrl.isValid ? singleParsedUrl.error : undefined}
          rightSection={
            singleParsedUrl?.isValid ? (
              <ThemeIcon color="green" variant="light" size="sm">
                <IconCheck size={14} />
              </ThemeIcon>
            ) : undefined
          }
        />

        {/* URL Type Badge */}
        {singleParsedUrl?.isValid && (
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              Detected:
            </Text>
            <Badge color={getUrlTypeColor(singleParsedUrl.type)} variant="light">
              {getUrlTypeLabel(singleParsedUrl.type)}
            </Badge>
            {singleParsedUrl.filename && (
              <Text size="xs" c="dimmed" lineClamp={1} style={{ maxWidth: '300px' }}>
                {singleParsedUrl.filename}
              </Text>
            )}
          </Group>
        )}

        {/* Multiple URLs Summary */}
        {parsedUrls.length > 1 && (
          <Box>
            <Text size="sm" fw={500} mb="xs">
              {validUrlCount} of {parsedUrls.length} URLs valid
            </Text>
            <List size="sm" spacing="xs">
              {parsedUrls.slice(0, 5).map((parsed, index) => (
                <List.Item
                  key={index}
                  icon={
                    <ThemeIcon
                      color={parsed.isValid ? 'green' : 'red'}
                      size="xs"
                      variant="light"
                    >
                      {parsed.isValid ? <IconCheck size={12} /> : <IconX size={12} />}
                    </ThemeIcon>
                  }
                >
                  <Group gap="xs">
                    <Badge size="xs" color={getUrlTypeColor(parsed.type)}>
                      {getUrlTypeLabel(parsed.type)}
                    </Badge>
                    <Text size="xs" {...(!parsed.isValid && { c: 'red' })} lineClamp={1}>
                      {parsed.filename ?? parsed.url.substring(0, 50)}
                      {!parsed.isValid && ` - ${parsed.error}`}
                    </Text>
                  </Group>
                </List.Item>
              ))}
              {parsedUrls.length > 5 && (
                <List.Item
                  icon={
                    <ThemeIcon color="gray" size="xs" variant="light">
                      <IconInfoCircle size={12} />
                    </ThemeIcon>
                  }
                >
                  <Text size="xs" c="dimmed">
                    ...and {parsedUrls.length - 5} more
                  </Text>
                </List.Item>
              )}
            </List>
          </Box>
        )}

        {/* Client Selector */}
        <Select
          label="Download Client"
          placeholder="Select download client"
          description={
            singleParsedUrl?.isValid
              ? `Showing clients compatible with ${getUrlTypeLabel(singleParsedUrl.type)}`
              : 'All enabled clients'
          }
          value={selectedClient}
          onChange={(value) => setSelectedClient(value ?? '')}
          data={compatibleClients}
          disabled={compatibleClients.length === 0}
          error={
            compatibleClients.length === 0 && enabledClients.length > 0
              ? 'No compatible clients for this URL type'
              : undefined
          }
        />

        {/* No Clients Warning */}
        {enabledClients.length === 0 && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            No download clients configured. Please enable at least one in Settings → Download
            Clients.
          </Alert>
        )}

        {/* Authentication Section (Collapsible) */}
        <Box>
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconLock size={14} />}
            onClick={toggleAuth}
            color="gray"
          >
            {authOpened ? 'Hide' : 'Show'} Authentication Options
          </Button>
          <Collapse in={authOpened}>
            <Stack gap="sm" mt="sm" p="sm" style={{ backgroundColor: 'var(--mantine-color-dark-6)', borderRadius: 'var(--mantine-radius-sm)' }}>
              <Text size="xs" c="dimmed">
                Optional: Provide credentials if the URL requires authentication
              </Text>
              <Group grow>
                <TextInput
                  label="Username"
                  placeholder="HTTP username"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  size="sm"
                />
                <PasswordInput
                  label="Password"
                  placeholder="HTTP password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  size="sm"
                />
              </Group>
            </Stack>
          </Collapse>
        </Box>

        {/* Invalid URLs Warning */}
        {hasInvalidUrls && hasValidUrl && (
          <Alert icon={<IconAlertCircle size={16} />} color="yellow">
            Some URLs are invalid and will be skipped. Only valid URLs will be downloaded.
          </Alert>
        )}

        {/* Download Button */}
        <Button
          fullWidth
          leftSection={
            downloadMutation.isPending ? (
              <Loader size={16} color="white" />
            ) : (
              <IconDownload size={16} />
            )
          }
          onClick={handleDownload}
          disabled={!canDownload}
          loading={downloadMutation.isPending}
        >
          {downloadMutation.isPending
            ? 'Sending to Client...'
            : validUrlCount > 1
              ? `Download ${validUrlCount} URLs`
              : 'Download'}
        </Button>
      </Stack>
    </Modal>
  );
}

export default DirectUrlModal;
