#!/usr/bin/env npx tsx

import { logger } from '../src/utils/logger';

// Copy of the normalizeStatus function from UniversalImportWizard
function normalizeStatus(status: any): string | null {
    if (!status) return null;
    
    const statusStr = String(status).toUpperCase();
    
    // Skip API status values
    if (['SUCCESS', 'error', 'FAIL', 'FAILED', 'PENDING'].includes(statusStr)) {
        return null;
    }
    
    // Map common variations to standard values
    if (['ONGOING', 'PUBLISHING', 'RELEASING', 'ACTIVE'].includes(statusStr)) {
        return 'ONGOING';
    }
    if (['COMPLETED', 'FINISHED', 'COMPLETE', 'ENDED'].includes(statusStr)) {
        return 'COMPLETED';
    }
    if (['HIATUS', 'ON_HIATUS', 'PAUSED'].includes(statusStr)) {
        return 'HIATUS';
    }
    if (['CANCELLED', 'CANCELED', 'DISCONTINUED', 'DROPPED'].includes(statusStr)) {
        return 'CANCELLED';
    }
    // If it's "Unknown" or similar, return null to use defaults
    if (['UNKNOWN', 'N/A', 'TBD'].includes(statusStr)) {
        return null;
    }
    
    return status; // Return original if it doesn't match any pattern
}

// Test the normalization
const testCases = [
    { input: 'FINISHED', expected: 'COMPLETED' },
    { input: 'COMPLETE', expected: 'COMPLETED' },
    { input: 'COMPLETED', expected: 'COMPLETED' },
    { input: 'ONGOING', expected: 'ONGOING' },
    { input: 'PUBLISHING', expected: 'ONGOING' },
    { input: 'HIATUS', expected: 'HIATUS' },
    { input: 'ON_HIATUS', expected: 'HIATUS' },
    { input: 'CANCELLED', expected: 'CANCELLED' },
    { input: 'UNKNOWN', expected: null },
    { input: 'SUCCESS', expected: null },
    { input: null, expected: null },
    { input: undefined, expected: null },
];

logger.info('Testing status normalization...');

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
    const result = normalizeStatus(testCase.input);
    if (result === testCase.expected) {
        logger.info(`✅ PASS: "${testCase.input}" -> "${result}"`);
        passed++;
    } else {
        logger.error(`❌ FAIL: "${testCase.input}" -> "${result}" (expected: "${testCase.expected}")`);
        failed++;
    }
}

logger.info(`\nTest Results: ${passed} passed, ${failed} failed`);

// Test the auto-selection condition
logger.info('\n--- Testing auto-selection conditions ---');

const testAutoSelect = (currentStatus: string | null | undefined, newStatus: string | null) => {
    // This mimics the condition: status && (!prev.status || prev.status === 'UNKNOWN')
    const willUpdate = newStatus && (!currentStatus || currentStatus === 'UNKNOWN');
    return willUpdate;
};

const autoSelectTests = [
    { current: '', new: 'COMPLETED', shouldUpdate: true },
    { current: null, new: 'COMPLETED', shouldUpdate: true },
    { current: undefined, new: 'COMPLETED', shouldUpdate: true },
    { current: 'UNKNOWN', new: 'COMPLETED', shouldUpdate: true },
    { current: 'FINISHED', new: 'COMPLETED', shouldUpdate: false }, // This was the bug - already has value
    { current: 'COMPLETED', new: 'COMPLETED', shouldUpdate: false },
    { current: 'ONGOING', new: 'COMPLETED', shouldUpdate: false },
];

for (const test of autoSelectTests) {
    const willUpdate = testAutoSelect(test.current, test.new);
    const status = willUpdate === test.shouldUpdate ? '✅' : '❌';
    logger.info(`${status} Current: "${test.current}", New: "${test.new}" -> Will Update: ${willUpdate} (expected: ${test.shouldUpdate})`);
}

logger.info('\n--- Testing with real AniList data ---');

// Simulate what happens with Fire Force from AniList
const anilistData = {
    status: 'FINISHED',
    averageScore: 74,
    popularity: 48595,
    startDate: { year: 2015, month: 9, day: 23 },
    endDate: { year: 2022, month: 2, day: 22 },
    tags: ['Firefighters', 'Shounen', 'Supernatural'],
};

// Initial state (empty)
let currentStatus: string = '';

// Step 1: Initial metadata extraction (this was setting raw "FINISHED")
// BEFORE FIX: currentStatus = anilistData.status; // Sets to "FINISHED" 
// AFTER FIX: 
currentStatus = normalizeStatus(anilistData.status) || '';
logger.info(`Step 1 - Initial extraction: status = "${currentStatus}"`);

// Step 2: AniList-specific auto-selection
const normalizedStatus = normalizeStatus(anilistData.status);
const willAutoSelect = normalizedStatus && (!currentStatus || currentStatus === 'UNKNOWN');

logger.info(`Step 2 - Auto-selection check:`);
logger.info(`  - Raw status: "${anilistData.status}"`);
logger.info(`  - Normalized status: "${normalizedStatus}"`);
logger.info(`  - Current status: "${currentStatus}"`);
logger.info(`  - Will auto-select: ${willAutoSelect}`);

if (willAutoSelect) {
    currentStatus = normalizedStatus!;
    logger.info(`  ✅ Status auto-selected to: "${currentStatus}"`);
} else {
    logger.info(`  ❌ Status NOT auto-selected (already has value: "${currentStatus}")`);
}

process.exit(failed > 0 ? 1 : 0);