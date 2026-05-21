/**
 * Settings Switch Component
 * 
 * A customized switch component that provides visual feedback and
 * accessibility features for settings pages. It includes a status indicator, tooltip, and
 * theme-aware styling.
 * 
 * Features:
 * - Theme-aware colors
 * - Status indicator icon
 * - Status text
 * - Tooltip
 * - Animated indicator bar
 * - Accessibility support
 * - Disabled state handling
 * 
 * @module components/settings/SettingsSwitch
 */

import React from "react";

import { Box, Group, Switch, Text, Tooltip } from '@mantine/core';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconCheck } from '@tabler/icons-react';
import { IconX } from '@tabler/icons-react';

import { useTheme } from '@/hooks/useTheme';

/**
 * Props for the SettingsSwitch component
 * 
 * @interface SettingsSwitchProps
 * @property {boolean} checked - Current state of the switch
 * @property {function} onChange - Handler for switch state changes
 * @property {boolean} [disabled] - Whether the switch is disabled
 * @property {string} [label] - Primary text label
 * @property {string} [description] - Additional descriptive text
 */
interface SettingsSwitchProps {
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
}

/**
 * Enhanced switch component with visual feedback
 * 
 * Renders a switch control with additional visual elements including
 * a status icon, text label, and animated indicator bar. The component
 * adapts its colors based on the current theme.
 * 
 * @param {SettingsSwitchProps} props - Component properties
 * @returns {JSX.Element} The rendered switch component
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <SettingsSwitch
 *   checked={isEnabled}
 *   onChange={handleChange}
 *   label="Feature Toggle"
 *   description="Enable or disable this feature"
 * />
 * 
 * // Disabled state
 * <SettingsSwitch
 *   checked={true}
 *   onChange={handleChange}
 *   disabled={true}
 *   label="Locked Setting"
 * />
 * ```
 */
export function SettingsSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  description,
}: SettingsSwitchProps): React.ReactElement {
  const { isDark } = useTheme();

  /**
   * Theme-aware color definitions
   * - enabledColor: Green shade adapted for light/dark modes
   * - disabledColor: Gray shade adapted for light/dark modes
   * - textColor: Text color adapted for light/dark modes
   */
  const enabledColor = isDark ? '#00E676' : '#4CAF50'; // Brighter green in dark mode
  const disabledColor = isDark ? '#555555' : '#cccccc'; // Darker gray in dark mode
  const textColor = isDark ? '#ffffff' : '#333333';

  return (
    <Group justify="space-between" gap="xs" style={{ width: '100%' }}>
      {(label || description) && (
        <Box>
          {label && <Text fw={500}>{label}</Text>}
          {description && <Text size="xs" color="dimmed">{description}</Text>}
        </Box>
      )}
      
      <Group gap="xs" align="center">
        <Tooltip 
          label={checked ? "Enabled" : "Disabled"} 
          position="top"
          withArrow
        >
          <Box style={{ position: 'relative' }}>
            <Group gap={5} align="center">
              <Switch
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                size="md"
              />
              
              {/* Status icon */}
              <Box 
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  backgroundColor: checked ? enabledColor : disabledColor,
                  color: textColor,
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                {checked ? (
                  <IconCheck size={14} stroke={2.5} />
                ) : (
                  <IconX size={14} stroke={2.5} />
                )}
              </Box>
              
              {/* Status text */}
              <Text 
                size="xs" 
                fw={500} 
                c={checked ? enabledColor : disabledColor}
                style={{ opacity: disabled ? 0.5 : 1 }}
              >
                {checked ? "Enabled" : "Disabled"}
              </Text>
            </Group>
            
            {/* Indicator bar */}
            <Box 
              style={{ 
                position: 'absolute', 
                bottom: -5, 
                left: 0, 
                right: 0, 
                height: '5px', 
                backgroundColor: checked ? enabledColor : disabledColor,
                borderRadius: '2px',
                transition: 'background-color 0.3s ease',
                opacity: disabled ? 0.5 : 1,
                boxShadow: checked ? `0 0 8px ${enabledColor}` : 'none'
              }} 
            />
          </Box>
        </Tooltip>
      </Group>
    </Group>
  );
}
