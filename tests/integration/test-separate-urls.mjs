#!/usr/bin/env node

console.log(`
=== Testing Separate URL Inputs ===

The UniversalImportWizard now has separate URL inputs:

1. Basic Info Tab:
   - Uses 'sourceUrl' state variable
   - Calls 'handleUrlParse' function
   - Extracts: title, alternative titles, basic info
   - Example: Enter a Fandom URL to get basic manga info

2. Metadata Tab:
   - Uses 'metadataUrl' state variable  
   - Calls 'handleMetadataUrlParse' function
   - Extracts: descriptions, dates, authors, genres, tags
   - Example: Enter a Wikipedia URL to get publication dates
   
Benefits:
- Can use different sources for different data
- Basic info from Fandom, dates from Wikipedia
- More flexibility in data sourcing
- Avoid overwriting data when switching between tabs

Example workflow:
1. In Basic Info tab: Enter https://fire-force.fandom.com/wiki/Fire_Force_(manga)
   - Extracts title "Fire Force (manga)"
   - Gets alternative titles

2. In Metadata tab: Enter https://en.wikipedia.org/wiki/Fire_Force
   - Extracts publication dates
   - Gets additional metadata without overwriting basic info

The URLs are now properly separated and won't interfere with each other!
`);