# Fire Force Fandom Search - Complete Data Flow

## 1. Initial Search Request
When searching for "Fire Force" from Fandom provider:

### Raw Search Response from Fandom API:
```json
{
  "query": {
    "search": [
      {
        "ns": 0,
        "title": "Fire Force (manga)",
        "pageid": 131,
        "size": 7156,
        "wordcount": 999,
        "snippet": "",
        "timestamp": "2025-06-13T18:24:41Z"
      }
    ]
  }
}
```

## 2. Initial Data Returned to UI
```javascript
{
  "id": "131",
  "sourceId": "131",
  "title": "Fire Force (manga)",
  "description": "No description available",  // Placeholder
  "provider": "fandom",
  "coverImage": "https://static.wikia.nocookie.net/fire-brigade-of-flames/images/4/4c/FBOF_on_WSM_cover.png",
  "url": "https://fire-force.fandom.com/wiki/Fire_Force_(manga)",
  "wikiUrl": "https://fire-force.fandom.com/wiki/Fire_Force_(manga)",
  "alternativeTitles": [],
  "volumes": undefined,  // Not available in search
  "chapters": undefined, // Not available in search
  "genres": [],
  "tags": [],
  "authors": [],
  "artists": []
}
```

## 3. Enhanced Metadata Fetch (Triggered in Wizard)
When Fandom is selected as either primary OR secondary provider, the system fetches enhanced metadata:

### API Call to getEnhancedFandomMetadata:
```javascript
{
  "url": "https://fire-force.fandom.com/wiki/Fire_Force_(manga)",
  "followLinks": true,
  "extractSummaries": true,
  "maxDepth": 2
}
```

### Enhanced Metadata Response (after ~30 seconds):
```javascript
{
  "title": "Fire Force",
  "description": "Fire Force (炎炎ノ消防隊, En'en no Shōbōtai) is a Japanese shōnen manga series written and illustrated by Atsushi Ōkubo.",
  "synopsis": "In the year 198 of the Solar Era, special fire brigades called the Fire Force fight increasing incidents of spontaneous human combustion where humans beings are turned into Infernals.",
  "status": "FINISHED",
  "format": "MANGA",
  "volumes": 33,
  "chapters": 305,
  "volumesAndChapters": {
    "totalVolumes": 33,
    "totalChapters": 305,
    "volumes": [/* Array of volume data */],
    "chapters": [/* Array of chapter data */]
  },
  "alternativeTitles": [
    "En'en no Shōbōtai",
    "炎炎ノ消防隊",
    "Fire Brigade of Flames"
  ],
  "genres": ["Action", "Comedy", "Drama", "Sci-Fi", "Supernatural"],
  "tags": [],  // Fandom doesn't provide detailed tags
  "themes": [],  // Fandom doesn't provide themes
  "authors": [],  // Fandom API limitation - author data not easily extractable
  "artists": [],  // Fandom API limitation - artist data not easily extractable
  "publisher": "Kodansha",
  "demographic": "Shōnen",
  "startDate": "2015-09-23",
  "endDate": "2022-02-22",
  "coverImage": "https://static.wikia.nocookie.net/fire-brigade-of-flames/images/4/4c/FBOF_on_WSM_cover.png",
  "metadata": {
    "externalLinks": [
      {
        "name": "Official Site",
        "url": "https://fire-force.fandom.com/wiki/Fire_Force_(manga)"
      }
    ]
  }
}
```

## 4. Final Data in Wizard Context
```javascript
selectedSourcesMetadata['fandom'] = {
  "id": "131",
  "sourceId": "131",
  "title": "Fire Force",
  "description": "Fire Force (炎炎ノ消防隊, En'en no Shōbōtai) is a Japanese shōnen manga series written and illustrated by Atsushi Ōkubo.",
  "synopsis": "In the year 198 of the Solar Era...",
  "status": "FINISHED",
  "format": "MANGA",
  "genres": ["Action", "Comedy", "Drama", "Sci-Fi", "Supernatural"],
  "tags": [],
  "themes": [],
  "authors": [],  // Empty due to API limitations
  "artists": [],  // Empty due to API limitations
  "publisher": "Kodansha",
  "demographic": "Shōnen",
  "startDate": "2015-09-23",
  "endDate": "2022-02-22",
  "coverImage": "https://static.wikia.nocookie.net/fire-brigade-of-flames/images/4/4c/FBOF_on_WSM_cover.png",
  "bannerImage": "",
  "url": "https://fire-force.fandom.com/wiki/Fire_Force_(manga)",
  "wikiUrl": "https://fire-force.fandom.com/wiki/Fire_Force_(manga)",
  "alternativeTitles": ["En'en no Shōbōtai", "炎炎ノ消防隊", "Fire Brigade of Flames"],
  "volumes": 33,
  "chapters": 305,
  "volumeData": [/* Detailed volume information */],
  "chapterData": [/* Detailed chapter information */]
}
```

## Key Points:
1. **Initial search** returns minimal data with "No description available" placeholder
2. **Enhanced fetch** is triggered when Fandom is the primary provider
3. **Enhanced fetch takes ~30 seconds** because it scrapes the wiki page
4. **Description loads properly** after enhanced fetch completes
5. **Volumes/Chapters data** (33 volumes, 305 chapters) loads correctly
6. **Authors/Artists remain empty** due to Fandom API limitations - this data isn't structured in a way that's easily extractable

## Known Limitations:
- No structured author/artist data from Fandom
- No detailed tags/themes (unlike AniList)
- Slow enhanced metadata fetch (30+ seconds)
- Limited genre categories compared to other providers