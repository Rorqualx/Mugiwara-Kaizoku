/**
 * A/B Testing Framework - Result Validator
 *
 * Validates and compares test results for accuracy scoring.
 * Pure functions with no side effects for reliable test result validation.
 */

/**
 * Type guard to check if a value is an object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate results against expected values
 *
 * Performs deep comparison of actual results against expected values.
 * Returns true if all expected fields are present and match.
 *
 * @param actual - The actual result object to validate
 * @param expected - The expected result object (optional)
 * @returns True if validation passes, false otherwise
 */
export function validateResults(actual: Record<string, unknown>, expected?: unknown): boolean {
  if (!expected) return true; // No expectations, consider success
  if (!isRecord(expected)) return false;

  // Simple validation - check key fields exist
  for (const key in expected) {
    if (!(key in actual)) return false;

    // Deep comparison for objects
    if (typeof expected[key] === 'object' && typeof actual[key] === 'object') {
      if (!deepCompare(expected[key], actual[key])) return false;
    } else if (expected[key] !== actual[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Deep compare two objects for equality
 *
 * Recursively compares two objects to check if they are deeply equal.
 * Handles nested objects and arrays.
 *
 * @param obj1 - First object to compare
 * @param obj2 - Second object to compare
 * @returns True if objects are deeply equal, false otherwise
 */
export function deepCompare(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true;
  if (!obj1 || !obj2) return false;
  if (!isRecord(obj1) || !isRecord(obj2)) return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepCompare(obj1[key], obj2[key])) return false;
  }

  return true;
}

/**
 * Calculate accuracy score between actual and expected results
 *
 * Computes the percentage of fields that match between actual and expected.
 * Recursively checks nested objects.
 *
 * @param actual - The actual result to compare
 * @param expected - The expected result (optional)
 * @returns Accuracy score between 0 and 1 (1 = 100% match)
 */
export function calculateAccuracy(actual: unknown, expected?: unknown): number {
  if (!expected) return 1.0;
  if (!isRecord(actual) || !isRecord(expected)) return 0;

  let correctFields = 0;
  let totalFields = 0;

  const checkAccuracy = (act: Record<string, unknown>, exp: Record<string, unknown>): void => {
    for (const key in exp) {
      totalFields++;
      if (key in act) {
        const expValue = exp[key];
        const actValue = act[key];
        if (isRecord(expValue) && isRecord(actValue)) {
          checkAccuracy(actValue, expValue);
        } else if (expValue === actValue) {
          correctFields++;
        }
      }
    }
  };

  checkAccuracy(actual, expected);
  return totalFields > 0 ? correctFields / totalFields : 0;
}
