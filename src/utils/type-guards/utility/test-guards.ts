/**
 * Test Type Guards
 *
 * Type guards for testing utilities and test data
 */

import { isString, isNumber, isBoolean, isObject, isArray, isFunction } from '../index';

/**
 * Check if value is a valid test case
 */
export function isTestCase(value: unknown): value is {
  name: string;
  description?: string;
  setup?: () => Promise<void>;
  test: () => Promise<void>;
  teardown?: () => Promise<void>;
  timeout?: number;
} {
  return (
    isObject(value) &&
    'name' in value &&
    isString(value['name']) &&
    (!('description' in value) || isString(value['description'])) &&
    (!('setup' in value) || isFunction(value['setup'])) &&
    'test' in value &&
    isFunction(value['test']) &&
    (!('teardown' in value) || isFunction(value['teardown'])) &&
    (!('timeout' in value) || isNumber(value['timeout']))
  );
}

/**
 * Check if value is a valid test suite
 */
export function isTestSuite(value: unknown): value is {
  name: string;
  description?: string;
  tests: unknown[];
  beforeAll?: () => Promise<void>;
  afterAll?: () => Promise<void>;
  beforeEach?: () => Promise<void>;
  afterEach?: () => Promise<void>;
} {
  return (
    isObject(value) &&
    'name' in value &&
    isString(value['name']) &&
    (!('description' in value) || isString(value['description'])) &&
    'tests' in value &&
    isArray(value['tests']) &&
    (!('beforeAll' in value) || isFunction(value['beforeAll'])) &&
    (!('afterAll' in value) || isFunction(value['afterAll'])) &&
    (!('beforeEach' in value) || isFunction(value['beforeEach'])) &&
    (!('afterEach' in value) || isFunction(value['afterEach']))
  );
}

/**
 * Check if value is a valid test result
 */
export function isTestResult(value: unknown): value is {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
  timestamp: string;
} {
  return (
    isObject(value) &&
    'name' in value &&
    isString(value['name']) &&
    'passed' in value &&
    isBoolean(value['passed']) &&
    (!('error' in value) || isString(value['error'])) &&
    'duration' in value &&
    isNumber(value['duration']) &&
    'timestamp' in value &&
    isString(value['timestamp'])
  );
}

/**
 * Check if value is a valid test mock
 */
export function isTestMock(value: unknown): value is {
  name: string;
  implementation: Function;
  calls: unknown[][];
  results: unknown[];
} {
  return (
    isObject(value) &&
    'name' in value &&
    isString(value['name']) &&
    'implementation' in value &&
    isFunction(value['implementation']) &&
    'calls' in value &&
    isArray(value['calls']) &&
    'results' in value &&
    isArray(value['results'])
  );
}

/**
 * Check if value is a valid test spy
 */
export function isTestSpy(value: unknown): value is {
  name: string;
  target: Function;
  calls: unknown[][];
  results: unknown[];
} {
  return (
    isObject(value) &&
    'name' in value &&
    isString(value['name']) &&
    'target' in value &&
    isFunction(value['target']) &&
    'calls' in value &&
    isArray(value['calls']) &&
    'results' in value &&
    isArray(value['results'])
  );
}

/**
 * Check if value is a valid test fixture
 */
export function isTestFixture(value: unknown): value is {
  name: string;
  data: Record<string, unknown>;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
} {
  return (
    isObject(value) &&
    'name' in value &&
    isString(value['name']) &&
    'data' in value &&
    isObject(value['data']) &&
    (!('setup' in value) || isFunction(value['setup'])) &&
    (!('teardown' in value) || isFunction(value['teardown']))
  );
}

/**
 * Check if value is a valid test assertion
 */
export function isTestAssertion(value: unknown): value is {
  actual: unknown;
  expected: unknown;
  operator: string;
  message?: string;
} {
  return (
    isObject(value) &&
    'actual' in value &&
    'expected' in value &&
    'operator' in value &&
    isString(value['operator']) &&
    (!('message' in value) || isString(value['message']))
  );
}

/**
 * Check if value is a valid test configuration
 */
export function isTestConfig(value: unknown): value is {
  timeout: number;
  bail?: boolean;
  verbose?: boolean;
  parallel?: boolean;
  maxWorkers?: number;
} {
  return (
    isObject(value) &&
    'timeout' in value &&
    isNumber(value['timeout']) &&
    (!('bail' in value) || isBoolean(value['bail'])) &&
    (!('verbose' in value) || isBoolean(value['verbose'])) &&
    (!('parallel' in value) || isBoolean(value['parallel'])) &&
    (!('maxWorkers' in value) || isNumber(value['maxWorkers']))
  );
}

/**
 * Check if value is a valid test coverage report
 */
export function isTestCoverageReport(value: unknown): value is {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  timestamp: string;
} {
  return (
    isObject(value) &&
    'statements' in value &&
    isNumber(value['statements']) &&
    'branches' in value &&
    isNumber(value['branches']) &&
    'functions' in value &&
    isNumber(value['functions']) &&
    'lines' in value &&
    isNumber(value['lines']) &&
    'timestamp' in value &&
    isString(value['timestamp'])
  );
}

/**
 * Check if value is a valid test performance data
 */
export function isTestPerformanceData(value: unknown): value is {
  name: string;
  duration: number;
  memory?: number;
  cpu?: number;
  timestamp: string;
} {
  return (
    isObject(value) &&
    'name' in value &&
    isString(value['name']) &&
    'duration' in value &&
    isNumber(value['duration']) &&
    (!('memory' in value) || isNumber(value['memory'])) &&
    (!('cpu' in value) || isNumber(value['cpu'])) &&
    'timestamp' in value &&
    isString(value['timestamp'])
  );
}