# Volume Organization Features Testing Guide

*Status: Active*
*Author: Development Team*
*Last Updated: 2025-10-16*

## Overview

This guide provides comprehensive testing procedures for the volume folder organization and volume splitting features. These features enhance manga library organization by creating dedicated volume folders and intelligently splitting volume archives into individual chapters.

---

## Features to Test

### 1. Volume Folder Organization
Automatically creates folders for each volume in the format: `{MangaTitle} Vol {VolumeNumber}`

**Example:**
```
Fire Force/
├── Fire Force Vol 1/
│   ├── Fire Force Vol 1 Ch 01.cbz
│   ├── Fire Force Vol 1 Ch 02.cbz
│   └── Fire Force Vol 1 Ch 03.cbz
└── Fire Force Vol 2/
    ├── Fire Force Vol 2 Ch 04.cbz
    └── Fire Force Vol 2 Ch 05.cbz
```

### 2. Volume Splitting
Intelligently splits volume archives into individual chapter files using:
- Filename pattern detection
- Sequential image analysis
- Database metadata validation
- Confidence scoring (with warnings below 70%)

---

## Prerequisites

Before testing, ensure:

1. ✅ Development server is running (`bun --bun run dev`)
2. ✅ PostgreSQL database is accessible
3. ✅ At least one library is configured
4. ✅ Test manga files are available:
   - Individual chapter files (for volume folder testing)
   - Volume archive files (for splitting testing)

---

## Test 1: Volume Folder Organization

### Setup

1. Navigate to **Settings → Media Management**
2. Scroll to **File Organization** section
3. Enable **"Create volume folders"** switch
4. Verify the preview updates to show volume folder structure

**Expected Preview:**
```
/manga/Fire Force/Fire Force Vol 1/Fire Force VOL01CH00 - Shinra joins the Force.cbz
```

### Test Scenario A: Import Single Chapter with Volume Info

**Steps:**
1. Add a manga to your library (e.g., "Fire Force")
2. Queue a download job for Volume 1, Chapter 1
3. Place a test file in the download client's completion directory:
   - Example: `Fire Force Vol 01 Ch 01.cbz`
4. Wait for automatic import or trigger manual import
5. Check the library directory

**Expected Results:**
- ✅ Folder created: `{LibraryPath}/Fire Force/Fire Force Vol 1/`
- ✅ File placed inside: `Fire Force Vol 1 Ch 01.cbz`
- ✅ Chapter database record updated with correct `filePath`
- ✅ Download status changed to `COMPLETED`

**Logs to Check:**
```
[FileImporter] Created/verified volume directory: /path/to/Fire Force Vol 1
[FileImporter] Copied Fire Force Vol 01 Ch 01.cbz to /path/to/Fire Force Vol 1/Fire Force Vol 01 Ch 01.cbz
[FileImporter] Updated chapter {id} with file Fire Force Vol 01 Ch 01.cbz
```

### Test Scenario B: Import Multiple Chapters (Same Volume)

**Steps:**
1. Queue downloads for Volume 1, Chapters 1-3
2. Place multiple test files:
   - `Fire Force Vol 01 Ch 01.cbz`
   - `Fire Force Vol 01 Ch 02.cbz`
   - `Fire Force Vol 01 Ch 03.cbz`
3. Trigger import

**Expected Results:**
- ✅ All three files placed in same `Fire Force Vol 1` folder
- ✅ All three chapters updated in database
- ✅ Folder structure remains clean

### Test Scenario C: Import Chapters from Different Volumes

**Steps:**
1. Queue downloads for:
   - Volume 1, Chapter 1
   - Volume 2, Chapter 5
2. Place test files:
   - `Fire Force Vol 01 Ch 01.cbz`
   - `Fire Force Vol 02 Ch 05.cbz`
3. Trigger import

**Expected Results:**
- ✅ Two separate folders created:
  - `Fire Force Vol 1/`
  - `Fire Force Vol 2/`
- ✅ Each file in its respective volume folder
- ✅ Both chapters updated correctly

### Test Scenario D: Import Without Volume Info

**Steps:**
1. Place a file without volume information:
   - `Fire Force Ch 10.cbz`
2. Trigger import

**Expected Results:**
- ✅ File placed directly in manga directory (no volume folder)
- ✅ Standard import behavior maintained
- ✅ Chapter updated normally

**Logs to Check:**
```
[FileImporter] No volume number detected, using default path
```

---

## Test 2: Volume Splitting

### Setup

1. Navigate to **Settings → Media Management**
2. Enable **"Split volume files into chapters"** switch
3. Read the warning alert about heuristic detection
4. Ensure you have backup copies of test volume files

### Test Scenario A: Split Well-Organized Volume

**Preparation:**
Create a test volume archive with clear chapter markers:
```
Fire Force Vol 01.cbz
├── Chapter 01/
│   ├── 001.jpg (20 pages)
│   └── ...
├── Chapter 02/
│   ├── 001.jpg (18 pages)
│   └── ...
└── Chapter 03/
    ├── 001.jpg (22 pages)
    └── ...
```

**Steps:**
1. Add manga "Fire Force" to library
2. Create chapters in database:
   - Chapter 1 (status: DOWNLOADING)
   - Chapter 2 (status: DOWNLOADING)
   - Chapter 3 (status: DOWNLOADING)
3. Add chapter page count metadata (optional but recommended):
   ```sql
   UPDATE chapters SET pages = 20 WHERE chapterNumber = 1;
   UPDATE chapters SET pages = 18 WHERE chapterNumber = 2;
   UPDATE chapters SET pages = 22 WHERE chapterNumber = 3;
   ```
4. Place `Fire Force Vol 01.cbz` in download completion directory
5. Trigger import

**Expected Results:**
- ✅ Volume detected: `isVolumeFile()` returns true
- ✅ Three chapter files created:
  - `Fire Force Vol 01 Ch 01.cbz`
  - `Fire Force Vol 01 Ch 02.cbz`
  - `Fire Force Vol 01 Ch 03.cbz`
- ✅ All three database chapters updated to `COMPLETED`
- ✅ Confidence score reported (should be 90-100%)
- ✅ No warnings in logs

**Logs to Check:**
```
[FileImporter] Detected volume file: Fire Force Vol 01.cbz, initiating split
[VolumeSplitter] Using filename-based detection
[VolumeSplitter] Detected 3 chapters with confidence 0.95
[FileImporter] Volume split successful: 3 chapters created (confidence: 95%)
[FileImporter] Updated chapter {id} with split file Fire Force Vol 01 Ch 01.cbz
```

### Test Scenario B: Split Volume with Sequential Images

**Preparation:**
Create a test volume with sequentially numbered images (no chapter folders):
```
Fire Force Vol 01.cbz
├── 001.jpg
├── 002.jpg
├── ...
├── 060.jpg  (60 total pages, 3 chapters of ~20 pages each)
```

**Steps:**
1. Create chapters in database with page counts:
   - Chapter 1: 20 pages
   - Chapter 2: 20 pages
   - Chapter 3: 20 pages
2. Place volume file in completion directory
3. Trigger import

**Expected Results:**
- ✅ Volume detected
- ✅ Sequential detection used (no clear filename markers)
- ✅ Chapters split based on expected page counts
- ✅ Confidence score 70-85% (lower due to heuristics)
- ✅ Warnings logged if page counts don't match exactly

**Logs to Check:**
```
[VolumeSplitter] Filename-based detection found 0 chapters, trying sequential
[VolumeSplitter] Using sequential detection with metadata hints
[VolumeSplitter] Detected 3 chapters with confidence 0.75
[FileImporter] Volume split warning: Chapter 2: page count mismatch (expected 20, detected 19)
```

### Test Scenario C: Split Volume Without Metadata

**Preparation:**
Use the same test volume but don't set chapter page counts in database.

**Steps:**
1. Create chapters in database WITHOUT page counts
2. Place volume file in completion directory
3. Trigger import

**Expected Results:**
- ✅ Volume detected
- ✅ Fallback to equal distribution (60 pages ÷ 3 chapters = 20 each)
- ✅ Confidence score 50-60% (fallback method)
- ✅ Warning logged about missing metadata

**Logs to Check:**
```
[VolumeSplitter] No metadata available for validation - using heuristic detection only
[VolumeSplitter] Using fallback equal distribution
[VolumeSplitter] Detected 3 chapters with confidence 0.50
[FileImporter] Volume split warning: No metadata available for validation
```

### Test Scenario D: Volume File Too Small (Not Actually a Volume)

**Preparation:**
Create a small archive (single chapter, ~20 pages, <10MB)

**Steps:**
1. Place small file in completion directory
2. Trigger import

**Expected Results:**
- ✅ `isVolumeFile()` returns false (file too small)
- ✅ Standard single-chapter import used
- ✅ No splitting attempted

**Logs to Check:**
```
[VolumeSplitter] File size below volume threshold, treating as single chapter
[FileImporter] Normal import for Fire Force Ch 01.cbz
```

### Test Scenario E: Volume Splitting with Format Conversion

**Preparation:**
1. Set preferred format to CBZ in **Settings → File Conversion**
2. Create volume file in different format (e.g., ZIP or CBR)

**Steps:**
1. Place `Fire Force Vol 01.zip` in completion directory
2. Trigger import

**Expected Results:**
- ✅ Volume split successfully
- ✅ Three chapter files created
- ✅ Conversion jobs created for each chapter
- ✅ Format conversion jobs visible in Jobs dashboard

**Logs to Check:**
```
[FileImporter] Volume split successful: 3 chapters created
[FileImporter] File conversion needed: zip -> cbz
[FileImporter] Creating conversion job: Fire Force Vol 01 Ch 01.zip -> Fire Force Vol 01 Ch 01.cbz
[FileImporter] Created conversion job {jobId} for chapter {chapterId}
```

---

## Test 3: Combined Features

### Test Scenario: Volume Splitting + Volume Folders

**Setup:**
1. Enable both:
   - ✅ Create volume folders
   - ✅ Split volume files into chapters
2. Prepare volume archive
3. Create database chapters

**Steps:**
1. Place `Fire Force Vol 01.cbz` in completion directory
2. Trigger import

**Expected Results:**
- ✅ Volume folder created: `Fire Force Vol 1/`
- ✅ Volume split into chapters
- ✅ All chapter files placed inside volume folder:
  ```
  Fire Force Vol 1/
  ├── Fire Force Vol 01 Ch 01.cbz
  ├── Fire Force Vol 01 Ch 02.cbz
  └── Fire Force Vol 01 Ch 03.cbz
  ```
- ✅ Database chapters updated with paths inside volume folder

---

## Verification Checklist

After each test, verify:

### File System
- [ ] Folder structure matches expected layout
- [ ] File paths are correct and accessible
- [ ] No duplicate files created
- [ ] Original volume file still exists (not deleted)

### Database
- [ ] Chapter `downloadStatus` changed to `COMPLETED`
- [ ] `filePath` field contains correct absolute path
- [ ] `fileName` field matches actual filename
- [ ] `volume` field set correctly
- [ ] `size` and `fileFormat` fields updated

### Logs
- [ ] No errors or exceptions logged
- [ ] Confidence scores reported for volume splits
- [ ] Warnings logged for low confidence (<70%)
- [ ] All operations logged with timestamps

### Settings Persistence
- [ ] Settings saved to database
- [ ] Settings persist after page refresh
- [ ] Settings visible in Settings → Media Management

---

## Troubleshooting

### Volume Folders Not Created

**Check:**
1. Setting enabled in database:
   ```sql
   SELECT * FROM "Config" WHERE key = 'fileOrganization';
   ```
2. Volume number detected in filename
3. Manga exists in database
4. Library path has write permissions

**Solution:**
- Verify filename contains volume info: `Vol 01`, `v01`, `Volume 01`
- Check logs for path creation errors
- Manually test folder creation: `mkdir -p "path/to/Fire Force Vol 1"`

### Volume Not Detected for Splitting

**Check:**
1. File size (must be >10MB for volume detection)
2. Archive format (ZIP/CBZ supported)
3. Setting enabled

**Solution:**
- Verify file is actually a volume (multiple chapters)
- Check `isVolumeFile()` logic in volumeSplitter.ts:254
- Manually test with `volumeSplitter.isVolumeFile(filePath)`

### Low Confidence Score (<50%)

**Symptoms:**
- Chapters split incorrectly
- Page counts don't match
- Many warnings in logs

**Solutions:**
1. Add chapter page count metadata to database
2. Improve filename structure in volume archive
3. Organize images in chapter-named folders
4. Review volume structure before importing

### Chapters Not Matched to Database

**Check:**
1. Chapters exist in database with status `DOWNLOADING`
2. Chapter numbers in filenames match database
3. Manga ID correct

**Solution:**
```sql
-- Verify chapters waiting for files
SELECT id, title, chapterNumber, downloadStatus
FROM chapters
WHERE mangaId = {mangaId}
  AND downloadStatus = 'DOWNLOADING';
```

### Format Conversion Not Triggered

**Check:**
1. Preferred format set in File Conversion settings
2. Source format different from target format
3. Conversion supported (use `ConverterFactory.isConversionSupported()`)

**Solution:**
- Verify conversion settings: Settings → File Conversion
- Check converter availability
- Review logs for conversion job creation

---

## Performance Testing

### Large Volume Files

Test with volumes of varying sizes:
- Small: 10-50 MB (50-100 pages)
- Medium: 50-200 MB (100-500 pages)
- Large: 200-500 MB (500-1000 pages)
- Very Large: >500 MB (>1000 pages)

**Monitor:**
- Import duration
- Memory usage
- CPU usage during splitting
- Disk I/O

**Expected Performance:**
- Small volumes: <5 seconds
- Medium volumes: 5-15 seconds
- Large volumes: 15-45 seconds
- Very Large: 45-120 seconds

### Concurrent Imports

Test importing multiple volumes simultaneously:
1. Queue 5-10 download jobs
2. Place all files in completion directory
3. Trigger parallel imports

**Monitor:**
- No race conditions
- All imports complete successfully
- Database updates don't conflict
- File locks handled properly

---

## Automated Testing

### Unit Tests (Future Enhancement)

Create unit tests for:
```typescript
// volumeSplitter.ts
describe('VolumeSplitter', () => {
  it('should detect volume files correctly', async () => {
    // Test isVolumeFile() with various file sizes
  });

  it('should detect chapters from filenames', () => {
    // Test detectChaptersByFilename()
  });

  it('should calculate confidence accurately', () => {
    // Test calculateConfidence() with mock metadata
  });
});

// fileImporter.ts
describe('FileImporter', () => {
  it('should create volume folders when enabled', async () => {
    // Test importFile() with createVolumeFolders = true
  });

  it('should integrate volume splitting', async () => {
    // Test importFile() with splitVolumeFiles = true
  });
});
```

### Integration Tests

Test complete workflows:
```typescript
describe('Volume Organization Integration', () => {
  it('should import volume with splitting and folder creation', async () => {
    // Setup: Create manga, chapters, settings
    // Action: Import volume file
    // Assert: Verify files, folders, database
  });
});
```

---

## Reporting Issues

When reporting bugs, include:

1. **Environment:**
   - Operating system
   - Node.js version
   - Database version
   - Available disk space

2. **Settings:**
   - Screenshot of File Organization settings
   - Database config dump:
     ```sql
     SELECT * FROM "Config" WHERE key = 'fileOrganization';
     ```

3. **Test Data:**
   - File structure of test volume
   - File size and format
   - Expected vs actual results

4. **Logs:**
   - Relevant log entries (search for `[FileImporter]` and `[VolumeSplitter]`)
   - Error stack traces if any
   - Timestamp range

5. **Steps to Reproduce:**
   - Exact steps taken
   - Test files used (or structure description)
   - Settings configuration

---

## Success Criteria

The features are working correctly when:

✅ **Volume Folders:**
- Folders created with correct naming format
- Files placed in appropriate volume folders
- Settings persist across sessions
- Preview updates correctly

✅ **Volume Splitting:**
- Volumes detected accurately (>90% for well-organized volumes)
- Chapters split at correct boundaries
- Confidence scoring provides useful warnings
- Database chapters updated correctly
- Split files are readable and complete

✅ **Combined:**
- Both features work together seamlessly
- No file conflicts or duplicates
- Performance remains acceptable
- Error handling is graceful

---

## Next Steps

After successful testing:

1. Document any edge cases discovered
2. Update confidence scoring thresholds if needed
3. Consider adding UI for viewing split confidence scores
4. Implement automated tests for critical paths
5. Create user documentation with examples

---

*Last Updated: 2025-10-16*
*Testing Guide Version: 1.0*
