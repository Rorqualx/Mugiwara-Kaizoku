#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Define the replacements to make
const replacements = [
  {
    name: 'TaskList',
    from: "import { TaskList } from '../components/tasks/TaskList';",
    to: "import { ResponsiveTaskList } from '../components/tasks/ResponsiveTaskList';",
    componentFrom: '<TaskList',
    componentTo: '<ResponsiveTaskList',
    closeFrom: '</TaskList>',
    closeTo: '</ResponsiveTaskList>'
  },
  {
    name: 'UserList',
    from: "import { UserList } from '../components/systems/UserList';",
    to: "import { ResponsiveUserList } from '../components/systems/ResponsiveUserList';",
    componentFrom: '<UserList',
    componentTo: '<ResponsiveUserList',
    closeFrom: '</UserList>',
    closeTo: '</ResponsiveUserList>'
  },
  {
    name: 'IndexerList',
    from: "import { IndexerList } from './IndexerList';",
    to: "import { ResponsiveIndexerList } from './ResponsiveIndexerList';",
    componentFrom: '<IndexerList',
    componentTo: '<ResponsiveIndexerList',
    closeFrom: '</IndexerList>',
    closeTo: '</ResponsiveIndexerList>'
  },
  {
    name: 'ProwlarrIndexerList',
    from: "import { ProwlarrIndexerList } from '../components/settings/prowlarr/ProwlarrIndexerList';",
    to: "import { ResponsiveIndexerList } from '../components/settings/prowlarr/ResponsiveIndexerList';",
    componentFrom: '<ProwlarrIndexerList',
    componentTo: '<ResponsiveIndexerList',
    closeFrom: '</ProwlarrIndexerList>',
    closeTo: '</ResponsiveIndexerList>'
  }
];

// Function to update a file
function updateFile(filePath, replacement) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;

    // Update imports
    if (content.includes(replacement.from)) {
      content = content.replace(replacement.from, replacement.to);
      updated = true;
    }

    // Update component usage
    if (content.includes(replacement.componentFrom)) {
      content = content.replace(new RegExp(replacement.componentFrom, 'g'), replacement.componentTo);
      updated = true;
    }

    // Update closing tags
    if (content.includes(replacement.closeFrom)) {
      content = content.replace(new RegExp(replacement.closeFrom, 'g'), replacement.closeTo);
      updated = true;
    }

    if (updated) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated ${filePath}`);
      return true;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`❌ Error updating ${filePath}:`, error.message);
    }
  }
  return false;
}

// Function to find and update files
function findAndUpdateFiles(dir, replacement) {
  const files = fs.readdirSync(dir);
  let count = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      count += findAndUpdateFiles(filePath, replacement);
    } else if (stat.isFile() && (file.endsWith('.tsx') || file.endsWith('.ts'))) {
      if (updateFile(filePath, replacement)) {
        count++;
      }
    }
  }

  return count;
}

// Main execution
console.log('🔄 Updating components to use responsive versions...\n');

const srcDir = path.join(__dirname, '..', 'src');
let totalUpdates = 0;

for (const replacement of replacements) {
  console.log(`\n📦 Processing ${replacement.name}...`);
  const count = findAndUpdateFiles(srcDir, replacement);
  totalUpdates += count;
  console.log(`   Updated ${count} files`);
}

console.log(`\n✨ Complete! Updated ${totalUpdates} files in total.`);
console.log('\n📝 Note: You may need to update the component props if the new responsive components have different interfaces.');