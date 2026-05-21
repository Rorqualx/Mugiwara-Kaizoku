/**
 * A/B Testing Framework - Test Executor
 *
 * Executes tests using both rule-based parser and ML engine for comparison.
 *
 * Extracted from: ABTestingFramework.ts (lines 112-196)
 */

import type { PatternRecognitionEngine } from '@/server/parsers/pattern-recognition/core/PatternRecognitionEngine';
import type { RecognitionRequest } from '@/server/parsers/pattern-recognition/types';
import type { UnifiedMetadataParser } from '@/server/parsers/UnifiedMetadataParser';
import { logger } from '@/utils/logger';

import { handleError, type TestCase, type TestResult } from './types';

// ============================================================================
// Public API
// ============================================================================

/**
 * Execute test case with both parsers
 *
 * @param testCase - Test case to execute
 * @param ruleParser - Rule-based parser instance
 * @param mlEngine - ML pattern recognition engine instance
 * @param validateFn - Function to validate results against expected values
 * @param calculateAccuracyFn - Function to calculate accuracy score
 * @returns Results from both rule-based and ML-based tests
 */
export async function executeTest(
  testCase: TestCase,
  ruleParser: UnifiedMetadataParser,
  mlEngine: PatternRecognitionEngine,
  validateFn: (actual: Record<string, unknown>, expected?: unknown) => boolean,
  calculateAccuracyFn: (actual: unknown, expected?: unknown) => number
): Promise<{ ruleResult: TestResult; mlResult: TestResult }> {
  const ruleResult = await executeRuleBasedTest(testCase, ruleParser, validateFn, calculateAccuracyFn);
  const mlResult = await executeMLBasedTest(testCase, mlEngine, validateFn, calculateAccuracyFn);

  return { ruleResult, mlResult };
}

// ============================================================================
// Rule-Based Test Execution
// ============================================================================

/**
 * Execute test using rule-based parser
 *
 * @param testCase - Test case to execute
 * @param parser - Rule-based parser instance
 * @param validateFn - Function to validate results
 * @param calculateAccuracyFn - Function to calculate accuracy
 * @returns Test result with execution metrics
 */
export function executeRuleBasedTest(
  testCase: TestCase,
  parser: UnifiedMetadataParser,
  validateFn: (actual: Record<string, unknown>, expected?: unknown) => boolean,
  calculateAccuracyFn: (actual: unknown, expected?: unknown) => number
): Promise<TestResult> {
  const startTime = Date.now();
  let success = false;
  let extractedData: unknown = {};
  const errors: string[] = [];

  try {
    const result = parser.parseHTML(testCase.html);
    extractedData = result;
    success = validateFn(result as unknown as Record<string, unknown>, testCase.expectedResults);
  } catch (error: unknown) {
    const err = handleError(error);
    errors.push(err.message);
    logger.error('Rule-based test failed', {
      testId: testCase.id,
      error: err.message
    });
  }

  const executionTime = Date.now() - startTime;

  const result: TestResult = {
    testId: testCase.id,
    variant: 'rule',
    success,
    accuracy: success ? calculateAccuracyFn(extractedData, testCase.expectedResults) : 0,
    confidence: 1.0, // Rule-based always has 100% confidence
    executionTime,
    extractedData,
    ...(errors.length > 0 && { errors })
  };

  return Promise.resolve(result);
}

// ============================================================================
// ML-Based Test Execution
// ============================================================================

/**
 * Execute test using ML pattern recognition engine
 *
 * @param testCase - Test case to execute
 * @param engine - ML pattern recognition engine instance
 * @param validateFn - Function to validate results
 * @param calculateAccuracyFn - Function to calculate accuracy
 * @returns Test result with execution metrics and confidence scores
 */
export async function executeMLBasedTest(
  testCase: TestCase,
  engine: PatternRecognitionEngine,
  validateFn: (actual: Record<string, unknown>, expected?: unknown) => boolean,
  calculateAccuracyFn: (actual: unknown, expected?: unknown) => number
): Promise<TestResult> {
  const startTime = Date.now();
  let success = false;
  let extractedData: unknown = {};
  let confidence = 0;
  const errors: string[] = [];

  try {
    const request: RecognitionRequest = {
      html: testCase.html,
      // FIX: Line 170 - Use truthy check instead of !== null (fixes @typescript-eslint/no-unnecessary-condition)
      ...(testCase.url && { url: testCase.url }),
      options: {
        useCache: true,
        learnFromResult: true
      }
    };

    const result = await engine.recognize(request);
    extractedData = result.extractedData;
    confidence = result.confidence;
    success = result.success && validateFn(extractedData as unknown as Record<string, unknown>, testCase.expectedResults);
  } catch (error: unknown) {
    const err = handleError(error);
    errors.push(err.message);
    logger.error('ML-based test failed', {
      testId: testCase.id,
      error: err.message
    });
  }

  const executionTime = Date.now() - startTime;

  const result: TestResult = {
    testId: testCase.id,
    variant: 'ml',
    success,
    accuracy: success ? calculateAccuracyFn(extractedData, testCase.expectedResults) : 0,
    confidence,
    executionTime,
    extractedData,
    ...(errors.length > 0 && { errors })
  };

  return result;
}
