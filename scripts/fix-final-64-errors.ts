#!/usr/bin/env tsx

/**
 * Manually fix the final 64 TypeScript errors
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.join(process.cwd(), 'src');

interface Fix {
  file: string;
  line: number;
  original: string;
  replacement: string;
}

const fixes: Fix[] = [
  // Fix assignment to conditional expressions (TS2364)
  {
    file: 'sdk/examples/advanced-features.ts',
    line: 55,
    original: '(error instanceof Error ? error.message : String(error)) = `[SDK] ${(error instanceof Error ? error.message : String(error))}`',
    replacement: 'error.message = `[SDK] ${error.message}`'
  },
  {
    file: 'server/queue/kapowarrHandlers.ts',
    line: 66,
    original: '(error instanceof Error ? error.code : String(error)) = TaskErrorCode.INVALID_STATE',
    replacement: 'error.code = TaskErrorCode.INVALID_STATE'
  },
  {
    file: 'server/queue/kapowarrHandlers.ts',
    line: 77,
    original: '(error instanceof Error ? error.code : String(error)) = TaskErrorCode.INVALID_STATE',
    replacement: 'error.code = TaskErrorCode.INVALID_STATE'
  },
  {
    file: 'server/queue/kapowarrHandlers.ts',
    line: 135,
    original: '(error instanceof Error ? error.code : String(error)) = TaskErrorCode.INVALID_STATE',
    replacement: 'error.code = TaskErrorCode.INVALID_STATE'
  },
  {
    file: 'server/queue/kapowarrHandlers.ts',
    line: 184,
    original: '(error instanceof Error ? error.code : String(error)) = TaskErrorCode.DOWNLOAD_FAILED',
    replacement: 'error.code = TaskErrorCode.DOWNLOAD_FAILED'
  },
  {
    file: 'server/queue/download.ts',
    line: 137,
    original: '(error instanceof Error ? error.code : String(error)) = TaskErrorCode.INVALID_STATE',
    replacement: 'error.code = TaskErrorCode.INVALID_STATE'
  },
  {
    file: 'server/api/adapters/BaseApiAdapter.ts',
    line: 148,
    original: '(error instanceof Error ? error.code : String(error)) = \'API_ERROR\'',
    replacement: '(error as any).code = \'API_ERROR\''
  },
  {
    file: 'server/queue/taskHandlers.ts',
    line: 97,
    original: '(error instanceof Error ? error.code : String(error)) = code',
    replacement: '(error as any).code = code'
  },
  {
    file: 'server/services/download/base.ts',
    line: 278,
    original: '(error instanceof Error ? error.code : String(error)) = \'ENOENT\'',
    replacement: '(error as any).code = \'ENOENT\''
  },
  {
    file: 'test/utils/mockHelpers.tsx',
    line: 196,
    original: '(error instanceof Error ? error.code : String(error)) = code',
    replacement: '(error as any).code = code'
  },
  {
    file: 'utils/api-response.ts',
    line: 64,
    original: '(error instanceof Error ? error.code : String(error)) = \'NETWORK_ERROR\'',
    replacement: '(error as any).code = \'NETWORK_ERROR\''
  },
  {
    file: 'utils/async-result.ts',
    line: 237,
    original: '(error instanceof Error ? error.code : String(error)) = \'ASYNC_ERROR\'',
    replacement: '(error as any).code = \'ASYNC_ERROR\''
  },

  // Fix undefined errorMessage variables (TS2304)
  {
    file: 'hooks/useTaskOperations.ts',
    line: 203,
    original: 'throw new Error(errorMessage)',
    replacement: 'throw new Error(\'Invalid function provided\')'
  },
  {
    file: 'server/index.ts',
    line: 113,
    original: 'logger.error(`Failed to connect to database: ${errorMessage}`)',
    replacement: 'logger.error(`Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`)'  
  },
  {
    file: 'server/index.ts',
    line: 488,
    original: 'logger.error(`Server initialization failed: ${errorMessage}`)',
    replacement: 'logger.error(`Server initialization failed: ${error instanceof Error ? error.message : String(error)}`)'  
  },
  {
    file: 'server/index.ts',
    line: 491,
    original: 'logger.error(`Fatal error during server startup: ${errorMessage}`)',
    replacement: 'logger.error(`Fatal error during server startup: ${error instanceof Error ? error.message : String(error)}`)'  
  },
  {
    file: 'server/queue/index.ts',
    line: 315,
    original: 'error: errorMessage',
    replacement: 'error: error instanceof Error ? error.message : String(error)'
  },
  {
    file: 'server/queue/index.ts',
    line: 316,
    original: 'logger.error(`Failed to process ${job.name}: ${errorMessage}`)',
    replacement: 'logger.error(`Failed to process ${job.name}: ${error instanceof Error ? error.message : String(error)}`)'  
  },
  {
    file: 'server/queue/index.ts',
    line: 347,
    original: 'logger.error(`Job ${job.id} failed after ${job.attemptsMade} attempts: ${errorMessage}`)',
    replacement: 'logger.error(`Job ${job.id} failed after ${job.attemptsMade} attempts: ${error instanceof Error ? error.message : String(error)}`)'  
  },
  {
    file: 'server/services/prowlarrClient.ts',
    line: 209,
    original: 'logger.error(`Prowlarr search failed: ${errorMessage}`)',
    replacement: 'logger.error(`Prowlarr search failed: ${error instanceof Error ? error.message : String(error)}`)'  
  },
  {
    file: 'server/services/suwayomi/service.ts',
    line: 588,
    original: 'logger.error(`Failed to fetch manga: ${errorMessage}`)',
    replacement: 'logger.error(`Failed to fetch manga: ${error instanceof Error ? error.message : String(error)}`)'  
  },
  {
    file: 'server/services/suwayomi/service.ts',
    line: 613,
    original: 'logger.error(`Failed to fetch chapters: ${errorMessage}`)',
    replacement: 'logger.error(`Failed to fetch chapters: ${error instanceof Error ? error.message : String(error)}`)'  
  },
];

function applyFixes() {
  console.log('🔍 Applying manual fixes for final 64 errors...\n');
  
  let fixedCount = 0;
  
  for (const fix of fixes) {
    const filePath = path.join(SRC_DIR, fix.file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${fix.file}`);
      continue;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    if (lines[fix.line - 1] && lines[fix.line - 1].includes(fix.original.substring(0, 20))) {
      lines[fix.line - 1] = lines[fix.line - 1].replace(fix.original, fix.replacement);
      fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
      console.log(`✅ Fixed: ${fix.file}:${fix.line}`);
      fixedCount++;
    } else {
      console.log(`⚠️  Pattern not found at ${fix.file}:${fix.line}`);
    }
  }
  
  console.log(`\n📊 Applied ${fixedCount} fixes`);
}

applyFixes();