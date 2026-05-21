#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, '../src/components/addManga/UniversalImportWizard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Track changes
let changeCount = 0;

// List of fields that should have auto-selection
const autoSelectFields = [
  'Title',
  'Status',
  'Format',
  'Publisher',
  'Start Date',
  'End Date',
  'Country',
  'Language',
  'Release Year',
  'Average Score',
  'Popularity',
  'Total Volumes',
  'Total Chapters',
  'Volume Source',
  'Chapter Source',
  'AniList ID',
  'MyAnimeList ID',
  'MangaDex ID',
  'ComicVine ID'
];

// Replace Select components with AutoSelectField for specific fields
autoSelectFields.forEach(fieldLabel => {
  // Create regex to match Select with this label
  const regex = new RegExp(`<Select(\\s+)label="${fieldLabel}"`, 'g');
  
  // Count matches before replacement
  const matches = content.match(regex);
  if (matches) {
    changeCount += matches.length;
    
    // Replace with AutoSelectField
    content = content.replace(regex, (match) => {
      // Determine field name from label
      const fieldName = fieldLabel
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/_id$/, 'Id');
      
      return `<AutoSelectField$1label="${fieldLabel}"$1fieldName="${fieldName}"$1autoSelectSingle={true}$1useSmartSelection={true}`;
    });
  }
});

// Also replace Select components for description fields that have edit mode
const descriptionFields = ['description', 'synopsis', 'plot', 'background', 'history', 'reception'];
descriptionFields.forEach(field => {
  // Match Select in ternary expressions for these fields
  const regex = new RegExp(`<Select value={selectedMetadata\\.${field}}`, 'g');
  
  const matches = content.match(regex);
  if (matches) {
    changeCount += matches.length;
    content = content.replace(regex, 
      `<AutoSelectField fieldName="${field}" autoSelectSingle={true} useSmartSelection={true} value={selectedMetadata.${field}}`
    );
  }
});

// Write the updated content back
fs.writeFileSync(filePath, content, 'utf8');

console.log(`✅ Successfully updated ${changeCount} Select components to AutoSelectField`);
console.log(`📝 File updated: ${filePath}`);