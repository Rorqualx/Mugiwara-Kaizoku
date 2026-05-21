/**
 * Pattern Evolution Utilities
 *
 * Shared helper functions used across all pattern evolution modules.
 * Provides weighted averaging, selector combining, and class extraction.
 *
 * Extracted from: PatternEvolutionManager.ts (lines 310-362)
 */

/**
 * Calculate weighted average of values
 * @param values - Array of value/weight pairs
 * @returns Weighted average, or 0 if total weight is 0
 */
export function weightedAverage(
  values: Array<{ value: number; weight: number }>
): number {
  const totalWeight = values.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight === 0) return 0;

  return values.reduce((sum, v) => sum + v.value * v.weight, 0) / totalWeight;
}

/**
 * Combine multiple CSS selectors into optimized selector
 * Finds common classes or returns comma-separated list
 * @param selectors - Array of CSS selectors
 * @returns Combined/optimized selector string
 */
export function combineSelectors(selectors: string[]): string {
  const unique = [...new Set(selectors)];
  const commonClasses = findCommonClasses(unique);
  if (commonClasses.length > 0) {
    return '.' + commonClasses.join('.');
  }
  return unique.join(', ');
}

/**
 * Extract common CSS classes from multiple selectors
 * @param selectors - Array of CSS selectors
 * @returns Array of class names common to all selectors
 */
export function findCommonClasses(selectors: string[]): string[] {
  if (selectors.length === 0) return [];

  // Extract classes from each selector
  const classSets = selectors.map(selector => {
    const matches = selector.match(/\.[\w-]+/g) ?? [];
    return new Set(matches.map(m => m.substring(1)));
  });

  const firstClassSet = classSets[0];
  if (!firstClassSet) return [];

  // Find intersection
  const common = new Set(firstClassSet);
  for (let i = 1; i < classSets.length; i++) {
    const classSet = classSets[i];
    if (!classSet) continue;
    for (const className of common) {
      if (!classSet.has(className)) {
        common.delete(className);
      }
    }
  }

  return Array.from(common);
}
