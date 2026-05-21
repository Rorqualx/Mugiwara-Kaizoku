# Alternative Titles Auto-Merge Feature

## Overview
Alternative titles are now automatically collected and merged from all selected sources, eliminating the need to manually manage them when adding additional metadata sources.

## How It Works

### Automatic Merging
When you select an additional source or provider:
1. Alternative titles from the new source are automatically extracted
2. They are merged with existing alternative titles
3. Duplicates are automatically removed using Set operations
4. The merged list is displayed in the UI

### Implementation Details

#### 1. When a Source is Auto-Selected
```typescript
// When a matching result is found and selected
const alternativeTitles = getMetadataField(matchingResult, 'alternativeTitles', []);
if (alternativeTitles && alternativeTitles.length > 0) {
  // Merge with existing alternative titles instead of replacing
  const existingTitles = prev.alternativeTitles?.value || [];
  const mergedTitles = [...new Set([...existingTitles, ...alternativeTitles])];
  updates.alternativeTitles = { source: sourceKey, value: mergedTitles };
}
```

#### 2. When Enhanced Data is Received
```typescript
// When fetching enhanced metadata from AniList, Fandom, etc.
if (enhancedData.alternativeTitles && enhancedData.alternativeTitles.length > 0) {
  // Merge with existing alternative titles
  const existingTitles = updatedResult.alternativeTitles || [];
  updatedResult.alternativeTitles = [...new Set([...existingTitles, ...enhancedData.alternativeTitles])];
}
```

#### 3. Manual Selection from Dropdown
```typescript
// When user manually selects from alternative titles dropdown
onChange={(value) => {
  if (value) {
    const manga = allSources[value];
    const altTitles = getMetadataField(manga, 'alternativeTitles', []);
    setFieldSelections(prev => {
      // Merge with existing alternative titles
      const existingTitles = prev.alternativeTitles?.value || [];
      const mergedTitles = [...new Set([...existingTitles, ...newTitles])];
      return {
        ...prev,
        alternativeTitles: { 
          source: value, 
          value: mergedTitles
        }
      };
    });
  }
}}
```

## User Interface

### Collection Display
- Shows count of collected titles: `"X titles collected (auto-merged from all sources)"`
- Displays helpful text: `"Titles will be auto-merged when sources are selected"`

### Title Management
- All collected alternative titles are displayed as clickable badges
- Click on any badge to remove that specific title
- Visual feedback with remove icon (X) in each badge
- Badges are styled with blue outline for visibility

### Example UI:
```
Alternative Titles: [Select ▼]
📝 5 titles collected (auto-merged from all sources)

Collected Alternative Titles (click to remove):
[Fire Force ×] [Enen no Shouboutai ×] [炎炎ノ消防隊 ×] [En En no Shōbōtai ×] [Fire Brigade of Flames ×]
```

## Benefits

1. **Automatic Collection**: No need to manually copy alternative titles from each source
2. **No Duplicates**: Set operations ensure each title appears only once
3. **Source Agnostic**: Works with all providers (AniList, Fandom, ComicVine, Wikipedia)
4. **Easy Management**: Remove unwanted titles with a single click
5. **Comprehensive Coverage**: Gathers all possible names/titles for better searchability

## Technical Details

### Merge Points
Alternative titles are merged at three key points:
1. When a provider result is auto-matched and selected
2. When enhanced metadata is fetched from a provider
3. When user manually selects from the dropdown

### Data Sources Checked
- `alternativeTitles` field
- `synonyms` field (fallback)
- `rawData.alternativeTitles`
- `metadata.alternativeTitles`

### Deduplication
Uses JavaScript Set to remove duplicates:
```typescript
const mergedTitles = [...new Set([...existingTitles, ...newTitles])];
```

## Testing

1. Search for a manga (e.g., "Fire Force")
2. Select results from multiple providers
3. Observe alternative titles being automatically collected
4. Verify no duplicates appear
5. Click on individual titles to remove them
6. Confirm the final list is saved with the manga

## Future Enhancements

Potential improvements:
- Add "Clear All" button for alternative titles
- Allow manual addition of custom alternative titles
- Show which source each title came from
- Sort titles alphabetically or by source
- Add title language detection/labeling