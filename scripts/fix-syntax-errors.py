#!/usr/bin/env python3

"""
Script to fix TypeScript syntax errors caused by malformed import/export statements.
This script processes files to fix common syntax patterns that cause compilation errors.
"""

import os
import re
import sys
import shutil
from pathlib import Path
from datetime import datetime
import subprocess

def create_backup(file_path):
    """Create a backup of the file before modifying it."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{file_path}.backup_{timestamp}"
    shutil.copy2(file_path, backup_path)
    return backup_path

def fix_import_export_syntax(content):
    """Fix common import/export syntax errors."""
    original = content
    
    # Fix pattern: "export { Something, } from './types';"
    content = re.sub(r'export\s*{\s*([^,}]+),\s*}\s*from', r'export { \1 } from', content)
    
    # Fix pattern: "import { Something, } from './types';"
    content = re.sub(r'import\s*{\s*([^,}]+),\s*}\s*from', r'import { \1 } from', content)
    
    # Fix duplicate 'import {' patterns like "import { import {"
    content = re.sub(r'import\s*{\s*import\s*{', 'import {', content)
    content = re.sub(r'export\s*{\s*export\s*{', 'export {', content)
    
    # Fix "export type { import {" pattern
    content = re.sub(r'export\s+type\s*{\s*import\s*{', 'export type {', content)
    
    # Fix malformed multi-line imports/exports with "} from './types';" on wrong line
    content = re.sub(r'([,\s]+)\s*}\s*from\s*[\'"]\.\/types[\'"];', r' } from "./types";', content)
    
    # Fix imports from wrong paths
    content = re.sub(r'from\s*[\'"]\.\.\/types\/canonical[\'"]', "from '../../types/canonical'", content)
    content = re.sub(r'from\s*[\'"]\.\/types[\'"]', "from '../types'", content)
    
    # Fix trailing commas before closing brace
    content = re.sub(r',\s*}\s*from', ' } from', content)
    
    # Fix orphaned "} from" statements
    content = re.sub(r'^\s*}\s*from\s*[\'"][^\'\"]+[\'\"];?\s*$', '', content, flags=re.MULTILINE)
    
    # Fix multiple consecutive commas
    content = re.sub(r',\s*,+', ',', content)
    
    # Fix empty imports/exports
    content = re.sub(r'(import|export)\s*{\s*}\s*from\s*[\'"][^\'\"]+[\'\"];?', '', content)
    
    # Clean up extra whitespace
    content = re.sub(r'[ \t]+', ' ', content)
    content = re.sub(r'\n\s*\n\s*\n+', '\n\n', content)
    
    return content

def fix_mantine_imports(content):
    """Fix imports that incorrectly import from canonical types instead of Mantine."""
    # Components that should come from @mantine/core
    mantine_components = [
        'Table', 'ScrollArea', 'Badge', 'Group', 'Text', 'ActionIcon',
        'Paper', 'Stack', 'Checkbox', 'Button', 'Modal', 'TextInput',
        'Select', 'Textarea', 'Switch', 'Tabs', 'Card', 'Grid', 'Col',
        'Container', 'Center', 'Flex', 'SimpleGrid', 'Space', 'Divider'
    ]
    
    for component in mantine_components:
        # Fix imports that incorrectly import these from canonical
        pattern = rf"import\s*{{\s*([^}}]*\b{component}\b[^}}]*)}}\s*from\s*['\"].*?/types/canonical['\"]"
        
        def replacer(match):
            components = match.group(1)
            # Remove the component from this import
            remaining = re.sub(rf'\b{component}\b,?\s*', '', components).strip().rstrip(',')
            if remaining:
                return f"import {{ {remaining} }} from '../../types/canonical'"
            else:
                return ''
        
        content = re.sub(pattern, replacer, content)
        
        # Add proper Mantine import if component is used but not imported
        if component in content and f"from '@mantine/core'" not in content:
            # Add to existing Mantine import if present
            mantine_import_pattern = r"import\s*{\s*([^}]+)\s*}\s*from\s*['\"]@mantine/core['\"]"
            match = re.search(mantine_import_pattern, content)
            if match:
                existing_imports = match.group(1)
                if component not in existing_imports:
                    new_imports = f"{existing_imports.rstrip()}, {component}"
                    content = re.sub(mantine_import_pattern, 
                                   f"import {{ {new_imports} }} from '@mantine/core'", 
                                   content, count=1)
    
    return content

def process_file(file_path):
    """Process a single file to fix syntax errors."""
    try:
        # Read file
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Create backup
        backup_path = create_backup(file_path)
        
        # Apply fixes
        fixed_content = fix_import_export_syntax(content)
        fixed_content = fix_mantine_imports(fixed_content)
        
        # Write back if changed
        if fixed_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(fixed_content)
            print(f"✅ Fixed: {file_path}")
            return True
        else:
            # Remove backup if no changes
            os.remove(backup_path)
            print(f"⏭️  No changes needed: {file_path}")
            return False
    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        return False

def get_files_with_errors():
    """Get list of files with TypeScript errors."""
    try:
        result = subprocess.run(
            ["pnpm", "type-check"],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        # Parse error output to get file paths
        files = set()
        for line in result.stderr.split('\n'):
            if 'error TS' in line:
                # Extract file path from error line
                parts = line.split('(')
                if parts:
                    file_path = parts[0].strip()
                    if file_path and os.path.exists(file_path):
                        files.add(file_path)
        
        return list(files)
    except Exception as e:
        print(f"Error getting files with errors: {e}")
        return []

def main():
    """Main function to process all files with syntax errors."""
    print("🔍 Finding files with TypeScript errors...")
    
    error_files = get_files_with_errors()
    
    if not error_files:
        print("No files with errors found or unable to get error list.")
        print("Processing known problematic files...")
        
        # Fallback to known problematic files
        error_files = [
            "src/api/metadataProviders/fandomClient.ts",
            "src/components/addManga/MetadataEditor.tsx",
            "src/components/addManga/form.tsx",
            "src/components/addManga/mangaSearchResult.tsx",
            "src/components/addLibrary.tsx",
            "src/components/addManga/components/display/MetadataPreview.tsx",
            "src/components/addManga/components/display/ProviderResults.tsx",
            "src/components/addManga/components/media/ImageGallery.tsx",
            "src/components/addManga/components/media/VolumeCoversGallery.tsx",
            "src/components/addManga/components/media/BannerGallery.tsx",
            "src/components/addManga/components/media/ChapterCoversGallery.tsx",
            "src/components/addManga/components/performance/LazyLoad.tsx",
            "src/components/addManga/components/performance/VirtualList.tsx",
            "src/components/addManga/components/performance/index.ts",
            "src/components/addManga/components/utils/index.ts"
        ]
        
        # Filter to only existing files
        error_files = [f for f in error_files if os.path.exists(f)]
    
    print(f"📝 Found {len(error_files)} files to process")
    
    fixed_count = 0
    for i, file_path in enumerate(error_files, 1):
        print(f"\n[{i}/{len(error_files)}] Processing {file_path}...")
        if process_file(file_path):
            fixed_count += 1
    
    print(f"\n✨ Completed! Fixed {fixed_count} out of {len(error_files)} files")
    
    # Run type check to show improvement
    print("\n📊 Running type check to see improvements...")
    result = subprocess.run(
        ["pnpm", "type-check"],
        capture_output=True,
        text=True
    )
    
    error_count = result.stderr.count('error TS')
    print(f"Current error count: {error_count}")

if __name__ == "__main__":
    main()