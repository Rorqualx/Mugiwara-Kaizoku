#!/usr/bin/env node

/**
 * Script to update all pages from MainLayout to ResponsiveMainLayout
 * This enables mobile-responsive navigation across the application
 */

const fs = require('fs');
const path = require('path');

// List of files that need to be updated
const filesToUpdate = [
  // Settings pages
  'src/pages/settings/index.tsx',
  'src/pages/settings/metadata.tsx',
  'src/pages/settings/indexers.tsx',
  'src/pages/settings/download-clients.tsx',
  'src/pages/settings/media-management.tsx',
  'src/pages/settings/events.tsx',
  'src/pages/settings/kapowarr.tsx',
  'src/pages/settings/integrations/index.tsx',
  'src/pages/settings/integrations/komga.tsx',
  'src/pages/settings/integrations/kavita.tsx',
  'src/pages/settings/integrations/prowlarr.tsx',
  'src/pages/settings/integrations/notifications.tsx',
  
  // System pages
  'src/pages/system/index.tsx',
  'src/pages/system/status.tsx',
  'src/pages/system/events.tsx',
  'src/pages/system/logs.tsx',
  'src/pages/system/updates.tsx',
  'src/pages/system/appearance.tsx',
  'src/pages/system/backup.tsx',
  'src/pages/system/plugins.tsx',
  'src/pages/system/users/index.tsx',
  
  // Tasks pages
  'src/pages/tasks/active.tsx',
  'src/pages/tasks/queued.tsx',
  'src/pages/tasks/scheduled.tsx',
  'src/pages/tasks/failed.tsx',
  'src/pages/tasks/completed.tsx',
  'src/pages/tasks/out-of-sync.tsx',
  
  // Wanted pages
  'src/pages/wanted.tsx',
  'src/pages/wanted/downloads.tsx',
  'src/pages/wanted/blocklist.tsx',
  'src/pages/wanted/missing.tsx',
  'src/pages/wanted/history.tsx',
  
  // Other pages
  'src/pages/test-events.tsx',
  'src/pages/library/[id]-enhanced.tsx',
  'src/pages/demo/library-search.tsx',
  'src/components/layouts/ClientLayout.tsx'
];

let updatedCount = 0;
let errorCount = 0;

filesToUpdate.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);
  
  try {
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return;
    }
    
    // Read file content
    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;
    
    // Replace import statement
    content = content.replace(
      /import\s*{\s*MainLayout\s*}\s*from\s*['"].*[\/]MainLayout['"];?/g,
      `import { ResponsiveMainLayout } from '${filePath.includes('components/layouts') ? './ResponsiveMainLayout' : filePath.includes('pages/system/users') ? '../../../components/layouts/ResponsiveMainLayout' : filePath.includes('pages/settings/integrations') || filePath.includes('pages/tasks') || filePath.includes('pages/wanted') || filePath.includes('pages/system') || filePath.includes('pages/settings') ? '../../components/layouts/ResponsiveMainLayout' : filePath.includes('pages/demo') || filePath.includes('pages/library') ? '../../components/layouts/ResponsiveMainLayout' : '../components/layouts/ResponsiveMainLayout'}';`
    );
    
    // Replace JSX usage
    content = content.replace(/<MainLayout([^>]*)>/g, '<ResponsiveMainLayout$1>');
    content = content.replace(/<\/MainLayout>/g, '</ResponsiveMainLayout>');
    
    // Replace in getLayout functions
    content = content.replace(/return\s*<MainLayout>/g, 'return <ResponsiveMainLayout>');
    
    // Check if any changes were made
    if (content !== originalContent) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ Updated: ${filePath}`);
      updatedCount++;
    } else {
      console.log(`ℹ️  No changes needed: ${filePath}`);
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    errorCount++;
  }
});

console.log('\n📊 Summary:');
console.log(`✅ Files updated: ${updatedCount}`);
console.log(`❌ Errors: ${errorCount}`);
console.log(`ℹ️  Files checked: ${filesToUpdate.length}`);

if (updatedCount > 0) {
  console.log('\n🎉 Mobile navigation has been enabled across the application!');
  console.log('\n📱 Next steps:');
  console.log('1. Test the application on mobile devices');
  console.log('2. Update any remaining components to use responsive versions');
  console.log('3. Add mobile-specific features like PWA support');
}