#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Check all server files for wrong imports
const files = glob.sync('src/server/**/*.{ts,tsx}', { nodir: true });

let fixedCount = 0;
const errors = [];

files.forEach(filePath => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if file has wrong import
    if (content.includes('from "../../../utils/id-conversion"')) {
      // Count directory depth from src/server
      const relativePath = path.relative('src/server', filePath);
      const depth = relativePath.split('/').length - 1;
      
      // Create correct relative path
      const correctPath = '../'.repeat(depth + 2) + 'utils/id-conversion';
      
      const updatedContent = content.replace(
        /from ["']\.\.\/\.\.\/\.\.\/utils\/id-conversion["']/g,
        `from "${correctPath}"`
      );
      
      if (content !== updatedContent) {
        fs.writeFileSync(filePath, updatedContent);
        fixedCount++;
        console.log(`✓ Fixed ${filePath} -> ${correctPath}`);
      }
    }
  } catch (error) {
    errors.push({ file: filePath, error: error.message });
  }
});

// Also check for the wrong gap prop in SimpleGrid
const uiFiles = glob.sync('src/components/**/*.tsx', { nodir: true });
uiFiles.forEach(filePath => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const updatedContent = content.replace(/}} gap="/g, '}} spacing="');
    
    if (content !== updatedContent) {
      fs.writeFileSync(filePath, updatedContent);
      console.log(`✓ Fixed SimpleGrid gap prop in ${filePath}`);
      fixedCount++;
    }
  } catch (error) {
    errors.push({ file: filePath, error: error.message });
  }
});

console.log(`\n✅ Fixed ${fixedCount} issues`);

if (errors.length > 0) {
  console.log('\n❌ Errors:');
  errors.forEach(err => console.log(`  - ${err.file}: ${err.error}`));
}
