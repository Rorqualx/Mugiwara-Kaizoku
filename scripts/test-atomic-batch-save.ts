#!/usr/bin/env bun

/**
 * Test script for atomic batch save functionality
 *
 * This script tests the saveBatchToDatabase function directly,
 * bypassing tRPC authentication to verify the database layer works.
 *
 * Run with: bun run scripts/test-atomic-batch-save.ts
 */

import { ConfigScope, ConfigValueType } from '@prisma/client';
import { saveBatchToDatabase } from '@/server/services/config/config-persistence';
import type { ConfigMetadata } from '@/server/services/config/config-types';

// Helper function to stringify values
function stringifyValue(value: unknown, type: ConfigValueType): string {
  switch (type) {
    case ConfigValueType.STRING:
      return String(value);
    case ConfigValueType.NUMBER:
      return String(value);
    case ConfigValueType.BOOLEAN:
      return String(value);
    case ConfigValueType.OBJECT:
    case ConfigValueType.ARRAY:
    case ConfigValueType.JSON:
      return JSON.stringify(value);
    default:
      return String(value);
  }
}

// Helper to remove fields from object
function removeFieldsFromObject(obj: unknown, fieldsToRemove: string[]): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const result = { ...obj as Record<string, unknown> };
  for (const field of fieldsToRemove) {
    delete result[field];
  }
  return result;
}

async function main() {
  console.log('🚀 Testing atomic batch save functionality...');

  // Create test batch data
  const testBatch = [
    {
      key: 'test.batch.key1',
      value: 'test value 1',
      valueType: ConfigValueType.STRING,
      scope: ConfigScope.SYSTEM,
      metadata: {
        key: 'test.batch.key1',
        label: 'Test Batch Key 1',
        type: ConfigValueType.STRING,
        scope: ConfigScope.SYSTEM,
        category: 'Test'
      } as ConfigMetadata,
      stringifyValue,
      removeFieldsFromObject
    },
    {
      key: 'test.batch.key2',
      value: 42,
      valueType: ConfigValueType.NUMBER,
      scope: ConfigScope.SYSTEM,
      metadata: {
        key: 'test.batch.key2',
        label: 'Test Batch Key 2',
        type: ConfigValueType.NUMBER,
        scope: ConfigScope.SYSTEM,
        category: 'Test'
      } as ConfigMetadata,
      stringifyValue,
      removeFieldsFromObject
    },
    {
      key: 'test.batch.key3',
      value: true,
      valueType: ConfigValueType.BOOLEAN,
      scope: ConfigScope.SYSTEM,
      metadata: {
        key: 'test.batch.key3',
        label: 'Test Batch Key 3',
        type: ConfigValueType.BOOLEAN,
        scope: ConfigScope.SYSTEM,
        category: 'Test'
      } as ConfigMetadata,
      stringifyValue,
      removeFieldsFromObject
    }
  ];

  try {
    console.log('📦 Saving batch of 3 configuration entries...');
    await saveBatchToDatabase(testBatch);
    console.log('✅ Batch save completed successfully!');

    // Verify by checking the database
    console.log('🔍 Verifying entries were saved...');
    const { prisma } = await import('@/server/db');

    for (const item of testBatch) {
      const saved = await prisma.config.findUnique({
        where: { key: item.key }
      });

      if (saved) {
        console.log(`   ✓ ${item.key}: ${saved.value} (${saved.valueType})`);
      } else {
        console.log(`   ✗ ${item.key}: NOT FOUND`);
      }
    }

    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    for (const item of testBatch) {
      await prisma.config.deleteMany({
        where: { key: item.key }
      });
    }
    console.log('✅ Cleanup complete');

  } catch (error) {
    console.error('❌ Batch save failed:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);