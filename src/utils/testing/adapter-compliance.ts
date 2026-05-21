/**
 * Adapter Compliance Testing Utilities
 *
 * This module provides utilities for testing if adapter implementations
 * correctly implement the required interfaces and follow established patterns.
 */
// import { logger } from '@/utils/logger';
import { createSuccessResult } from '../async-result';

import type { IntegrationAdapter, BaseIntegrationConfig } from '../integration-adapter';
import type { Chapter as ChapterEntity } from '@prisma/client';
/**
 * Error thrown when an adapter fails compliance checks
 */
export class AdapterComplianceError extends Error {
    constructor(adapterName: string, issue: string) {
        super(`Adapter "${adapterName}" compliance issue: ${issue}`);
        this["name"] = 'AdapterComplianceError';
    }
}
/**
 * Interface for adapter compliance verification options
 */
export interface AdapterComplianceOptions {
    /**
     * Whether to throw on failure (otherwise returns result object)
     */
    throwOnFailure?: boolean;
    /**
     * Skip checking specific methods
     */
    skipMethods?: string[];
    /**
     * Additional methods to check beyond the interface requirements
     */
    additionalMethods?: string[];
    /**
     * Check for AsyncResult pattern implementation
     */
    checkAsyncResult?: boolean;
    /**
     * Check configuration validation
     */
    checkConfigValidation?: boolean;
}
/**
 * Result of adapter compliance verification
 */
export interface AdapterComplianceResult {
    /**
     * Whether the adapter passed all checks
     */
    isCompliant: boolean;
    /**
     * List of compliance issues found
     */
    issues: string[];
    /**
     * Adapter name
     */
    adapterName: string;
}
/**
 * Required methods for all integration adapters
 */
const REQUIRED_ADAPTER_METHODS = [
    'isEnabled',
    'search',
    'getMangaById',
    'getMangaByTitle',
    'getChapters',
    'getStatus',
    'getSourceInfo',
    'configure',
    'getConfig',
    'dispose'
];
/**
 * Required AsyncResult pattern methods for all integration adapters
 */
const REQUIRED_ASYNC_RESULT_METHODS = [
    'searchAsync',
    'getMangaByIdAsync',
    'getMangaByTitleAsync',
    'getChaptersAsync',
    'getStatusAsync'
];
/**
 * Optional AsyncResult pattern methods for specialized adapters
 */
const OPTIONAL_ASYNC_RESULT_METHODS = [
    'searchMangaAsync',
    'updateMangaMetadataAsync',
    'updateAllMangaMetadataAsync'
];

/**
 * Safely extracts adapter name from an adapter instance
 */
function getAdapterName(adapter: { constructor: { name?: string } }): string {
  const constructorName = adapter.constructor.name;
  if (typeof constructorName === 'string' && constructorName.length > 0) {
    return constructorName;
  }

  const proto = Object.getPrototypeOf(adapter) as { constructor?: { name?: string } } | null;
  const protoName = proto?.constructor?.name;
  if (typeof protoName === 'string' && protoName.length > 0) {
    return protoName;
  }

  return 'Unknown';
}

/**
 * Checks if required methods exist on the adapter
 *
 * @param adapter - The adapter to check
 * @param methodsToCheck - Array of method names to verify
 * @param issues - Array to collect issues found
 */
function checkRequiredMethods(
    adapter: Record<string, unknown>,
    methodsToCheck: string[],
    issues: string[]
): void {
    for (const method of methodsToCheck) {
        if (typeof adapter[method] !== 'function') {
            issues.push(`Missing or non-function method: ${method}`);
        }
    }
}

/**
 * Validates AsyncResult pattern implementation on the adapter
 *
 * @param adapter - The adapter to check
 * @param skipMethods - Methods to skip during validation
 * @param issues - Array to collect issues found
 */
function checkAsyncResultMethods(
    adapter: Record<string, unknown>,
    skipMethods: string[],
    issues: string[]
): void {
    // Check required AsyncResult methods
    for (const method of REQUIRED_ASYNC_RESULT_METHODS) {
        if (!skipMethods.includes(method) && typeof adapter[method] !== 'function') {
            issues.push(`Missing required AsyncResult method: ${method}`);
        }
    }

    // Check for implementation of base methods with corresponding Async methods
    // This is for backward compatibility with older adapters
    const baseMethodsToCheck = ['search', 'getMangaById', 'getMangaByTitle', 'getStatus']
        .filter((method) => !skipMethods.includes(method))
        .filter((method) => typeof adapter[method] === 'function');

    for (const method of baseMethodsToCheck) {
        const asyncMethod = `${method}Async`;
        if (!skipMethods.includes(asyncMethod) && typeof adapter[asyncMethod] !== 'function') {
            issues.push(`Missing corresponding AsyncResult method: ${asyncMethod} for implemented base method: ${method}`);
        }
    }

    // Check optional AsyncResult methods - only if the base method is implemented
    for (const asyncMethod of OPTIONAL_ASYNC_RESULT_METHODS) {
        if (skipMethods.includes(asyncMethod))
            continue;
        // Get the base method name by removing 'Async' suffix
        const baseMethod = asyncMethod.replace('Async', '');
        // If base method exists but async version doesn't, report it
        if (typeof adapter[baseMethod] === 'function' &&
            typeof adapter[asyncMethod] !== 'function') {
            issues.push(`Missing corresponding AsyncResult method: ${asyncMethod} for implemented optional method: ${baseMethod}`);
        }
    }
}

/**
 * Tests configuration validation behavior
 *
 * @param adapter - The adapter to test
 * @param issues - Array to collect issues found
 */
function checkConfigurationValidation<T extends BaseIntegrationConfig>(
    adapter: IntegrationAdapter<T>,
    issues: string[]
): void {
    try {
        adapter.configure({});
    }
    catch (error: unknown) {
        if (error instanceof Error && (error instanceof Error ? error.message : String(error)).includes('Missing required configuration')) {
            // This is expected behavior when configuration validation is implemented
        }
        else {
            issues.push(`Configuration validation error: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
        }
    }
}

/**
 * Tests the search method of an adapter
 *
 * @param adapter - The adapter to test
 * @param searchQuery - Search query to use
 * @param issues - Array to collect issues found
 */
async function testSearchMethod<T extends BaseIntegrationConfig>(
    adapter: IntegrationAdapter<T>,
    searchQuery: string,
    issues: string[]
): Promise<void> {
    try {
        const searchResults = await adapter.search(searchQuery);
        if (!Array.isArray(searchResults)) {
            issues.push('search() should return an array');
        }
    }
    catch (error: unknown) {
        issues.push(`search() failed: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
    }
}

/**
 * Tests the getChapters method of an adapter
 *
 * @param adapter - The adapter to test
 * @param sampleId - Sample ID to use for testing
 * @param issues - Array to collect issues found
 */
async function testChaptersMethod<T extends BaseIntegrationConfig>(
    adapter: IntegrationAdapter<T>,
    sampleId: string,
    issues: string[]
): Promise<void> {
    try {
        const chapters = await adapter.getChapters(sampleId);
        if (!Array.isArray(chapters)) {
            issues.push('getChapters() should return an array');
        }
    }
    catch (error: unknown) {
        issues.push(`getChapters() failed: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
    }
}

/**
 * Tests a single AsyncResult method with appropriate parameters
 *
 * @param method - The method name being tested
 * @param methodFn - The method function to invoke
 * @param searchQuery - Sample search query for searchAsync
 * @param sampleId - Sample ID for getMangaById/Title/Chapters
 * @returns Array of issues found (empty if no issues)
 */
async function testSingleAsyncMethod(
    method: string,
    methodFn: (...args: unknown[]) => Promise<unknown>,
    searchQuery: string,
    sampleId: string
): Promise<string[]> {
    const issues: string[] = [];

    try {
        let result: unknown;

        // Call method with appropriate parameters
        if (method === 'searchAsync') {
            result = await methodFn(searchQuery);
        } else if (method === 'getMangaByIdAsync' || method === 'getMangaByTitleAsync') {
            result = await methodFn(sampleId);
        } else if (method === 'getChaptersAsync') {
            result = await methodFn(sampleId);
        } else {
            result = await methodFn();
        }

        // Verify AsyncResult structure
        const resultRecord = result as Record<string, unknown>;
        if (!result || typeof resultRecord["status"] !== 'string') {
            issues.push(`${method}() should return an AsyncResult object`);
        } else if (!['idle', 'loading', 'success', 'error'].includes(resultRecord["status"] as string)) {
            issues.push(`${method}() returned invalid AsyncResult status: ${String(resultRecord["status"])}`);
        } else if (resultRecord["status"] === 'success' && !('data' in resultRecord)) {
            issues.push(`${method}() success result should have data property`);
        } else if (resultRecord["status"] === 'error' && !('error' in resultRecord)) {
            issues.push(`${method}() error result should have error property`);
        }
    } catch (error: unknown) {
        issues.push(`${method}() failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return issues;
}

/**
 * Tests all required AsyncResult methods on an adapter in parallel
 *
 * @param adapter - The adapter to test
 * @param searchQuery - Search query to use
 * @param sampleId - Sample ID to use for testing
 * @param issues - Array to collect issues found
 */
async function testAsyncResultMethods(
    adapter: Record<string, unknown>,
    searchQuery: string,
    sampleId: string,
    issues: string[]
): Promise<void> {
    // Test all methods in parallel for better performance
    const testResults = await Promise.all(
        REQUIRED_ASYNC_RESULT_METHODS.map(async (method) => {
            if (typeof adapter[method] === 'function') {
                const methodFn = adapter[method] as (...args: unknown[]) => Promise<unknown>;
                return testSingleAsyncMethod(method, methodFn, searchQuery, sampleId);
            }
            return [`Required AsyncResult method ${method}() is not implemented`];
        })
    );

    // Flatten all issues from parallel tests into the issues array
    testResults.forEach(methodIssues => {
        issues.push(...methodIssues);
    });
}

/**
 * Tests the getStatus and getSourceInfo methods of an adapter
 *
 * @param adapter - The adapter to test
 * @param issues - Array to collect issues found
 */
async function testStatusAndInfo<T extends BaseIntegrationConfig>(
    adapter: IntegrationAdapter<T>,
    issues: string[]
): Promise<void> {
    // Test getStatus
    try {
        const status = await adapter.getStatus();
        if (typeof status !== 'object' || !('status' in status)) {
            issues.push('getStatus() should return an object with a status property');
        }
    }
    catch (error: unknown) {
        issues.push(`getStatus() failed: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
    }

    // Test getSourceInfo
    try {
        const info = adapter.getSourceInfo();
        if (typeof info !== 'object' || !('id' in info) || !('name' in info)) {
            issues.push('getSourceInfo() should return an object with id and name properties');
        }
    }
    catch (error: unknown) {
        issues.push(`getSourceInfo() failed: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
    }
}

/**
 * Tests configuration handling methods of an adapter
 *
 * @param adapter - The adapter to test
 * @param issues - Array to collect issues found
 */
function testConfiguration<T extends BaseIntegrationConfig>(
    adapter: IntegrationAdapter<T>,
    issues: string[]
): void {
    try {
        const config = adapter.getConfig();
        adapter.configure(config);
    }
    catch (error: unknown) {
        issues.push(`Configuration handling failed: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
    }
}
/**
 * Verifies that an adapter correctly implements the IntegrationAdapter interface
 *
 * @param adapter - The adapter to verify
 * @param options - Verification options
 * @returns Compliance verification result
 */
export function verifyAdapterCompliance<T extends BaseIntegrationConfig>(adapter: IntegrationAdapter<T>, options: AdapterComplianceOptions = {}): AdapterComplianceResult {
    const { throwOnFailure = false, skipMethods = [], additionalMethods = [], checkAsyncResult = true, checkConfigValidation = true } = options;
    // Get adapter name from constructor or prototype
    const adapterName = getAdapterName(adapter);
    const issues: string[] = [];

    // Check required methods
    const methodsToCheck = [
        ...REQUIRED_ADAPTER_METHODS.filter((method) => !skipMethods.includes(method)),
        ...additionalMethods
    ];
    checkRequiredMethods(adapter as unknown as Record<string, unknown>, methodsToCheck, issues);

    // Check AsyncResult pattern implementation
    if (checkAsyncResult) {
        checkAsyncResultMethods(adapter as unknown as Record<string, unknown>, skipMethods, issues);
    }

    // Check configuration validation
    if (checkConfigValidation) {
        checkConfigurationValidation(adapter, issues);
    }

    const result: AdapterComplianceResult = {
        isCompliant: issues.length === 0,
        issues,
        adapterName
    };
    if (throwOnFailure && !result.isCompliant) {
        const issuesMessage = issues.join('; ');
        throw new AdapterComplianceError(adapterName, issuesMessage);
    }
    return result;
}
/**
 * Tests an adapter with sample data to verify basic functionality
 *
 * @param adapter - The adapter to test
 * @param searchQuery - Sample search query to use
 * @param sampleId - Sample ID to use for getMangaById
 * @returns Promise resolving to compliance verification result
 */
export async function testAdapterFunctionality<T extends BaseIntegrationConfig>(adapter: IntegrationAdapter<T>, searchQuery: string = 'test', sampleId: string = '1'): Promise<AdapterComplianceResult> {
    const adapterName = getAdapterName(adapter);
    const issues: string[] = [];
    try {
        // Test search
        await testSearchMethod(adapter, searchQuery, issues);

        // Test getChapters
        await testChaptersMethod(adapter, sampleId, issues);

        // Test required AsyncResult methods
        await testAsyncResultMethods(adapter as unknown as Record<string, unknown>, searchQuery, sampleId, issues);

        // Test getStatus and getSourceInfo
        await testStatusAndInfo(adapter, issues);

        // Test configuration
        testConfiguration(adapter, issues);
    }
    catch (error: unknown) {
        issues.push(`Unexpected error during testing: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
    }
    return {
        isCompliant: issues.length === 0,
        issues,
        adapterName
    };
}
/**
 * Creates a mock adapter for testing that implements the IntegrationAdapter interface
 *
 * @param overrides - Method overrides
 * @returns Mock adapter
 */
export function createMockAdapter<T extends BaseIntegrationConfig = BaseIntegrationConfig>(overrides: Partial<IntegrationAdapter<T>> = {}): IntegrationAdapter<T> {
    const mockAdapter = {
        // Standard methods
        isEnabled: () => true,
        search: () => Promise.resolve([]),
        getMangaById: () => Promise.resolve({ id: '1', title: 'Mock Manga' }),
        getMangaByTitle: () => Promise.resolve({ id: '1', title: 'Mock Manga' }),
        getChapters: () => Promise.resolve([]),
        getStatus: () => Promise.resolve({ status: 'ok' as const, message: 'Mock adapter is working' }),
        // AsyncResult pattern methods
        searchAsync: () => Promise.resolve(createSuccessResult([])),
        getMangaByIdAsync: () => Promise.resolve(createSuccessResult({ id: '1', title: 'Mock Manga' })),
        getMangaByTitleAsync: () => Promise.resolve(createSuccessResult({ id: '1', title: 'Mock Manga' })),
        getChaptersAsync: () => Promise.resolve(createSuccessResult<ChapterEntity[], Error>([])),
        getStatusAsync: () => Promise.resolve(createSuccessResult({ status: 'ok' as const, message: 'Mock adapter is working' })),
        // Optional searchManga implementation
        searchManga: () => Promise.resolve([]),
        searchMangaAsync: () => Promise.resolve(createSuccessResult<unknown[], Error>([])),
        // Source info and configuration
        getSourceInfo: () => ({
            id: 'mock',
            name: 'Mock Adapter',
            url: 'https://example.com',
            supportedTypes: ['manga'],
            hasApiKey: false,
            requiresAuth: false,
            capabilities: {
                search: true,
                Metadata: true,
                volumeInfo: false,
                chapterInfo: false
            }
        }),
        configure: () => { },
        getConfig: () => ({ enabled: true }) as T,
        dispose: () => { },
        ...overrides
    };
    // Cast to ensure type compatibility with specific status string literals
    return mockAdapter as IntegrationAdapter<T>;
}
