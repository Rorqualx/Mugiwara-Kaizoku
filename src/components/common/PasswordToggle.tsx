/**
 * Custom Password Input Component with Visibility Toggle
 * 
 * This component extends Mantine's PasswordInput with improved visibility toggle functionality
 * that works consistently across browsers.
 */
import React, { useState } from 'react';

import { PasswordInput, ActionIcon } from '@mantine/core';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconEye } from '@tabler/icons-react';
import { IconEyeOff } from '@tabler/icons-react';

/**
 * Props for the PasswordToggle component
 * 
 * @interface PasswordToggleProps
 * @extends Omit<React.ComponentPropsWithoutRef<typeof PasswordInput>, 'rightSection'>
 */
interface PasswordToggleProps extends Omit<React.ComponentPropsWithoutRef<typeof PasswordInput>, 'rightSection'> {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  description?: string;
  placeholder?: string;
  error?: React.ReactNode;
}

/**
 * A custom password input component with a reliable visibility toggle
 * 
 * @component
 * @param {PasswordToggleProps} props - Component props
 * @returns {React.ReactElement} Password input with visibility toggle
 */
export const PasswordToggle: React.FC<PasswordToggleProps> = ({
  label,
  value,
  onChange,
  description,
  placeholder,
  error,
  ...props
}) => {
  const [visible, setVisible] = useState(false);

  // Toggle password visibility
  const toggleVisibility = (): void => {
    setVisible(!visible);
  };

  // Custom right section with the eye icon
  const rightSection =
  <ActionIcon
    onClick={toggleVisibility}
    variant="subtle"
    color="blue"
    aria-label={visible ? "Hide password" : "Show password"}
    tabIndex={0}
    style={{ cursor: 'pointer' }}>

      {visible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
    </ActionIcon>;


  return (
    <PasswordInput
      label={label}
      value={value}
      onChange={onChange}
      description={description}
      placeholder={placeholder}
      error={error}
      visible={visible}
      rightSection={rightSection}
      rightSectionWidth={35}
      {...props} />);


};

export default PasswordToggle;