/**
 * Component Types Type Guards
 *
 * This module contains type guards for validating component prop type objects,
 * ensuring type safety for React component properties.
 *
 * @module ComponentTypesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  BaseProps,
  LayoutProps,
  FormFieldProps,
  ButtonProps,
  ModalProps,
  CardProps,
  LoadingState,
  WithLoadingProps
} from "@/types/component-types";

import {
  isValidObject,
  validateOptionalProperty,
  validateRequiredProperty,
  validatePropertyExists,
  validateFunctionProperty
} from "./component-validation-utils";

/**
 * Type guard for BaseProps
 * Validates that an object conforms to the BaseProps interface
 */
export function isBaseProps(obj: unknown): obj is BaseProps {
  if (!isValidObject(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateOptionalProperty(candidate, "className", "string") &&
    validateOptionalProperty(candidate, "id", "string") &&
    validateOptionalProperty(candidate, "style", "any")
  );
}

/**
 * Type guard for LayoutProps
 * Validates that an object conforms to the LayoutProps interface
 */
export function isLayoutProps(obj: unknown): obj is LayoutProps {
  if (!isValidObject(obj)) {
    return false;
  }

  return validatePropertyExists(obj as Record<string, unknown>, "children");
}

/**
 * Type guard for FormFieldProps
 * Validates that an object conforms to the FormFieldProps interface
 */
export function isFormFieldProps(obj: unknown): obj is FormFieldProps {
  if (!isValidObject(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateOptionalProperty(candidate, "name", "string") &&
    validateOptionalProperty(candidate, "label", "string") &&
    validateOptionalProperty(candidate, "error", "string") &&
    validateOptionalProperty(candidate, "required", "boolean") &&
    validateOptionalProperty(candidate, "disabled", "boolean") &&
    validateFunctionProperty(candidate, "onChange") &&
    validateFunctionProperty(candidate, "onBlur")
  );
}

/**
 * Type guard for ButtonProps
 * Validates that an object conforms to the ButtonProps interface
 */
export function isButtonProps(obj: unknown): obj is ButtonProps {
  if (!isValidObject(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateOptionalProperty(candidate, "type", "any") &&
    validateOptionalProperty(candidate, "variant", "string") &&
    validateOptionalProperty(candidate, "size", "any") &&
    validateOptionalProperty(candidate, "color", "string") &&
    validateOptionalProperty(candidate, "loading", "boolean") &&
    validateOptionalProperty(candidate, "disabled", "boolean") &&
    validateFunctionProperty(candidate, "onClick") &&
    validateOptionalProperty(candidate, "leftIcon", "any") &&
    validateOptionalProperty(candidate, "rightIcon", "any") &&
    validatePropertyExists(candidate, "children")
  );
}

/**
 * Type guard for ModalProps
 * Validates that an object conforms to the ModalProps interface
 */
export function isModalProps(obj: unknown): obj is ModalProps {
  if (!isValidObject(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateRequiredProperty(candidate, "isOpen", "boolean") &&
    validateFunctionProperty(candidate, "onClose") &&
    validateOptionalProperty(candidate, "title", "string") &&
    validateOptionalProperty(candidate, "size", "any") &&
    validatePropertyExists(candidate, "children")
  );
}

/**
 * Type guard for CardProps
 * Validates that an object conforms to the CardProps interface
 */
export function isCardProps(obj: unknown): obj is CardProps {
  if (!isValidObject(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateOptionalProperty(candidate, "title", "string") &&
    validateOptionalProperty(candidate, "shadow", "any") &&
    validateOptionalProperty(candidate, "radius", "any") &&
    validateOptionalProperty(candidate, "padding", "any") &&
    validateOptionalProperty(candidate, "withBorder", "boolean") &&
    validatePropertyExists(candidate, "children")
  );
}

/**
 * Type guard for LoadingState
 * Validates that an object conforms to the LoadingState interface
 */
export function isLoadingState(obj: unknown): obj is LoadingState {
  if (!isValidObject(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateRequiredProperty(candidate, "isLoading", "boolean") &&
    validateRequiredProperty(candidate, "isError", "boolean") &&
    validateOptionalProperty(candidate, "error", "any")
  );
}

/**
 * Type guard for WithLoadingProps
 * Validates that an object conforms to the WithLoadingProps interface
 */
export function isWithLoadingProps(obj: unknown): obj is WithLoadingProps {
  if (!isValidObject(obj)) {
    return false;
  }

  return validatePropertyExists(obj as Record<string, unknown>, "children");
}
