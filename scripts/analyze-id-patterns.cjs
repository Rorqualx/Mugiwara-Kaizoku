#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns to search for
const patterns = {
  'Number()': /Number\([^)]+\)/g,
  'parseInt()': /parseInt\([^)]+\)/g,
  'parseFloat()': /parseFloat\([^)]+\)/g,
  'toNumberId()': /toNumberId\([^)]+\)/g,
  'toNumericId()': /toNumericId\([^)]+\)/g,
  'toStringId()': /toStringId\([^)]+\)/g,
  'String()': /String\([^)]+\)/g,
  '.toString()': /\.toString\(\)/g,
  'inline +': /\+[a-zA-Z_$][a-zA-Z0-9_$]*/g,  // +variable pattern
  'template literals': /`\$\{[^}]+\}`/g
};

// Count occurrences
const counts = {};
const examples = {};

// Initialize counters
for (const pattern in patterns) {
  counts[pattern] = 0;
  examples[pattern] = [];
}

// Get all TypeScript files
const files = glob.sync('src/**/*.{ts,tsx}', { ignore: ['**/node_modules/**', '**/.git/**'] });

console.log(`Analyzing ${files.length} files...\n`);

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, lineNum) => {
    for (const [patternName, regex] of Object.entries(patterns)) {
      const matches = line.match(regex);
      if (matches) {
        counts[patternName] += matches.length;
        
        // Store first 3 examples
        if (examples[patternName].length < 3) {
          examples[patternName].push({
            file: file.replace('src/', ''),
            line: lineNum + 1,
            code: line.trim().substring(0, 100)
          });
        }
      }
    }
  });
});

// Sort by count
const sortedPatterns = Object.entries(counts)
  .sort(([,a], [,b]) => b - a);

console.log('=== ID Conversion Patterns Analysis ===\n');
console.log('Pattern Usage Statistics:');
console.log('-------------------------');

sortedPatterns.forEach(([pattern, count]) => {
  if (count > 0) {
    console.log(`\n${pattern}: ${count} occurrences`);
    
    if (examples[pattern].length > 0) {
      console.log('  Examples:');
      examples[pattern].forEach(ex => {
        console.log(`    ${ex.file}:${ex.line}`);
        console.log(`      ${ex.code}`);
      });
    }
  }
});

// Analyze context for Number() calls
console.log('\n\n=== Detailed Number() Usage Analysis ===\n');

const numberContexts = {
  'ID conversions': 0,
  'Parsing strings': 0,
  'Math operations': 0,
  'Other': 0
};

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const numberMatches = content.matchAll(/Number\(([^)]+)\)/g);
  
  for (const match of numberMatches) {
    const arg = match[1];
    
    if (arg.includes('id') || arg.includes('Id') || arg.includes('ID')) {
      numberContexts['ID conversions']++;
    } else if (arg.includes('.') || arg.includes('parse') || arg.includes('value')) {
      numberContexts['Parsing strings']++;
    } else if (arg.includes('+') || arg.includes('-') || arg.includes('*') || arg.includes('/')) {
      numberContexts['Math operations']++;
    } else {
      numberContexts['Other']++;
    }
  }
});

console.log('Number() usage contexts:');
for (const [context, count] of Object.entries(numberContexts)) {
  console.log(`  ${context}: ${count}`);
}

console.log('\n=== Recommendations ===\n');
console.log('1. Most common pattern:', sortedPatterns[0][0]);
console.log('2. ID-specific conversions should use: toNumericId()');
console.log('3. String parsing should use: parseInt() with radix');
console.log('4. Type coercion (+variable) should be avoided');

