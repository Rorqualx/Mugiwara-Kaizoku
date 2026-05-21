/**
 * SourceCard component for displaying and managing manga source providers
 * 
 * This component provides a card interface for managing individual manga source providers,
 * supporting Suwayomi sources. It handles:
 * - Enabling/disabling sources
 * - Displaying source metadata (name, version, language, NSFW status)
 * - Source-specific settings configuration
 * - Source testing capabilities
 * 
 * @remarks
 * Source Types:
 * - Suwayomi: Blue badge, uses SuwayomiCardSettings for configuration
 * - Suwayomi: Blue badge, uses SuwayomiCardSettings for configuration
 * 
 * Features:
 * - Visual status indicators (enabled/disabled)
 * - Collapsible settings panel
 * - Built-in source tester
 * - Loading state management
 * - Badge system for source attributes
 * 
 * @example
 * ```tsx
 * // Basic usage with a Suwayomi source
 * const suwayomiSource = {
 *   id: 'suwayomi-1',
 *   name: 'MangaPlus',
 *   version: '1.0.0',
 *   sourceType: 'suwayomi',
 *   author: 'Suwayomi',
 *   description: 'MangaPlus source via Suwayomi',
 *   enabled: true,
 *   lang: 'en',
 *   isNsfw: false
 * };
 *
 * function SourcesPage() {
 *   const handleToggle = (id: string, enabled: boolean, type: 'suwayomi') => {
 *     // Handle source toggle
 *   };
 *
 *   return (
 *     <SourceCard
 *       source={suwayomiSource}
 *       isLoading={false}
 *       onToggle={handleToggle}
 *     />
 *   );
 * }
 * ```
 */

import React, { useState } from 'react';

import { Card, Text, Group, Switch, ActionIcon, Menu, Collapse, Box, LoadingOverlay, Badge, Divider } from '@mantine/core';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconDotsVertical } from '@tabler/icons-react';
import { IconCheck } from '@tabler/icons-react';
import { IconX } from '@tabler/icons-react';
import { IconTestPipe } from '@tabler/icons-react';
import { IconSettings } from '@tabler/icons-react';

// MangalCardSettings removed - mangal is deprecated
import { useSettings } from '@/hooks/useSettings';
import type { UnifiedSource } from '@/types/sources';
import { trpc as _trpc } from '@/utils/trpc-client';

import { SourceTester } from './SourceTester.mock';

/**
 * Props for the SourceCard component
 */
interface SourceCardProps {
  /** Source configuration and metadata */
  source: UnifiedSource;
  /** Whether the source is in a loading state */
  isLoading: boolean;
  /** Callback for handling source enable/disable toggle */
  onToggle: (sourceId: string, enabled: boolean, sourceType: 'suwayomi') => void;
}

export function SourceCard({
  source,
  onToggle
}: SourceCardProps): React.ReactElement {
  const [showTester, setShowTester] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { isLoading } = useSettings();

  // Handle toggle
  const handleToggle = (): void => {
    onToggle(source["id"], !source.enabled, source.sourceType);
  };

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder style={{ position: 'relative', height: '100%' }}>
      <LoadingOverlay visible={isLoading} />
      <Group justify="space-between" mb="xs">
        <Box>
          <Group mb="xs">
            <Text fw={500} size="lg">{source["name"]}</Text>
            <Badge size="sm" variant="filled">v{source.version}</Badge>
            <Badge size="sm" color="blue" variant="filled">Suwayomi</Badge>
            {/* Mangal badge removed - deprecated */}
            {source.lang &&
            <Badge size="sm" color="gray" variant="outline">{source.lang.toUpperCase()}</Badge>
            }
            {source.isNsfw &&
            <Badge size="sm" color="red" variant="dot">NSFW</Badge>
            }
          </Group>
          <Text size="sm" c="dimmed">By {source.author}</Text>
        </Box>
        <Group gap="xs">
          <Box style={{ position: 'relative' }}>
            <Switch
              checked={source.enabled}
              onChange={handleToggle}
              disabled={isLoading}
              size="md"
              thumbIcon={source.enabled ? <IconCheck size={12} stroke={3} /> : <IconX size={12} stroke={3} />}
              color={source.enabled ? "green" : "gray"}
              label={source.enabled ? "Enabled" : "Disabled"}
              labelPosition="left" />

            <Box
              style={{
                position: 'absolute',
                bottom: -4,
                left: 0,
                right: 0,
                height: '2px',
                backgroundColor: source.enabled ? '#4CAF50' : '#ccc',
                borderRadius: '2px',
                transition: 'background-color 0.3s ease'
              }} />

          </Box>
          <Menu position="bottom-end" shadow="md">
            <Menu.Target>
              <ActionIcon variant="subtle" color="blue" title="Source options">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Source Options</Menu.Label>
              <Menu.Item
                leftSection={<IconSettings size={14} />}
                onClick={() => setShowSettings(!showSettings)}>

                {showSettings ? "Hide Settings" : "Show Settings"}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconTestPipe size={14} />}
                onClick={() => setShowTester(!showTester)}>

                {showTester ? "Hide Test Tools" : "Test Source"}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
      
      <Box mb="md" style={{
        backgroundColor: '#f9f9f9',
        padding: '10px',
        borderRadius: '4px',
        border: '1px solid #eee'
      }}>
        <Text size="sm" style={{ lineHeight: 1.5 }}>
          {source["description"]}
        </Text>
      </Box>
      
      <Collapse in={showTester} mt="md" animateOpacity>
        <Divider my="sm" color="orange" />
        <Group mb="xs" justify="space-between">
          <Text size="sm" fw={500} color="orange">Source Tester</Text>
          <Badge size="sm" color="orange">Testing Tools</Badge>
        </Group>
        
        <Box style={{ backgroundColor: '#fff9f0', padding: '12px', borderRadius: '6px', border: '1px dashed #ffcc80' }}>
          <SourceTester sourceName={source["name"]} />
        </Box>
      </Collapse>
    </Card>);

}