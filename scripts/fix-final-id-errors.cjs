#!/usr/bin/env node

const fs = require('fs');

// Fix Stack spacing -> gap
const stackFiles = [
  'src/components/addManga/steps/confirmationStep/components/MetadataDisplay.tsx',
  'src/components/library/views/DetailedView.tsx',
  'src/components/manga/StandardMangaList.tsx'
];

stackFiles.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/(\s)spacing="/g, '$1gap="');
    fs.writeFileSync(file, content);
    console.log(`✓ Fixed Stack spacing in ${file}`);
  }
});

// Fix self-imports in utils files
const utilsFiles = [
  'src/utils/idUtils.ts',
  'src/utils/validation/guards/metadata.ts',
  'src/utils/validation/id-utilities.ts'
];

utilsFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    // Remove self-imports
    const lines = content.split('\n');
    const filtered = lines.filter(line => {
      // Remove import lines that import from id-conversion or self
      return !line.includes('import') || (!line.includes('id-conversion') && !line.includes('idUtils') && !line.includes('id-utilities'));
    });
    fs.writeFileSync(file, filtered.join('\n'));
    console.log(`✓ Fixed self-imports in ${file}`);
  }
});

console.log('\n✅ Final fixes completed!');
