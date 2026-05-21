/**
 * ReaderSettingsModal Component
 *
 * Modal dialog for configuring reader settings including:
 * - Reading mode and direction
 * - Image fit mode
 * - Visual adjustments (background, brightness, contrast)
 * - UI toggles (toolbar, keyboard, click navigation, gestures)
 * - Performance settings (preload pages)
 */

import React from 'react';

import { Box, ColorInput, Modal, Select, Slider, Stack, Switch, Text } from '@mantine/core';

import type { ReadingMode, ReadingDirection, FitMode, ReaderSettings } from '@/types/reader/reader-types';

interface ReaderSettingsModalProps {
  opened: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  updateSettings: (updates: Partial<ReaderSettings>) => void;
}

export function ReaderSettingsModal({
  opened,
  onClose,
  settings,
  updateSettings,
}: ReaderSettingsModalProps): React.JSX.Element {
  return (
    <Modal opened={opened} onClose={onClose} title="Reader Settings" size="md">
      <Stack gap="md">
        {/* Reading Mode */}
        <Select
          label="Reading Mode"
          value={settings.readingMode}
          onChange={value => {
            if (value) {
              updateSettings({
                readingMode: value as ReadingMode,
              });
            }
          }}
          data={[
            { value: 'single', label: 'Single Page' },
            { value: 'double', label: 'Double Page' },
            { value: 'continuous_vertical', label: 'Continuous Vertical' },
            { value: 'continuous_horizontal', label: 'Continuous Horizontal' },
            { value: 'webtoon', label: 'Webtoon Mode' },
          ]}
        />

        {/* Reading Direction */}
        <Select
          label="Reading Direction"
          value={settings.readingDirection}
          onChange={value => {
            if (value) {
              updateSettings({
                readingDirection: value as ReadingDirection,
              });
            }
          }}
          data={[
            { value: 'ltr', label: 'Left to Right' },
            { value: 'rtl', label: 'Right to Left (Manga)' },
          ]}
        />

        {/* Fit Mode */}
        <Select
          label="Fit Mode"
          value={settings.fitMode}
          onChange={value => {
            if (value) {
              updateSettings({
                fitMode: value as FitMode,
              });
            }
          }}
          data={[
            { value: 'fit-width', label: 'Fit Width' },
            { value: 'fit-height', label: 'Fit Height' },
            { value: 'fit-both', label: 'Fit Both' },
            { value: 'original', label: 'Original Size' },
            { value: 'stretch', label: 'Stretch' },
          ]}
        />

        {/* Background Color */}
        <ColorInput
          label="Background Color"
          value={settings.backgroundColor}
          onChange={value =>
            updateSettings({
              backgroundColor: value,
            })
          }
        />

        {/* Brightness */}
        <Box>
          <Text size="sm" mb="xs">
            Brightness
          </Text>
          <Slider
            value={settings.brightness}
            onChange={value =>
              updateSettings({
                brightness: value,
              })
            }
            min={0.5}
            max={1.5}
            step={0.1}
            marks={[
              { value: 0.5, label: '50%' },
              { value: 1, label: '100%' },
              { value: 1.5, label: '150%' },
            ]}
          />
        </Box>

        {/* Contrast */}
        <Box>
          <Text size="sm" mb="xs">
            Contrast
          </Text>
          <Slider
            value={settings.contrast}
            onChange={value =>
              updateSettings({
                contrast: value,
              })
            }
            min={0.5}
            max={1.5}
            step={0.1}
            marks={[
              { value: 0.5, label: '50%' },
              { value: 1, label: '100%' },
              { value: 1.5, label: '150%' },
            ]}
          />
        </Box>

        {/* Show Toolbar */}
        <Switch
          label="Show Toolbar"
          checked={settings.showToolbar}
          onChange={e =>
            updateSettings({
              showToolbar: e.currentTarget.checked,
            })
          }
        />

        {/* Enable Keyboard Navigation */}
        <Switch
          label="Enable Keyboard Navigation"
          checked={settings.enableKeyboard}
          onChange={e =>
            updateSettings({
              enableKeyboard: e.currentTarget.checked,
            })
          }
        />

        {/* Enable Click Navigation */}
        <Switch
          label="Enable Click Navigation"
          checked={settings.clickNavigation}
          onChange={e =>
            updateSettings({
              clickNavigation: e.currentTarget.checked,
            })
          }
        />

        {/* Enable Gestures */}
        <Switch
          label="Enable Gestures"
          checked={settings.enableGestures}
          onChange={e =>
            updateSettings({
              enableGestures: e.currentTarget.checked,
            })
          }
        />

        {/* Double Page Offset (conditional) */}
        {settings.readingMode === 'double' && (
          <Switch
            label="Double Page Offset (for cover pages)"
            checked={settings.doublePageOffset}
            onChange={e =>
              updateSettings({
                doublePageOffset: e.currentTarget.checked,
              })
            }
          />
        )}

        {/* Preload Pages */}
        <Box>
          <Text size="sm" mb="xs">
            Preload Pages ({settings.preloadPages})
          </Text>
          <Slider
            value={settings.preloadPages}
            onChange={value =>
              updateSettings({
                preloadPages: value,
              })
            }
            min={1}
            max={10}
            step={1}
            marks={[
              { value: 1, label: '1' },
              { value: 3, label: '3' },
              { value: 5, label: '5' },
              { value: 10, label: '10' },
            ]}
          />
          <Text size="xs" c="dimmed" mt="xs">
            Number of pages to preload ahead for smoother reading
          </Text>
        </Box>
      </Stack>
    </Modal>
  );
}
