# DOCUMENTATION_ONBOARDING_GUIDE

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for DOCUMENTATION_ONBOARDING_GUIDE

---
# Documentation Onboarding Guide

> Welcome to the Mugiwara-Kaizoku documentation system!  
> This guide helps new developers and contributors understand and use our documentation effectively.

## 🚀 Quick Start (5 Minutes)

### Essential Documents to Read First

1. **[CANONICAL_DOCS.md](./CANONICAL_DOCS.md)** - Your source of truth for which documentation to trust
2. **[README.md](../README.md)** - Project overview and setup
3. **Your Area's Guide**:
   - Frontend Dev? → [Component Pattern Guide](./component-pattern-unified.md)
   - Backend Dev? → [API Documentation](./api-documentation-standardized.md)
   - Testing? → [Testing Guide](./testing-guide-unified.md)
   - DevOps? → [Build System Guide](./build-system-standardization.md)

### Key Commands to Know

```bash
# Find documentation
npm run docs:search "search term"     # Search all docs
npm run docs:map                      # Visual documentation map

# Validate documentation
npm run docs:validate                 # Check all docs
npm run docs:check                    # Check references

# Fix issues
npm run docs:fix                      # Auto-fix common issues
```

## 📚 Understanding Our Documentation

### Documentation Structure

```
docs/
├── CANONICAL_DOCS.md           # ⭐ START HERE - List of trusted docs
├── guides/                     # How-to guides and tutorials
├── integrations/              # External service integrations
├── patterns/                  # Code patterns and best practices
├── api/                       # API references
├── architecture/              # System design and architecture
├── templates/                 # Documentation templates
└── archive/                   # ⚠️ Outdated docs (DO NOT USE)
```

### Documentation Categories

1. **Canonical Documentation** ✅
   - Listed in CANONICAL_DOCS.md
   - Regularly updated and validated
   - Safe to follow

2. **Archived Documentation** ⚠️
   - Found in docs/archive/
   - Contains deprecation warnings
   - Historical reference only

3. **Work-in-Progress** 🚧
   - Marked with WIP tags
   - May be incomplete
   - Check with doc owner

## 🎯 Common Tasks

### Finding the Right Documentation

```mermaid
graph TD
    A[Need Documentation?] --> B{What type?}
    B -->|Code Pattern| C[Check CANONICAL_DOCS.md]
    B -->|API Reference| D[Check api/ folder]
    B -->|How-to Guide| E[Check guides/ folder]
    B -->|Not Sure| F[Use search command]
    
    C --> G[Found in list?]
    G -->|Yes| H[Use that doc]
    G -->|No| I[Ask in #documentation]
    
    F --> J[npm run docs:search "term"]
```

### When You Find Outdated Documentation

1. **Check for warnings** - Look for deprecation banners
2. **Find the replacement** - Check CANONICAL_DOCS.md
3. **Report if unclear** - Create an issue or ask in Slack

Example deprecation banner:
```markdown
> ⚠️ **DEPRECATED**: This document is outdated as of January 2025.
> Please refer to [new-guide.md](./new-guide.md) for current information.
```

### Contributing to Documentation

#### Before You Write

1. **Check if it exists** - Search first to avoid duplication
2. **Use templates** - Found in docs/templates/
3. **Follow standards** - Read [DOCUMENTATION_BEST_PRACTICES.md](./DOCUMENTATION_BEST_PRACTICES.md)

#### Writing Process

```bash
# 1. Create branch
git checkout -b docs/your-topic

# 2. Use appropriate template
cp docs/templates/GUIDE_TEMPLATE.md docs/guides/your-guide.md

# 3. Write your documentation
code docs/guides/your-guide.md

# 4. Validate before committing
npm run docs:validate:single docs/guides/your-guide.md

# 5. Create PR
git add docs/guides/your-guide.md
git commit -m "docs: add guide for X"
git push origin docs/your-topic
```

## 🔍 Documentation Discovery

### Search Strategies

1. **By Topic**
   ```bash
   npm run docs:search "manga status"    # Find all manga status docs
   npm run docs:search "error handling"  # Find error handling guides
   ```

2. **By File Pattern**
   ```bash
   find docs -name "*pattern*.md"        # Find all pattern docs
   find docs -name "*api*.md"            # Find all API docs
   ```

3. **By Recent Updates**
   ```bash
   # Find recently updated docs
   find docs -name "*.md" -mtime -7      # Updated in last 7 days
   ```

### Visual Navigation

```bash
# Generate visual site map
npm run docs:map

# Output includes:
# - ASCII tree structure
# - Interactive HTML map
# - Mermaid diagram
```

## 🛠️ Development Workflow

### Working with Documentation

1. **Start of Day**
   ```bash
   # Check for documentation updates
   git pull origin main
   npm run docs:validate
   ```

2. **During Development**
   ```bash
   # Run in watch mode for real-time validation
   npm run docs:watch
   ```

3. **Before Committing**
   ```bash
   # Validate your changes
   npm run docs:validate:changed
   ```

### Common Scenarios

#### Scenario 1: "I need to implement a new feature"

1. Check CANONICAL_DOCS.md for relevant patterns
2. Read the specific pattern guide
3. Follow the examples in the guide
4. Update docs if you discover gaps

#### Scenario 2: "I found conflicting documentation"

1. Check which doc is in CANONICAL_DOCS.md (use that one)
2. Report the conflict in #documentation
3. The conflicting doc will be archived

#### Scenario 3: "I can't find documentation for X"

1. Search using `npm run docs:search "X"`
2. Check if it's in development (ask team)
3. If truly missing, volunteer to write it!

## 📋 Documentation Checklist

### For New Team Members

- [ ] Read CANONICAL_DOCS.md
- [ ] Bookmark the canonical docs for your area
- [ ] Install documentation tools: `npm install`
- [ ] Join #documentation Slack channel
- [ ] Run `npm run docs:map` to explore structure
- [ ] Read relevant guides for your role
- [ ] Try the search command
- [ ] Know how to report issues

### For Your First Week

- [ ] Understand the documentation structure
- [ ] Know which docs are canonical
- [ ] Can run validation commands
- [ ] Have fixed at least one doc issue
- [ ] Attended documentation office hours

### For Your First Month

- [ ] Contributed to documentation
- [ ] Understand the review process
- [ ] Can help others find docs
- [ ] Participate in doc maintenance

## 🤝 Getting Help

### Documentation Support

1. **Slack Channels**
   - `#documentation` - General documentation questions
   - `#documentation-urgent` - Critical doc issues
   - `#dev-help` - Development questions

2. **Office Hours**
   - Every Thursday 2-3 PM
   - Open for any documentation questions
   - Screen sharing available

3. **Documentation Owners**
   - Listed in [DOCUMENTATION_GOVERNANCE.md](./DOCUMENTATION_GOVERNANCE.md)
   - Responsible for specific areas
   - Available for deep dives

### Reporting Issues

```markdown
<!-- Use this template for documentation issues -->
**Issue Type**: [ ] Outdated [ ] Missing [ ] Confusing [ ] Broken Link

**Document**: path/to/document.md

**Problem**: Clear description of the issue

**Suggested Fix**: How you think it should be fixed

**Priority**: [ ] P0-Critical [ ] P1-High [ ] P2-Medium [ ] P3-Low
```

## 🎓 Learning Path

### Week 1: Foundation
- [ ] Complete this onboarding guide
- [ ] Read all canonical docs for your area
- [ ] Run basic documentation commands
- [ ] Fix one documentation issue

### Week 2: Proficiency
- [ ] Use templates to create documentation
- [ ] Understand validation process
- [ ] Participate in PR reviews
- [ ] Help another developer find docs

### Week 3: Contribution
- [ ] Write new documentation
- [ ] Update existing guides
- [ ] Suggest improvements
- [ ] Mentor new team members

### Week 4: Mastery
- [ ] Lead documentation initiative
- [ ] Improve documentation tools
- [ ] Establish best practices
- [ ] Become area expert

## 🚨 Important Warnings

### Never Use These Documents
```
❌ docs/archive/*                    # All archived docs
❌ mangal-integration.md            # Removed feature
❌ lucia-auth.md                    # Wrong auth system
❌ docs/anilist-adapter-types.md    # Outdated types
```

### Always Verify
- Check the "Last Updated" date
- Look for deprecation warnings
- Confirm it's in CANONICAL_DOCS.md
- Ask if unsure

## 📈 Measuring Success

You'll know you're successful when:

1. **Finding Docs**: <2 minutes to find any documentation
2. **Understanding**: Can explain our doc structure to others
3. **Contributing**: Submit 1+ doc improvement per week
4. **Helping**: Answer doc questions in Slack
5. **Quality**: Your code follows documented patterns

## 🎉 Next Steps

1. **Today**: 
   - Read your area's canonical docs
   - Try the search command
   - Join #documentation

2. **This Week**:
   - Attend office hours
   - Fix one doc issue
   - Create your first doc

3. **This Month**:
   - Become proficient with all tools
   - Help improve the system
   - Share feedback

## 📚 Resources

### Essential Links
- [CANONICAL_DOCS.md](./CANONICAL_DOCS.md) - Source of truth
- [Best Practices](./DOCUMENTATION_BEST_PRACTICES.md) - Writing guide
- [Contribution Guide](./DOCUMENTATION_CONTRIBUTION_GUIDE.md) - How to contribute
- [Templates](./templates/README.md) - Documentation templates

### Quick Reference Card

```bash
# Daily Commands
npm run docs:validate     # Check all docs
npm run docs:search      # Find documentation
npm run docs:fix         # Fix common issues
npm run docs:watch       # Real-time validation

# Before Committing
npm run docs:validate:changed  # Check your changes
npm run docs:spell:changed     # Spell check
npm run docs:test:examples     # Test code examples

# Getting Help
npm run docs:map         # Visual structure
npm run docs:health      # Documentation metrics
```

---

**Welcome aboard!** 🚢 We're excited to have you contributing to our documentation. Remember, great documentation makes everyone's life easier.

**Questions?** Ask in #documentation or during office hours.

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**For**: New developers and contributors