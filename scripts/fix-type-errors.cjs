#!/usr/bin/env node

/**
 * Script to fix common TypeScript type errors
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const fixes = [
  // Fix coverImages -> covers in AniListAdapter
  {
    file: 'src/server/adapters/unified/AniListAdapter.ts',
    find: 'coverImages:',
    replace: 'covers:'
  },
  
  // Add url to CachedParseOptions
  {
    file: 'src/server/parsers/CachedUnifiedParser.ts',
    find: 'export interface CachedParseOptions {',
    replace: 'export interface CachedParseOptions {\n  url?: string;'
  },
  
  // Fix the RecognitionOptions
  {
    file: 'src/server/parsers/CachedUnifiedParser.ts',
    find: '        options: {\n          minConfidence:',
    replace: '        options: {\n          // minConfidence:'
  },
  
  // Fix id fields in MangaMetadata
  {
    pattern: 'src/server/services/providers/strategies/*.ts',
    find: /(\s+)id: [^,\n]+,?/g,
    replace: '$1// id field removed - not in MangaMetadata',
    multifile: true
  },
  
  // Fix enableCache -> enableCaching
  {
    file: 'src/server/parsers/unified/index.ts',
    find: 'enableCache:',
    replace: 'enableCaching:'
  },
  
  // Fix db import
  {
    file: 'src/server/services/ml/MLMetricsService.ts',
    find: "import { prisma } from '../../../server/db';",
    replace: "import { prisma } from '../../db';"
  },
  
  // Fix optional parameter order
  {
    file: 'src/server/services/providers/strategies/ComicVineProviderStrategy.ts',
    find: 'async searchForManga(query: string, limit?: number, providerPreferences: ProviderPreferences)',
    replace: 'async searchForManga(query: string, providerPreferences: ProviderPreferences, limit?: number)'
  }
];

async function applyFixes() {
  console.log('🔧 Applying TypeScript fixes...\n');
  
  for (const fix of fixes) {
    if (fix.multifile && fix.pattern) {
      const files = glob.sync(fix.pattern);
      for (const file of files) {
        await applyFix(file, fix);
      }
    } else if (fix.file) {
      await applyFix(fix.file, fix);
    }
  }
  
  console.log('\n✅ Fixes applied!');
}

async function applyFix(filePath, fix) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return;
    }
    
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;
    
    if (typeof fix.find === 'string') {
      if (content.includes(fix.find)) {
        content = content.replace(fix.find, fix.replace);
        modified = true;
      }
    } else if (fix.find instanceof RegExp) {
      const matches = content.match(fix.find);
      if (matches) {
        content = content.replace(fix.find, fix.replace);
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(fullPath, content);
      console.log(`✅ Fixed: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
  }
}

// Additional fixes for PatternRecognitionEngine
async function fixPatternRecognitionEngine() {
  const filePath = 'src/server/parsers/pattern-recognition/core/PatternRecognitionEngine.ts';
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  PatternRecognitionEngine not found`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Add missing properties to class
  const classMatch = content.match(/export class PatternRecognitionEngine[^{]*{/);
  if (classMatch) {
    const insertPos = classMatch.index + classMatch[0].length;
    const additions = `
  private activeLearning?: any;
  private evolutionManager?: any;
  private mlPipeline?: any;
`;
    
    // Check if properties already exist
    if (!content.includes('private activeLearning')) {
      content = content.slice(0, insertPos) + additions + content.slice(insertPos);
      fs.writeFileSync(fullPath, content);
      console.log(`✅ Fixed: Added missing properties to PatternRecognitionEngine`);
    }
  }
}

// Fix feature types
async function fixFeatureTypes() {
  const typesPath = 'src/server/parsers/pattern-recognition/types.ts';
  const fullPath = path.join(process.cwd(), typesPath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Pattern recognition types file not found`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Fix StructuralFeatures
  content = content.replace(
    /export interface StructuralFeatures \{[^}]+\}/,
    `export interface StructuralFeatures {
  tagCounts: Record<string, number>;
  maxDepth: number;
  averageDepth: number;
  elementCount: number;
  depth?: number;
  siblingIndex?: number;
}`
  );
  
  // Fix SemanticFeatures
  content = content.replace(
    /export interface SemanticFeatures \{[^}]+\}/,
    `export interface SemanticFeatures {
  keywordDensity: Record<string, number>;
  topicDistribution: Record<string, number>;
  sentimentScore: number;
  readabilityScore: number;
  hasHeading?: boolean;
  hasList?: boolean;
  hasTable?: boolean;
}`
  );
  
  // Fix StatisticalFeatures
  content = content.replace(
    /export interface StatisticalFeatures \{[^}]+\}/,
    `export interface StatisticalFeatures {
  wordCount: number;
  avgWordLength: number;
  sentenceCount: number;
  avgSentenceLength: number;
  paragraphCount: number;
  textLength?: number;
}`
  );
  
  fs.writeFileSync(fullPath, content);
  console.log(`✅ Fixed: Feature interface types`);
}

// Main execution
async function main() {
  await applyFixes();
  await fixPatternRecognitionEngine();
  await fixFeatureTypes();
  
  console.log('\n🎉 Type error fixes complete!');
  console.log('Run "pnpm tsc --noEmit" to check remaining errors');
}

main().catch(console.error);