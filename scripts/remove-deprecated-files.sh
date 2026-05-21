#!/bin/bash
# Script to remove deprecated and backup files from the Mugiwara-Kaizoku project

echo "🧹 Cleaning up deprecated and backup files..."
echo ""

# Create a list of files to remove
FILES_TO_REMOVE=(
  # Deprecated router files
  "src/server/trpc/routers/settings.deprecated.backup.ts"
  "src/server/trpc/routers/settingsV2.backup.ts"
  
  # Hook backup files
  "src/hooks/useConfig.backup.ts"
  "src/hooks/useConfig.backup.20250102.ts"
  "src/hooks/useBackgroundTask.ts.backup"
  "src/hooks/useChapterSync.ts.backup"
  "src/hooks/useDomainSearch.ts.backup"
  "src/hooks/useDownload.ts.backup"
  "src/hooks/useDownloadQueue.ts.backup"
  "src/hooks/useEvents.ts.backup"
  "src/hooks/useInfiniteChapters.ts.backup"
  "src/hooks/useIntegrationConfig.ts.backup"
  "src/hooks/useMetadata.ts.backup"
  "src/hooks/useMetadataProviders.ts.backup"
  "src/hooks/useProviderSearch.ts.backup"
  "src/hooks/useRealTimeUpdates.ts.backup"
  "src/hooks/useSuwayomiConfig.ts.backup"
  "src/hooks/useSystemEvents.ts.backup"
  "src/hooks/useSystemLogs.ts.backup"
  "src/hooks/useTaskCounts.ts.backup"
  "src/hooks/useTaskOperations.ts.backup"
  
  # Component backup files
  "src/components/MangaList.tsx.backup"
  "src/components/addLibrary.tsx.backup"
  "src/components/addManga/form.tsx.backup"
  "src/components/addManga/steps/confirmationStep.tsx.backup"
  "src/components/addManga/steps/searchStep.tsx.backup"
  "src/components/addManga/steps/sourceStep.tsx.backup"
  "src/components/fixOutOfSyncChaptersButton.tsx.backup"
  "src/components/headerSearch.tsx.backup"
  "src/components/library/CreateLibraryModal.tsx.backup"
  "src/components/library/EditLibraryModal.tsx.backup"
  "src/components/library/LibraryList.tsx.backup"
  "src/components/manga/MangaDetailView.tsx.backup"
  "src/components/manga/StandardMangaList.tsx.backup"
  "src/components/navbar.tsx.backup"
  "src/components/settings/BackupSettings.tsx.backup"
  "src/components/settings/DefaultMetadataProvider.tsx.backup"
  "src/components/settings/FileOrganizationSettings.tsx.backup"
  "src/components/settings/MetadataProvidersGrid.tsx.backup"
  "src/components/settings/anilist.tsx.backup"
  "src/components/settings/notification.tsx.backup"
  "src/components/settings/prowlarr/ProwlarrConfig.tsx.backup"
  "src/components/settings/prowlarr/ProwlarrIntegration.tsx.backup"
  "src/components/settings/suwayomi/SuwayomiDashboard.tsx.backup"
  "src/components/settings/suwayomi/SuwayomiSourceList.tsx.backup"
  "src/components/settingsMenu/SettingsMenu.tsx.backup"
  "src/components/suwayomi/DownloadButton.tsx.backup"
  "src/components/suwayomi/DownloadManager.tsx.backup"
  "src/components/system/LogViewer.tsx.backup"
  "src/components/system/MangalCardSettings.tsx.backup"
  "src/components/system/SourceCard.tsx.backup"
  "src/components/system/SourceTester.tsx.backup"
  "src/components/system/StatusContent.tsx.backup"
  "src/components/system/SuwayomiCardSettings.tsx.backup"
  "src/components/system/SystemPluginsPage.tsx.backup"
  "src/components/system/plugins/SystemSettings.tsx.backup"
  "src/components/updateManga.tsx.backup"
  "src/components/updateManga/ProviderSelectionForm.tsx.backup"
  "src/components/updateManga/UpdateForm.tsx.backup"
  
  # Context backup files
  "src/contexts/search/MainSearchContext.tsx.backup"
  "src/contexts/search/ModalSearchContext.tsx.backup"
  
  # Page backup files
  "src/pages/library-debug.tsx.backup"
  "src/pages/library/[id].tsx.backup"
  "src/pages/manga/[id].tsx.backup"
  "src/pages/settings/indexers.tsx.backup"
  "src/pages/system/updates.tsx.backup"
  "src/pages/tasks/active.tsx.backup"
  "src/pages/tasks/completed.tsx.backup"
  "src/pages/tasks/failed.tsx.backup"
  "src/pages/tasks/out-of-sync.tsx.backup"
  "src/pages/tasks/queued.tsx.backup"
  "src/pages/tasks/scheduled.tsx.backup"
)

# Count total files
TOTAL_FILES=${#FILES_TO_REMOVE[@]}
REMOVED_COUNT=0
NOT_FOUND_COUNT=0

echo "Found $TOTAL_FILES deprecated/backup files to remove"
echo ""

# Remove each file
for file in "${FILES_TO_REMOVE[@]}"; do
  if [ -f "$file" ]; then
    rm "$file"
    ((REMOVED_COUNT++))
    echo "✅ Removed: $file"
  else
    ((NOT_FOUND_COUNT++))
    echo "⚠️  Not found: $file"
  fi
done

echo ""
echo "📊 Summary:"
echo "   - Total files identified: $TOTAL_FILES"
echo "   - Successfully removed: $REMOVED_COUNT"
echo "   - Not found/already removed: $NOT_FOUND_COUNT"
echo ""
echo "🎉 Cleanup complete!"
