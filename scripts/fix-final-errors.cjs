#!/usr/bin/env node

const fs = require('fs');

// More mutations that need isPending
const additionalMutationFiles = [
  'src/components/systems/UserList.tsx',
  'src/hooks/metadata/useMetadataInitialization.ts',
  'src/hooks/useCalendar.ts',
  'src/hooks/useConfigTRPC.ts',
  'src/hooks/useDownload.ts',
  'src/hooks/useSystemLogs.ts',
  'src/hooks/useWanted.ts',
  'src/pages/settings/backup.tsx',
  'src/pages/settings/file-organization.tsx',
  'src/pages/settings/integrations/kavita.tsx',
  'src/pages/settings/release-blocklist.tsx'
];

// Fix all mutations
additionalMutationFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  
  let code = fs.readFileSync(filePath, 'utf8');
  // Replace all .isLoading with .isPending for mutations
  code = code.replace(/\.isLoading/g, (match, offset) => {
    // Check context - if it's after mutation-like variable
    const before = code.substring(Math.max(0, offset - 50), offset);
    if (before.includes('Mutation') || before.includes('.mutate')) {
      return '.isPending';
    }
    return match;
  });
  
  fs.writeFileSync(filePath, code);
  console.log(`✓ Fixed mutations in ${filePath}`);
});

// Fix dynamic imports in _app files
const appFiles = ['src/pages/_app.tsx', 'src/pages/_app.direct.tsx'];
appFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  
  let code = fs.readFileSync(filePath, 'utf8');
  // Change isLoading: to loading: for dynamic imports
  code = code.replace(/(\s+)isLoading:/g, '$1loading:');
  
  fs.writeFileSync(filePath, code);
  console.log(`✓ Fixed dynamic imports in ${filePath}`);
});

// Fix history.tsx
const historyPath = 'src/pages/history.tsx';
if (fs.existsSync(historyPath)) {
  let code = fs.readFileSync(historyPath, 'utf8');
  code = code.replace(/clearHistoryMutation\.isLoading/g, 'clearHistoryMutation.isPending');
  fs.writeFileSync(historyPath, code);
  console.log(`✓ Fixed history.tsx`);
}

// Fix volumeChaptersTable
const volumePath = 'src/components/volumeChaptersTable.tsx';
if (fs.existsSync(volumePath)) {
  let code = fs.readFileSync(volumePath, 'utf8');
  // Change isLoading: to loading: in render props
  code = code.replace(/(\s+)isLoading:/g, '$1loading:');
  fs.writeFileSync(volumePath, code);
  console.log(`✓ Fixed volumeChaptersTable`);
}

// Fix store selectors
const selectorsPath = 'src/store/useStoreSelectors.ts';
if (fs.existsSync(selectorsPath)) {
  let code = fs.readFileSync(selectorsPath, 'utf8');
  // Change loading references to isLoading
  code = code.replace(/state\.ui\.forms\.loading/g, 'state.ui.forms.isLoading');
  fs.writeFileSync(selectorsPath, code);
  console.log(`✓ Fixed store selectors`);
}

// Fix test setup
const setupPath = 'src/test/setup.ts';
if (fs.existsSync(setupPath)) {
  let code = fs.readFileSync(setupPath, 'utf8');
  // Fix duplicate _loading
  code = code.replace(/const _loading = _loading;/g, '');
  // Fix references
  code = code.replace(/\bisLoading\b/g, '_loading');
  code = code.replace(/\bloading\b(?!:)/g, '_loading');
  fs.writeFileSync(setupPath, code);
  console.log(`✓ Fixed test setup`);
}

// Fix searchStep
const searchStepPath = 'src/components/addManga/steps/searchStep.tsx';
if (fs.existsSync(searchStepPath)) {
  let code = fs.readFileSync(searchStepPath, 'utf8');
  // providersQuery doesn't have .loading
  code = code.replace(/providersQuery\.loading/g, 'providersQuery.isLoading');
  // providerSearch doesn't have .loading
  code = code.replace(/providerSearch\.loading/g, 'providerSearch.isLoading');
  fs.writeFileSync(searchStepPath, code);
  console.log(`✓ Fixed searchStep`);
}

// Fix CalendarListView
const calendarPath = 'src/components/calendar/CalendarListView.tsx';
if (fs.existsSync(calendarPath)) {
  let code = fs.readFileSync(calendarPath, 'utf8');
  // Remove isLoading from destructuring if it's not in props
  code = code.replace(/,?\s*isLoading\s*(?=[\s,\}])/g, '');
  fs.writeFileSync(calendarPath, code);
  console.log(`✓ Fixed CalendarListView`);
}

console.log('\n✅ Final errors fixed!');
