/**
 * Component Type Guards
 *
 * Type guards for React component props and state
 */

import { isString, isBoolean, isObject, isArray, isFunction } from '../index';

/**
 * Check if value is valid component props
 */
export function isComponentProps(value: unknown): value is {
  children?: unknown;
  className?: string;
  style?: Record<string, unknown>;
  id?: string;
} {
  return (
    isObject(value) &&
    // children is optional and can be any type - no validation needed
    (!('className' in value) || isString(value['className'])) &&
    (!('style' in value) || isObject(value['style'])) &&
    (!('id' in value) || isString(value['id']))
  );
}

/**
 * Check if value is valid component state
 */
export function isComponentState(value: unknown): value is {
  loading?: boolean;
  error?: string;
  data?: unknown;
  visible?: boolean;
  disabled?: boolean;
} {
  return (
    isObject(value) &&
    (!('loading' in value) || isBoolean(value['loading'])) &&
    (!('error' in value) || isString(value['error'])) &&
    // data is optional and can be any type - no validation needed
    (!('visible' in value) || isBoolean(value['visible'])) &&
    (!('disabled' in value) || isBoolean(value['disabled']))
  );
}

/**
 * Check if value is valid form field props
 */
export function isFormFieldProps(value: unknown): value is {
  name: string;
  value?: unknown;
  onChange?: (value: unknown) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
} {
  return (
    isObject(value) &&
    'name' in value &&
    isString(value['name']) &&
    // value is optional and can be any type - no validation needed
    (!('onChange' in value) || isFunction(value['onChange'])) &&
    (!('onBlur' in value) || isFunction(value['onBlur'])) &&
    (!('error' in value) || isString(value['error'])) &&
    (!('required' in value) || isBoolean(value['required'])) &&
    (!('disabled' in value) || isBoolean(value['disabled']))
  );
}

/**
 * Check if value is valid button props
 */
export function isButtonProps(value: unknown): value is {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: string;
  size?: string;
  type?: 'button' | 'submit' | 'reset';
} {
  return (
    isObject(value) &&
    (!('onClick' in value) || isFunction(value['onClick'])) &&
    (!('disabled' in value) || isBoolean(value['disabled'])) &&
    (!('loading' in value) || isBoolean(value['loading'])) &&
    (!('variant' in value) || isString(value['variant'])) &&
    (!('size' in value) || isString(value['size'])) &&
    (!('type' in value) || isString(value['type']) && ['button', 'submit', 'reset'].includes(value['type']))
  );
}

/**
 * Check if value is valid modal props
 */
export function isModalProps(value: unknown): value is {
  opened: boolean;
  onClose: () => void;
  title?: string;
  size?: string;
  centered?: boolean;
} {
  return (
    isObject(value) &&
    'opened' in value &&
    isBoolean(value['opened']) &&
    'onClose' in value &&
    isFunction(value['onClose']) &&
    (!('title' in value) || isString(value['title'])) &&
    (!('size' in value) || isString(value['size'])) &&
    (!('centered' in value) || isBoolean(value['centered']))
  );
}

/**
 * Check if value is valid table props
 */
export function isTableProps(value: unknown): value is {
  data: unknown[];
  columns: Array<{
    key: string;
    title: string;
    render?: (value: unknown, record: unknown) => unknown;
  }>;
  loading?: boolean;
  pagination?: boolean;
} {
  return (
    isObject(value) &&
    'data' in value &&
    isArray(value['data']) &&
    'columns' in value &&
    isArray(value['columns']) &&
    value['columns'].every((column: unknown) =>
      isObject(column) &&
      'key' in column &&
      isString((column as Record<string, unknown>)['key']) &&
      'title' in column &&
      isString((column as Record<string, unknown>)['title']) &&
      (!('render' in column) || isFunction((column as Record<string, unknown>)['render']))
    ) &&
    (!('loading' in value) || isBoolean(value['loading'])) &&
    (!('pagination' in value) || isBoolean(value['pagination']))
  );
}

/**
 * Check if value is valid card props
 */
export function isCardProps(value: unknown): value is {
  title?: string;
  children?: unknown;
  shadow?: string;
  padding?: string;
  radius?: string;
} {
  return (
    isObject(value) &&
    (!('title' in value) || isString(value['title'])) &&
    // children is optional and can be any type - no validation needed
    (!('shadow' in value) || isString(value['shadow'])) &&
    (!('padding' in value) || isString(value['padding'])) &&
    (!('radius' in value) || isString(value['radius']))
  );
}

/**
 * Check if value is valid input props
 */
export function isInputProps(value: unknown): value is {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  required?: boolean;
} {
  return (
    isObject(value) &&
    (!('value' in value) || isString(value['value'])) &&
    (!('onChange' in value) || isFunction(value['onChange'])) &&
    (!('placeholder' in value) || isString(value['placeholder'])) &&
    (!('type' in value) || isString(value['type'])) &&
    (!('disabled' in value) || isBoolean(value['disabled'])) &&
    (!('required' in value) || isBoolean(value['required']))
  );
}