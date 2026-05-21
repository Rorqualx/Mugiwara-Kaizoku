/**
 * Theme Editor Component - Production Version
 *
 * A production-ready theme editor that follows all project standards.
 * Implements proper type safety, AsyncResult pattern, and real persistence.
 */

import React, { useState, useEffect, useCallback } from "react";
import type { ReactElement } from 'react';

import { Box, Text, ColorInput, Button, Group, Paper, Tabs, ActionIcon, Tooltip, Notification, Grid, Card, useMantineTheme, rem, Loader, Center } from '@mantine/core';
import { IconRefresh, IconDeviceFloppy, IconCheck, IconX, IconInfoCircle, IconPalette } from '@tabler/icons-react';

import {
    DEFAULT_THEME_CONFIG,
    THEME_CONFIG_KEY,
    isValidHexColor,
} from '@/constants/theme-defaults';
import type { ColorTheme, ThemeConfig } from '@/constants/theme-defaults';
import { useLoadingManager } from '@/hooks/useLoadingManager';
import { useUIStore } from '@/store';
import { useColorSchemeContext } from '@/styles/ColorSchemeProvider';
import { trpc } from '@/utils/trpc-client/index';

import type { MantineTheme} from '@mantine/core';
// Type definitions
type ColorScheme = 'light' | 'dark';
type ThemeVariant = 'light' | 'dark';
interface NotificationState {
    type: 'success' | 'error' | null;
    message: string | null;
}
interface ModernColorPickerProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    swatchColors?: string[];
}
/**
 * Generate shades of a color for the color picker swatches
 */
function generateColorShades(color: string, count: number = 5): string[] {
    if (!isValidHexColor(color)) {
        return ['#000000', '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#ffffff'];
    }
    const shades: string[] = ['#000000'];
    const r = parseInt(color.substring(1, 3), 16);
    const g = parseInt(color.substring(3, 5), 16);
    const b = parseInt(color.substring(5, 7), 16);
    for (let i = Math.floor(count / 2); i >= 1; i--) {
        const factor = 1 - i * 0.2;
        shades.push(rgbToHex(Math.floor(r * factor), Math.floor(g * factor), Math.floor(b * factor)));
    }
    shades.push(color);
    for (let i = 1; i <= Math.floor(count / 2); i++) {
        const factor = i * 0.2;
        shades.push(rgbToHex(Math.floor(r + (255 - r) * factor), Math.floor(g + (255 - g) * factor), Math.floor(b + (255 - b) * factor)));
    }
    shades.push('#ffffff');
    return shades;
}
/**
 * Convert RGB components to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (c: number): string => {
        const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
/**
 * Get theme color based on current theme
 */
function getThemeColor(theme: MantineTheme, isDark: boolean): string {
    return theme.colors[isDark ? 'dark' : 'gray'][3];
}

function mergeColorIntoConfig(
    config: ThemeConfig,
    variant: ThemeVariant,
    colorKey: keyof ColorTheme,
    value: string,
): ThemeConfig {
    const updatedScheme: ColorTheme = { ...config.themes[variant], [colorKey]: value };
    return {
        ...config,
        themes: { ...config.themes, [variant]: updatedScheme },
    };
}
/**
 * Modern Color Picker Component
 */
function ModernColorPicker({ label, value, onChange, swatchColors = [] }: ModernColorPickerProps): ReactElement {
    const theme = useMantineTheme();
    const [isOpen, setIsOpen] = useState(false);
    const handleHexChange = (newValue: string): void => {
        if (isValidHexColor(newValue)) {
            onChange(newValue);
        }
    };
    const handleSwatchClick = (color: string): void => {
        if (isValidHexColor(color)) {
            onChange(color);
        }
    };
    const isDark = (theme as MantineTheme & {
        colorScheme: ColorScheme;
    }).colorScheme === 'dark';
    const borderColor = getThemeColor(theme, isDark);
    return (<Card shadow="sm" p="xs" radius="md" mb="md" withBorder>
      <Group>
        <Group>
          <div style={{
            width: rem(24),
            height: rem(24),
            borderRadius: rem(4),
            backgroundColor: value,
            border: `1px solid ${borderColor}`
        }}/>

          <Text size="sm" fw={500}>{label}</Text>
        </Group>

        <Group>
          <ColorInput value={value} onChange={handleHexChange} format="hex" size="xs" style={{ width: rem(120) }} swatches={['#000000', '#25262b', '#495057', '#868e96', '#adb5bd', '#dee2e6', '#ffffff']}/>

          <ActionIcon variant="light" color="blue" size="md" onClick={() => setIsOpen(!isOpen)}>

            <IconPalette size={18}/>
          </ActionIcon>
        </Group>
      </Group>

      {isOpen && swatchColors.length > 0 &&
            <Group mt={8}>
          {swatchColors.map((color, index) => {
            const colorArray = theme.colors[isDark ? 'white' : 'dark'];
            const borderStyle = colorArray?.[9] !== undefined
              ? `2px solid ${colorArray[9]}`
              : `1px solid ${borderColor}`;
            return <div
                        key={index}
                        role="button"
                        tabIndex={0}
                        aria-label={`Select color ${color}`}
                        aria-pressed={color === value}
                        style={{
                            width: rem(20),
                            height: rem(20),
                            borderRadius: rem(4),
                            backgroundColor: color,
                            cursor: 'pointer',
                            border: color === value ? borderStyle : `1px solid ${borderColor}`
                        }}
                        onClick={() => { void handleSwatchClick(color); }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                void handleSwatchClick(color);
                            }
                        }}/>;
          })}
        </Group>}
    </Card>);
}
/**
 * Theme Editor component for customizing application theme colors
 */
function useThemeEditor(): {
    activeTab: ThemeVariant;
    setActiveTab: (v: ThemeVariant) => void;
    notification: NotificationState;
    setNotification: (n: NotificationState) => void;
    themeConfig: ThemeConfig;
    isReady: boolean;
    handleColorChange: (key: keyof ColorTheme, value: string) => void;
    save: () => Promise<void>;
    reset: () => Promise<void>;
    isSaving: boolean;
    isResetting: boolean;
} {
    const { colorScheme, themeColorsConfig, isThemeConfigLoaded, setThemeColorsConfig } = useColorSchemeContext();
    const [activeTab, setActiveTab] = useState<ThemeVariant>('light');
    const [notification, setNotification] = useState<NotificationState>({ type: null, message: null });
    const { withLoading } = useLoadingManager();
    const isSaving = useUIStore((s) => s.loadingStates['save-theme'] ?? false);
    const isResetting = useUIStore((s) => s.loadingStates['reset-theme'] ?? false);
    const setConfigMutation = trpc.config.set.useMutation();

    useEffect(() => {
        if (isThemeConfigLoaded) {
            setActiveTab(colorScheme === 'dark' ? 'dark' : 'light');
        }
    // Initialize-once on first load so users can edit a tab that doesn't match their current scheme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isThemeConfigLoaded]);

    const handleColorChange = useCallback((colorKey: keyof ColorTheme, value: string): void => {
        if (!isValidHexColor(value)) return;
        setThemeColorsConfig(mergeColorIntoConfig(themeColorsConfig, activeTab, colorKey, value));
    }, [activeTab, setThemeColorsConfig, themeColorsConfig]);

    const save = withLoading('save-theme', async (): Promise<void> => {
        setNotification({ type: null, message: null });
        try {
            await setConfigMutation.mutateAsync({ key: THEME_CONFIG_KEY, value: themeColorsConfig });
            setNotification({ type: 'success', message: 'Theme configuration saved successfully' });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setNotification({ type: 'error', message: `Failed to save theme configuration: ${msg}` });
        }
    });

    const reset = withLoading('reset-theme', async (): Promise<void> => {
        setNotification({ type: null, message: null });
        setThemeColorsConfig(DEFAULT_THEME_CONFIG);
        try {
            await setConfigMutation.mutateAsync({ key: THEME_CONFIG_KEY, value: DEFAULT_THEME_CONFIG });
            setNotification({ type: 'success', message: 'Theme configuration reset successfully' });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setNotification({ type: 'error', message: `Failed to reset theme configuration: ${msg}` });
        }
    });

    return {
        activeTab,
        setActiveTab,
        notification,
        setNotification,
        themeConfig: themeColorsConfig,
        isReady: isThemeConfigLoaded,
        handleColorChange,
        save,
        reset,
        isSaving,
        isResetting,
    };
}

export function ThemeEditor(): ReactElement {
    const {
        activeTab, setActiveTab, notification, setNotification,
        themeConfig, isReady, handleColorChange, save, reset, isSaving, isResetting,
    } = useThemeEditor();

    if (!isReady) {
        return (<Center h={200}><Loader size="md"/></Center>);
    }

    const currentTheme = themeConfig.themes[activeTab];
    const colorSwatches = {
        primary: generateColorShades(currentTheme.primary),
        background: generateColorShades(currentTheme.background),
        secondary: generateColorShades(currentTheme.secondary),
        accent: generateColorShades(currentTheme.accent),
        card: generateColorShades(currentTheme.card),
        surface: generateColorShades(currentTheme.surface),
        text: generateColorShades(currentTheme.text),
        success: generateColorShades(currentTheme.success),
        error: generateColorShades(currentTheme.error),
        warning: generateColorShades(currentTheme.warning)
    };
    return (<Box>
      {notification.type && notification.message &&
            <Notification title={notification.type === 'success' ? 'Success' : 'Error'} color={notification.type === 'success' ? 'green' : 'red'} icon={notification.type === 'success' ? <IconCheck /> : <IconX />} onClose={() => setNotification({ type: null, message: null })} mb="md">

          {notification.message}
        </Notification>}

      <Paper shadow="sm" radius="md" p="md" mb="xl" withBorder>
        <Group>
          <Box>
            <Text fw={500}>Theme Customization</Text>
            <Text size="sm" c="dimmed">Customize the application&apos;s appearance</Text>
          </Box>
          <Group>
            <Tooltip label="Reset to defaults">
              <ActionIcon variant="light" color="gray" onClick={() => { void reset(); }} loading={isResetting} radius="xl">
                <IconRefresh size={18}/>
              </ActionIcon>
            </Tooltip>
            <Button leftSection={<IconDeviceFloppy size={16}/>} onClick={() => { void save(); }} loading={isSaving} color={notification.type === 'success' ? 'green' : 'blue'} radius="md">
              {notification.type === 'success' ? 'Saved' : 'Save Changes'}
            </Button>
          </Group>
        </Group>

        <Tabs value={activeTab} onChange={(value) => setActiveTab(value as ThemeVariant)} radius="md">
          <Tabs.List>
            <Tabs.Tab value="light">Light Theme</Tabs.Tab>
            <Tabs.Tab value="dark">Dark Theme</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value={activeTab} pt="md">
            <Grid gutter="md">
              <Grid.Col span={6}>
                <Box>
                  <Text fw={500} size="sm" mb="xs">App Colors</Text>
                  <ModernColorPicker label="Buttons & Links" value={currentTheme.primary} onChange={(value) => { void handleColorChange('primary', value); }} swatchColors={colorSwatches.primary}/>

                  <ModernColorPicker label="App Background" value={currentTheme.background} onChange={(value) => { void handleColorChange('background', value); }} swatchColors={colorSwatches.background}/>

                  <ModernColorPicker label="Tabs" value={currentTheme.secondary} onChange={(value) => { void handleColorChange('secondary', value); }} swatchColors={colorSwatches.secondary}/>

                  <ModernColorPicker label="Highlights" value={currentTheme.accent} onChange={(value) => { void handleColorChange('accent', value); }} swatchColors={colorSwatches.accent}/>

                  <ModernColorPicker label="Cards & Panels" value={currentTheme.card} onChange={(value) => { void handleColorChange('card', value); }} swatchColors={colorSwatches.card}/>

                  <ModernColorPicker label="Inputs & Controls" value={currentTheme.surface} onChange={(value) => { void handleColorChange('surface', value); }} swatchColors={colorSwatches.surface}/>

                  <ModernColorPicker label="Text" value={currentTheme.text} onChange={(value) => { void handleColorChange('text', value); }} swatchColors={colorSwatches.text}/>

                </Box>
              </Grid.Col>

              <Grid.Col span={6}>
                <Box>
                  <Text fw={500} size="sm" mb="xs">Status Colors</Text>
                  <ModernColorPicker label="Confirmations" value={currentTheme.success} onChange={(value) => { void handleColorChange('success', value); }} swatchColors={colorSwatches.success}/>

                  <ModernColorPicker label="Errors & Alerts" value={currentTheme.error} onChange={(value) => { void handleColorChange('error', value); }} swatchColors={colorSwatches.error}/>

                  <ModernColorPicker label="Cautions" value={currentTheme.warning} onChange={(value) => { void handleColorChange('warning', value); }} swatchColors={colorSwatches.warning}/>

                </Box>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>
        </Tabs>
      </Paper>

      <Group>
        <IconInfoCircle size={20}/>
        <Text size="sm">
          Color changes preview live. Click <strong>Save Changes</strong> to persist them to the server, or <strong>Reset</strong> to restore defaults.
        </Text>
      </Group>
    </Box>);
}
