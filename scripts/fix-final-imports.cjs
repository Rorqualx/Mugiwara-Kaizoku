#!/usr/bin/env node

const fs = require('fs');

// Fix SimpleGrid gap -> spacing in MetadataDisplay
const metadataFile = 'src/components/addManga/steps/confirmationStep/components/MetadataDisplay.tsx';
if (fs.existsSync(metadataFile)) {
  let content = fs.readFileSync(metadataFile, 'utf8');
  content = content.replace(/(<SimpleGrid[^>]*)\bgap="/g, '$1spacing="');
  fs.writeFileSync(metadataFile, content);
  console.log(`✓ Fixed SimpleGrid gap in ${metadataFile}`);
}

// Add imports to validation files that need them
const validationFiles = [
  'src/utils/validation/guards/metadata.ts',
  'src/utils/validation/id-utilities.ts'
];

validationFiles.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Check if file uses toNumericId but doesn't import it
    if (content.includes('toNumericId') && !content.includes('import') && !content.includes('toNumericId')) {
      // Add import at the beginning
      content = `import { toNumericId, toStringId } from '../../utils/id-conversion';\n${content}`;
    } else if (content.includes('toNumericId') && !content.includes('from \'../../utils/id-conversion\'') && !content.includes('from "../../utils/id-conversion"')) {
      // Add import after existing imports
      const lines = content.split('\n');
      let lastImportIndex = -1;
      
      lines.forEach((line, i) => {
        if (line.startsWith('import ')) {
          lastImportIndex = i;
        }
      });
      
      if (lastImportIndex >= 0) {
        lines.splice(lastImportIndex + 1, 0, 'import { toNumericId, toStringId } from \'../../utils/id-conversion\';');
        content = lines.join('\n');
      } else {
        content = `import { toNumericId, toStringId } from '../../utils/id-conversion';\n${content}`;
      }
    }
    
    fs.writeFileSync(file, content);
    console.log(`✓ Fixed imports in ${file}`);
  }
});

console.log('\n✅ Final import fixes completed!');
