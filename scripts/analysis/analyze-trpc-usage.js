#!/usr/bin/env node

// Script to analyze tRPC endpoint usage
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// All tRPC endpoints found in router files (updated with actual endpoints)
const endpoints = [
  // Library Router
  'library.scan',
  'library.detail',
  'library.update',
  'library.delete',
  'library.transferManga',
  'library.query',
  'library.create',
  'library.updateGlobalInterval',
  'library.add',
  
  // Tasks Router
  'tasks.getByType',
  'tasks.getByStatus',
  'tasks.getScheduled',
  'tasks.getQueued',
  'tasks.retry',
  'tasks.cancel',
  
  // Activity Router
  'activity.query',
  
  // History Router
  'history.query',
  
  // Manga Router
  'manga.add',
  'manga.query',
  'manga.get',
  'manga.detail',
  'manga.sources',
  'manga.bind',
  'manga.refreshMetaData',
  'manga.download',
  'manga.checkOutOfSyncChapters',
  'manga.fixOutOfSyncChapters',
  'manga.remove',
  'manga.enhanceChapterTitles',
  'manga.search',
  'manga.searchAcrossProviders',
  'manga.searchProviderConfirmation',
  'manga.getProviderMetadata',
  'manga.updateProviderPreferences',
  'manga.update',
  
  // Settings Router
  'settings.providers.list',
  'settings.search.listProviders',
  'settings.search.getConfig',
  'settings.search.updateConfig',
  'settings.search.setDefaultProvider',
  'settings.search.toggleProvider',
  'settings.search.getProwlarrConfig',
  'settings.search.updateProwlarrConfig',
  'settings.get',
  'settings.set',
  'settings.getFileOrganization',
  'settings.updateFileOrganization',
  'settings.getBackupSettings',
  'settings.updateBackupSettings',
  'settings.getIntegration',
  'settings.updateIntegration',
  'settings.backupDatabase',
  'settings.restoreDatabase',
  
  // Settings Metadata Router (nested)
  'settings.metadata.fieldPreferences',
  'settings.metadata.updateFieldPreferences',
  'settings.metadata.providerStrengths',
  'settings.metadata.getConflicts',
  'settings.metadata.resolveConflict',
  'settings.metadata.refreshMetadata',
  
  // System Router
  'system.getMangalSources',
  'system.getBackups',
  'system.createBackup',
  'system.deleteBackup',
  'system.restoreBackup',
  'system.scheduleBackup',
  'system.getProcessInfo',
  'system.getLogs',
  'system.getLogFiles',
  'system.getLogFileContent',
  'system.clearLogFile',
  'system.getUpdateInfo',
  'system.checkForUpdates',
  'system.performUpdate',
  'system.migrateProviderSettings',
  'system.getStatus',
  
  // Health Router
  'health.check',
  'health.dbCheck',
  
  // Search Router
  'search.withProvider',
  'search.all',
  'search.getMetadata',
  'search.getProviders',
  'search.setDefaultProvider',
  
  // Events Router (updated with actual endpoints)
  'events.list',
  'events.getEventTypes',
  'events.getEventSources',
  'events.getEventLevels',
  'events.clearEvents',
  'events.exportEvents',
  'events.getEventSettings',
  'events.updateEventSettings',
  
  // App Router direct procedures (from appRouter.ts)
  'history',
  'activityStats',
];

// Directory to search
const srcDir = path.join(__dirname, 'src');

// Extensions to search
const extensions = ['.ts', '.tsx', '.js', '.jsx'];

// Results object
const results = {
  used: {},
  unused: [],
};

// Function to recursively search files
function searchFiles(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      searchFiles(filePath);
    } else if (stat.isFile() && extensions.includes(path.extname(file))) {
      searchInFile(filePath);
    }
  }
}

// Function to search in a single file
function searchInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    for (const endpoint of endpoints) {
      // Create specific patterns for this endpoint
      const parts = endpoint.split('.');
      let patterns = [];
      
      if (parts.length === 1) {
        // Direct procedure like history or activityStats
        patterns = [
          new RegExp(`trpc\\\\.${endpoint}\\\\.useQuery`, 'g'),
          new RegExp(`trpc\\\\.${endpoint}\\\\.useMutation`, 'g'),
          new RegExp(`trpc\\\\.${endpoint}\\\\.useSubscription`, 'g'),
          new RegExp(`trpc\\\\.${endpoint}\\\\.query`, 'g'),
          new RegExp(`trpc\\\\.${endpoint}\\\\.mutate`, 'g'),
          new RegExp(`trpc\\\\.${endpoint}\\\\.subscribe`, 'g'),
          new RegExp(`\\\\.${endpoint}\\\\.useQuery`, 'g'),
          new RegExp(`\\\\.${endpoint}\\\\.useMutation`, 'g'),
          new RegExp(`\\\\.${endpoint}\\\\.useSubscription`, 'g'),
          new RegExp(`\\\\.${endpoint}\\\\.query`, 'g'),
          new RegExp(`\\\\.${endpoint}\\\\.mutate`, 'g'),
          new RegExp(`\\\\.${endpoint}\\\\.subscribe`, 'g'),
        ];
      } else if (parts.length === 2) {
        // Simple endpoint like manga.query
        const [router, method] = parts;
        patterns = [
          new RegExp(`trpc\\\\.${router}\\\\.${method}\\\\.useQuery`, 'g'),
          new RegExp(`trpc\\\\.${router}\\\\.${method}\\\\.useMutation`, 'g'),
          new RegExp(`trpc\\\\.${router}\\\\.${method}\\\\.useSubscription`, 'g'),
          new RegExp(`trpc\\\\.${router}\\\\.${method}\\\\.query`, 'g'),
          new RegExp(`trpc\\\\.${router}\\\\.${method}\\\\.mutate`, 'g'),
          new RegExp(`trpc\\\\.${router}\\\\.${method}\\\\.subscribe`, 'g'),
          new RegExp(`\\\\.${router}\\\\.${method}\\\\.useQuery`, 'g'),
          new RegExp(`\\\\.${router}\\\\.${method}\\\\.useMutation`, 'g'),
          new RegExp(`\\\\.${router}\\\\.${method}\\\\.useSubscription`, 'g'),
          new RegExp(`\\\\.${router}\\\\.${method}\\\\.query`, 'g'),
          new RegExp(`\\\\.${router}\\\\.${method}\\\\.mutate`, 'g'),
          new RegExp(`\\\\.${router}\\\\.${method}\\\\.subscribe`, 'g'),
        ];
      } else if (parts.length === 3) {
        // Nested endpoint like settings.search.getConfig
        const [router, subrouter, method] = parts;
        patterns = [
          new RegExp(`trpc\\\\.${router}\\\\.${subrouter}\\\\.${method}\\\\.useQuery`, 'g'),
          new RegExp(`trpc\\\\.${router}\\\\.${subrouter}\\\\.${method}\\\\.useMutation`, 'g'),
          new RegExp(`trpc\\\\.${router}\\\\.${subrouter}\\\\.${method}\\\\.useSubscription`, 'g'),
          new RegExp(`trpc\\\\.${router}\\\\.${subrouter}\\\\.${method}\\\\.query`, 'g'),
          new RegExp(`trpc\\\\.${router}\\\\.${subrouter}\\\\.${method}\\\\.mutate`, 'g'),
          new RegExp(`trpc\\\\.${router}\\\\.${subrouter}\\\\.${method}\\\\.subscribe`, 'g'),
          new RegExp(`\\\\.${router}\\\\.${subrouter}\\\\.${method}\\\\.useQuery`, 'g'),
          new RegExp(`\\\\.${router}\\\\.${subrouter}\\\\.${method}\\\\.useMutation`, 'g'),
          new RegExp(`\\\\.${router}\\\\.${subrouter}\\\\.${method}\\\\.useSubscription`, 'g'),
          new RegExp(`\\\\.${router}\\\\.${subrouter}\\\\.${method}\\\\.query`, 'g'),
          new RegExp(`\\\\.${router}\\\\.${subrouter}\\\\.${method}\\\\.mutate`, 'g'),
          new RegExp(`\\\\.${router}\\\\.${subrouter}\\\\.${method}\\\\.subscribe`, 'g'),
        ];
      }
      
      for (const pattern of patterns) {
        const matches = content.match(pattern);
        if (matches) {
          if (!results.used[endpoint]) {
            results.used[endpoint] = [];
          }
          results.used[endpoint].push({
            file: path.relative(__dirname, filePath),
            count: matches.length,
            pattern: pattern.source,
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
  }
}

// Run the search
console.log('Analyzing tRPC endpoint usage...\n');
searchFiles(srcDir);

// Find unused endpoints
for (const endpoint of endpoints) {
  if (!results.used[endpoint]) {
    results.unused.push(endpoint);
  }
}

// Sort results
results.unused.sort();

// Output results
console.log('=== UNUSED ENDPOINTS ===\n');
if (results.unused.length === 0) {
  console.log('All endpoints are used!');
} else {
  console.log(`Found ${results.unused.length} unused endpoints:\n`);
  
  // Group by router
  const groupedUnused = {};
  for (const endpoint of results.unused) {
    const router = endpoint.split('.')[0];
    if (!groupedUnused[router]) {
      groupedUnused[router] = [];
    }
    groupedUnused[router].push(endpoint);
  }
  
  // Display grouped
  for (const [router, endpoints] of Object.entries(groupedUnused)) {
    console.log(`\n${router}:`);
    for (const endpoint of endpoints) {
      console.log(`  - ${endpoint}`);
    }
  }
}

console.log('\n=== USED ENDPOINTS ===\n');
const usedEndpoints = Object.keys(results.used).sort();
console.log(`Found ${usedEndpoints.length} used endpoints:\n`);

// Group by router
const groupedUsed = {};
for (const endpoint of usedEndpoints) {
  const router = endpoint.split('.')[0];
  if (!groupedUsed[router]) {
    groupedUsed[router] = [];
  }
  groupedUsed[router].push(endpoint);
}

// Display grouped with counts
for (const [router, endpoints] of Object.entries(groupedUsed)) {
  console.log(`\n${router}:`);
  for (const endpoint of endpoints) {
    const uses = results.used[endpoint];
    const totalUses = uses.reduce((sum, use) => sum + use.count, 0);
    console.log(`  - ${endpoint} (${totalUses} uses in ${uses.length} files)`);
  }
}

// Write detailed results to file
const outputPath = path.join(__dirname, 'trpc-usage-analysis.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\n\nDetailed results saved to: ${outputPath}`);

// Summary
console.log('\n=== SUMMARY ===');
console.log(`Total endpoints: ${endpoints.length}`);
console.log(`Used endpoints: ${usedEndpoints.length} (${Math.round(usedEndpoints.length / endpoints.length * 100)}%)`);
console.log(`Unused endpoints: ${results.unused.length} (${Math.round(results.unused.length / endpoints.length * 100)}%)`);
