#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Fixing RequestOptions interface conflicts...\n');

// Define the canonical RequestOptions interface
const canonicalInterface = `export interface RequestOptions {
  method?: HttpMethod | string;
  path?: string;
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
  responseType?: ResponseType | string;
  validateStatus?: (status: number) => boolean;
  retries?: number;
}`;

// Files that need to import from httpClient
const filesToFix = [
  'src/api/base/ApiClient.ts',
  'src/api/downloadClients/sabnzbdClient.ts',
  'src/api/metadataProviders/fandomClient.ts',
  'src/api/metadataProviders/comicvine/fullyProtectedClient.ts',
  'src/api/prowlarrClient.ts'
];

let fixedCount = 0;
let errorCount = 0;

// Fix ApiClient imports
const apiClientPath = path.join(process.cwd(), 'src/api/base/ApiClient.ts');
if (fs.existsSync(apiClientPath)) {
  let content = fs.readFileSync(apiClientPath, 'utf-8');
  
  // Fix the import statement
  content = content.replace(
    /HttpRequestOptions as RequestOptions/g,
    'RequestOptions'
  );
  
  // Ensure RequestOptions is imported from httpClient
  if (!content.includes("RequestOptions,") && !content.includes("RequestOptions }")) {
    content = content.replace(
      /HttpClientConfig,/,
      'HttpClientConfig, RequestOptions,'
    );
  }
  
  fs.writeFileSync(apiClientPath, content);
  console.log('✅ Fixed ApiClient.ts imports');
  fixedCount++;
}

// Fix duplicate RequestOptions interfaces
filesToFix.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;
  
  // Remove local RequestOptions interface definitions
  const interfacePattern = /interface RequestOptions\s*{[^}]+}/g;
  if (interfacePattern.test(content)) {
    content = content.replace(interfacePattern, '');
    changed = true;
  }
  
  // Add import if not present
  if (!content.includes("import") || !content.includes("RequestOptions")) {
    const importPattern = /import[^;]+from\s+['"]\.\.\/utils['"]/;
    if (importPattern.test(content)) {
      // Add to existing utils import
      content = content.replace(
        /(import\s*{[^}]+)(}\s*from\s*['"]\.\.\/utils['"])/,
        '$1, RequestOptions$2'
      );
    } else {
      // Add new import
      const firstImport = content.match(/import[^;]+;/);
      if (firstImport) {
        content = content.replace(
          firstImport[0],
          firstImport[0] + '\nimport { RequestOptions } from \'../utils/httpClient\';'
        );
      }
    }
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed ${file}`);
    fixedCount++;
  }
});

// Fix method property access issues
const methodAccessFiles = glob.sync('src/api/**/*.ts', { 
  ignore: ['**/node_modules/**', '**/*.d.ts'] 
});

methodAccessFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  let changed = false;
  
  // Fix places where method/path are required but marked optional
  const patterns = [
    // Change options.method to options.method || 'GET'
    {
      pattern: /if\s*\(\s*options\.method\s*===\s*['"]GET['"]\s*\)/g,
      replacement: "if ((options.method || 'GET') === 'GET')"
    },
    // Add default values for method and path
    {
      pattern: /const\s+method\s*=\s*options\.method;/g,
      replacement: "const method = options.method || 'GET';"
    },
    {
      pattern: /const\s+path\s*=\s*options\.path;/g,
      replacement: "const path = options.path || '';"
    }
  ];
  
  patterns.forEach(({ pattern, replacement }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      changed = true;
    }
  });
  
  if (changed) {
    fs.writeFileSync(file, content);
    fixedCount++;
  }
});

console.log(`\n✅ Fixed ${fixedCount} files`);
if (errorCount > 0) {
  console.log(`⚠️  ${errorCount} files had errors`);
}

console.log('\n📝 Next steps:');
console.log('1. Run: pnpm type-check');
console.log('2. Fix any remaining RequestOptions issues manually');