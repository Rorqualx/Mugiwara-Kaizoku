/**
 * Components Type Guards
 *
 * This module contains type guards for validating component prop type objects,
 * specifically for Mantine UI components and custom application components.
 *
 * @module ComponentsTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  GroupProps,
  StackProps,
  LoadingOverlayProps,
  TextProps,
  MantineCustomTheme,
  ActionBarProps,
  HomeActionBarProps,
  ProwlarrContextType,
  EventListItem,
  EventModalDetails
} from "@/types/components";

/**
 * Type guard for GroupProps
 * Validates that an object conforms to the GroupProps interface
 */
export function isGroupProps(obj: unknown): obj is GroupProps {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("position" in candidate) || "position" in candidate) &&
    (!("spacing" in candidate) || "spacing" in candidate) &&
    (!("align" in candidate) || typeof candidate["align"] === "string") &&
    (!("noWrap" in candidate) || typeof candidate["noWrap"] === "boolean") &&
    (!("grow" in candidate) || typeof candidate["grow"] === "boolean")
  );
}

/**
 * Type guard for StackProps
 * Validates that an object conforms to the StackProps interface
 */
export function isStackProps(obj: unknown): obj is StackProps {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("spacing" in candidate) || "spacing" in candidate) &&
    (!("align" in candidate) || typeof candidate["align"] === "string") &&
    (!("justify" in candidate) || "justify" in candidate)
  );
}

/**
 * Type guard for LoadingOverlayProps
 * Validates that an object conforms to the LoadingOverlayProps interface
 */
export function isLoadingOverlayProps(obj: unknown): obj is LoadingOverlayProps {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["visible"] === "boolean" &&
    (!("blur" in candidate) || typeof candidate["blur"] === "number")
  );
}

/**
 * Type guard for TextProps
 * Validates that an object conforms to the TextProps interface
 */
export function isTextProps(obj: unknown): obj is TextProps {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("size" in candidate) || typeof candidate["size"] === "string") &&
    (!("weight" in candidate) || "weight" in candidate) &&
    (!("color" in candidate) || typeof candidate["color"] === "string") &&
    (!("align" in candidate) || "align" in candidate) &&
    (!("lineClamp" in candidate) || typeof candidate["lineClamp"] === "number")
  );
}

/**
 * Type guard for MantineCustomTheme
 * Validates that an object conforms to the MantineCustomTheme interface
 */
export function isMantineCustomTheme(obj: unknown): obj is MantineCustomTheme {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["colorScheme"] === "string"
  );
}

/**
 * Type guard for ActionBarProps
 * Validates that an object conforms to the ActionBarProps interface
 */
export function isActionBarProps(obj: unknown): obj is ActionBarProps {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "children" in candidate
  );
}

/**
 * Type guard for HomeActionBarProps
 * Validates that an object conforms to the HomeActionBarProps interface
 */
export function isHomeActionBarProps(obj: unknown): obj is HomeActionBarProps {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "onRefresh" in candidate &&
    typeof candidate["refreshing"] === "boolean"
  );
}

/**
 * Type guard for ProwlarrContextType
 * Validates that an object conforms to the ProwlarrContextType interface
 */
export function isProwlarrContextType(obj: unknown): obj is ProwlarrContextType {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "api" in candidate &&
    typeof candidate["connectionStatus"] === "string" &&
    "testConnection" in candidate &&
    (!("error" in candidate) || typeof candidate["error"] === "string")
  );
}

/**
 * Type guard for EventListItem
 * Validates that an object conforms to the EventListItem interface
 */
export function isEventListItem(obj: unknown): obj is EventListItem {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["level"] === "string" &&
    typeof candidate["message"] === "string" &&
    "timestamp" in candidate &&
    (!("details" in candidate) || "details" in candidate) &&
    (!("raw" in candidate) || "raw" in candidate)
  );
}

/**
 * Type guard for EventModalDetails
 * Validates that an object conforms to the EventModalDetails interface
 */
export function isEventModalDetails(obj: unknown): obj is EventModalDetails {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("mangaTitle" in candidate) || typeof candidate["mangaTitle"] === "string") &&
    (!("chapterTitle" in candidate) || typeof candidate["chapterTitle"] === "string") &&
    (!("libraryName" in candidate) || typeof candidate["libraryName"] === "string") &&
    (!("jobType" in candidate) || typeof candidate["jobType"] === "string") &&
    (!("error" in candidate) || typeof candidate["error"] === "string") &&
    (!("stack" in candidate) || typeof candidate["stack"] === "string")
  );
}