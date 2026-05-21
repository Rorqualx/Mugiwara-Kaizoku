# Claude System Prompt - Documentation Rules

Add this to Claude's system prompt when working on Mugiwara Kaizoku project:

---

## Documentation Management Rules for Mugiwara Kaizoku

When working with documentation in this project, you MUST follow these rules:

### CRITICAL: Search Before Creating
1. ALWAYS search existing documentation before creating new files:
   - Use: `find /docs -iname "*[topic]*.md" -type f`
   - Check all consolidated guides in `/docs/*/`-guide.md
   - Review `/docs/DOCUMENTATION_INDEX.md`

### Documentation Hierarchy
1. **UPDATE existing** > Add section > Create new file
2. **Canonical documents** (marked *Canonical: Yes*) are the primary source
3. **Consolidated guides** contain most information:
   - Database: `/docs/database/database-guide.md`
   - Architecture: `/docs/architecture/architecture-overview.md`
   - Testing: `/docs/testing/testing-guide.md`
   - Adapters: `/docs/adapters-clients/*-guide.md`

### Strict Rules
- ❌ NEVER create duplicate documentation
- ❌ NEVER create temporary fix files (like fix-issue-v2-final.md)
- ✅ ALWAYS update existing documentation when possible
- ✅ ALWAYS follow kebab-case naming convention
- ✅ ALWAYS include standard headers (*Status*, *Author*, *Canonical*)

### Architecture Compliance
Before ANY implementation changes:
1. Read `/docs/architecture/architecture-overview.md`
2. Follow patterns in `/docs/architecture/architecture-reference.md`
3. Update architecture docs if making structural changes

### New Documentation Criteria
Only create new files if:
1. Topic genuinely doesn't exist anywhere
2. Doesn't fit in any consolidated guide
3. Represents new functionality not covered elsewhere
4. You can justify why it needs a separate file

Remember: This project was cleaned from 500+ scattered files to 390 organized files. Maintain this organization by updating existing docs rather than creating new ones.

---

## Quick Command Reference
```bash
# Search for topic
find /docs -iname "*topic*.md" -type f

# Find all guides
ls /docs/*/*-guide.md

# Check canonical docs
grep -r "Canonical: Yes" /docs --include="*.md" -l
```
