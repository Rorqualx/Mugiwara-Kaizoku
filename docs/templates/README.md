# Documentation Templates

This directory contains standardized templates for creating consistent documentation across the Mugiwara-Kaizoku project.

## Available Templates

### 1. [FEATURE_TEMPLATE.md](./FEATURE_TEMPLATE.md)
Use this template for documenting:
- New features or components
- Existing features that need documentation
- Complex utilities or services

### 2. [API_TEMPLATE.md](./API_TEMPLATE.md)
Use this template for documenting:
- REST API endpoints
- GraphQL schemas
- External API integrations
- Internal service APIs

### 3. [INTEGRATION_TEMPLATE.md](./INTEGRATION_TEMPLATE.md)
Use this template for documenting:
- Third-party service integrations
- External library integrations
- Provider implementations

### 4. [MIGRATION_TEMPLATE.md](./MIGRATION_TEMPLATE.md)
Use this template for documenting:
- Breaking changes requiring migration
- Pattern updates
- Dependency upgrades
- Architecture changes

## How to Use Templates

1. **Copy the appropriate template** to your documentation location
2. **Rename the file** following our naming conventions
3. **Fill in all sections** - delete any that don't apply
4. **Update the header metadata** (status, author, date)
5. **Add to CANONICAL_DOCS.md** if it's an authoritative document

## Template Guidelines

### Required Sections
Every document should include:
- Header metadata (status, author, date)
- Overview section
- Usage examples
- Related documentation links

### Optional Sections
Include these when relevant:
- Migration guides
- Troubleshooting
- Performance considerations
- Security notes

### Code Examples
- Always include working examples
- Test all code snippets
- Use TypeScript for type safety
- Include both basic and advanced usage

### Metadata Fields

| Field | Values | Description |
|-------|--------|-------------|
| Status | `Draft`, `Review`, `Approved` | Document lifecycle stage |
| Author | Name/Team | Who created/owns this doc |
| Last Updated | ISO Date | When last modified |
| Canonical | `Yes`/`No` | Is this the authoritative source |
| Version | Semver | For API docs and versioned features |

## Creating New Templates

If you need a new template type:

1. Create it in this directory
2. Follow the existing template patterns
3. Add it to this README
4. Get it reviewed by the documentation team

## Quality Checklist

Before submitting documentation:

- [ ] Used appropriate template
- [ ] Filled all required sections
- [ ] Tested all code examples
- [ ] Added related doc links
- [ ] Updated metadata
- [ ] Spell-checked content
- [ ] Had it reviewed

## Related Documentation

- Documentation Naming Conventions
- Documentation Contribution Guide
- CANONICAL_DOCS.md

---

**Questions?** Ask in #documentation or check the contribution guide.
