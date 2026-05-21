#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files with NotificationData that need 'loading' not 'isLoading'
const notificationDataFiles = [
  'src/components/homeActionBar.tsx',
  'src/components/pattern-recognition/DataCorrectionPanel.tsx',
  'src/components/systemMenu.tsx'
];

// Files with more mutations that need isPending
const moreMutationFiles = [
  'src/components/library/EditLibraryModal.tsx',
  'src/components/manga/AniListBindModal.tsx',
  'src/components/manga/ProviderMetadataModal.tsx',
  'src/components/manga/ProviderSearchModal.tsx',
  'src/components/manga/SyncStatusCard.tsx',
  'src/components/settings/BackupSettings.tsx',
  'src/components/settings/ThemeEditor.tsx',
  'src/components/system/LogViewer.tsx',
  'src/components/system/StatusContent.tsx',
  'src/components/system/SuwayomiCardSettings.tsx',
  'src/components/systemMenu.tsx'
];

// Fix NotificationData properties
notificationDataFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  
  let code = fs.readFileSync(filePath, 'utf8');
  // Change isLoading: to loading: in object literals
  code = code.replace(/(\s+)isLoading(\s*:\s*)/g, '$1loading$2');
  
  fs.writeFileSync(filePath, code);
  console.log(`✓ Fixed NotificationData in ${filePath}`);
});

// Fix mutation isLoading -> isPending
moreMutationFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  
  let code = fs.readFileSync(filePath, 'utf8');
  // Replace mutation.isLoading with mutation.isPending
  code = code.replace(/(\w+Mutation\w*\.isLoading)/g, (match, p1) => {
    return p1.replace('.isLoading', '.isPending');
  });
  // Also handle patterns like deleteMutation.isLoading
  code = code.replace(/(\w+\.(mutate|mutateAsync)\([^)]*\)\.isLoading)/g, (match) => {
    return match.replace('.isLoading', '.isPending');
  });
  // Handle standalone mutation references
  code = code.replace(/(\s)(mutation\.isLoading)/g, '$1mutation.isPending');
  
  fs.writeFileSync(filePath, code);
  console.log(`✓ Fixed mutations in ${filePath}`);
});

// Fix searchStep.tsx specific issue
const searchStepPath = 'src/components/addManga/steps/searchStep.tsx';
if (fs.existsSync(searchStepPath)) {
  let code = fs.readFileSync(searchStepPath, 'utf8');
  // providersQuery doesn't have .loading, it has .isLoading
  code = code.replace(/providersQuery\.loading/g, 'providersQuery.isLoading');
  // providerSearch doesn't have .loading, it has .isLoading
  code = code.replace(/providerSearch\.loading/g, 'providerSearch.isLoading');
  
  fs.writeFileSync(searchStepPath, code);
  console.log(`✓ Fixed searchStep.tsx`);
}

// Fix CalendarListView props
const calendarPath = 'src/components/calendar/CalendarListView.tsx';
if (fs.existsSync(calendarPath)) {
  let code = fs.readFileSync(calendarPath, 'utf8');
  // Remove the isLoading prop usage if it doesn't exist in interface
  code = code.replace(/(\s+)isLoading,?\s*$/gm, '');
  
  fs.writeFileSync(calendarPath, code);
  console.log(`✓ Fixed CalendarListView`);
}

// Fix BatchMetadataEditor stats
const batchPath = 'src/components/library/scan/BatchMetadataEditor.tsx';
if (fs.existsSync(batchPath)) {
  let code = fs.readFileSync(batchPath, 'utf8');
  // stats.loading should be stats.isLoading
  code = code.replace(/stats\.loading/g, 'stats.isLoading');
  
  fs.writeFileSync(batchPath, code);
  console.log(`✓ Fixed BatchMetadataEditor`);
}

console.log('\n✅ Remaining errors fixed!');
