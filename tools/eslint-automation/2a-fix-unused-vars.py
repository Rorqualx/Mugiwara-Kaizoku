#!/usr/bin/env python3
"""
Phase 2A: Fix unused variable violations (459)
Strategy: Prefix unused variables with underscore
Risk: LOW - TypeScript will catch any errors
"""
import re
import sys
import json
import subprocess
from pathlib import Path
from typing import List, Dict, Tuple

def get_unused_vars() -> List[Dict]:
    """Get list of unused variable violations from ESLint."""
    print("🔍 Scanning for unused variable violations...")

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
        print("❌ Failed to parse ESLint output")
        return []
    
    violations = []
    for file_data in data:
        for message in file_data.get('messages', []):
            if message.get('ruleId') == '@typescript-eslint/no-unused-vars':
                violations.append({
                    'file': file_data['filePath'],
                    'line': message['line'],
                    'column': message['column'],
                    'message': message['message'],
                    'varName': extract_var_name(message['message'])
                })
    
    return violations

def extract_var_name(message: str) -> str:
    """Extract variable name from error message."""
    # Message format: "'varName' is defined but never used"
    match = re.search(r"'([^']+)' is defined", message)
    return match.group(1) if match else ""

def fix_unused_var(file_path: str, line_num: int, var_name: str, dry_run: bool = True) -> bool:
    """Fix a single unused variable by prefixing with underscore."""
    if not var_name or var_name.startswith('_'):
        return False  # Already fixed or can't determine name
    
    # Read file
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    if line_num > len(lines):
        return False
    
    line = lines[line_num - 1]
    new_var_name = f'_{var_name}'
    
    # Pattern matching for safe replacements
    patterns = [
        # Function parameters: function foo(unused) =>
        (r'\b' + re.escape(var_name) + r'\b(?=\s*[,)])', new_var_name),
        # Destructuring: const { foo, bar } =>
        (r'(\{[^}]*)' + r'\b' + re.escape(var_name) + r'\b', r'\1' + new_var_name),
        # Catch clause: catch (error) =>
        (r'catch\s*\(\s*' + re.escape(var_name) + r'\s*\)', f'catch ({new_var_name})'),
        # Variable declaration: const foo =
        (r'\bconst\s+' + re.escape(var_name) + r'\b', f'const {new_var_name}'),
        (r'\blet\s+' + re.escape(var_name) + r'\b', f'let {new_var_name}'),
    ]
    
    new_line = line
    for pattern, replacement in patterns:
        new_line = re.sub(pattern, replacement, new_line)
    
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
    
    violations = get_unused_vars()
    print(f"Found {len(violations)} unused variable violations")
    print("")
    
    if not violations:
        print("✅ No unused variables found!")
        return
    
    # Group by file
    by_file: Dict[str, List] = {}
    for v in violations:
        by_file.setdefault(v['file'], []).append(v)
    
    print(f"Affected files: {len(by_file)}")
    print("")

    fixed_count = 0
    skipped_count = 0

    # Get project root for relative paths
    project_root = Path(__file__).parent.parent.parent

    for file_path, file_violations in by_file.items():
        rel_path = Path(file_path).relative_to(project_root)
        print(f"  {rel_path}: {len(file_violations)} violations")
        
        for v in file_violations:
            if fix_unused_var(v['file'], v['line'], v['varName'], dry_run):
                fixed_count += 1
                if not dry_run:
                    print(f"    ✅ Fixed: {v['varName']} → _{v['varName']}")
            else:
                skipped_count += 1
                if not dry_run:
                    print(f"    ⏭️  Skipped: {v['varName']}")
    
    print("")
    print(f"✅ Fixed: {fixed_count}")
    print(f"⏭️  Skipped: {skipped_count}")
    
    if dry_run:
        print("")
        print("To apply changes, run: ./2a-fix-unused-vars.py --execute")
    else:
        print("")
        print("Next steps:")
        print("1. Validate: npm run type-check")
        print("2. Review: git diff")
        print("3. Commit: git add -A && git commit -m 'fix(eslint): Prefix unused variables with underscore'")

if __name__ == '__main__':
    main()
