#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

// Fix tRPC mutations - they use isPending not isLoading
const mutationFiles = [
  'src/components/calendar/CalendarEventModal.tsx',
  'src/components/calendar/ManualScheduleOverrideForm.tsx',
  'src/components/calendar/ReleaseScheduleOverride.tsx',
  'src/components/calendarActionBar.tsx',
  'src/components/events/EventsPanel.tsx',
  'src/components/fandom/FandomImportWizard.tsx',
  'src/components/library/BulkActionsModal.tsx',
  'src/components/library/CreateLibraryModal.tsx',
  'src/components/library/DownloadManagerModal.tsx',
  'src/components/libraryActionBar.tsx',
  'src/components/manga/AutoDownloadModal.tsx',
  'src/components/manga/BulkDownloadModal.tsx',
  'src/components/manga/ChapterDetailModal.tsx',
  'src/components/manga/CoverSelectorModal.tsx',
  'src/components/manga/DownloadOptionsModal.tsx',
  'src/components/manga/PackSearchModal.tsx',
  'src/components/manga/ReleaseScheduleCard.tsx',
  'src/components/manga/UnifiedDownloadButton.tsx',
  'src/components/manga/VolumeDetailModal.tsx',
  'src/components/metadata/ConflictResolutionModal.tsx',
  'src/components/search/SearchForm.tsx',
  'src/components/settings/FieldProviderPreferences.tsx',
  'src/components/settings/MetadataConflictResolver.tsx',
  'src/components/updateManga.tsx',
  'src/pages/calendar-enhanced.tsx',
  'src/pages/library/[id].tsx',
  'src/pages/library/[id]-enhanced.tsx',
  'src/pages/manga/[id].tsx',
  'src/pages/settings/download-clients.tsx',
  'src/pages/settings/integrations/komga.tsx',
  'src/pages/settings/integrations/notifications.tsx',
  'src/pages/settings/integrations/prowlarr.tsx',
  'src/pages/settings/search-providers.tsx',
  'src/pages/tasks/dashboard.tsx',
  'src/pages/wanted/missing.tsx'
];

function revertMutationLoading(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  const code = fs.readFileSync(filePath, 'utf8');
  
  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    let modified = false;

    traverse(ast, {
      MemberExpression(nodePath) {
        // Look for mutation.isLoading and change back to mutation.isPending
        if (
          t.isIdentifier(nodePath.node.property, { name: 'isLoading' }) &&
          nodePath.node.object &&
          (
            // Direct mutation object
            (t.isIdentifier(nodePath.node.object) && nodePath.node.object.name.includes('utation')) ||
            // Nested mutation calls
            (t.isMemberExpression(nodePath.node.object) && 
             t.isIdentifier(nodePath.node.object.property) && 
             (nodePath.node.object.property.name === 'mutate' || 
              nodePath.node.object.property.name === 'mutateAsync'))
          )
        ) {
          nodePath.node.property.name = 'isPending';
          modified = true;
        }
      }
    });

    if (modified) {
      const output = generate(ast, {}, code);
      fs.writeFileSync(filePath, output.code);
      console.log(`✓ Fixed mutations in ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

// Fix specific revert cases
function revertSpecificProperties(filePath, shouldRevert) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  const code = fs.readFileSync(filePath, 'utf8');
  
  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    let modified = false;

    traverse(ast, {
      ObjectProperty(nodePath) {
        // If this is an isLoading property that should be loading
        if (
          t.isIdentifier(nodePath.node.key, { name: 'isLoading' }) &&
          shouldRevert
        ) {
          nodePath.node.key.name = 'loading';
          modified = true;
        }
      }
    });

    if (modified) {
      const output = generate(ast, {}, code);
      fs.writeFileSync(filePath, output.code);
      console.log(`✓ Reverted properties in ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

// Fix task pages - isPending variables
function fixTaskPages() {
  const taskFiles = [
    'src/pages/tasks/active.tsx',
    'src/pages/tasks/completed.tsx',
    'src/pages/tasks/failed.tsx',
    'src/pages/tasks/out-of-sync.tsx',
    'src/pages/tasks/queued.tsx',
    'src/pages/tasks/scheduled.tsx'
  ];

  taskFiles.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }

    let code = fs.readFileSync(filePath, 'utf8');
    
    // Simple text replacement for these specific errors
    code = code.replace(/\bisPending\b/g, 'isPending');
    code = code.replace(/\bisLoading\b(?!:)/g, 'isPending');
    
    fs.writeFileSync(filePath, code);
    console.log(`✓ Fixed task page ${filePath}`);
  });
}

// Fix test files
function fixTestFiles() {
  const testFiles = [
    'src/test/setup.ts',
    'src/test/utils/mockComponents.tsx'
  ];

  testFiles.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }

    let code = fs.readFileSync(filePath, 'utf8');
    
    // Simple text replacement for test files to avoid AST issues
    if (filePath.includes('setup.ts')) {
      // These should reference _loading variable
      code = code.replace(/(\s)isLoading(\s|;|,|\))/g, '$1_loading$2');
    } else if (filePath.includes('mockComponents.tsx')) {
      // These should be 'loading' variable
      code = code.replace(/(\s)isLoading(\s|;|,|\)|\.)/g, '$1loading$2');
    }
    
    fs.writeFileSync(filePath, code);
    console.log(`✓ Fixed test file ${filePath}`);
  });
}

console.log('Fixing migration errors...\n');

// 1. Fix tRPC mutations
console.log('Fixing tRPC mutations...');
mutationFiles.forEach(file => {
  revertMutationLoading(file);
});

// 2. Fix specific reverts
console.log('\nReverting specific properties...');
revertSpecificProperties('src/components/addManga/steps/searchStep.tsx', true);
revertSpecificProperties('src/components/addManga/UniversalImportWizard.tsx', true);
revertSpecificProperties('src/store/uiSlice.ts', true);

// 3. Fix task pages
console.log('\nFixing task pages...');
fixTaskPages();

// 4. Fix test files
console.log('\nFixing test files...');
fixTestFiles();

// 5. Fix CalendarListView props
const calendarListViewPath = 'src/components/calendar/CalendarListView.tsx';
if (fs.existsSync(calendarListViewPath)) {
  let code = fs.readFileSync(calendarListViewPath, 'utf8');
  // Remove isLoading from props interface if it was added
  code = code.replace(/^\s*isLoading\?\s*:\s*boolean;?\s*$/gm, '');
  fs.writeFileSync(calendarListViewPath, code);
  console.log(`✓ Fixed CalendarListView props`);
}

console.log('\n✅ Migration fixes completed!');
