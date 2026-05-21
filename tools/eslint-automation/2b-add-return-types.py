#!/usr/bin/env python3
"""
Phase 2B: Add return types to functions (200-300 of 843)
Strategy: Auto-annotate obvious return types
Risk: LOW - Only handles clear patterns
"""
import re
import sys
import json
import subprocess
from pathlib import Path
from typing import List, Dict, Optional

def get_missing_return_types() -> List[Dict]:
    """Get list of missing return type violations."""
    print("🔍 Scanning for missing return types...")

    # Find project root (where package.json is)
    project_root = Path(__file__).parent.parent.parent

    result = subprocess.run(
        ['npx', 'eslint', 'src', '--format', 'json', '--no-color'],
        capture_output=True,
        text=True,
        cwd=project_root
    )
    
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return []
    
    violations = []
    for file_data in data:
        for message in file_data.get('messages', []):
            rule_id = message.get('ruleId')
            if rule_id in ['@typescript-eslint/explicit-function-return-type',
                          '@typescript-eslint/explicit-module-boundary-types']:
                violations.append({
                    'file': file_data['filePath'],
                    'line': message['line'],
                    'column': message['column'],
                    'ruleId': rule_id
                })

    return violations

def infer_return_type(file_path: str, line_num: int) -> Optional[str]:
    """Infer return type for a function at given line."""
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    if line_num > len(lines):
        return None
    
    # Get function signature and body
    func_line = lines[line_num - 1]
    
    # Pattern 1: React components returning JSX
    if re.search(r'return\s*<', ' '.join(lines[line_num:min(line_num+20, len(lines))])):
        if '.tsx' in file_path:
            return 'React.ReactElement'
    
    # Pattern 2: Async functions
    if 'async' in func_line:
        return 'Promise<void>'  # Conservative - may need manual refinement
    
    # Pattern 3: Event handlers (no return)
    if re.search(r'handle|onClick|onChange|onSubmit', func_line):
        return 'void'
    
    # Pattern 4: Functions with no return statement
    func_body = ' '.join(lines[line_num:min(line_num+30, len(lines))])
    if 'return' not in func_body or re.search(r'return\s*;', func_body):
        return 'void'
    
    return None  # Can't infer safely

def add_return_type(file_path: str, line_num: int, return_type: str, dry_run: bool = True) -> bool:
    """Add return type to function."""
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    if line_num > len(lines):
        return False
    
    line = lines[line_num - 1]
    
    # Find the closing parenthesis of parameters
    # Pattern: function name(...params) { or (...params) => {
    patterns = [
        # export function foo(...) {
        (r'(export\s+function\s+\w+\s*\([^)]*\))', rf'\1: {return_type}'),
        # Arrow functions: const foo = (...) => {
        (r'(=\s*\([^)]*\))\s*=>', rf'\1: {return_type} =>'),
        # Arrow functions: const foo = async (...) => {
        (r'(async\s*\([^)]*\))\s*=>', rf'\1: {return_type} =>'),
    ]
    
    new_line = line
    for pattern, replacement in patterns:
        if re.search(pattern, line):
            new_line = re.sub(pattern, replacement, line)
            break
    
    if new_line != line:
        if not dry_run:
            lines[line_num - 1] = new_line
            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)
        return True
    
    return False

def main():
    dry_run = '--execute' not in sys.argv
    
    if dry_run:
        print("🔍 DRY RUN MODE - No files will be modified")
        print("   Run with --execute to apply changes")
        print("")
    
    violations = get_missing_return_types()
    print(f"Found {len(violations)} missing return type violations")
    print("")
    
    fixed_count = 0
    skipped_count = 0
    
    # Group by file
    by_file: Dict[str, List] = {}
    for v in violations:
        by_file.setdefault(v['file'], []).append(v)
    
    print(f"Affected files: {len(by_file)}")
    print("")

    # Get project root for relative paths
    project_root = Path(__file__).parent.parent.parent

    for file_path, file_violations in list(by_file.items())[:20]:  # Limit to first 20 files
        rel_path = Path(file_path).relative_to(project_root)
        print(f"  {rel_path}:")
        
        for v in file_violations:
            return_type = infer_return_type(v['file'], v['line'])
            
            if return_type:
                if add_return_type(v['file'], v['line'], return_type, dry_run):
                    fixed_count += 1
                    print(f"    ✅ Line {v['line']}: Added → {return_type}")
                else:
                    skipped_count += 1
                    print(f"    ⏭️  Line {v['line']}: Could not add {return_type}")
            else:
                skipped_count += 1
                print(f"    ⏭️  Line {v['line']}: Cannot infer type (needs manual)")
    
    print("")
    print(f"✅ Fixed: {fixed_count}")
    print(f"⏭️  Skipped: {skipped_count} (need manual review)")
    
    if dry_run:
        print("")
        print("To apply changes, run: ./2b-add-return-types.py --execute")
    else:
        print("")
        print("⚠️  IMPORTANT: Review changes carefully!")
        print("   Inferred types may be too broad (e.g., Promise<void> for async functions)")
        print("")
        print("Next steps:")
        print("1. Validate: npm run type-check")
        print("2. Review: git diff")
        print("3. Commit: git add -A && git commit -m 'fix(eslint): Add inferred return types to functions'")

if __name__ == '__main__':
    main()
