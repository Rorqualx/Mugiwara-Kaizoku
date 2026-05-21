/**
 * Platform UI Components
 * 
 * Platform-specific UI adaptations:
 * - iOS/Android specific styling
 * - Native-like components
 * - Platform conventions
 * - Adaptive layouts
 */

import React, { useEffect, useState } from 'react';

import { Box, Switch, Checkbox, SegmentedControl } from '@mantine/core';

import { getNativePlatform, isNativeApp } from '@/utils/mobile/native-bridge';
import { getPWACapabilities } from '@/utils/mobile/pwa-manager';

export type Platform = 'ios' | 'android' | 'web';

/**
 * Get current platform
 */
export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>('web');

  useEffect(() => {
    if (isNativeApp()) {
      setPlatform(getNativePlatform() as Platform);
    } else {
      const capabilities = getPWACapabilities();
      setPlatform(capabilities.platform === 'ios' || capabilities.platform === 'android' ?
      capabilities.platform :
      'web'
      );
    }
  }, []);

  return platform;
}

/**
 * Platform-specific switch
 */
export interface PlatformSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export function PlatformSwitch({ checked, onChange, ...props }: PlatformSwitchProps): React.ReactElement {
  const platform = usePlatform();

  if (platform === 'ios') {
    return (
      <Switch
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        {...props}
        styles={{
          track: {
            backgroundColor: checked ?
            'var(--mantine-color-green-6)' :
            'var(--mantine-color-gray-3)',
            border: 'none'
          },
          thumb: {
            border: 'none',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
          }
        }} />);

  }

  return <Switch checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} {...props} />;
}

/**
 * Platform-specific checkbox
 */
export interface PlatformCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  indeterminate?: boolean;
}

export function PlatformCheckbox({ checked, onChange, ...props }: PlatformCheckboxProps): React.ReactElement {
  const platform = usePlatform();

  if (platform === 'ios') {
    return (
      <Checkbox
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        {...props}
        radius="xl"
        styles={{
          input: {
            backgroundColor: checked ?
            'var(--mantine-color-blue-6)' :
            'var(--mantine-color-gray-3)',
            borderColor: checked ?
            'var(--mantine-color-blue-6)' :
            'var(--mantine-color-gray-3)'
          }
        }} />);

  }

  return <Checkbox checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} {...props} />;
}

/**
 * Platform-specific segmented control
 */
export interface PlatformSegmentedControlProps {
  value: string;
  onChange: (value: string) => void;
  data: {label: string;value: string;}[];
  fullWidth?: boolean;
  disabled?: boolean;
}

export function PlatformSegmentedControl(props: PlatformSegmentedControlProps): React.ReactElement {
  const platform = usePlatform();

  if (platform === 'ios') {
    return (
      <SegmentedControl
        {...props}
        radius="md"
        styles={{
          root: {
            backgroundColor: 'var(--mantine-color-gray-1)',
            padding: 2
          },
          label: {
            padding: '8px 16px'
          },
          indicator: {
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            borderRadius: 'var(--mantine-radius-md)'
          }
        }} />);

  }

  if (platform === 'android') {
    return (
      <SegmentedControl
        {...props}
        radius="xl"
        styles={{
          root: {
            backgroundColor: 'transparent',
            border: '1px solid var(--mantine-color-gray-3)'
          },
          label: {
            padding: '8px 16px'
          },
          indicator: {
            backgroundColor: 'var(--mantine-color-blue-6)',
            borderRadius: 'var(--mantine-radius-xl)'
          }
        }} />);

  }

  return <SegmentedControl {...props} />;
}

/**
 * Platform-specific list item
 */
export interface PlatformListItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  leftSection?: React.ReactNode;
  rightSection?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

export function PlatformListItem({
  children,
  onClick,
  leftSection,
  rightSection,
  description,
  disabled
}: PlatformListItemProps): React.ReactElement {
  const platform = usePlatform();
  const [isPressed, setIsPressed] = useState(false);

  const baseStyles: React.CSSProperties = {
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: disabled ? 'not-allowed' : onClick ? 'pointer' : 'default',
    opacity: disabled ? 0.5 : 1,
    transition: 'background-color 0.2s ease',
    WebkitTapHighlightColor: 'transparent'
  };

  const platformStyles: React.CSSProperties = platform === 'ios' ? {
    backgroundColor: isPressed ? 'var(--mantine-color-gray-1)' : 'transparent',
    borderBottom: '1px solid var(--mantine-color-gray-2)'
  } : {
    backgroundColor: isPressed ? 'var(--mantine-color-gray-0)' : 'transparent',
    borderRadius: 'var(--mantine-radius-sm)'
  };

  return (
    <Box
      style={{ ...baseStyles, ...platformStyles }}
      onClick={!disabled ? onClick : undefined}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}>

      {leftSection &&
      <Box style={{ flexShrink: 0 }}>{leftSection}</Box>
      }
      
      <Box style={{ flex: 1 }}>
        <Box>{children}</Box>
        {description &&
        <Box
          style={{
            fontSize: '0.875rem',
            color: 'var(--mantine-color-gray-6)',
            marginTop: 2
          }}>

            {description}
          </Box>
        }
      </Box>
      
      {rightSection &&
      <Box style={{ flexShrink: 0 }}>{rightSection}</Box>
      }
    </Box>);

}

/**
 * Platform-specific navigation bar
 */
export interface PlatformNavBarProps {
  title: string;
  leftSection?: React.ReactNode;
  rightSection?: React.ReactNode;
  transparent?: boolean;
  bordered?: boolean;
}

export function PlatformNavBar({
  title,
  leftSection,
  rightSection,
  transparent,
  bordered = true
}: PlatformNavBarProps): React.ReactElement {
  const platform = usePlatform();

  const baseStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: transparent ? 'transparent' : 'var(--mantine-color-body)',
    position: 'relative'
  };

  const platformStyles: React.CSSProperties = platform === 'ios' ? {
    borderBottom: bordered ? '0.5px solid var(--mantine-color-gray-3)' : 'none',
    backdropFilter: transparent ? 'blur(20px)' : 'none',
    WebkitBackdropFilter: transparent ? 'blur(20px)' : 'none'
  } : {
    borderBottom: bordered ? '1px solid var(--mantine-color-gray-2)' : 'none',
    boxShadow: bordered && !transparent ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none'
  };

  return (
    <Box style={{ ...baseStyles, ...platformStyles }}>
      <Box style={{ minWidth: 60 }}>{leftSection}</Box>
      
      <Box
        style={{
          flex: 1,
          textAlign: 'center',
          fontWeight: platform === 'ios' ? 600 : 500,
          fontSize: platform === 'ios' ? '17px' : '20px'
        }}>

        {title}
      </Box>
      
      <Box style={{ minWidth: 60, display: 'flex', justifyContent: 'flex-end' }}>
        {rightSection}
      </Box>
    </Box>);

}

/**
 * Platform-specific tab bar
 */
export interface PlatformTabBarProps {
  items: {
    id: string;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
  }[];
  activeId: string;
  onChange: (id: string) => void;
}

export function PlatformTabBar({ items, activeId, onChange }: PlatformTabBarProps): React.ReactElement {
  const platform = usePlatform();

  const baseStyles: React.CSSProperties = {
    display: 'flex',
    backgroundColor: 'var(--mantine-color-body)',
    borderTop: '1px solid var(--mantine-color-gray-2)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)'
  };

  return (
    <Box style={baseStyles}>
      {items.map((item) => {
        const isActive = item["id"] === activeId;

        return (
          <Box
            key={item["id"]}
            onClick={() => onChange(item["id"])}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '8px 0',
              cursor: 'pointer',
              color: isActive ?
              'var(--mantine-color-blue-6)' :
              'var(--mantine-color-gray-6)',
              position: 'relative'
            }}>

            <Box style={{ position: 'relative' }}>
              {item.icon}
              {item.badge &&
              <Box
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -8,
                  backgroundColor: 'var(--mantine-color-red-6)',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '2px 6px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  minWidth: 18,
                  textAlign: 'center'
                }}>

                  {item.badge}
                </Box>
              }
            </Box>
            <Box
              style={{
                fontSize: platform === 'ios' ? '10px' : '12px',
                marginTop: 4,
                fontWeight: isActive ? 500 : 400
              }}>

              {item.label}
            </Box>
          </Box>);

      })}
    </Box>);

}