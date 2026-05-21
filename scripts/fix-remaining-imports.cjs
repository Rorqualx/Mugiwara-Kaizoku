#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

// Files with incorrect import paths
const importFixes = [
  { file: 'src/server/adapters/metadata/adapter-template.ts', correctPath: '../../../utils/status-mapper' },
  { file: 'src/server/adapters/metadata/unifiedParserAdapter.ts', correctPath: '../../../utils/status-mapper' },
  { file: 'src/server/parsers/core/DataNormalizer.ts', correctPath: '../../../utils/status-mapper' },
  { file: 'src/server/parsers/UnifiedMetadataParser.ts', correctPath: '../../utils/status-mapper' },
  { file: 'src/server/services/combined/combinedMetadataExtractor.ts', correctPath: '../../../utils/status-mapper' },
  { file: 'src/server/services/fandom/dataExtraction.ts', correctPath: '../../../utils/status-mapper' },
  { file: 'src/server/services/metadataMerger.ts', correctPath: '../../utils/status-mapper' },
  { file: 'src/server/services/notifications/notificationEventLogger.ts', correctPath: '../../../utils/status-mapper' },
];

// Fix import paths
importFixes.forEach(({file, correctPath}) => {
  const filePath = path.join(projectRoot, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix any wrong mapToMangaStatus import path
    content = content.replace(
      /import { mapToMangaStatus } from ['"].*?status-mapper['"]/g,
      `import { mapToMangaStatus } from '${correctPath}'`
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed import path in ${file}`);
  }
});

// Add missing import to PatternLibrary
const patternLibraryPath = path.join(projectRoot, 'src/server/parsers/patterns/PatternLibrary.ts');
if (fs.existsSync(patternLibraryPath)) {
  let content = fs.readFileSync(patternLibraryPath, 'utf8');
  
  if (!content.includes("import { mapToMangaStatus }")) {
    // Find the last import
    const lines = content.split('\n');
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) {
        lastImportIndex = i;
      }
      if (lines[i] === '' && lastImportIndex !== -1) {
        break;
      }
    }
    
    if (lastImportIndex !== -1) {
      lines.splice(lastImportIndex + 1, 0, "import { mapToMangaStatus } from '../../../utils/status-mapper';");
      content = lines.join('\n');
      fs.writeFileSync(patternLibraryPath, content, 'utf8');
      console.log(`✅ Added import to PatternLibrary.ts`);
    }
  }
}

// Fix useManga.ts - ChapterStatus type issue
const useMangaPath = path.join(projectRoot, 'src/hooks/useManga.ts');
if (fs.existsSync(useMangaPath)) {
  let content = fs.readFileSync(useMangaPath, 'utf8');
  
  // The function should return ChapterStatus, not use mapToMangaStatus which returns MangaPublicationStatus
  content = content.replace(
    /function mapChapterStatus\([^)]*\): ChapterStatus \{[\s\S]*?return mapToMangaStatus\([^)]*\)\s*\}/g,
    `function mapChapterStatus(status: string | undefined): ChapterStatus {
  if (!status) return ChapterStatus.PENDING;
  
  // Convert to uppercase for case-insensitive comparison
  const normalizedStatus = status.toUpperCase();
  
  // Map common status values to ChapterStatus enum values
  switch (normalizedStatus) {
    case 'COMPLETED':
    case 'DOWNLOADED':
    case 'DONE':
      return ChapterStatus.COMPLETED;
    case 'DOWNLOADING':
    case 'IN_PROGRESS':
      return ChapterStatus.DOWNLOADING;
    case 'ERROR':
    case 'FAILED':
      return ChapterStatus.ERROR;
    case 'DELETED':
      return ChapterStatus.DELETED;
    case 'AVAILABLE':
      return ChapterStatus.AVAILABLE;
    case 'PENDING':
    default:
      return ChapterStatus.PENDING;
  }
}`
  );
  
  fs.writeFileSync(useMangaPath, content, 'utf8');
  console.log(`✅ Fixed ChapterStatus mapping in useManga.ts`);
}

// Fix tasks/dashboard.tsx color issue
const dashboardPath = path.join(projectRoot, 'src/pages/tasks/dashboard.tsx');
if (fs.existsSync(dashboardPath)) {
  let content = fs.readFileSync(dashboardPath, 'utf8');
  
  // Find and fix the getTaskColor function
  content = content.replace(
    /const getTaskColor[^}]*mapToMangaStatus[^}]*\}/g,
    `const getTaskColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.PENDING: return 'gray';
      case TaskStatus.RUNNING: return 'blue';
      case TaskStatus.COMPLETED: return 'green';
      case TaskStatus.FAILED: return 'red';
      case TaskStatus.CANCELLED: return 'orange';
      default: return 'gray';
    }
  }`
  );
  
  fs.writeFileSync(dashboardPath, content, 'utf8');
  console.log(`✅ Fixed getTaskColor in tasks/dashboard.tsx`);
}

console.log('\n🎉 All remaining import and type issues fixed!');