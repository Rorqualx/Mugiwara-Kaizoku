/**
 * Mock Mantine Input Components
 *
 * Mock implementations of Mantine form input components for testing.
 * Includes TextInput, Checkbox, and Select with full prop support.
 *
 * Extracted from: mockComponents.tsx (lines 382-497)
 */

import React from 'react';

import type {
  MockTextInputProps,
  MockCheckboxProps,
  MockSelectProps,
} from './types';

// ============================================================================
// Input Components
// ============================================================================

export const TextInput = ({
  value,
  onChange,
  label,
  placeholder,
  error,
  description,
  disabled,
  required,
  readOnly,
  ...props
}: MockTextInputProps): JSX.Element => (
  <div
    data-testid="mantine-text-input"
    className="mantine-TextInput-root"
    data-disabled={disabled ? 'true' : 'false'}
    data-required={required ? 'true' : 'false'}
    data-invalid={error ? 'true' : 'false'}
  >
    {label && (
      <label className="mantine-TextInput-label">
        {label}
        {required && <span className="mantine-TextInput-required">*</span>}
      </label>
    )}
    <input
      value={value ?? ''}
      onChange={onChange}
      placeholder={placeholder ?? ''}
      disabled={disabled}
      aria-required={required}
      aria-invalid={!!error}
      readOnly={readOnly}
      aria-readonly={readOnly}
      {...props}
    />
    {error && (
      <div className="mantine-TextInput-error" data-testid="input-error">
        {error}
      </div>
    )}
    {description && (
      <div className="mantine-TextInput-description">{description}</div>
    )}
  </div>
);

export const Checkbox = ({
  checked,
  onChange,
  label,
  disabled,
  indeterminate,
  ...props
}: MockCheckboxProps): JSX.Element => (
  <div
    data-testid="mantine-checkbox"
    className="mantine-Checkbox-root"
    data-disabled={disabled ? 'true' : 'false'}
    data-checked={checked ? 'true' : 'false'}
    data-indeterminate={indeterminate ? 'true' : 'false'}
  >
    <input
      type="checkbox"
      checked={checked ?? false}
      onChange={onChange}
      disabled={disabled}
      aria-checked={indeterminate ? 'mixed' : checked ? 'true' : 'false'}
      {...props}
    />
    {label && <label className="mantine-Checkbox-label">{label}</label>}
  </div>
);

export const Select = ({
  value,
  onChange,
  data,
  label,
  placeholder,
  error,
  disabled,
  required,
  ...props
}: MockSelectProps): JSX.Element => (
  <div
    data-testid="mantine-select"
    className="mantine-Select-root"
    data-disabled={disabled ? 'true' : 'false'}
    data-required={required ? 'true' : 'false'}
    data-invalid={error ? 'true' : 'false'}
  >
    {label && (
      <label className="mantine-Select-label">
        {label}
        {required && <span className="mantine-Select-required">*</span>}
      </label>
    )}
    <select
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      aria-required={required}
      aria-invalid={!!error}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {(data ?? []).map((item, index: number) => {
        const itemValue = typeof item === 'string' ? item : item.value;
        const itemLabel = typeof item === 'string' ? item : item.label;
        return (
          <option key={index} value={itemValue}>
            {itemLabel}
          </option>
        );
      })}
    </select>
    {error && (
      <div className="mantine-Select-error" data-testid="select-error">
        {error}
      </div>
    )}
  </div>
);
