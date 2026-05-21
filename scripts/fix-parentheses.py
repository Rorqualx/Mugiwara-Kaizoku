#!/usr/bin/env python3

import sys
import re

def check_parentheses_balance(filepath, line_number):
    """Check parentheses balance around a specific line."""
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    if line_number > len(lines):
        return
    
    # Check the specific line and surrounding context
    start = max(0, line_number - 5)
    end = min(len(lines), line_number + 5)
    
    context = ''.join(lines[start:end])
    
    # Count parentheses
    open_count = context.count('(')
    close_count = context.count(')')
    
    print(f"\n{filepath}:{line_number}")
    print(f"Context (lines {start+1}-{end}):")
    for i in range(start, end):
        prefix = ">>> " if i == line_number - 1 else "    "
        print(f"{prefix}{i+1}: {lines[i].rstrip()}")
    
    print(f"Open parentheses: {open_count}, Close parentheses: {close_count}")
    
    if open_count > close_count:
        print(f"Missing {open_count - close_count} closing parenthesis/es")
    elif close_count > open_count:
        print(f"Extra {close_count - open_count} closing parenthesis/es")

# Parse TypeScript error output
errors = [
    ("src/components/addManga/UniversalImportWizard.tsx", 4574),
    ("src/components/addManga/UniversalImportWizard.tsx", 4623),
    ("src/components/addManga/UniversalImportWizard.tsx", 4696),
    ("src/components/addManga/UniversalImportWizard.tsx", 4771),
    ("src/components/events/EventDetailsModal.tsx", 282),
    ("src/components/events/EventsDashboard.tsx", 586),
    ("src/components/library/LibraryDisplay.tsx", 86),
    ("src/components/manga/ProviderMetadataModal.tsx", 237),
]

for filepath, line_num in errors[:3]:  # Check first 3 errors
    check_parentheses_balance(filepath, line_num)