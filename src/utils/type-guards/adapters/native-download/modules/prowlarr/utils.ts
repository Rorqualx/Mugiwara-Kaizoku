/**
 * Prowlarr Type Guard Utilities
 * 
 * Shared validation utilities for Prowlarr type guards to reduce complexity
 * and eliminate code duplication.
 * 
 * @module ProwlarrTypeGuardUtils
 * @category TypeGuards
 * @subcategory Kapowarr
 */

/**
 * Validates that an object is not null and is of type 'object'
 */
export function isValidObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === "object" && obj !== null;
}

/**
 * Validates that a property exists and is of the expected type
 */
export function hasPropertyType(
  obj: Record<string, unknown>,
  property: string,
  type: "string" | "number" | "boolean" | "object" | "array"
): boolean {
  if (!(property in obj)) {
    return false;
  }

  const value = obj[property];

  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return typeof value === "object" && value !== null;
    case "array":
      return Array.isArray(value);
    default:
      return false;
  }
}

/**
 * Validates that a property is optional (may not exist) but if it does, it must be of the expected type
 */
export function hasOptionalPropertyType(
  obj: Record<string, unknown>,
  property: string,
  type: "string" | "number" | "boolean" | "object" | "array"
): boolean {
  if (!(property in obj)) {
    return true; // Optional property is allowed to be missing
  }

  return hasPropertyType(obj, property, type);
}

/**
 * Validates that an array contains only elements of a specific type
 */
export function isArrayOfType(
  arr: unknown,
  elementType: "string" | "number" | "boolean"
): boolean {
  if (!Array.isArray(arr)) {
    return false;
  }

  return arr.every((element) => {
    switch (elementType) {
      case "string":
        return typeof element === "string";
      case "number":
        return typeof element === "number";
      case "boolean":
        return typeof element === "boolean";
      default:
        return false;
    }
  });
}

/**
 * Validates that an object has all required properties of the correct types
 */
export function hasRequiredProperties(
  obj: Record<string, unknown>,
  requiredProps: Record<string, "string" | "number" | "boolean" | "object" | "array">
): boolean {
  return Object.entries(requiredProps).every(([prop, type]) =>
    hasPropertyType(obj, prop, type)
  );
}

/**
 * Validates that an object has optional properties of the correct types when present
 */
export function hasOptionalProperties(
  obj: Record<string, unknown>,
  optionalProps: Record<string, "string" | "number" | "boolean" | "object" | "array">
): boolean {
  return Object.entries(optionalProps).every(([prop, type]) =>
    hasOptionalPropertyType(obj, prop, type)
  );
}

/**
 * Validates that an object has a specific method (function property)
 */
export function hasMethod(obj: Record<string, unknown>, methodName: string): boolean {
  return methodName in obj && typeof obj[methodName] === "function";
}

/**
 * Validates that an object has multiple methods
 */
export function hasMethods(obj: Record<string, unknown>, methodNames: string[]): boolean {
  return methodNames.every((methodName) => hasMethod(obj, methodName));
}
