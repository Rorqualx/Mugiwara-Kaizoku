/**
 * Responsive Input Components
 * 
 * Enhanced input components with mobile optimizations:
 * - Touch-friendly sizing
 * - Mobile keyboard handling
 * - Clear buttons for mobile
 * - Voice input support
 */

import React, { useState, useRef, useCallback } from 'react';

import {
  TextInput,
  PasswordInput,
  Textarea,
  NumberInput,
  Select,
  MultiSelect,
  ActionIcon,
  Group } from
'@mantine/core';
import {
  IconX,
  IconVolume,
  IconVolumeOff} from
'@tabler/icons-react';

import { useBreakpoint } from '@/hooks/mobile';

import type {
  TextInputProps,
  PasswordInputProps,
  TextareaProps,
  NumberInputProps,
  SelectProps,
  MultiSelectProps} from '@mantine/core';

// Base props for all responsive inputs
interface ResponsiveInputBaseProps {
  /** Show clear button on mobile */
  showClearButton?: boolean;
  /** Enable voice input (mobile only) */
  enableVoiceInput?: boolean;
  /** Mobile-specific size */
  mobileSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Touch-friendly mode */
  touchFriendly?: boolean;
}

// Responsive Text Input
export interface ResponsiveTextInputProps extends TextInputProps, ResponsiveInputBaseProps {}

export function ResponsiveTextInput({
  showClearButton = true,
  enableVoiceInput = false,
  mobileSize,
  touchFriendly = true,
  size = 'md',
  rightSection,
  onChange,
  value,
  ...props
}: ResponsiveTextInputProps): React.ReactElement {
  const { isMobile } = useBreakpoint();
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate responsive size
  const responsiveSize = isMobile && mobileSize ? mobileSize : size;

  // Handle clear
  const handleClear = useCallback((): void => {
    if (onChange) {
      const event = { currentTarget: { value: '' } } as React.ChangeEvent<HTMLInputElement>;
      onChange(event);
    }
    inputRef.current?.focus();
  }, [onChange]);

  // Handle voice input (placeholder - actual implementation would use Web Speech API)
  const handleVoiceInput = useCallback((): void => {
    setIsRecording(!isRecording);
    // Voice input implementation would go here
  }, [isRecording]);

  // Build right section
  const responsiveRightSection = React.useMemo(() => {
    if (!isMobile) return rightSection;

    const elements = [];

    if (showClearButton && value) {
      elements.push(
        <ActionIcon
          key="clear"
          size={responsiveSize}
          variant="subtle"
          color="gray"
          onClick={handleClear}>

          <IconX size={16} />
        </ActionIcon>
      );
    }

    if (enableVoiceInput && 'webkitSpeechRecognition' in window) {
      elements.push(
        <ActionIcon
          key="voice"
          size={responsiveSize}
          variant="subtle"
          color={isRecording ? 'red' : 'gray'}
          onClick={handleVoiceInput}>

          {isRecording ? <IconVolumeOff size={16} /> : <IconVolume size={16} />}
        </ActionIcon>
      );
    }

    if (rightSection) {
      elements.push(<React.Fragment key="custom">{rightSection}</React.Fragment>);
    }

    return elements.length > 0 ?
    <Group gap={4}>
        {elements}
      </Group> :
    undefined;
  }, [isMobile, rightSection, showClearButton, value, enableVoiceInput, responsiveSize, handleClear, isRecording, handleVoiceInput]);

  return (
    <TextInput
      ref={inputRef}
      size={responsiveSize}
      rightSection={responsiveRightSection}
      styles={(theme) => ({
        input: {
          minHeight: isMobile && touchFriendly ? 44 : undefined,
          fontSize: isMobile ? theme.fontSizes.md : undefined
        }
      })}
      {...props} />);

}

// Responsive Password Input
export interface ResponsivePasswordInputProps extends PasswordInputProps, ResponsiveInputBaseProps {}

export function ResponsivePasswordInput({
  mobileSize,
  touchFriendly = true,
  size = 'md',
  ...props
}: ResponsivePasswordInputProps): React.ReactElement {
  const { isMobile } = useBreakpoint();
  const responsiveSize = isMobile && mobileSize ? mobileSize : size;

  return (
    <PasswordInput
      size={responsiveSize}
      styles={(theme) => ({
        input: {
          minHeight: isMobile && touchFriendly ? 44 : undefined,
          fontSize: isMobile ? theme.fontSizes.md : undefined
        },
        visibilityToggle: {
          minWidth: isMobile ? 44 : undefined,
          minHeight: isMobile ? 44 : undefined
        }
      })}
      {...props} />);

}

// Responsive Textarea
export interface ResponsiveTextareaProps extends TextareaProps, ResponsiveInputBaseProps {
  /** Auto-resize on mobile */
  mobileAutosize?: boolean;
  /** Mobile min rows */
  mobileMinRows?: number;
  /** Mobile max rows */
  mobileMaxRows?: number;
}

export function ResponsiveTextarea({
  mobileSize,
  touchFriendly = true,
  mobileAutosize = true,
  mobileMinRows,
  mobileMaxRows,
  size = 'md',
  autosize,
  minRows,
  maxRows,
  ...props
}: ResponsiveTextareaProps): React.ReactElement {
  const { isMobile } = useBreakpoint();

  const responsiveSize = isMobile && mobileSize ? mobileSize : size;
  const responsiveAutosize = isMobile ? mobileAutosize : autosize;
  const responsiveMinRows = isMobile && mobileMinRows ? mobileMinRows : minRows;
  const responsiveMaxRows = isMobile && mobileMaxRows ? mobileMaxRows : maxRows;

  // Build conditional props to avoid passing undefined with exactOptionalPropertyTypes
  const textareaProps: TextareaProps = {
    size: responsiveSize,
    ...(responsiveAutosize !== undefined && { autosize: responsiveAutosize }),
    ...(responsiveMinRows !== undefined && { minRows: responsiveMinRows }),
    ...(responsiveMaxRows !== undefined && { maxRows: responsiveMaxRows }),
    styles: (theme) => ({
      input: {
        ...(isMobile && touchFriendly && { minHeight: 88 }),
        ...(isMobile && { fontSize: theme.fontSizes.md })
      }
    }),
    ...props
  };

  return (
    <Textarea {...textareaProps} />);

}

// Responsive Number Input
export interface ResponsiveNumberInputProps extends NumberInputProps, ResponsiveInputBaseProps {
  /** Show increment/decrement buttons on mobile */
  showMobileControls?: boolean;
}

export function ResponsiveNumberInput({
  mobileSize,
  touchFriendly = true,
  showMobileControls = true,
  size = 'md',
  hideControls,
  ...props
}: ResponsiveNumberInputProps): React.ReactElement {
  const { isMobile } = useBreakpoint();

  const responsiveSize = isMobile && mobileSize ? mobileSize : size;
  const responsiveHideControls = isMobile ? !showMobileControls : hideControls;

  // Build conditional props to avoid passing undefined with exactOptionalPropertyTypes
  const numberInputProps: NumberInputProps = {
    size: responsiveSize,
    ...(responsiveHideControls !== undefined && { hideControls: responsiveHideControls }),
    styles: (theme) => ({
      input: {
        ...(isMobile && touchFriendly && { minHeight: 44 }),
        ...(isMobile && { fontSize: theme.fontSizes.md })
      },
      control: {
        ...(isMobile && { minWidth: 44 }),
        ...(isMobile && { minHeight: 44 })
      }
    }),
    ...props
  };

  return (
    <NumberInput {...numberInputProps} />);

}

// Responsive Select
export interface ResponsiveSelectProps extends SelectProps, ResponsiveInputBaseProps {
  /** Use native select on mobile */
  useNativeOnMobile?: boolean;
}

export function ResponsiveSelect({
  mobileSize,
  touchFriendly = true,
  size = 'md',
  ...props
}: ResponsiveSelectProps): React.ReactElement {
  const { isMobile } = useBreakpoint();

  const responsiveSize = isMobile && mobileSize ? mobileSize : size;

  return (
    <Select
      size={responsiveSize}
      styles={(theme) => ({
        input: {
          minHeight: isMobile && touchFriendly ? 44 : undefined,
          fontSize: isMobile ? theme.fontSizes.md : undefined
        },
        dropdown: {
          maxHeight: isMobile ? '50vh' : undefined
        }
      })}
      {...props} />);

}

// Responsive MultiSelect
export interface ResponsiveMultiSelectProps extends MultiSelectProps, ResponsiveInputBaseProps {
  /** Max items to show on mobile */
  mobileMaxSelectedValues?: number;
}

export function ResponsiveMultiSelect({
  mobileSize,
  touchFriendly = true,
  size = 'md',
  ...props
}: ResponsiveMultiSelectProps): React.ReactElement {
  const { isMobile } = useBreakpoint();

  const responsiveSize = isMobile && mobileSize ? mobileSize : size;

  return (
    <MultiSelect
      size={responsiveSize}
      styles={(theme) => ({
        input: {
          minHeight: isMobile && touchFriendly ? 44 : undefined,
          fontSize: isMobile ? theme.fontSizes.md : undefined
        },
        dropdown: {
          maxHeight: isMobile ? '50vh' : undefined
        },
        pill: {
          height: isMobile ? 28 : undefined
        }
      })}
      {...props} />);

}