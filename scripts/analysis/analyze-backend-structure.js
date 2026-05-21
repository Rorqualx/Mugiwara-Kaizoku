const fs = require('fs');
const path = require('path');

// Function to recursively scan directories
function scanDirectory(dir, depth = 0, maxDepth = 3) {
  const results = {
    path: dir,
    type: 'directory',
    children: []
  };
  
  if (depth > maxDepth) return results;
  
  try {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      if (file.startsWith('.') || file === 'node_modules') continue;
      
      const fullPath = path.join(dir, file);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        results.children.push(scanDirectory(fullPath, depth + 1, maxDepth));
      } else if (stats.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
        results.children.push({
          path: fullPath,
          type: 'file',
          name: file
        });
      }
    }
  } catch (error) {
    console.error(`Error scanning ${dir}:`, error.message);
  }
  
  return results;
}

// Analyze backend structure
console.log('=== BACKEND STRUCTURE ANALYSIS ===\n');

// 1. Server Structure
console.log('1. SERVER STRUCTURE:');
const serverStructure = scanDirectory('./src/server');
console.log(JSON.stringify(serverStructure, null, 2));

// 2. API Structure
console.log('\n2. API STRUCTURE:');
const apiStructure = scanDirectory('./src/api');
console.log(JSON.stringify(apiStructure, null, 2));

// 3. Types Structure
console.log('\n3. TYPES STRUCTURE:');
const typesStructure = scanDirectory('./src/types');
console.log(JSON.stringify(typesStructure, null, 2));

// 4. Analyze duplicate interfaces
console.log('\n4. DUPLICATE INTERFACES ANALYSIS:');

const interfacePattern = /export\s+(interface|type)\s+(\w+)/g;
const interfaces = new Map();

function findInterfaces(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stats = fs.statSync(fullPath);
    
    if (stats.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      findInterfaces(fullPath);
    } else if (stats.isFile() && file.endsWith('.ts')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        let match;
        
        while ((match = interfacePattern.exec(content)) !== null) {
          const interfaceName = match[2];
          if (!interfaces.has(interfaceName)) {
            interfaces.set(interfaceName, []);
          }
          interfaces.get(interfaceName).push(fullPath);
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }
}

findInterfaces('./src/types');

const duplicates = Array.from(interfaces.entries())
  .filter(([name, locations]) => locations.length > 1)
  .sort((a, b) => b[1].length - a[1].length);

console.log(`Found ${duplicates.length} duplicate interfaces:\n`);
duplicates.forEach(([name, locations]) => {
  console.log(`${name} (${locations.length} occurrences):`);
  locations.forEach(loc => console.log(`  - ${loc}`));
  console.log();
});
