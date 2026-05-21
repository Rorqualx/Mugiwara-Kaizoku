#!/usr/bin/env tsx

/**
 * Phase 4: Update Type Guards
 * 
 * This script updates all type guards to reflect the property alignment changes from Phase 3:
 * - MangaEntity now uses chapterCount/volumeCount instead of chapters/volumes for numbers
 * - ChapterEntity has size property (alias for fileSize)
 * - Proper handling of MangaWithRelations vs MangaEntity
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import * as path from 'path';

interface UpdateResult {
  file: string;
  changes: number;
  errors: string[];
}

class TypeGuardUpdater {
  private results: UpdateResult[] = [];
  
  async updateTypeGuards(): Promise<void> {
    console.log('🔍 Phase 4: Updating Type Guards...\n');
    
    // Find all type guard files
    const typeGuardFiles = [
      'src/utils/validation/type-guards.ts',
      'src/utils/validation/enhanced-type-guards.ts',
      'src/utils/validation/domain-type-guards.ts',
      'src/utils/validation/domain-guards.ts',
      'src/utils/validation/metadata-typeguards.ts',
      'src/utils/validation/data-validators.ts'
    ];
    
    for (const file of typeGuardFiles) {
      await this.updateFile(file);
    }
    
    // Also update any other files that define type guards
    const additionalFiles = glob.sync('src/**/*.ts').filter(f => 
      !f.includes('node_modules') && 
      !f.includes('.test.') &&
      !f.includes('.spec.')
    );
    
    for (const file of additionalFiles) {
      const content = readFileSync(file, 'utf8');
      if (content.includes('function is') && (
        content.includes('MangaEntity') || 
        content.includes('ChapterEntity')
      )) {
        await this.updateFile(file);
      }
    }
    
    this.printResults();
  }
  
  private async updateFile(filePath: string): Promise<void> {
    if (!this.fileExists(filePath)) {
      return;
    }
    
    const result: UpdateResult = {
      file: filePath,
      changes: 0,
      errors: []
    };
    
    try {
      let content = readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      // Update ChapterEntity type guards
      content = this.updateChapterEntityGuards(content, result);
      
      // Update MangaEntity type guards
      content = this.updateMangaEntityGuards(content, result);
      
      // Update property checks
      content = this.updatePropertyChecks(content, result);
      
      // Update type guard function signatures
      content = this.updateTypeGuardSignatures(content, result);
      
      if (content !== originalContent) {
        writeFileSync(filePath, content);
        console.log(`✅ Updated ${path.relative(process.cwd(), filePath)} (${result.changes} changes)`);
      }
      
    } catch (error) {
      result.errors.push(`Error processing file: ${error}`);
    }
    
    this.results.push(result);
  }
  
  private updateChapterEntityGuards(content: string, result: UpdateResult): string {
    // Update ChapterEntity type guard to check for new properties
    const chapterGuardRegex = /function\s+is(?:Valid)?ChapterEntity\([^)]+\)[^{]+\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;
    
    content = content.replace(chapterGuardRegex, (match, body) => {
      if (!body.includes('// Phase 4 updated')) {
        result.changes++;
        
        // Add size property check
        if (!body.includes("'size'") && !body.includes('fileSize')) {
          body = body.replace(
            /(return true;?)/,
            `// Check size/fileSize alias
  if ('size' in value && value.size !== undefined && !isNumber(value.size)) {
    return false;
  }
  if ('fileSize' in value && value.fileSize !== undefined && !isNumber(value.fileSize)) {
    return false;
  }
  
  // Phase 4 updated
  $1`
          );
        }
        
        // Ensure chapter property is checked correctly
        if (!body.includes('chapter:')) {
          body = body.replace(
            /const requiredProps = \[[^\]]+\]/,
            `const requiredProps = ['id', 'chapter', 'mangaId', 'status']`
          );
        }
        
        return match.replace(/\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/, `{${body}}`);
      }
      return match;
    });
    
    return content;
  }
  
  private updateMangaEntityGuards(content: string, result: UpdateResult): string {
    // Update MangaEntity type guard for chapterCount/volumeCount
    const mangaGuardRegex = /function\s+is(?:Valid)?MangaEntity\([^)]+\)[^{]+\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;
    
    content = content.replace(mangaGuardRegex, (match, body) => {
      if (!body.includes('// Phase 4 updated')) {
        result.changes++;
        
        // Add chapterCount/volumeCount checks
        if (!body.includes('chapterCount')) {
          body = body.replace(
            /(return true;?)/,
            `// Check chapter/volume counts (Phase 4)
  if ('chapterCount' in value && value.chapterCount !== undefined && !isNumber(value.chapterCount)) {
    return false;
  }
  if ('volumeCount' in value && value.volumeCount !== undefined && !isNumber(value.volumeCount)) {
    return false;
  }
  
  // Legacy support for chapters/volumes as numbers
  if ('chapters' in value && typeof value.chapters === 'number' && !isNumber(value.chapters)) {
    return false;
  }
  if ('volumes' in value && typeof value.volumes === 'number' && !isNumber(value.volumes)) {
    return false;
  }
  
  // Phase 4 updated
  $1`
          );
        }
        
        return match.replace(/\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/, `{${body}}`);
      }
      return match;
    });
    
    // Update MangaWithRelations type guard
    const relationsGuardRegex = /function\s+isMangaWithRelations\([^)]+\)[^{]+\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;
    
    content = content.replace(relationsGuardRegex, (match, body) => {
      if (!body.includes('// Phase 4 updated')) {
        result.changes++;
        
        // Ensure chapters array is properly validated
        body = body.replace(
          /if\s*\(\s*!isChapterEntityArray\s*\(\s*value\.chapters\s*\)\s*\)/,
          `// MangaWithRelations must have chapters array
  if (!('chapters' in value) || !isArray(value.chapters)) {
    return false;
  }
  if (!isChapterEntityArray(value.chapters))`
        );
        
        body += '\n  // Phase 4 updated';
        
        return match.replace(/\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/, `{${body}}`);
      }
      return match;
    });
    
    return content;
  }
  
  private updatePropertyChecks(content: string, result: UpdateResult): string {
    // Update property existence checks
    const replacements = [
      // Update chapters/volumes number checks to chapterCount/volumeCount
      {
        pattern: /if\s*\(\s*['"]chapters['"]\s+in\s+(\w+)\s*&&\s*typeof\s+\1\.chapters\s*===\s*['"]number['"]/g,
        replacement: `if ('chapterCount' in $1 && typeof $1.chapterCount === 'number'`,
        count: 0
      },
      {
        pattern: /if\s*\(\s*['"]volumes['"]\s+in\s+(\w+)\s*&&\s*typeof\s+\1\.volumes\s*===\s*['"]number['"]/g,
        replacement: `if ('volumeCount' in $1 && typeof $1.volumeCount === 'number'`,
        count: 0
      },
      // Update direct property checks
      {
        pattern: /isNumber\s*\(\s*(\w+)\.chapters\s*\)/g,
        replacement: (match: string, varName: string) => {
          // Only replace if it's checking a number, not an array
          if (!content.includes(`isArray(${varName}.chapters)`)) {
            return `isNumber(${varName}.chapterCount)`;
          }
          return match;
        },
        count: 0
      },
      {
        pattern: /isNumber\s*\(\s*(\w+)\.volumes\s*\)/g,
        replacement: `isNumber($1.volumeCount)`,
        count: 0
      }
    ];
    
    for (const { pattern, replacement } of replacements) {
      const matches = content.match(pattern);
      if (matches) {
        result.changes += matches.length;
        if (typeof replacement === 'string') {
          content = content.replace(pattern, replacement);
        } else {
          content = content.replace(pattern, replacement as any);
        }
      }
    }
    
    return content;
  }
  
  private updateTypeGuardSignatures(content: string, result: UpdateResult): string {
    // Ensure proper imports
    if (!content.includes("import type { MangaWithRelations }") && 
        content.includes("MangaWithRelations")) {
      const importRegex = /import\s*{([^}]+)}\s*from\s*['"]@\/types\/canonical['"]/;
      content = content.replace(importRegex, (match, imports) => {
        if (!imports.includes('MangaWithRelations')) {
          result.changes++;
          return match.replace(imports, `${imports}, MangaWithRelations`);
        }
        return match;
      });
    }
    
    return content;
  }
  
  private fileExists(filePath: string): boolean {
    try {
      readFileSync(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  private printResults(): void {
    console.log('\n📊 Type Guard Update Results:\n');
    
    let totalChanges = 0;
    let filesUpdated = 0;
    const errors: string[] = [];
    
    for (const result of this.results) {
      if (result.changes > 0) {
        filesUpdated++;
        totalChanges += result.changes;
      }
      errors.push(...result.errors);
    }
    
    console.log(`✅ Files updated: ${filesUpdated}`);
    console.log(`📝 Total changes: ${totalChanges}`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️ Errors encountered:`);
      errors.forEach(err => console.log(`  - ${err}`));
    }
    
    console.log('\n🎯 Next steps:');
    console.log('1. Run type checking: npx tsc --noEmit');
    console.log('2. Update any custom type guards in component files');
    console.log('3. Test type narrowing in runtime scenarios');
  }
}

// Run the updater
const updater = new TypeGuardUpdater();
updater.updateTypeGuards().catch(console.error);