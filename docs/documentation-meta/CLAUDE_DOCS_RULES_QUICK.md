# Claude Documentation System Rules - Quick Reference

*MANDATORY RULES for Mugiwara Kaizoku documentation work*

## 🚨 CRITICAL UPDATE: PRISMA TYPES ARE AUTHORITATIVE

**EFFECTIVE IMMEDIATELY (January 2025)**:
- **Prisma types from `@prisma/client` are the SINGLE SOURCE OF TRUTH**
- **NO canonical types, NO compatibility layers, NO converters**
- **All enums MUST use Prisma's UPPERCASE format**
- **Components work directly with Prisma shapes**
- **Import types ONLY from `@prisma/client`**

## 🚨 BEFORE ANY DOCUMENTATION WORK

### 1. SEARCH FIRST (Required)
```bash
find /docs -iname "*[topic]*.md" -type f
grep -r "[topic]" /docs --include="*.md"
```

### 2. CHECK CONSOLIDATED GUIDES
- `/docs/database/database-guide.md`
- `/docs/architecture/architecture-overview.md`
- `/docs/testing/testing-guide.md`
- `/docs/adapters-clients/*-guide.md`

### 3. DECISION FLOW
```
Documentation Needed?
├─ Topic Exists? → UPDATE (never duplicate)
├─ Fits in Guide? → ADD SECTION
├─ Is it a Fix? → UPDATE troubleshooting.md
└─ Truly New? → Create (RARE - needs justification)
```

## ✅ ALWAYS

1. **Update existing docs** instead of creating new ones
2. **Read architecture docs** before making changes
3. **Use kebab-case** for all filenames
4. **Include standard header** in any new file
5. **Check canonical status** before updating

## ❌ NEVER

1. Create duplicate documentation
2. Make `fix-issue-final-v2.md` type files
3. Fragment information across multiple files
4. Skip documentation search phase
5. Create new guides without checking existing ones

## 📁 PRIMARY DOCUMENTATION MAP

```
/docs/
├── database/          → database-guide.md
├── architecture/      → architecture-overview.md
├── testing/          → testing-guide.md
├── adapters-clients/ → [adapter]-guide.md
├── configuration/    → configuration-system.md
├── typescript/       → typescript-patterns-guide.md
└── development/      → development-guide.md
```

## 🔧 UPDATING CHECKLIST

- [ ] Found canonical document (*Canonical: Yes*)
- [ ] Document is Active (*Status: Active*)
- [ ] Added content to appropriate section
- [ ] Updated table of contents
- [ ] Maintained existing structure
- [ ] Cross-references still valid

## 🆕 NEW DOCUMENT CRITERIA

Only create new documentation if ALL are true:
1. ✓ No existing document covers the topic
2. ✓ Doesn't fit in any consolidated guide
3. ✓ Represents genuinely new functionality
4. ✓ Has clear maintenance plan

**Remember: 500+ files → 390 organized files. Keep it clean!**
