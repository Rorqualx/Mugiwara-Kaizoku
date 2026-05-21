/**
 * Component Types
 * 
 * This module provides standardized type definitions for React components
 * to ensure consistent typing throughout the application.
 */

import type { ReactNode, ReactElement, ElementType, ComponentPropsWithoutRef} from 'react';

/**
 * React Children type that accepts any valid ReactNode
 */
export type ReactChildren = ReactNode;

/**
 * Base props interface that can be extended by other components
 * with common properties like className
 */
export interface BaseProps {
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}

/**
 * Component props with children
 */
export type PropsWithChildren<P = Record<string, unknown>> = P & {
  children?: ReactChildren;
};

/**
 * Enhanced component props type that adds specific HTML element attributes
 */
export type ComponentPropsWithAs<
  C extends ElementType,
  P = Record<string, unknown>> =
P &
Omit<ComponentPropsWithoutRef<C>, 'as' | keyof P> & {
  as?: C;
};

/**
 * Type for polymorphic components that can render as different elements
 */
export type PolymorphicComponentProps<
  C extends ElementType,
  P = Record<string, unknown>> =
ComponentPropsWithAs<C, PropsWithChildren<P>>;

/**
 * Type for layout components with children
 */
export interface LayoutProps extends BaseProps {
  children: ReactNode;
}

/**
 * Type for form field components with common form properties
 */
export interface FormFieldProps extends BaseProps {
  name?: string;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  onChange?: (value: unknown) => void;
  onBlur?: (event: React.FocusEvent) => void;
}

/**
 * Type for button components with common button properties
 */
export interface ButtonProps extends BaseProps {
  type?: 'button' | 'submit' | 'reset';
  variant?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  loading?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  leftIcon?: ReactElement;
  rightIcon?: ReactElement;
  children: ReactNode;
}

/**
 * Type for modal components with common modal properties
 */
export interface ModalProps extends BaseProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: ReactNode;
}

/**
 * Type for card components with common card properties
 */
export interface CardProps extends BaseProps {
  title?: string;
  shadow?: boolean | 'sm' | 'md' | 'lg' | 'xl';
  radius?: number | 'sm' | 'md' | 'lg' | 'xl';
  padding?: number | 'sm' | 'md' | 'lg' | 'xl';
  withBorder?: boolean;
  children: ReactNode;
}

/**
 * Type for event handlers with proper typing
 */
export type EventHandler<T extends React.SyntheticEvent> = (event: T) => void;
export type ChangeEventHandler = EventHandler<React.ChangeEvent<HTMLInputElement>>;
export type KeyboardEventHandler = EventHandler<React.KeyboardEvent>;
export type MouseEventHandler = EventHandler<React.MouseEvent>;
export type FocusEventHandler = EventHandler<React.FocusEvent>;

/**
 * Type for data loading states
 */
export interface LoadingState {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
}

/**
 * Type for components with loading states
 */
export interface WithLoadingProps extends LoadingState {
  children: ReactNode;
}

/**
 * Helper function to check if an error has a specific property
 */
export function errorHasProperty<K extends string>(
error: unknown,
key: K)
: error is Record<K, unknown> {
  return (
    typeof error === 'object' &&
    error !== null &&
    key in error);

}

/**
 * Helper function to extract error message from any error type
 */
export function getComponentErrorMessage(error: unknown): string {
  if (!error) return 'An unknown error occurred';

  // Handle Error objects
  if (error instanceof Error) {
    return (error instanceof Error ? error.message : String(error));
  }

  // Handle objects with message property
  if (errorHasProperty(error, 'message') && typeof error['message'] === 'string') {
    return error['message'];
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Fallback: convert the error to string
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}