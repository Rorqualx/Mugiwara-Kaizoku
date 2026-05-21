# Documentation Rules & Guidelines

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

This document explains the documentation rules and tools for maintaining the Mugiwara Kaizoku documentation system.

---

## 🚀 Quick Start for Claude/AI Assistants

### Configuration Files
1. **Main Rules**: `/docs/CLAUDE_DOCUMENTATION_RULES.md` - Comprehensive rules
2. **Quick Reference**: `/docs/CLAUDE_DOCS_RULES_QUICK.md` - Condensed version
3. **System Prompt**: `/docs/CLAUDE_SYSTEM_PROMPT_ADDON.md` - Add to AI configuration
4. **Project Config**: `/claude.config.yml` - Project-specific settings

### Key Rule: Update, Don't Create
```
Before ANY documentation work:
1. Search: find /docs -iname "*topic*.md" -type f
2. Check guides: ls /docs/*/*-guide.md
3. Update existing > Add section > Create new (rare)
```

---

## 📋 For Developers

### Setting Up Documentation Compliance

1. **Install Pre-commit Hook** (Optional but recommended)
```bash
cp docs/hooks/pre-commit-docs .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

2. **Check Documentation Compliance**
```bash
node docs/check-template-compliance.js
```

3. **Fix Naming Conventions**
```bash
./docs/consolidation-work/remediate-docs-enhanced.sh
```

### Primary Documentation Locations

| Topic | Primary Guide |
|-------|--------------|
| Database | `/docs/database/database-guide.md` |
| Architecture | `/docs/architecture/architecture-overview.md` |
| Testing | `/docs/testing/testing-guide.md` |
| APIs/Adapters | `/docs/adapters-clients/*-guide.md` |
| Configuration | `/docs/configuration/configuration-system.md` |
| TypeScript | `/docs/typescript/typescript-patterns-guide.md` |

### Documentation Workflow

1. **Need to document something?**
   - Search existing docs first
   - Find the appropriate guide
   - Add your content as a new section
   - Update the table of contents

2. **Found a bug/issue?**
   - Don't create `fix-issue-final.md`
   - Update the relevant troubleshooting section
   - Add to the guide's troubleshooting area

3. **New feature?**
   - Add comprehensive section to relevant guide
   - Only create new file if it's a major new area
   - Link from related guides

---

## 🛠️ Available Tools

### Documentation Management
```bash
# Search for documentation
find /docs -iname "*search-term*.md" -type f

# Check all guides
ls /docs/*/*-guide.md

# Find canonical documents
grep -r "Canonical: Yes" /docs --include="*.md" -l

# Check compliance
node /docs/check-template-compliance.js

# Fix naming issues
./docs/consolidation-work/remediate-docs-enhanced.sh

# Add headers to new files
./docs/consolidation-work/add-headers-selective.sh [directory]
```

### Compliance Checking
- **Naming Convention**: Must use kebab-case
- **Headers Required**: Status, Author, Canonical
- **No Versioning**: Avoid -v2, -final-final patterns
- **Update First**: Always prefer updating existing docs

---

## 📊 Documentation Statistics

- **Before Cleanup**: 500+ scattered files
- **After Cleanup**: 390 organized files
- **Consolidation**: 110 files → 14 comprehensive guides
- **Compliance**: 100% naming and header compliance

---

## ❌ Common Mistakes to Avoid

1. **Creating Duplicate Docs**
   - Bad: `manga-search-fix-v2.md`
   - Good: Update `testing/testing-guide.md`

2. **Fragmenting Information**
   - Bad: 5 files about AniList fixes
   - Good: One `anilist-troubleshooting.md` section

3. **Temporary Files**
   - Bad: `temp-notes-delete-later.md`
   - Good: Update appropriate guide immediately

4. **Ignoring Structure**
   - Bad: Creating files in root /docs
   - Good: Place in appropriate category folder

---

## 📚 Required Reading

Before making any significant documentation or code changes:

1. **Architecture**: `/docs/architecture/architecture-overview.md`
2. **Development Rules**: `/docs/development/DEVELOPMENT_RULES.md`
3. **Documentation Rules**: `/docs/CLAUDE_DOCUMENTATION_RULES.md`
4. **Your Area's Guide**: The main guide for your work area

---

## 🤖 For AI Assistants (Claude, GitHub Copilot, etc.)

### Integration Instructions
1. Add `/docs/CLAUDE_SYSTEM_PROMPT_ADDON.md` to your system prompt
2. Reference `/claude.config.yml` for project settings
3. Always run search commands before creating documentation
4. Prioritize updating over creating

### Key Commands to Remember
```bash
# Before ANY documentation work
find /docs -iname "*topic*.md" -type f
grep -r "topic" /docs --include="*.md"

# Find the right guide
ls /docs/*/*-guide.md | grep -i "relevant-area"
```

---

## 📞 Getting Help

- **Documentation Questions**: Check guides first, then ask team
- **Tool Issues**: See `/docs/consolidation-work/` for tool documentation
- **Policy Questions**: Refer to `/docs/CLAUDE_DOCUMENTATION_RULES.md`

Remember: The goal is to maintain our clean, organized documentation system. When in doubt, update existing docs rather than creating new ones!
