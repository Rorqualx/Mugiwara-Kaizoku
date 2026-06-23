# Claude Documentation Rules

*Status: Active*  
*Canonical: Yes*  
*Date: July 11, 2025*

## Overview

Mandatory rules for Claude when working with Mugiwara Kaizoku documentation. These rules ensure documentation remains organized, consistent, and maintainable.

---

## 🚨 CRITICAL RULES - MUST FOLLOW

### Rule 1: Read Before Writing
**ALWAYS** search and read existing documentation before creating any new content.

```bash
# Required search patterns before any documentation work:
1. Search for topic in /docs using: find /docs -name "*keyword*.md"
2. Check consolidated guides first:
   - /docs/database/database-guide.md
   - /docs/architecture/architecture-overview.md
   - /docs/testing/testing-guide.md
   - /docs/adapters-clients/*-guide.md
3. Review DOCUMENTATION_INDEX.md for topic location
4. Check archive for historical context if needed
```

### Rule 2: Update, Don't Duplicate
**NEVER** create a new document if the topic already exists. Instead:

1. **Find the canonical document** (check *Canonical: Yes* in header)
2. **Update the existing document** with new information
3. **Maintain the document structure** already in place
4. **Add sections** rather than creating new files

### Rule 3: Follow Architecture Patterns
**ALWAYS** consult architecture documentation before implementation:

```markdown
Required Reading Order:
1. /docs/architecture/architecture-overview.md - System design
2. /docs/development/development-guide.md - Coding standards
3. /docs/typescript/typescript-patterns-guide.md - Type patterns
```

### Rule 4: Documentation Hierarchy
Follow this strict hierarchy for documentation decisions:

```
1. Does the topic exist? → UPDATE existing doc
2. Does it fit in a consolidated guide? → ADD section
3. Is it a minor fix/note? → UPDATE relevant troubleshooting
4. Is it truly new functionality? → ONLY THEN create new doc
```

---

## 📋 DOCUMENTATION WORKFLOW

### Before Creating ANY Documentation:

1. **Search Phase** (MANDATORY)
```bash
# Execute ALL of these searches:
find /docs -iname "*[topic]*.md" -type f
grep -r "[topic]" /docs --include="*.md"
ls /docs/*/[category]-guide.md  # Check all guides
```

2. **Verification Phase**
- [ ] Checked all consolidated guides
- [ ] Searched for topic variations
- [ ] Reviewed architecture docs
- [ ] Confirmed topic doesn't exist

3. **Decision Tree**
```
Topic Found?
├─ YES → Update existing document
│   ├─ Add new section if needed
│   ├─ Update table of contents
│   └─ Maintain existing structure
│
└─ NO → Is it architectural?
    ├─ YES → Update architecture-*.md
    └─ NO → Is it a fix/troubleshooting?
        ├─ YES → Update *-troubleshooting.md
        └─ NO → Create new doc (RARE)
```

---

## 📁 DOCUMENTATION STRUCTURE MAP

### Always Check These First:

#### For Database Topics:
- Primary: `/docs/database/database-guide.md`
- Schema source of truth: `prisma/schema.prisma`

#### For Architecture Topics:
- Primary: `/docs/architecture/architecture-overview.md`

#### For Testing Topics:
- Primary: `/docs/testing/testing-guide.md`

#### For API/Client Topics:
- Adapter pattern: `/docs/adapters-clients/adapter-pattern-comprehensive-guide.md`
- AniList: `/docs/user-guides/integrations/anilist-guide.md`
- Download clients: `/docs/adapters-clients/download-clients-complete-guide.md`

#### For Configuration:
- Primary: `/docs/configuration/environment-variables.md`
- Settings UI: `/docs/configuration/settings-ui-implementation-guide.md`

#### For TypeScript:
- Patterns: `/docs/typescript/typescript-patterns-guide.md`
- Fixes: `/docs/typescript/typescript-fixes-*.md`

---

## 🛠️ UPDATING EXISTING DOCUMENTATION

### Required Steps:

1. **Locate the Document**
```bash
# Use the consolidation work tools:
node /docs/check-template-compliance.js [file]
```

2. **Check Header Status**
```markdown
# Verify these fields:
*Status: Active*  # Should be Active for updates
*Canonical: Yes*  # Must be Yes for primary docs
```

3. **Update Appropriately**
- Add new sections with proper headers
- Update table of contents
- Maintain consistent formatting
- Update the Overview if scope changes
- Add dated notes for significant changes

4. **Cross-Reference Check**
```bash
# Find documents that reference this one:
grep -r "filename.md" /docs --include="*.md"
```

---

## 🚫 DOCUMENTATION ANTI-PATTERNS

### NEVER DO:
1. ❌ Create `fix-[issue]-final-final-v2.md` files
2. ❌ Duplicate content across multiple files
3. ❌ Create new guides without checking existing ones
4. ❌ Use camelCase in filenames (always kebab-case)
5. ❌ Skip the standard header template
6. ❌ Create "temporary" documentation files
7. ❌ Make architecture changes without updating architecture docs

### ALWAYS AVOID:
- Creating `[feature]-implementation-summary.md` when a guide exists
- Making new troubleshooting files instead of updating existing ones
- Fragmenting information across multiple small files
- Creating date-stamped versions of documents

---

## ✅ WHEN TO CREATE NEW DOCUMENTATION

### Acceptable Scenarios:
1. **Genuinely new feature** with no existing documentation
2. **New integration** not covered in adapter guides
3. **Major architectural change** requiring separate ADR
4. **New category** of functionality

### Required for New Documents:
```markdown
# [Descriptive Title]

*Status: Draft*  # Start as Draft
*Author: [Your identifier]*  
*Canonical: No*  # Until reviewed

## Overview
[Clear description of why this document is needed]

## Relationship to Existing Docs
[List related documents and why this couldn't be added to them]

---
[Content]
```

### New Document Checklist:
- [ ] Searched all existing documentation
- [ ] Confirmed topic doesn't fit in any guide
- [ ] Used kebab-case naming
- [ ] Added standard header
- [ ] Linked from relevant guides
- [ ] Updated DOCUMENTATION_INDEX.md

---

## 📊 QUICK REFERENCE COMMANDS

### Search for Topics:
```bash
# Comprehensive search
find /docs -type f -name "*.md" -exec grep -l "search term" {} \;

# Check guides
ls /docs/*/*.guide.md

# Find troubleshooting docs
find /docs -name "*troubleshooting*.md"

# Check for duplicates
find /docs -name "*[topic]*.md" | sort
```

### Verify Documentation:
```bash
# Check compliance
node /docs/check-template-compliance.js

# List canonical documents
grep -r "Canonical: Yes" /docs --include="*.md" -l

# Find active documents
grep -r "Status: Active" /docs --include="*.md" -l
```

---

## 🎯 GOLDEN RULES SUMMARY

1. **READ FIRST**: Always read existing docs before writing
2. **UPDATE PREFERRED**: Update > Add Section > New File
3. **FOLLOW ARCHITECTURE**: Respect established patterns
4. **MAINTAIN STRUCTURE**: Keep the clean organization
5. **USE TOOLS**: Leverage the compliance checking tools
6. **THINK LONG-TERM**: Will this scale? Is it maintainable?

---

## 🚨 ENFORCEMENT

These rules are **MANDATORY**. Following them ensures:
- Documentation remains maintainable
- Information stays consolidated
- Developers can find what they need
- The cleanup effort isn't wasted

**Remember**: We just reduced 500+ files to 390 well-organized documents. Let's keep it that way!

---

*Last Updated: July 11, 2025*  
*Next Review: August 11, 2025*
