#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript files
const files = glob.sync('src/server/**/*.{ts,tsx}', { nodir: true });

let fixedCount = 0;

files.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Fix the import path for id-conversion
  const updatedContent = content.replace(
    /from ["']\.\.\/\.\.\/utils\/id-conversion["']/g,
    'from "../../../utils/id-conversion"'
  );
  
  if (content !== updatedContent) {
    fs.writeFileSync(filePath, updatedContent);
    fixedCount++;
    console.log(`✓ Fixed import path in ${filePath}`);
  }
});

console.log(`\n✅ Fixed ${fixedCount} import paths`);
