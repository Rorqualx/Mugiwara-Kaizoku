import React, { useState, useMemo, useEffect } from 'react';

import {
  Modal,
  Stack,
  Group,
  Text,
  Badge,
  Card,
  Checkbox,
  Button,
  ScrollArea,
  Box,
  Tooltip,
  ActionIcon,
  Collapse,
  Divider,
  Alert,
  Progress,
  TextInput } from
'@mantine/core';
import {
  IconFolder,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconChevronDown,
  IconChevronRight,
  IconSearch,
  IconRefresh } from
'@tabler/icons-react';

import type { ScanResult, ScanItem } from '@/server/services/library/scanner';
import { isObject, isString } from '@/utils/type-guards';

interface ScanPreviewProps {
  scanResult: ScanResult;
  onConfirm: (items: ScanItem[]) => void;
  onCancel: () => void;
  onRescan?: () => void;
  isProcessing?: boolean;
}

// eslint-disable-next-line max-lines-per-function -- 308-line scan-result preview with grouped folder/file rows + per-row actions; future split candidate (extract row renderer)
export function ScanPreview({
  scanResult,
  onConfirm,
  onCancel,
  onRescan,
  isProcessing = false
}: ScanPreviewProps): JSX.Element {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(
    new Set(scanResult.items.filter((item) => item["status"] !== 'exists').map((item) => item.path))
  );
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // After a rescan, scanResult.items may shift. Drop orphan paths from the
  // selection so we don't ship phantom paths to onConfirm. Newly-discovered
  // items stay unticked — user re-confirms intent rather than us guessing.
  useEffect(() => {
    const validPaths = new Set(scanResult.items.map((item) => item.path));
    setSelectedItems((prev) => {
      const next = new Set<string>();
      prev.forEach((p) => { if (validPaths.has(p)) next.add(p); });
      return next;
    });
  }, [scanResult.items]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery) return scanResult.items;

    const query = searchQuery.toLowerCase();
    return scanResult.items.filter((item) =>
    item.parsed.cleanTitle.toLowerCase().includes(query) ||
    item.path.toLowerCase().includes(query)
    );
  }, [scanResult.items, searchQuery]);

  // Group items by status
  const groupedItems = useMemo(() => {
    const groups = {
      new: [] as ScanItem[],
      exists: [] as ScanItem[],
      error: [] as ScanItem[],
      enriched: [] as ScanItem[]
    };

    filteredItems.forEach((item) => {
      switch (item["status"]) {
        case 'created':
        case 'preview':
          groups.new.push(item);
          break;
        case 'exists':
          groups.exists.push(item);
          break;
        case 'error':
          groups.error.push(item);
          break;
        case 'enriched':
          groups.enriched.push(item);
          break;
        default:
          // Unknown status, skip
          break;
      }
    });

    return groups;
  }, [filteredItems]);

  const handleToggleItem = (path: string): void => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedItems(newSelected);
  };

  const handleToggleExpanded = (path: string): void => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedItems(newExpanded);
  };

  const handleSelectAll = (status: 'new' | 'error'): void => {
    const items = status === 'new' ? groupedItems.new : groupedItems.error;
    const paths = items.map((item) => item.path);

    const allSelected = paths.every((path) => selectedItems.has(path));
    const newSelected = new Set(selectedItems);

    if (allSelected) {
      paths.forEach((path) => newSelected.delete(path));
    } else {
      paths.forEach((path) => newSelected.add(path));
    }

    setSelectedItems(newSelected);
  };

  const handleConfirm = (): void => {
    const itemsToProcess = scanResult.items.filter(
      (item) => selectedItems.has(item.path)
    );
    onConfirm(itemsToProcess);
  };

  const getStatusColor = (status: ScanItem['status']): string => {
    switch (status) {
      case 'created':
      case 'preview':
        return 'green';
      case 'enriched':
        return 'blue';
      case 'exists':
        return 'yellow';
      case 'error':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = (status: ScanItem['status']): JSX.Element | null => {
    switch (status) {
      case 'created':
      case 'preview':
      case 'enriched':
        return <IconCheck size={16} />;
      case 'exists':
        return <IconAlertCircle size={16} />;
      case 'error':
        return <IconX size={16} />;
      default:
        return null;
    }
  };

  const renderItemGroup = (title: string, items: ScanItem[], statusKey: 'new' | 'error' | null): JSX.Element | null => {
    if (items.length === 0) return null;

    const canSelect = statusKey !== null;

    return (
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600}>{title} ({items.length})</Text>
          {canSelect && items.length > 0 &&
          <Button
            size="xs"
            variant="subtle"
            onClick={() => handleSelectAll(statusKey)}>

              Select All
            </Button>
          }
        </Group>
        
        {items.map((item) =>
        <Card key={item.path} withBorder p="sm">
            <Stack gap="xs">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" style={{ flex: 1 }}>
                  {canSelect &&
                <Checkbox
                  checked={selectedItems.has(item.path)}
                  onChange={() => handleToggleItem(item.path)}
                  disabled={item["status"] === 'exists'} />

                }
                  
                  <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => handleToggleExpanded(item.path)}>

                    {expandedItems.has(item.path) ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                  </ActionIcon>
                  
                  <Box style={{ flex: 1 }}>
                    <Group gap="xs">
                      <Text fw={500}>{item.parsed.cleanTitle}</Text>
                      {item["chapters"] &&
                    <Badge size="sm" variant="light">
                          {item["chapters"]} chapter{item["chapters"] !== 1 ? 's' : ''}
                        </Badge>
                    }
                    </Group>
                  </Box>
                </Group>

                <Badge
                leftSection={getStatusIcon(item["status"])}
                color={getStatusColor(item["status"])}
                variant="light">

                  {item["status"] === 'preview' ? 'new' : item["status"]}
                </Badge>
              </Group>

              <Collapse in={expandedItems.has(item.path)}>
                <Stack gap="xs" mt="xs">
                  <Group gap="xs">
                    <IconFolder size={14} />
                    <Text size="sm" c="dimmed" style={{ wordBreak: 'break-all' }}>
                      {item.path}
                    </Text>
                  </Group>
                  
                  {item.parsed.group &&
                <Text size="sm">
                      <Text span fw={500}>Group:</Text> {item.parsed.group}
                    </Text>
                }
                  
                  {item.parsed.language &&
                <Text size="sm">
                      <Text span fw={500}>Language:</Text> {item.parsed.language}
                    </Text>
                }
                  
                  {item.duplicate && isObject(item.duplicate) && isString(item.duplicate["title"]) ? (
                <Alert color="yellow" p="xs">
                      <Text size="sm" fw={500}>Already exists as:</Text>
                      <Text size="sm">{item.duplicate["title"]}</Text>
                    </Alert>
                ) : null}
                  
                  {item.enrichment?.["status"] === 'enriched' &&
                <Alert color="green" p="xs">
                      <Text size="sm" fw={500}>Matched with:</Text>
                      <Text size="sm">
                        {item.enrichment.appliedMatch?.title} ({item.enrichment.appliedMatch?.provider})
                      </Text>
                      <Text size="xs" c="dimmed">
                        Confidence: {Math.round((item.enrichment.appliedMatch?.confidence ?? 0) * 100)}%
                      </Text>
                    </Alert>
                }
                  
                  {item.error &&
                <Alert color="red" p="xs">
                      <Text size="sm">{item.error}</Text>
                    </Alert>
                }
                </Stack>
              </Collapse>
            </Stack>
          </Card>
        )}
      </Stack>);

  };

  const selectedCount = selectedItems.size;
  const processableCount = scanResult.items.filter(
    (item) => item["status"] !== 'exists'
  ).length;

  return (
    <Modal
      opened
      onClose={onCancel}
      size="xl"
      title="Scan Preview"
      closeOnClickOutside={!isProcessing}
      closeOnEscape={!isProcessing}>

      <Stack>
        <Group justify="space-between">
          <Text>
            Found {scanResult.totalFiles} files in {scanResult.items.length} manga
          </Text>
          <Group gap="xs">
            <Badge color="green" variant="light">
              {scanResult.created + groupedItems.new.length} New
            </Badge>
            <Badge color="blue" variant="light">
              {groupedItems.enriched.length} Enriched
            </Badge>
            <Badge color="yellow" variant="light">
              {scanResult.skipped} Existing
            </Badge>
            <Badge color="red" variant="light">
              {scanResult.errors} Errors
            </Badge>
          </Group>
        </Group>

        {scanResult.items.length > 10 &&
        <TextInput
          placeholder="Search manga..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)} />

        }

        <Divider />

        <ScrollArea h={400}>
          <Stack gap="md">
            {renderItemGroup('New Manga', groupedItems.new, 'new')}
            {renderItemGroup('Enriched Manga', groupedItems.enriched, null)}
            {renderItemGroup('Already Exists', groupedItems.exists, null)}
            {renderItemGroup('Errors', groupedItems.error, 'error')}
          </Stack>
        </ScrollArea>

        {isProcessing &&
        <>
            <Divider />
            <Stack gap="xs">
              <Text size="sm" fw={500}>Processing...</Text>
              <Progress value={100} animated />
            </Stack>
          </>
        }

        <Divider />

        <Group justify="space-between">
          <Group>
            {onRescan &&
            <Tooltip label="Rescan directory">
                <ActionIcon
                variant="default"
                onClick={onRescan}
                disabled={isProcessing}>

                  <IconRefresh size={20} />
                </ActionIcon>
              </Tooltip>
            }
          </Group>
          
          <Group>
            <Button
              variant="default"
              onClick={onCancel}
              disabled={isProcessing}>

              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedCount === 0 || isProcessing}
              loading={isProcessing}>

              Import {selectedCount} of {processableCount} Manga
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>);

}