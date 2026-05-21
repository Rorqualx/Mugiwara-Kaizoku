# Volume/Chapter Display Fixes

## Issues Identified

### 1. Chapter Count Shows as 0
- **Problem**: ComicVine volumes show `chapterCount: 0` because chapters need to be scraped from volume pages
- **Location**: Lines 3108, 3706, 9644, 9706, 9761, 9818, 9919 in UniversalImportWizard.tsx
- **Impact**: Chapter badges show "0 chapters" even when chapters exist

### 2. Duplicate Volume Covers
- **Problem**: The `useEffect` on line 10593 adds covers every time `displayVolumes` changes without checking for existing covers
- **Location**: Lines 10593-10608 in UniversalImportWizard.tsx
- **Impact**: Volume covers are duplicated multiple times when switching providers

### 3. Missing Chapter Tab Content
- **Problem**: When switching chapter display source, the chapters don't update correctly
- **Impact**: Chapter tab shows empty content with only "Chapter" text and a selection box

## Recommended Fixes

### Fix 1: Display Chapter Count from Source Data

```typescript
// Instead of using chapterCount: 0 for ComicVine, use the total chapter count
// Line 3108
chapterCount: sourceData.chapters || sourceData.metadata?.chapters || 0,

// For volume display, show estimated chapters per volume
const estimatedChaptersPerVolume = Math.ceil(totalChapters / volumeCount);
```

### Fix 2: Prevent Duplicate Volume Covers

```typescript
// Line 10593 - Fix the useEffect to prevent duplicates
useEffect(() => {
    if (displayVolumes.length > 0) {
        const volumeCovers = displayVolumes
            .filter((vol: any) => vol.coverImageUrl || vol.coverUrl || vol.coverImage || vol.cover || vol.image)
            .map((vol: any) => vol.coverImageUrl || vol.coverUrl || vol.coverImage || vol.cover || vol.image)
            .filter(Boolean);

        if (volumeCovers.length > 0) {
            logger.info('Auto-populating volume covers from displayVolumes:', volumeCovers.length);
            setMediaGallery(prev => {
                // Create a Set to remove duplicates
                const existingCovers = new Set(prev.volumeCovers);
                const newCovers = volumeCovers.filter(cover => !existingCovers.has(cover));

                if (newCovers.length > 0) {
                    return {
                        ...prev,
                        volumeCovers: [...prev.volumeCovers, ...newCovers]
                    };
                }
                return prev;
            });
        }
    }
}, [displayVolumes]);
```

### Fix 3: Group Volume Covers by Provider

```typescript
// New approach: Group covers by provider
interface GroupedVolumeCovers {
    [provider: string]: {
        covers: string[];
        selected: boolean;
    };
}

// In Media Step component
const groupedCovers = useMemo(() => {
    const groups: GroupedVolumeCovers = {};

    // Group covers from each provider
    Object.entries(selectedSourcesMetadata).forEach(([provider, data]) => {
        const covers = extractVolumeCovers(data);
        if (covers.length > 0) {
            groups[provider] = {
                covers,
                selected: false
            };
        }
    });

    return groups;
}, [selectedSourcesMetadata]);

// Render grouped covers with select all per provider
<Stack>
    {Object.entries(groupedCovers).map(([provider, group]) => (
        <Box key={provider}>
            <Group>
                <Text fw={600}>{provider.toUpperCase()} Covers</Text>
                <Checkbox
                    label="Select All"
                    checked={group.selected}
                    onChange={(e) => handleSelectAllForProvider(provider, e.currentTarget.checked)}
                />
            </Group>
            <SimpleGrid cols={4}>
                {group.covers.map((cover, idx) => (
                    <VolumeCard key={`${provider}-${idx}`} cover={cover} />
                ))}
            </SimpleGrid>
        </Box>
    ))}
</Stack>
```

### Fix 4: Properly Update Chapters When Switching Sources

```typescript
// When chapter display source changes, update the displayed chapters
useEffect(() => {
    if (chapterDisplaySource) {
        const sourceData = getSourceData(chapterDisplaySource);
        const chapters = getChaptersForSource(sourceData, chapterDisplaySource);

        // Update the displayed chapters
        setDisplayedChapters(chapters);

        // Update chapter URLs for selection
        if (chapters.length > 0) {
            setAllChapterUrls(chapters);
        }
    }
}, [chapterDisplaySource]);
```

### Fix 5: Show Estimated Chapter Counts for ComicVine

```typescript
// For ComicVine volumes that haven't been scraped yet
const getChapterBadgeText = (volume: any, source: string) => {
    if (source === 'comicvine' && volume.chapterCount === 0) {
        // If we have total chapters, estimate
        const totalChapters = volumesData?.totalChapters || 0;
        const volumeCount = displayVolumes.length || 1;

        if (totalChapters > 0) {
            const estimated = Math.ceil(totalChapters / volumeCount);
            return `~${estimated} chapters (pending scrape)`;
        }
        return 'Chapters pending scrape';
    }

    return `${volume.chapters?.length || volume.chapterCount || 0} chapters`;
};
```

## Implementation Priority

1. **High Priority**: Fix duplicate volume covers (Fix 2) - Impacts UI immediately
2. **High Priority**: Fix chapter display when switching sources (Fix 4) - Core functionality broken
3. **Medium Priority**: Group covers by provider (Fix 3) - Better UX for multi-source imports
4. **Low Priority**: Show estimated chapter counts (Fix 5) - Nice to have for ComicVine

## Testing Checklist

- [ ] Volume covers don't duplicate when switching providers
- [ ] Chapter counts display correctly for all providers
- [ ] Chapter tab shows content when switching display sources
- [ ] Volume covers are grouped by provider with select all functionality
- [ ] ComicVine volumes show estimated or pending status for chapters