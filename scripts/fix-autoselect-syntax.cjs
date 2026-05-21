#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, '../src/components/addManga/UniversalImportWizard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Track changes
let changeCount = 0;

// Fix malformed AutoSelectField components
// They were incorrectly transformed and need proper closing tags

// First, let's revert all AutoSelectField back to Select temporarily
// to fix them properly
content = content.replace(/<AutoSelectField\s+label="([^"]+)"\s+fieldName="[^"]+"\s+autoSelectSingle={true}\s+useSmartSelection={true}/g, '<Select label="$1"');

console.log('Reverted AutoSelectField components back to Select');

// Now properly replace Select components with AutoSelectField where appropriate
const fieldsToReplace = [
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
  'AniList ID',
  'MyAnimeList ID',
  'MangaDex ID',
  'ComicVine ID'
];

fieldsToReplace.forEach(label => {
  // Match Select components with this label
  const regex = new RegExp(`<Select\\s+label="${label}"([^>]*?)/>`, 'gs');
  
  content = content.replace(regex, (match, props) => {
    changeCount++;
    
    // Derive field name from label
    const fieldName = label
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/_id$/, 'Id');
    
    // Extract value and onChange from props
    const valueMatch = props.match(/value={([^}]+)}/);
    const onChangeMatch = props.match(/onChange={([^}]+})}/);
    const dataMatch = props.match(/data={([^}]+(?:\([^)]*\))?[^}]*)}/);
    const placeholderMatch = props.match(/placeholder="([^"]+)"/);
    
    let newComponent = `<AutoSelectField
      label="${label}"
      fieldName="${fieldName}"
      autoSelectSingle={true}
      useSmartSelection={true}`;
    
    if (valueMatch) {
      newComponent += `
      value={${valueMatch[1]}}`;
    }
    
    if (onChangeMatch) {
      newComponent += `
      onChange={${onChangeMatch[1]}}`;
    }
    
    if (dataMatch) {
      newComponent += `
      data={${dataMatch[1]}}`;
    }
    
    if (placeholderMatch) {
      newComponent += `
      placeholder="${placeholderMatch[1]}"`;
    }
    
    // Add common props
    newComponent += `
      searchable
      clearable
      allowDeselect
    />`;
    
    return newComponent;
  });
});

// Write the updated content back
fs.writeFileSync(filePath, content, 'utf8');

console.log(`✅ Successfully fixed ${changeCount} Select components to AutoSelectField`);
console.log(`📝 File updated: ${filePath}`);