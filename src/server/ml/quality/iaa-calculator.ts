/**
 * Inter-Annotator Agreement (IAA) Calculator
 *
 * Implements Krippendorff's alpha for measuring annotation consistency
 * between multiple annotators on NER/BIO tagging tasks.
 *
 * Target: alpha > 0.8 for production-quality training data
 *
 * @module ml/quality/iaa-calculator
 */

// ============================================================================
// Types
// ============================================================================

export interface IAAResult {
  alpha: number;
  qualityLevel: 'excellent' | 'good' | 'fair' | 'poor';
  observedDisagreement: number;
  expectedDisagreement: number;
  totalUnits: number;
  annotatorCount: number;
}

export interface EntityIAAResult {
  entityType: string;
  alpha: number;
  count: number;
}

export interface FullIAAReport {
  overall: IAAResult;
  byEntity: EntityIAAResult[];
  timestamp: number;
}

// ============================================================================
// Constants
// ============================================================================

const ALPHA_THRESHOLDS = {
  excellent: 0.8,
  good: 0.67,
  fair: 0.4,
};

// ============================================================================
// Helper Functions
// ============================================================================

function getQualityLevel(alpha: number): IAAResult['qualityLevel'] {
  if (alpha >= ALPHA_THRESHOLDS.excellent) return 'excellent';
  if (alpha >= ALPHA_THRESHOLDS.good) return 'good';
  if (alpha >= ALPHA_THRESHOLDS.fair) return 'fair';
  return 'poor';
}

function countCoincidences(annotations: string[][]): Map<string, Map<string, number>> {
  const coincidences = new Map<string, Map<string, number>>();
  const numUnits = annotations[0]?.length ?? 0;

  for (let u = 0; u < numUnits; u++) {
    const valuesAtUnit: string[] = [];
    for (const annotator of annotations) {
      const value = annotator[u];
      if (value !== undefined) valuesAtUnit.push(value);
    }

    const numPairs = valuesAtUnit.length;
    if (numPairs < 2) continue;

    for (let i = 0; i < valuesAtUnit.length; i++) {
      for (let j = i + 1; j < valuesAtUnit.length; j++) {
        const c = valuesAtUnit[i];
        const k = valuesAtUnit[j];
        if (c === undefined || k === undefined) continue;

        incrementCoincidence(coincidences, c, k);
        if (c !== k) incrementCoincidence(coincidences, k, c);
      }
    }
  }

  return coincidences;
}

function incrementCoincidence(
  matrix: Map<string, Map<string, number>>,
  row: string,
  col: string
): void {
  if (!matrix.has(row)) matrix.set(row, new Map());
  const rowMap = matrix.get(row);
  if (rowMap) {
    rowMap.set(col, (rowMap.get(col) ?? 0) + 1);
  }
}

function calculateMarginals(coincidences: Map<string, Map<string, number>>): Map<string, number> {
  const marginals = new Map<string, number>();

  for (const [category, rowMap] of coincidences) {
    let total = 0;
    for (const count of rowMap.values()) {
      total += count;
    }
    marginals.set(category, (marginals.get(category) ?? 0) + total);
  }

  return marginals;
}

// ============================================================================
// Main Calculator
// ============================================================================

/**
 * Calculate Krippendorff's alpha for multiple annotators
 *
 * @param annotations - Array of annotations per annotator, each is array of labels
 * @returns IAAResult with alpha coefficient and quality assessment
 */
export function calculateKrippendorffsAlpha(annotations: string[][]): IAAResult {
  if (annotations.length < 2) {
    return {
      alpha: 1.0,
      qualityLevel: 'excellent',
      observedDisagreement: 0,
      expectedDisagreement: 0,
      totalUnits: annotations[0]?.length ?? 0,
      annotatorCount: annotations.length,
    };
  }

  const numUnits = annotations[0]?.length ?? 0;
  if (numUnits === 0) {
    return {
      alpha: 1.0,
      qualityLevel: 'excellent',
      observedDisagreement: 0,
      expectedDisagreement: 0,
      totalUnits: 0,
      annotatorCount: annotations.length,
    };
  }

  const coincidences = countCoincidences(annotations);
  const marginals = calculateMarginals(coincidences);

  // Calculate observed disagreement
  let observedDisagreement = 0;
  let totalPairs = 0;

  for (const [c, rowMap] of coincidences) {
    for (const [k, count] of rowMap) {
      if (c !== k) observedDisagreement += count;
      totalPairs += count;
    }
  }

  if (totalPairs === 0) {
    return {
      alpha: 1.0,
      qualityLevel: 'excellent',
      observedDisagreement: 0,
      expectedDisagreement: 0,
      totalUnits: numUnits,
      annotatorCount: annotations.length,
    };
  }

  observedDisagreement /= totalPairs;

  // Calculate expected disagreement
  let totalMarginal = 0;
  for (const count of marginals.values()) {
    totalMarginal += count;
  }

  let expectedDisagreement = 0;
  const categories = Array.from(marginals.keys());

  for (let i = 0; i < categories.length; i++) {
    for (let j = i + 1; j < categories.length; j++) {
      const c = categories[i];
      const k = categories[j];
      if (c === undefined || k === undefined) continue;
      const nc = marginals.get(c) ?? 0;
      const nk = marginals.get(k) ?? 0;
      expectedDisagreement += 2 * nc * nk;
    }
  }

  if (totalMarginal > 1) {
    expectedDisagreement /= totalMarginal * (totalMarginal - 1);
  }

  // Calculate alpha
  let alpha = 1.0;
  if (expectedDisagreement > 0) {
    alpha = 1 - observedDisagreement / expectedDisagreement;
  }

  return {
    alpha,
    qualityLevel: getQualityLevel(alpha),
    observedDisagreement,
    expectedDisagreement,
    totalUnits: numUnits,
    annotatorCount: annotations.length,
  };
}

/**
 * Calculate IAA for each entity type separately
 *
 * @param annotations - Array of annotations per annotator
 * @returns Array of per-entity IAA results
 */
export function calculateEntityIAA(annotations: string[][]): EntityIAAResult[] {
  const entityTypes = new Set<string>();

  for (const annotator of annotations) {
    for (const label of annotator) {
      if (label !== 'O' && label.includes('-')) {
        const entity = label.split('-')[1];
        if (entity) entityTypes.add(entity);
      }
    }
  }

  const results: EntityIAAResult[] = [];

  for (const entityType of entityTypes) {
    const binaryAnnotations = annotations.map((annotator) =>
      annotator.map((label) => {
        if (label === 'O') return 'O';
        const parts = label.split('-');
        return parts[1] === entityType ? label : 'O';
      })
    );

    const result = calculateKrippendorffsAlpha(binaryAnnotations);
    const count = annotations[0]?.filter((l) => l.includes(`-${entityType}`)).length ?? 0;

    results.push({
      entityType,
      alpha: result.alpha,
      count,
    });
  }

  return results.sort((a, b) => b.count - a.count);
}

/**
 * Generate full IAA report
 */
export function generateIAAReport(annotations: string[][]): FullIAAReport {
  return {
    overall: calculateKrippendorffsAlpha(annotations),
    byEntity: calculateEntityIAA(annotations),
    timestamp: Date.now(),
  };
}
