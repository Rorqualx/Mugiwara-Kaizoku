#!/usr/bin/env python3
"""
TS2375 Error Fixer - exactOptionalPropertyTypes
Phase 3 - Strategic Quick Wins

Fixes: Type 'X | undefined' is not assignable to type 'Y' with
       'exactOptionalPropertyTypes: true'

Solution: Change '|| undefined' to '|| null' and ': undefined' to ': null'

Target: 420 errors
"""

import re
import subprocess
import sys
from pathlib import Path
from typing import List, Tuple

def get_error_count() -> int:
    """Get count of TS2375 errors"""
    try:
        result = subprocess.run(
            ['pnpm', 'type-check'],
            capture_output=True,
            text=True,
            timeout=120
        )
        output = result.stdout + result.stderr
        return output.count('error TS2375')
    except subprocess.TimeoutExpired:
        print("⚠️  Type check timed out, continuing anyway...")
        return 0
    except Exception as e:
        print(f"Error running type-check: {e}")
        return 0

def get_files_with_errors() -> List[str]:
    """Get list of files with TS2375 errors"""
    try:
        result = subprocess.run(
            ['pnpm', 'type-check'],
            capture_output=True,
            text=True,
            timeout=120
        )
        output = result.stdout + result.stderr

        files = set()
        for line in output.split('\n'):
            if 'error TS2375' in line:
                # Extract file path before the first '('
                match = re.match(r'^([^(]+)\(', line)
                if match:
                    files.add(match.group(1))

        return sorted(list(files))
    except subprocess.TimeoutExpired:
        print("⚠️  Type check timed out, continuing anyway...")
        return []
    except Exception as e:
        print(f"Error getting files: {e}")
        return []

def fix_file(file_path: str) -> Tuple[bool, int]:
    """
    Fix TS2375 errors in a single file
    Returns (changed, num_fixes)
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content
        fixes = 0

        # Pattern 1: Fix JSX props with || undefined
        # color={variable || undefined} → color={variable || null}
        patterns_jsx = [
            (r'(color=\{[^}]*) \|\| undefined}', r'\1 || null}'),
            (r'(className=\{[^}]*) \|\| undefined}', r'\1 || null}'),
            (r'(description=\{[^}]*) \|\| undefined}', r'\1 || null}'),
            (r'(placeholder=\{[^}]*) \|\| undefined}', r'\1 || null}'),
            (r'(error=\{[^}]*) \|\| undefined}', r'\1 || null}'),
            (r'(onClick=\{[^}]*) \|\| undefined}', r'\1 || null}'),
            (r'(onError=\{[^}]*) \|\| undefined}', r'\1 || null}'),
            (r'(lineClamp=\{[^}]*) \|\| undefined}', r'\1 || null}'),
        ]

        for pattern, replacement in patterns_jsx:
            new_content, count = re.subn(pattern, replacement, content)
            if count > 0:
                content = new_content
                fixes += count

        # Pattern 2: Fix object literals with : undefined
        # className: undefined, → className: null,
        patterns_obj = [
            (r'(className:) undefined([,}])', r'\1 null\2'),
            (r'(description:) undefined([,}])', r'\1 null\2'),
            (r'(color:) undefined([,}])', r'\1 null\2'),
            (r'(placeholder:) undefined([,}])', r'\1 null\2'),
            (r'(error:) undefined([,}])', r'\1 null\2'),
            (r'(notes:) undefined([,}])', r'\1 null\2'),
            (r'(hash:) undefined([,}])', r'\1 null\2'),
            (r'(context:) undefined([,}])', r'\1 null\2'),
            (r'(suggestion:) undefined([,}])', r'\1 null\2'),
            (r'(confidence:) undefined([,}])', r'\1 null\2'),
            (r'(customUrl:) undefined([,}])', r'\1 null\2'),
            (r'(cover:) undefined([,}])', r'\1 null\2'),
            (r'(coverImage:) undefined([,}])', r'\1 null\2'),
            (r'(coverUrl:) undefined([,}])', r'\1 null\2'),
            (r'(banner:) undefined([,}])', r'\1 null\2'),
            (r'(status:) undefined([,}])', r'\1 null\2'),
            (r'(genres:) undefined([,}])', r'\1 null\2'),
            (r'(onError:) undefined([,}])', r'\1 null\2'),
            (r'(onClick:) undefined([,}])', r'\1 null\2'),
            (r'(libraryId:) undefined([,}])', r'\1 null\2'),
            (r'(lineClamp:) undefined([,}])', r'\1 null\2'),
            (r'(required:) undefined([,}])', r'\1 null\2'),
            (r'(endChapter:) undefined([,}])', r'\1 null\2'),
            (r'(isManuallyEdited:) undefined([,}])', r'\1 null\2'),
            (r'(url:) undefined([,}])', r'\1 null\2'),
            (r'(title:) undefined([,}])', r'\1 null\2'),
            (r'(loading:) undefined([,}])', r'\1 null\2'),
            (r'(alternativeTitles:) undefined([,}])', r'\1 null\2'),
            (r'(authors:) undefined([,}])', r'\1 null\2'),
            (r'(limit:) undefined([,}])', r'\1 null\2'),
            (r'(format:) undefined([,}])', r'\1 null\2'),
            (r'(eta:) undefined([,}])', r'\1 null\2'),
            (r'(dayOfMonth:) undefined([,}])', r'\1 null\2'),
            (r'(dayOfWeek:) undefined([,}])', r'\1 null\2'),
            (r'(nextRelease:) undefined([,}])', r'\1 null\2'),
        ]

        for pattern, replacement in patterns_obj:
            new_content, count = re.subn(pattern, replacement, content)
            if count > 0:
                content = new_content
                fixes += count

        # Pattern 3: Fix property assignments that might be undefined
        # notes: options.notes → notes: options.notes ?? null
        # But be careful not to match function declarations or type definitions
        prop_patterns = [
            (r'(\s+notes:)\s+([a-zA-Z_][\w.]*\.notes)([,\s}])', r'\1 \2 ?? null\3'),
            (r'(\s+hash:)\s+([a-zA-Z_][\w.]*\.hash)([,\s}])', r'\1 \2 ?? null\3'),
            (r'(\s+context:)\s+([a-zA-Z_][\w.]*\.context)([,\s}])', r'\1 \2 ?? null\3'),
            (r'(\s+suggestion:)\s+([a-zA-Z_][\w.]*\.suggestion)([,\s}])', r'\1 \2 ?? null\3'),
            (r'(\s+confidence:)\s+([a-zA-Z_][\w.]*\.confidence)([,\s}])', r'\1 \2 ?? null\3'),
            (r'(\s+customUrl:)\s+([a-zA-Z_][\w.]*\.customUrl)([,\s}])', r'\1 \2 ?? null\3'),
            (r'(\s+libraryId:)\s+([a-zA-Z_][\w.]*\.libraryId)([,\s}])', r'\1 \2 ?? null\3'),
            (r'(\s+required:)\s+([a-zA-Z_][\w.]*\.required)([,\s}])', r'\1 \2 ?? null\3'),
            (r'(\s+endChapter:)\s+([a-zA-Z_][\w.]*\.endChapter)([,\s}])', r'\1 \2 ?? null\3'),
            (r'(\s+isManuallyEdited:)\s+([a-zA-Z_][\w.]*\.isManuallyEdited)([,\s}])', r'\1 \2 ?? null\3'),
        ]

        for pattern, replacement in prop_patterns:
            new_content, count = re.subn(pattern, replacement, content)
            if count > 0:
                content = new_content
                fixes += count

        # Write back if changed
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True, fixes

        return False, 0

    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False, 0

def main():
    print("🔧 Fixing TS2375: exactOptionalPropertyTypes Violations")
    print("=======================================================")
    print("")

    # Get initial count
    print("📊 Counting initial errors...")
    initial_count = get_error_count()
    print(f"Initial TS2375 errors: {initial_count}")
    print("")

    if initial_count == 0:
        print("✅ No TS2375 errors found!")
        return 0

    # Get files with errors
    print("📋 Finding files with TS2375 errors...")
    files = get_files_with_errors()
    print(f"Found {len(files)} files with TS2375 errors")
    print("")

    # Create git stash backup
    print("💾 Creating git stash backup...")
    subprocess.run(['git', 'stash', 'push', '-u', '-m', 'Before TS2375 fixes (Python)'])
    print("")

    # Fix each file
    print("🔨 Applying fixes...")
    total_fixes = 0
    files_changed = 0

    for i, file_path in enumerate(files, 1):
        changed, fixes = fix_file(file_path)
        if changed:
            files_changed += 1
            total_fixes += fixes
            if i % 20 == 0:
                print(f"  Processed {i}/{len(files)} files ({files_changed} modified, {total_fixes} fixes)...")

    print(f"✅ Processed {len(files)} files")
    print(f"   Modified: {files_changed} files")
    print(f"   Total pattern replacements: {total_fixes}")
    print("")

    # Check for syntax errors
    print("🔍 Checking for syntax errors...")
    try:
        result = subprocess.run(
            ['pnpm', 'type-check'],
            capture_output=True,
            text=True,
            timeout=120
        )
        output = result.stdout + result.stderr

        syntax_errors = sum(1 for line in output.split('\n') if re.search(r'error TS1[0-9]{3}', line))

        if syntax_errors > 0:
            print(f"❌ Found {syntax_errors} syntax errors after fixes")
            print("Reverting changes...")
            subprocess.run(['git', 'reset', '--hard', 'HEAD'])
            subprocess.run(['git', 'stash', 'pop'])
            return 1

        print("✅ No syntax errors found")
        print("")

        # Count remaining errors
        final_count = output.count('error TS2375')
        fixed_count = initial_count - final_count

        if fixed_count > 0:
            reduction_percent = int((fixed_count / initial_count) * 100)

            print("")
            print("📊 Results:")
            print("===========")
            print(f"Initial errors:   {initial_count}")
            print(f"Remaining errors: {final_count}")
            print(f"Fixed:            {fixed_count} ({reduction_percent}%)")
            print("")
            print(f"✅ Successfully fixed {fixed_count} TS2375 errors!")
            print("")
            print("Discarding backup stash (fixes successful)...")
            subprocess.run(['git', 'stash', 'drop'])
        else:
            print("⚠️  No errors were fixed")
            print("Reverting changes...")
            subprocess.run(['git', 'reset', '--hard', 'HEAD'])
            subprocess.run(['git', 'stash', 'pop'])

    except subprocess.TimeoutExpired:
        print("⚠️  Type check timed out during validation")
        print("Changes have been applied but not validated")
        print("")
    except Exception as e:
        print(f"Error during validation: {e}")
        return 1

    print("")
    print("Next steps:")
    print("1. Review remaining TS2375 errors manually")
    print("2. Some may require conditional prop spreading: {...(value && { prop: value })}")
    print("3. Others may need type definition updates")
    print("")

    return 0

if __name__ == '__main__':
    sys.exit(main())
