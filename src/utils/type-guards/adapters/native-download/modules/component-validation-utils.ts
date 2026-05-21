/**
 * Component Validation Utilities
 * 
 * Shared validation functions for component type guards to reduce complexity
 * and eliminate code duplication.
 * 
 * @module ComponentValidationUtils
 * @category TypeGuards
 * @subcategory Kapowarr
 */

/**
 * Validates that an object is a non-null object
 */
export function isValidObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === "object" && obj !== null;
}

/**
 * Validates an optional property with type checking
 */
export function validateOptionalProperty(
  candidate: Record<string, unknown>,
  property: string,
  type: "string" | "boolean" | "function" | "object" | "any"
): boolean {
  if (!(property in candidate)) {
    return true; // Optional property is valid if not present
  }

  const value = candidate[property];
  
  switch (type) {
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "function":
      return typeof value === "function";
    case "object":
      return typeof value === "object" && value !== null;
    case "any":
      return true; // Any type is valid
    default:
      return false;
  }
}

/**
 * Validates a required property with type checking
 */
export function validateRequiredProperty(
  candidate: Record<string, unknown>,
  property: string,
  type: "string" | "boolean" | "function" | "object" | "any"
): boolean {
  if (!(property in candidate)) {
    return false; // Required property must be present
  }

  return validateOptionalProperty(candidate, property, type);
}

/**
 * Validates that a property exists (without type checking)
 */
export function validatePropertyExists(
  candidate: Record<string, unknown>,
  property: string
): boolean {
  return property in candidate;
}

/**
 * Validates a function property (checks existence only)
 */
export function validateFunctionProperty(
  candidate: Record<string, unknown>,
  property: string
): boolean {
  return validatePropertyExists(candidate, property);
}

/**
 * Validates a string property
 */
export function validateStringProperty(
  candidate: Record<string, unknown>,
  property: string,
  required: boolean = false
): boolean {
  return required
    ? validateRequiredProperty(candidate, property, "string")
    : validateOptionalProperty(candidate, property, "string");
}

/**
 * Validates a boolean property
 */
export function validateBooleanProperty(
  candidate: Record<string, unknown>,
  property: string,
  required: boolean = false
): boolean {
  return required
    ? validateRequiredProperty(candidate, property, "boolean")
    : validateOptionalProperty(candidate, property, "boolean");
}

/**
 * Creates a type guard function with common validation patterns
 */
export function createTypeGuard<T>(
  requiredProps: Array<{ property: string; type: "string" | "boolean" | "function" | "object" | "any" }>,
  optionalProps: Array<{ property: string; type: "string" | "boolean" | "function" | "object" | "any" }> = []
): (obj: unknown) => obj is T {
  return (obj: unknown): obj is T => {
    if (!isValidObject(obj)) {
      return false;
    }

    const candidate = obj as Record<string, unknown>;

    // Validate all required properties
    for (const { property, type } of requiredProps) {
      if (!validateRequiredProperty(candidate, property, type)) {
        return false;
      }
    }

    // Validate all optional properties
    for (const { property, type } of optionalProps) {
      if (!validateOptionalProperty(candidate, property, type)) {
        return false;
      }
    }

    return true;
  };
}
