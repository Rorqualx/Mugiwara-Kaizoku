#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

// Files with missing return statements where mapToMangaStatus should be returned
const filesToFix = [
  'src/components/addManga/components/utils/metadata-helpers.ts',
  'src/components/manga/ChapterDetailModal.tsx',
  'src/components/manga/MobileMangaHeader.tsx',
  'src/components/settings/kapowarr/KapowarrDownloads.tsx',
  'src/components/tasks/utils.ts',
  'src/hooks/useManga.ts',
  'src/pages/history.tsx',
  'src/pages/wanted/downloads.tsx',
  'src/server/adapters/metadata/adapter-template.ts',
  'src/server/adapters/metadata/unifiedParserAdapter.ts',
  'src/server/parsers/core/DataNormalizer.ts',
  'src/server/services/search/anilistProvider.ts',
  'src/utils/frontend/type-adapters.ts',
  'src/utils/status-direct.ts',
  'src/utils/task-validation.ts',
];

// Fix return statements
filesToFix.forEach(file => {
  const filePath = path.join(projectRoot, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix standalone mapToMangaStatus calls (not in if/switch statements)
    // Pattern: line with just mapToMangaStatus(something) without return
    content = content.replace(/^(\s+)mapToMangaStatus\(([^)]+)\)$/gm, (match, indent, args) => {
      modified = true;
      return `${indent}return mapToMangaStatus(${args})`;
    });
    
    // Fix void return type issues - functions ending with mapToMangaStatus
    content = content.replace(/^(\s+)mapToMangaStatus\(([^)]+)\)\s*\n\}/gm, (match, indent, args) => {
      modified = true;
      return `${indent}return mapToMangaStatus(${args})\n}`;
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed return statements in ${file}`);
    }
  }
});

// Fix specific complex cases
const specificFixes = [
  {
    file: 'src/components/tasks/ResponsiveTaskList.tsx',
    fixes: [
      {
        search: /const getTaskColor = \([^)]*\)[^{]*\{[^}]*mapToMangaStatus\([^)]+\)[^}]*\}/g,
        replace: (match) => {
          // This function should return a color, not call mapToMangaStatus
          return match.replace(/mapToMangaStatus\([^)]+\)/, 'return "gray"');
        }
      }
    ]
  },
  {
    file: 'src/components/tasks/TaskList.tsx',
    fixes: [
      {
        search: /const getTaskColor = \([^)]*\)[^{]*\{[^}]*mapToMangaStatus\([^)]+\)[^}]*\}/g,
        replace: (match) => {
          return match.replace(/mapToMangaStatus\([^)]+\)/, 'return "gray"');
        }
      }
    ]
  }
];

specificFixes.forEach(({file, fixes}) => {
  const filePath = path.join(projectRoot, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    fixes.forEach(fix => {
      if (fix.search.test(content)) {
        content = content.replace(fix.search, fix.replace);
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed specific issues in ${file}`);
    }
  }
});

console.log('\n🎉 Return statements fixed!');