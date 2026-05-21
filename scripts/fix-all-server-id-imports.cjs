#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript files in src/server
const files = glob.sync('src/server/**/*.{ts,tsx}', { nodir: true });

let fixedCount = 0;
const issues = [];

files.forEach(filePath => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if file has any id-conversion import
    if (content.includes('id-conversion')) {
      // Calculate correct relative path from file location to src/utils
      const fileDir = path.dirname(filePath);
      const relativePath = path.relative(fileDir, 'src/utils');
      const correctImportPath = relativePath + '/id-conversion';
      
      // Fix any import with id-conversion
      const updatedContent = content.replace(
        /from ["'][^"']*id-conversion["']/g,
        `from "${correctImportPath}"`
      );
      
      if (content !== updatedContent) {
        fs.writeFileSync(filePath, updatedContent);
        fixedCount++;
        console.log(`✓ Fixed ${filePath}`);
        console.log(`  New path: ${correctImportPath}`);
      }
    }
  } catch (error) {
    issues.push({ file: filePath, error: error.message });
  }
});

console.log(`\n✅ Fixed ${fixedCount} files`);

if (issues.length > 0) {
  console.log('\n❌ Issues:');
  issues.forEach(issue => console.log(`  - ${issue.file}: ${issue.error}`));
}
