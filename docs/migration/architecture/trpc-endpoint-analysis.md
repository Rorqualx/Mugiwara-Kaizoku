# Trpc Endpoint Analysis

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Trpc Endpoint Analysis

---
# Systematic tRPC Endpoint Usage Analysis - Mugiwara Kaizoku

## Executive Summary

A systematic analysis of all tRPC endpoints in the Mugiwara Kaizoku application reveals that **100% of the 92 identified endpoints appear to be unused** according to our search patterns. This unusual finding suggests one of several possibilities that need investigation.

## Methodology

1. **Endpoint Discovery**: Analyzed all tRPC router files to identify endpoints
2. **Usage Search**: Searched all TypeScript/JavaScript files for tRPC usage patterns
3. **Pattern Matching**: Used regex patterns to find both direct and indirect usage

## Complete List of Unused tRPC Endpoints (92 total)

### Activity Router (2 endpoints)
- `activity.query` - Get task activity statistics
- `activityStats` - Direct procedure for activity stats

### Events Router (8 endpoints)
- `events.list` - List events with filtering
- `events.getEventTypes` - Get event type options
- `events.getEventSources` - Get event source options
- `events.getEventLevels` - Get event level options
- `events.clearEvents` - Clear old events
- `events.exportEvents` - Export events to file
- `events.getEventSettings` - Get event configuration
- `events.updateEventSettings` - Update event configuration

### Health Router (2 endpoints)
- `health.check` - Basic API health check
- `health.dbCheck` - Database connection check

### History Router (2 endpoints)
- `history` - Direct procedure for chapter history
- `history.query` - Query download history

### Library Router (9 endpoints)
- `library.scan` - Scan directory for manga
- `library.detail` - Get library details
- `library.update` - Update library info
- `library.delete` - Delete a library
- `library.transferManga` - Move manga between libraries
- `library.query` - Get all libraries
- `library.create` - Create new library
- `library.updateGlobalInterval` - Update scan intervals
- `library.add` - Add manga to library

### Manga Router (18 endpoints)
- `manga.add` - Add new manga
- `manga.query` - Query all manga
- `manga.get` - Get single manga
- `manga.detail` - Get manga details
- `manga.sources` - Get available sources
- `manga.bind` - Bind to AniList
- `manga.refreshMetaData` - Refresh metadata
- `manga.download` - Download chapters
- `manga.checkOutOfSyncChapters` - Check sync status
- `manga.fixOutOfSyncChapters` - Fix sync issues
- `manga.remove` - Remove manga
- `manga.enhanceChapterTitles` - Enhance titles
- `manga.search` - Search for manga
- `manga.searchAcrossProviders` - Multi-provider search
- `manga.searchProviderConfirmation` - Confirmation search
- `manga.getProviderMetadata` - Get provider metadata
- `manga.updateProviderPreferences` - Update preferences
- `manga.update` - Update manga info

### Search Router (5 endpoints)
- `search.withProvider` - Search with specific provider
- `search.all` - Search all providers
- `search.getMetadata` - Get detailed metadata
- `search.getProviders` - List available providers
- `search.setDefaultProvider` - Set default provider

### Settings Router (25 endpoints)
Main settings:
- `settings.get` - Get configuration value
- `settings.set` - Set configuration value
- `settings.providers.list` - List metadata providers
- `settings.getFileOrganization` - Get file settings
- `settings.updateFileOrganization` - Update file settings
- `settings.getBackupSettings` - Get backup config
- `settings.updateBackupSettings` - Update backup config
- `settings.getIntegration` - Get integration settings
- `settings.updateIntegration` - Update integration
- `settings.backupDatabase` - Trigger backup
- `settings.restoreDatabase` - Restore from backup

Search settings (nested):
- `settings.search.listProviders` - List search providers
- `settings.search.getConfig` - Get search config
- `settings.search.updateConfig` - Update search config
- `settings.search.setDefaultProvider` - Set default
- `settings.search.toggleProvider` - Enable/disable provider
- `settings.search.getProwlarrConfig` - Get Prowlarr config
- `settings.search.updateProwlarrConfig` - Update Prowlarr

Metadata settings (nested):
- `settings.metadata.fieldPreferences` - Get field prefs
- `settings.metadata.updateFieldPreferences` - Update prefs
- `settings.metadata.providerStrengths` - Get strengths
- `settings.metadata.getConflicts` - Get conflicts
- `settings.metadata.resolveConflict` - Resolve conflict
- `settings.metadata.refreshMetadata` - Refresh metadata

### System Router (16 endpoints)
- `system.getMangalSources` - Get Mangal sources
- `system.getBackups` - List backups
- `system.createBackup` - Create backup
- `system.deleteBackup` - Delete backup
- `system.restoreBackup` - Restore backup
- `system.scheduleBackup` - Schedule backups
- `system.getProcessInfo` - Get process info
- `system.getLogs` - Get application logs
- `system.getLogFiles` - List log files
- `system.getLogFileContent` - Get log content
- `system.clearLogFile` - Clear log file
- `system.getUpdateInfo` - Check for updates
- `system.checkForUpdates` - Check updates
- `system.performUpdate` - Perform update
- `system.migrateProviderSettings` - Migrate settings
- `system.getStatus` - Get system status

### Tasks Router (6 endpoints)
- `tasks.getByType` - Filter by task type
- `tasks.getByStatus` - Filter by status
- `tasks.getScheduled` - Get scheduled tasks
- `tasks.getQueued` - Get queued tasks
- `tasks.retry` - Retry failed task
- `tasks.cancel` - Cancel task

## Potential Reasons for 100% Unused Endpoints

### 1. **Different Import Pattern**
The application might be using a different import pattern than what we're searching for. Possibilities:
- Using a custom tRPC wrapper or proxy
- Importing through barrel exports
- Using a different client initialization

### 2. **Dynamic Endpoint Usage**
Endpoints might be called dynamically using:
- Computed property names
- String concatenation
- Variable references

### 3. **Server-Side Only Usage**
Some endpoints might only be called:
- From server-side code
- Through internal service calls
- Via background jobs or cron tasks

### 4. **Legacy/Future Implementation**
The endpoints might be:
- Part of a new feature not yet implemented
- Legacy endpoints from a previous version
- Prepared for future functionality

### 5. **Test or Development Code**
Usage might exist in:
- Test files (if not included in search)
- Development-only code
- Storybook stories
- Example/demo files

### 6. **Build-Time Code Generation**
The actual usage might be:
- Generated during build process
- Created by code generators
- Part of a macro or compiler plugin

## Recommendations

### 1. **Investigate Import Patterns**
Search for alternative tRPC usage patterns:
```bash
# Search for tRPC imports
grep -r "from.*trpc" src/
grep -r "import.*trpc" src/

# Search for procedure calls
grep -r "useQuery\|useMutation\|query\|mutate" src/
```

### 2. **Check Page Components**
Manually inspect key page components that should be using these endpoints:
- `/src/pages/library/*` - Should use library endpoints
- `/src/pages/manga/*` - Should use manga endpoints
- `/src/pages/settings/*` - Should use settings endpoints

### 3. **Verify Client Configuration**
Check how the tRPC client is initialized and if there's a wrapper:
- `/src/utils/trpc-client/index.ts`
- `/src/utils/trpc-monkey-patch.ts`
- Any custom hooks wrapping tRPC

### 4. **Dead Code Analysis**
Consider that many of these endpoints might be:
- Dead code that can be removed
- Planned features not yet implemented
- Legacy code from previous versions

### 5. **Usage in Non-TypeScript Files**
Check if endpoints are used in:
- Configuration files
- Build scripts
- Database seeders
- Migration scripts

## Next Steps

1. **Manual Verification**: Pick 5-10 critical endpoints (like `manga.query`, `library.query`, `settings.get`) and manually search for their usage
2. **Component Analysis**: Check the main application components to see how they fetch data
3. **Developer Interview**: Consult with the development team about the architecture
4. **Gradual Cleanup**: If confirmed unused, consider removing endpoints in phases

## Conclusion

The finding that 100% of tRPC endpoints appear unused is highly unusual and suggests either:
1. A limitation in our search methodology
2. A unique architectural pattern in the application
3. A significant amount of dead code

Further investigation is needed to determine the actual state of the codebase and whether these endpoints are truly unused or if they're being invoked through an unconventional pattern.
