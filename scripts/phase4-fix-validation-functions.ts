#!/usr/bin/env tsx

/**
 * Phase 4: Fix Validation Functions
 * 
 * This script updates validation functions to handle the property alignment:
 * - Validates chapterCount/volumeCount for MangaEntity
 * - Handles size/fileSize aliases for ChapterEntity
 * - Updates schema validators
 * - Fixes Zod schemas if used
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import * as path from 'path';

interface ValidationUpdate {
  file: string;
  changes: number;
  errors: string[];
}

class ValidationFunctionFixer {
  private results: ValidationUpdate[] = [];
  
  async fixValidationFunctions(): Promise<void> {
    console.log('🔧 Fixing Validation Functions...\n');
    
    // Find validation files
    const validationFiles = glob.sync('src/**/*.{ts,tsx}').filter(f => 
      (f.includes('validation') || 
       f.includes('validator') || 
       f.includes('schema') ||
       f.includes('zod')) &&
      !f.includes('node_modules') &&
      !f.includes('.test.') &&
      !f.includes('.spec.')
    );
    
    for (const file of validationFiles) {
      await this.updateValidationFile(file);
    }
    
    // Also check for inline validators in other files
    const otherFiles = glob.sync('src/**/*.{ts,tsx}').filter(f =>
      !f.includes('node_modules') &&
      !f.includes('.test.') &&
      !f.includes('.spec.')
    );
    
    for (const file of otherFiles) {
      const content = readFileSync(file, 'utf8');
      if (this.hasValidationCode(content)) {
        await this.updateValidationFile(file);
      }
    }
    
    this.printResults();
  }
  
  private hasValidationCode(content: string): boolean {
    return (
      content.includes('z.object') ||
      content.includes('yup.object') ||
      content.includes('joi.object') ||
      content.includes('validate') ||
      content.includes('isValid') ||
      content.includes('schema')
    );
  }
  
  private async updateValidationFile(filePath: string): Promise<void> {
    const result: ValidationUpdate = {
      file: filePath,
      changes: 0,
      errors: []
    };
    
    try {
      let content = readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      // Update Zod schemas
      content = this.updateZodSchemas(content, result);
      
      // Update validation functions
      content = this.updateValidationFunctions(content, result);
      
      // Update property validators
      content = this.updatePropertyValidators(content, result);
      
      // Update error messages
      content = this.updateErrorMessages(content, result);
      
      if (content !== originalContent) {
        writeFileSync(filePath, content);
        console.log(`✅ Updated ${path.relative(process.cwd(), filePath)} (${result.changes} changes)`);
      }
      
    } catch (error) {
      result.errors.push(`Error processing file: ${error}`);
    }
    
    if (result.changes > 0 || result.errors.length > 0) {
      this.results.push(result);
    }
  }
  
  private updateZodSchemas(content: string, result: ValidationUpdate): string {
    // Update MangaEntity Zod schemas
    const mangaSchemaRegex = /const\s+(\w+MangaSchema\w*)\s*=\s*z\.object\s*\([^)]+\)/gs;
    
    content = content.replace(mangaSchemaRegex, (match) => {
      if (match.includes('chapters:') && !match.includes('chapterCount')) {
        result.changes++;
        
        // Add chapterCount/volumeCount to schema
        match = match.replace(
          /chapters:\s*z\.number\(\)/g,
          'chapterCount: z.number().optional()'
        );
        match = match.replace(
          /volumes:\s*z\.number\(\)/g,
          'volumeCount: z.number().optional()'
        );
        
        // Add legacy support
        if (!match.includes('// Legacy support')) {
          match = match.replace(
            /\}\s*\)/,
            `,
  // Legacy support
  chapters: z.union([z.number(), z.array(z.any())]).optional(),
  volumes: z.number().optional()
})`
          );
        }
      }
      return match;
    });
    
    // Update ChapterEntity Zod schemas
    const chapterSchemaRegex = /const\s+(\w+ChapterSchema\w*)\s*=\s*z\.object\s*\([^)]+\)/gs;
    
    content = content.replace(chapterSchemaRegex, (match) => {
      if (!match.includes('size:') && match.includes('fileSize:')) {
        result.changes++;
        
        // Add size as alias
        match = match.replace(
          /fileSize:\s*z\.number\(\)\.optional\(\)/g,
          `fileSize: z.number().optional(),
  size: z.number().optional() // Alias for fileSize`
        );
      }
      
      // Ensure chapter property exists
      if (!match.includes('chapter:')) {
        result.changes++;
        match = match.replace(
          /\{\s*/,
          `{
  chapter: z.union([z.string(), z.number()]),
  `
        );
      }
      
      return match;
    });
    
    return content;
  }
  
  private updateValidationFunctions(content: string, result: ValidationUpdate): string {
    // Update validateMangaEntity functions
    const validateMangaRegex = /function\s+validate(?:Manga|Entity)\s*\([^)]+\)[^{]+\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/gs;
    
    content = content.replace(validateMangaRegex, (match, body) => {
      if (!body.includes('chapterCount') && body.includes('chapters')) {
        result.changes++;
        
        // Update validation logic
        body = body.replace(
          /if\s*\(\s*manga\.chapters\s*&&\s*typeof\s+manga\.chapters\s*!==\s*['"]number['"]\s*\)/g,
          `if (manga.chapterCount && typeof manga.chapterCount !== 'number')`
        );
        
        body = body.replace(
          /if\s*\(\s*manga\.volumes\s*&&\s*typeof\s+manga\.volumes\s*!==\s*['"]number['"]\s*\)/g,
          `if (manga.volumeCount && typeof manga.volumeCount !== 'number')`
        );
        
        // Add legacy support check
        if (!body.includes('// Legacy support')) {
          body = body.replace(
            /(return\s+(?:true|errors);?)/,
            `// Legacy support for chapters/volumes as numbers
  if (typeof manga.chapters === 'number') {
    manga.chapterCount = manga.chapters;
  }
  if (typeof manga.volumes === 'number') {
    manga.volumeCount = manga.volumes;
  }
  
  $1`
          );
        }
        
        return match.replace(/\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/, `{${body}}`);
      }
      return match;
    });
    
    // Update validateChapterEntity functions
    const validateChapterRegex = /function\s+validate(?:Chapter|ChapterEntity)\s*\([^)]+\)[^{]+\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/gs;
    
    content = content.replace(validateChapterRegex, (match, body) => {
      if (!body.includes('// Size/fileSize alias')) {
        result.changes++;
        
        // Add size/fileSize validation
        body = body.replace(
          /(return\s+(?:true|errors);?)/,
          `// Size/fileSize alias handling
  if (chapter.size !== undefined && chapter.fileSize === undefined) {
    chapter.fileSize = chapter.size;
  }
  
  $1`
        );
        
        return match.replace(/\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/, `{${body}}`);
      }
      return match;
    });
    
    return content;
  }
  
  private updatePropertyValidators(content: string, result: ValidationUpdate): string {
    // Update property-specific validators
    const replacements = [
      // Update chapters validation to chapterCount
      {
        pattern: /errors\.push\s*\(\s*['"]Invalid chapters['"]/g,
        replacement: `errors.push('Invalid chapterCount'`,
      },
      {
        pattern: /errors\.push\s*\(\s*['"]Invalid volumes['"]/g,
        replacement: `errors.push('Invalid volumeCount'`,
      },
      // Update property access in validators
      {
        pattern: /(\w+)\.chapters\s*>\s*0/g,
        replacement: (match: string, varName: string) => {
          // Check if it's about count
          if (!content.includes(`${varName}.chapters.length`)) {
            return `${varName}.chapterCount > 0`;
          }
          return match;
        }
      },
      {
        pattern: /(\w+)\.volumes\s*>\s*0/g,
        replacement: `$1.volumeCount > 0`,
      },
      // Update property existence checks
      {
        pattern: /hasOwnProperty\s*\(\s*['"]chapters['"]\s*\)/g,
        replacement: (match: string) => {
          // Only replace for number checks
          const context = content.substring(content.indexOf(match) - 100, content.indexOf(match) + 100);
          if (context.includes('number')) {
            return `hasOwnProperty('chapterCount')`;
          }
          return match;
        }
      },
      {
        pattern: /hasOwnProperty\s*\(\s*['"]volumes['"]\s*\)/g,
        replacement: `hasOwnProperty('volumeCount')`,
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
  
  private updateErrorMessages(content: string, result: ValidationUpdate): string {
    // Update error messages to reflect new property names
    const errorPatterns = [
      {
        pattern: /['"]chapters must be a number['"]/gi,
        replacement: `'chapterCount must be a number'`
      },
      {
        pattern: /['"]volumes must be a number['"]/gi,
        replacement: `'volumeCount must be a number'`
      },
      {
        pattern: /['"]Missing required field: chapters['"]/gi,
        replacement: `'Missing required field: chapterCount'`
      },
      {
        pattern: /['"]Missing required field: volumes['"]/gi,
        replacement: `'Missing required field: volumeCount'`
      },
      {
        pattern: /\$\{field\} === ['"]chapters['"]/g,
        replacement: `\${field} === 'chapterCount'`
      },
      {
        pattern: /\$\{field\} === ['"]volumes['"]/g,
        replacement: `\${field} === 'volumeCount'`
      }
    ];
    
    for (const { pattern, replacement } of errorPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        result.changes += matches.length;
        content = content.replace(pattern, replacement);
      }
    }
    
    return content;
  }
  
  private printResults(): void {
    console.log('\n📊 Validation Function Fix Results:\n');
    
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
    
    console.log('\n🎯 Next validation steps:');
    console.log('1. Test validation functions with sample data');
    console.log('2. Check form validation in UI components');
    console.log('3. Verify API request/response validation');
  }
}

// Run the fixer
const fixer = new ValidationFunctionFixer();
fixer.fixValidationFunctions().catch(console.error);