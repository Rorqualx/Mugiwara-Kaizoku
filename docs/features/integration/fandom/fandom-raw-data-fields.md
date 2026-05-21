# Fandom API Raw Data Fields & Text Content

## 1. Search API Response Fields
**Endpoint:** `https://fire-force.fandom.com/api.php?action=query&list=search`

### Raw Fields:
```json
{
  "ns": 0,                              // Namespace (0 = main articles)
  "title": "Fire Force (manga)",        // Page title
  "pageid": 131,                        // Unique page ID
  "size": 7156,                         // Page size in bytes
  "wordcount": 999,                     // Word count
  "snippet": "",                        // Search snippet (empty)
  "timestamp": "2025-06-13T18:24:41Z", // Last modified
  "titlesnippet": ""                    // Title snippet (empty)
}
```

## 2. Article Details API Fields
**Endpoint:** `https://fire-force.fandom.com/api/v1/Articles/Details?ids=131`

### Raw Fields:
```json
{
  "id": 131,
  "title": "Fire Force (manga)",
  "ns": 0,
  "url": "/wiki/Fire_Force_(manga)",
  "full_url": "https://fire-force.fandom.com/wiki/Fire_Force_(manga)",
  "revision": {
    "id": 37872,
    "user": "Namakemono 37",
    "user_id": 54236919,
    "timestamp": "1749839081"
  },
  "wiki_display_name": "Fire Force Wiki",
  "type": "article",
  "abstract": "Main article: Story Arcs Main article: List of Volumes Main article: List of Chapters As of April 10th, 2022, Fire Force has 304 chapters. It also has 33 volumes published in Japanese and in English...",
  "thumbnail": "https://static.wikia.nocookie.net/fire-brigade-of-flames/images/4/4c/FBOF_on_WSM_cover.png",
  "original_dimensions": {
    "width": 909,
    "height": 1300
  }
}
```

## 3. Exact Text Content Extracted

### From Initial Search (NO description):
- **title**: "Fire Force (manga)"
- **description**: "No description available" (hardcoded placeholder)
- **coverImage**: null (not in search response)
- **volumes**: undefined
- **chapters**: undefined

### From Article Details API:
- **abstract** (raw text): "Main article: Story Arcs Main article: List of Volumes Main article: List of Chapters As of April 10th, 2022, Fire Force has 304 chapters. It also has 33 volumes published in Japanese and in English. In a conversation with Fairy Tail's author, Hiro Mashima, the author of Fire Force, Atsushi Ōkubo, stated that everybody in the manga having an ability relating to fire could be interesting, jokingly saying it branches from his own monomania. As the manga carries a heavy and dark theme, Ōkubo..."

### From Page Props:
- **fandomdescription**: Same as abstract above

### From Parse API (Infobox):
```
Series Info
Romaji: En'en no Shōbōtai
Kanji: 炎炎ノ消防隊
Author: Atsushi Ōkubo
Original Run: September 23, 2015 - February 22, 2022
Volume(s): 33
Genre: Action, Supernatural, Dark Fantasy, Sci-Fi
```

## 4. What Gets Mapped to Our System

### Initial Response (before enhancement):
```javascript
{
  id: "131",
  title: "Fire Force (manga)",
  description: "No description available",  // PLACEHOLDER!
  coverImage: null,
  url: "https://fire-force.fandom.com/wiki/Fire_Force_(manga)",
  volumes: undefined,
  chapters: undefined,
  genres: [],
  authors: [],
  artists: []
}
```

### After Enhanced Fetch (getEnhancedFandomMetadata):
The system makes additional calls to scrape the wiki page and extract:
- **description**: From the abstract or scraped content
- **volumes**: 33 (parsed from infobox or content)
- **chapters**: 305 (parsed from content, updated from 304)
- **genres**: ["Action", "Supernatural", "Dark Fantasy", "Sci-Fi"] (from infobox)
- **author**: "Atsushi Ōkubo" (from infobox)
- **startDate**: "September 23, 2015" (from infobox)
- **endDate**: "February 22, 2022" (from infobox)

## 5. Key Raw Text Values

### Volume/Chapter Text in Abstract:
- "Fire Force has **304 chapters**"
- "It also has **33 volumes** published"

### Alternative Titles from Infobox:
- Romaji: "En'en no Shōbōtai"
- Kanji: "炎炎ノ消防隊"
- English: "Fire Force"

### Author Text:
- "Author: Atsushi Ōkubo"

### Date Text:
- "Original Run: September 23, 2015 - February 22, 2022"

## Note on Enhanced Fetching
The enhanced fetch (which takes ~30 seconds) actually scrapes the HTML page and parses the infobox table to extract structured data that's not available through the APIs. This is why:
1. Initial search shows "No description available"
2. Enhanced fetch gets the real description
3. Volume/chapter counts appear after enhancement
4. The process is slow (30+ seconds)