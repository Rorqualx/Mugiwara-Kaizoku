/**
 * Test Setup - Mantine Form Component Mocks
 *
 * Mock implementations of Mantine form components.
 * Extracted from: src/test/setup.ts (form components from lines 764-1655)
 */

import { jest } from '@jest/globals';
import * as React from 'react';
import { isRecord, getUnknownProperty, FormComponentProps, MantineComponentProps } from './foundation';

jest.mock('@mantine/core', () => ({
  ...(jest.requireActual('@mantine/core') as Record<string, unknown>),

  Select: ({ value, data, label, description, leftSection, rightSection, grow, ...props }: {
    value?: string | number;
    data?: unknown[];
    label?: string;
    description?: React.ReactNode;
    leftSection?: React.ReactNode;
    rightSection?: React.ReactNode;
    grow?: boolean;
    [key: string]: unknown;
  }) => {
    const selectedOption = Array.isArray(data) ? data.find((item: unknown) => {
      if (!isRecord(item)) return false;
      return getUnknownProperty(item, 'value') === value;
    }) : null;

    // Filter out Mantine-specific props from DOM element
    const cleanProps = isRecord(props) ? props : {};

    return React.createElement('div', { className: 'mantine-select-wrapper' },
      label && React.createElement('label', { htmlFor: (isRecord(cleanProps) ? getUnknownProperty(cleanProps, 'id') : null) || 'select-input' }, label),
      React.createElement('select', {
        ...cleanProps,
        'data-testid': 'mantine-select',
        id: (isRecord(cleanProps) ? getUnknownProperty(cleanProps, 'id') : null) || 'select-input',
        value: value ?? '',
        onChange: (e: unknown) => {
          if (isRecord(props) && isRecord(e) && 'target' in e) {
            const target = getUnknownProperty(e, 'target');
            const onChange = getUnknownProperty(props, 'onChange');
            if (typeof onChange === 'function' && isRecord(target)) {
              onChange(getUnknownProperty(target, 'value'));
            }
          }
        }
      },
        Array.isArray(data) && data.map((option: unknown) => {
          if (!isRecord(option)) return null;
          const value = String(getUnknownProperty(option, 'value') ?? '');
          return React.createElement('option', {
            key: value,
            value: value
          }, String(getUnknownProperty(option, 'label') ?? ''));
        })
      ),
      description && React.createElement('div', { className: 'mantine-input-description' }, description)
    );
  },

  TextInput: ({ value, label, description, leftSection, rightSection, styles, grow, ...props }: {
    value?: string | number;
    label?: string;
    description?: React.ReactNode;
    leftSection?: React.ReactNode;
    rightSection?: React.ReactNode;
    styles?: unknown;
    grow?: boolean;
    [key: string]: unknown;
  }) => {
    const [internalValue, setInternalValue] = React.useState(value ?? '');
    const currentValue = value !== undefined ? value : internalValue;

    // Filter out Mantine-specific props from DOM element
    const cleanProps = isRecord(props) ? props : {};

    const inputId = (isRecord(cleanProps) ? getUnknownProperty(cleanProps, 'id') : null) || 'text-input';

    return React.createElement('div', { className: 'mantine-textinput-wrapper' },
      label && React.createElement('label', { htmlFor: inputId }, label),
      React.createElement('input', {
        ...cleanProps,
        'data-testid': 'mantine-textinput',
        id: inputId,
        type: 'text',
        value: currentValue,
        onChange: (e: unknown) => {
          if (value === undefined && isRecord(e) && 'target' in e) {
            const target = getUnknownProperty(e, 'target');
            if (isRecord(target)) {
              const newValue = getUnknownProperty(target, 'value');
              setInternalValue(typeof newValue === 'string' || typeof newValue === 'number' ? newValue : '');
            }
          }
          if (isRecord(props)) {
            const onChange = getUnknownProperty(props, 'onChange');
            if (typeof onChange === 'function') {
              onChange(e);
            }
          }
        }
      }),
      description && React.createElement('div', { className: 'mantine-input-description' }, description)
    );
  },

  Switch: ({ checked, label, description, grow, ...props }: {
    checked?: boolean;
    label?: string;
    description?: React.ReactNode;
    grow?: boolean;
    onChange?: (e: unknown) => void;
    [key: string]: unknown;
  }) => {
    // Filter out Mantine-specific props from DOM element
    const { grow: _grow, onChange, ...cleanProps } = props;

    const inputId = (isRecord(cleanProps) ? getUnknownProperty(cleanProps, 'id') : null) || 'switch-input';

    return React.createElement('div', { className: 'mantine-switch-wrapper' },
      React.createElement('input', {
        ...cleanProps,
        'data-testid': 'mantine-switch',
        id: inputId,
        type: 'checkbox',
        role: 'switch',
        'aria-checked': checked || false,
        checked: checked || false,
        onChange: (e: unknown) => onChange?.(e)
      }),
      label && React.createElement('label', { htmlFor: inputId }, label),
      description && React.createElement('div', { className: 'mantine-input-description' }, description)
    );
  },

  Button: ({ children, loading: _loading, disabled, leftSection, rightSection, fullWidth, variant, grow, ...props }: {
    children?: React.ReactNode;
    loading?: boolean;
    disabled?: boolean;
    leftSection?: React.ReactNode;
    rightSection?: React.ReactNode;
    fullWidth?: boolean;
    variant?: string;
    grow?: boolean;
    className?: string;
    style?: React.CSSProperties;
    [key: string]: unknown;
  }) => {
    const { leftSection: _leftSection, rightSection: _rightSection, fullWidth: _fullWidth, variant: _variant, grow: _grow, className, style, ...cleanProps } = props;
    return React.createElement('button', {
      ...cleanProps,
      'data-testid': 'mantine-button',
      className: `mantine-Button-root ${className ?? ''}`,
      disabled: disabled || _loading,
      'aria-busy': _loading,
      type: 'button',
      'data-variant': variant,
      style: {
        width: fullWidth ? '100%' : undefined,
        ...style
      }
    },
      _loading ? React.createElement('span', { 'data-testid': 'mantine-loader' }, 'Loading...') : leftSection,
      children,
      rightSection
    );
  },

  ColorInput: ({ value, label, description, onChange, swatchColors, ...props }: FormComponentProps & {
    value?: string;
    onChange?: (value: string) => void;
    swatchColors?: string[];
  }) =>
    React.createElement('div', { className: 'mantine-colorinput-wrapper' },
      label && React.createElement('label', {}, label),
      React.createElement('input', {
        ...(isRecord(props) ? props : {}),
        'data-testid': 'mantine-colorinput',
        type: 'color',
        value: value || '#000000',
        onChange: (e: unknown) => {
          if (typeof onChange === 'function' && isRecord(e) && 'target' in e) {
            const target = getUnknownProperty(e, 'target');
            if (isRecord(target)) {
              onChange(getUnknownProperty(target, 'value') as string);
            }
          }
        }
      }),
      swatchColors && React.createElement('div', { 'data-testid': 'color-swatches' },
        swatchColors.map((color: string, index: number) =>
          React.createElement('button', {
            key: index,
            'data-testid': `color-swatch-${index}`,
            style: { backgroundColor: color },
            onClick: () => onChange?.(color)
          })
        )
      ),
      description && React.createElement('div', { className: 'mantine-input-description' }, description)
    ),

  NumberInput: ({ value, onChange, label, description, error, min, max, step, placeholder, disabled, leftSection, rightSection, ...props }: FormComponentProps & {
    value?: string | number;
    onChange?: (value: string | number) => void;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
  }) => {
    const [internalValue, setInternalValue] = React.useState<string | number>(value ?? '');
    const currentValue = value !== undefined ? value : internalValue;

    // Mock hooks.assignRef functionality
    const inputRef = React.useRef(null);
    const propsRef = (props as Record<string, unknown>)['ref'];

    React.useEffect(() => {
      if (propsRef && inputRef.current) {
        if (typeof propsRef === 'function') {
          propsRef(inputRef.current);
        } else if (propsRef && typeof propsRef === 'object' && 'current' in propsRef) {
          (propsRef as React.MutableRefObject<unknown>).current = inputRef.current;
        }
      }
    }, [propsRef]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      if (value === undefined) {
        setInternalValue(newValue);
      }

      // Convert to number if it's a valid number, otherwise pass the string
      const numericValue = parseFloat(newValue);
      const finalValue = isNaN(numericValue) ? newValue : numericValue;

      if (onChange) {
        onChange(finalValue);
      }
    };

    // Filter out Mantine-specific props from DOM element
    const { leftSection: _leftSection, rightSection: _rightSection, grow: _grow, ...cleanProps } = props;

    const inputId = (cleanProps as Record<string, unknown>)['id'] as string || 'number-input';

    return React.createElement('div', { className: 'mantine-numberinput-wrapper' }, [
      label && React.createElement('label', { key: 'label', htmlFor: inputId }, label),
      React.createElement('div', {
        key: 'input-wrapper',
        className: 'mantine-numberinput-input-wrapper',
        style: { position: 'relative', display: 'flex', alignItems: 'center' }
      }, [
        leftSection && React.createElement('div', {
          key: 'left-section',
          className: 'mantine-numberinput-left-section'
        }, leftSection),
        React.createElement('input', {
          key: 'input',
          ...cleanProps,
          ref: inputRef,
          'data-testid': 'mantine-numberinput',
          id: inputId,
          type: 'number',
          value: currentValue,
          onChange: handleChange,
          min,
          max,
          step,
          placeholder,
          disabled,
          style: {
            paddingLeft: leftSection ? '30px' : undefined,
            paddingRight: rightSection ? '30px' : undefined,
            ...cleanProps.style
          }
        }),
        rightSection && React.createElement('div', {
          key: 'right-section',
          className: 'mantine-numberinput-right-section'
        }, rightSection)]
      ),
      description && React.createElement('div', {
        key: 'description',
        className: 'mantine-input-description'
      }, description),
      error && React.createElement('div', {
        key: 'error',
        className: 'mantine-input-error',
        style: { color: '#fa5252' }
      }, error)]
    );
  },

  Checkbox: ({ checked, onChange, label, disabled, color, description, error, ...props }: FormComponentProps & {
    checked?: boolean;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    color?: string;
  }) => {
    return React.createElement('label', {
      'data-testid': 'mantine-checkbox-label',
      style: { display: 'flex', alignItems: 'center', gap: '8px' }
    }, [
      React.createElement('input', {
        key: 'input',
        type: 'checkbox',
        role: 'checkbox',
        checked: !!checked,
        onChange: disabled ? undefined : onChange,
        disabled,
        'data-testid': 'mantine-checkbox',
        'data-color': color,
        ...props
      }),
      label && React.createElement('span', { key: 'label' }, label),
      description && React.createElement('div', {
        key: 'description',
        className: 'mantine-input-description'
      }, description),
      error && React.createElement('div', {
        key: 'error',
        className: 'mantine-input-error',
        style: { color: '#fa5252' }
      }, error)]
    );
  },

  /**
   * Portal - Renders children into a DOM node outside the parent component hierarchy
   * In tests, we render into a container div with a test-id for queryability
   *
   * NOTE: This mock is duplicated from mantine-layout-mocks.ts because jest.mock() calls
   * don't stack - the last mock of @mantine/core wins. Since this file is imported last
   * in setup.ts, we need to include the Portal mock here to ensure it's available.
   */
  Portal: ({ children }: { children?: React.ReactNode }) => {
    // In tests, render children in a container div with test-id for queryability
    if (!children) {
      return null;
    }
    // Wrap in a div with test-id so Portal content is queryable in tests
    return React.createElement('div', {
      'data-testid': 'mantine-portal',
      'data-portal': 'true'
    }, children);
  }
}));
