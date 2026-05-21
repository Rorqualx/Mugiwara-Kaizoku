# Test Instructions for Volume Display Fix

## What was fixed:
1. Added volumeList and chapters fields to the metadata router's type definition
2. Enhanced logging to trace data flow from backend to frontend
3. Fixed the data mapping in UniversalImportWizard to properly extract volume data

## To test the fix:

1. Open the application at http://localhost:3000
2. Navigate to Library > Add Manga
3. In the import wizard, paste this URL: 
   ```
   https://fire-force.fandom.com/wiki/Fire_Force_(manga)
   ```
4. Click "Parse URL" or the appropriate button to fetch metadata

## Expected results:
- The console should show logs with:
  - "📦 [FANDOM] Raw enhanced data received" with volumeListLength: 34
  - "📦 [FANDOM] Transformed data" with hasVolumeList: true
  - "📚 [VOLUMES] Setting volumes data from enhanced metadata" with volumeCount: 34
  - "📚 [VOLUMES] New volumesData state" showing the volumes array

- In the UI:
  - The Volumes tab should display "Volumes (34)"
  - Clicking the Volumes tab should show a grid of 34 volume covers
  - Each volume should display its cover image and volume number

## If volumes are still not showing:
1. Check the browser console for any error messages
2. Look for the logging messages mentioned above
3. Check if the volumeList data is present in the network tab response

## Console commands to verify data:
Open browser console and after parsing the URL, you can check:
- The network tab for the `fetchEnhancedMangaMetadata` request
- The response should contain a `volumeList` array with 34 items