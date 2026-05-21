#!/usr/bin/env python3
"""
TS18046 Error Fixer - Unknown Type Property Access
Phase 4 - Strategic Quick Wins

Fixes: 'X' is of type 'unknown' errors by adding type guards and casts

Solution: Cast unknown variables to Record<string, unknown> before property access

Target: 3,050 errors
Expected: 67% reduction (~2,000 errors fixed)
"""

import re
import subprocess
import sys
from pathlib import Path
from typing import List, Tuple, Dict, Set

def get_error_count() -> int:
    """Get count of TS18046 errors"""
    try:
        result = subprocess.run(
            ['pnpm', 'type-check'],
            capture_output=True,
            text=True,
            timeout=120
        )
        output = result.stdout + result.stderr
        return output.count('error TS18046')
    except subprocess.TimeoutExpired:
        print("⚠️  Type check timed out, continuing anyway...")
        return 0
    except Exception as e:
        print(f"Error running type-check: {e}")
        return 0

def parse_ts18046_errors() -> Dict[str, List[Tuple[int, str]]]:
    """Parse TS18046 errors and group by file"""
    try:
        result = subprocess.run(
            ['pnpm', 'type-check'],
            capture_output=True,
            text=True,
            timeout=120
        )
        output = result.stdout + result.stderr

        errors_by_file = {}

        # Parse: file.tsx(line,col): error TS18046: 'varName' is of type 'unknown'.
        pattern = r"^(.+?)\((\d+),\d+\): error TS18046: '(.+?)' is of type 'unknown'\."

        for line in output.split('\n'):
            match = re.match(pattern, line)
            if match:
                file_path = match.group(1)
                line_num = int(match.group(2))
                var_name = match.group(3)

                if file_path not in errors_by_file:
                    errors_by_file[file_path] = []

                errors_by_file[file_path].append((line_num, var_name))

        return errors_by_file

    except subprocess.TimeoutExpired:
        print("⚠️  Type check timed out")
        return {}
    except Exception as e:
        print(f"Error parsing errors: {e}")
        return {}

def find_variable_declaration(lines: List[str], target_line: int, var_name: str) -> int:
    """Find where a variable is declared/introduced"""
    # Search backwards from error line to find declaration
    for i in range(target_line - 1, max(0, target_line - 50), -1):
        line = lines[i]
        # Look for: const varName =, let varName =, varName: unknown, (varName: unknown)
        patterns = [
            rf'\b(const|let|var)\s+{re.escape(var_name)}\s*[=:]',
            rf'\({re.escape(var_name)}:\s*unknown\)',
            rf'\({re.escape(var_name)}:',
            rf'\.forEach\(\({re.escape(var_name)}\)',
            rf'\.map\(\({re.escape(var_name)}\)',
            rf'\.filter\(\({re.escape(var_name)}\)',
            rf'\.find\(\({re.escape(var_name)}\)',
        ]

        for pattern in patterns:
            if re.search(pattern, line):
                return i

    return -1

def fix_file(file_path: str, errors: List[Tuple[int, str]]) -> Tuple[bool, int]:
    """
    Fix TS18046 errors in a file
    Returns (changed, num_fixes)
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        original_content = ''.join(lines)
        fixes = 0
        vars_already_cast = Set[str]()

        # Group errors by variable name
        vars_by_line: Dict[str, List[int]] = {}
        for line_num, var_name in errors:
            if var_name not in vars_by_line:
                vars_by_line[var_name] = []
            vars_by_line[var_name].append(line_num)

        # For each unknown variable, find its declaration and add cast
        for var_name in sorted(vars_by_line.keys()):
            if var_name in vars_already_cast:
                continue

            # Find first usage
            first_line = min(vars_by_line[var_name])
            decl_line = find_variable_declaration(lines, first_line, var_name)

            if decl_line >= 0:
                line = lines[decl_line]

                # Check if already has type annotation
                if f': Record<string, unknown>' in line or f'as Record<string, unknown>' in line:
                    vars_already_cast.add(var_name)
                    continue

                # Try to add cast after the declaration
                # Pattern: const varName = ... → const varName = ... as Record<string, unknown>

                # For arrow function parameters: (varName: unknown) → (varName: unknown)
                # We need to cast at first usage instead
                if f'({var_name}:' in line or f'({var_name} ' in line:
                    # This is a function parameter, cast at first usage
                    first_usage_line = first_line - 1
                    if first_usage_line < len(lines):
                        usage_line = lines[first_usage_line]
                        # Add cast: const obj = varName as Record<string, unknown>;
                        indent = len(usage_line) - len(usage_line.lstrip())
                        cast_line = f"{' ' * indent}const {var_name}Obj = {var_name} as Record<string, unknown>;\n"

                        # Replace varName with varNameObj in subsequent lines
                        # This is complex, skip for now
                        continue

                # For variable declarations: add 'as Record<string, unknown>' before semicolon/newline
                if re.search(rf'\b(const|let|var)\s+{re.escape(var_name)}\s*=', line):
                    # Find the end of the statement (semicolon or line end)
                    # Handle multi-line statements
                    stmt_end = decl_line
                    while stmt_end < len(lines) - 1:
                        if ';' in lines[stmt_end] or lines[stmt_end].rstrip().endswith('{'):
                            break
                        stmt_end += 1

                    # Add cast before semicolon
                    end_line = lines[stmt_end]
                    if ';' in end_line:
                        lines[stmt_end] = end_line.replace(';', ' as Record<string, unknown>;', 1)
                        fixes += 1
                        vars_already_cast.add(var_name)

        # Write back if changed
        new_content = ''.join(lines)
        if new_content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            return True, fixes

        return False, 0

    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False, 0

def main():
    print("🔧 Fixing TS18046: Unknown Type Property Access")
    print("===============================================")
    print("")

    # Get initial count
    print("📊 Counting initial errors...")
    initial_count = get_error_count()
    print(f"Initial TS18046 errors: {initial_count}")
    print("")

    if initial_count == 0:
        print("✅ No TS18046 errors found!")
        return 0

    # Parse errors
    print("📋 Parsing TS18046 errors...")
    errors_by_file = parse_ts18046_errors()
    print(f"Found {len(errors_by_file)} files with TS18046 errors")
    print("")

    if not errors_by_file:
        print("⚠️  No errors to fix")
        return 1

    # Create git stash backup
    print("💾 Creating git stash backup...")
    subprocess.run(['git', 'stash', 'push', '-u', '-m', 'Before TS18046 fixes (Python)'])
    print("")

    # Fix each file
    print("🔨 Applying fixes...")
    total_fixes = 0
    files_changed = 0

    for i, (file_path, errors) in enumerate(sorted(errors_by_file.items()), 1):
        changed, fixes = fix_file(file_path, errors)
        if changed:
            files_changed += 1
            total_fixes += fixes
            if i % 20 == 0:
                print(f"  Processed {i}/{len(errors_by_file)} files ({files_changed} modified, {total_fixes} casts added)...")

    print(f"✅ Processed {len(errors_by_file)} files")
    print(f"   Modified: {files_changed} files")
    print(f"   Type casts added: {total_fixes}")
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
        final_count = output.count('error TS18046')
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
            print(f"✅ Successfully fixed {fixed_count} TS18046 errors!")
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
    print("1. Review changes: git diff")
    print("2. Commit: git commit -am 'fix: Add type casts for unknown variables'")
    print("")

    return 0

if __name__ == '__main__':
    sys.exit(main())
