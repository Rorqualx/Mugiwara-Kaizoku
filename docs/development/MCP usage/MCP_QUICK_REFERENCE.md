# MCP Quick Reference Card - Mugiwara Kaizoku

*Keep this handy during development*  
*Last Updated: 2025-10-26*

---

## ⚡ Quick Decision Tree

```
Need to do something? → Check this flowchart:

┌─────────────────────────────────────┐
│   Is it security-sensitive?        │
│   (credentials, production data)    │
└─────────────────────────────────────┘
         │
         ├─ YES ──→ ❌ DO NOT USE MCP
         │
         └─ NO ──→ Continue
                   │
                   ▼
┌─────────────────────────────────────┐
│   Do we have a project tool for it? │
│   (ast-grep, /commit, /start, etc.) │
└─────────────────────────────────────┘
         │
         ├─ YES ──→ ✅ USE PROJECT TOOL
         │
         └─ NO ──→ Continue
                   │
                   ▼
┌─────────────────────────────────────┐
│   Is it complex/unfamiliar?        │
│   Would it save >5 minutes?        │
└─────────────────────────────────────┘
         │
         ├─ YES ──→ ✅ USE MCP (validate after)
         │
         └─ NO ──→ ✅ CODE IT YOURSELF
```

---

## 🎯 Common Use Cases

| Task | MCP Server | Tool | Example Prompt |
|------|------------|------|----------------|
| Complex SQL query | `postgres` | `execute_query` | "Find all manga with >100 chapters and rating >4.5" |
| Find documentation | `documentation-search` | `search_documentation` | "How do I implement AsyncResult in adapters?" |
| Test API endpoint | `adapter-tester` | `test_adapter_endpoint` | "Test MangaDex search with title 'One Piece'" |
| Create PR | `github` | `create_pull_request` | "Create PR for feature/manga-search-v2" |
| Check server status | `dev-monitor` | `check_server_status` | "Is dev server running on port 3000?" |
| Navigate codebase | `filesystem` | `search_files` | "Find all AsyncResult implementations" |

---

## ✅ Validation Checklist

**After using MCP to generate code, ALWAYS:**

```bash
# 1. Check for forbidden patterns
ast-grep --pattern 'any' src/
# Should return: No matches

# 2. Type check
bun run type-check
# Should return: No errors

# 3. Lint check
bun run lint
# Should return: No errors

# 4. Run pre-commit validation
/commit
# Should return: All checks passed
```

---

## 🚫 Never Use MCP For

- ❌ Committing code (use `/commit`)
- ❌ Searching code patterns (use `ast-grep`)
- ❌ Type checking (use `bun run type-check`)
- ❌ Linting (use `bun run lint`)
- ❌ Managing credentials
- ❌ Production deployments
- ❌ Simple CRUD you know by heart

---

## 📋 Installed MCP Servers

### Core Servers (Official)
- **postgres** - Database queries and analysis
- **github** - Repository management
- **filesystem** - File operations and search

### Custom Servers (Mugiwara-Specific)
- **documentation-search** - Semantic doc search
- **adapter-tester** - API testing and validation

---

## 🔧 Common Commands

### List Available Tools
```
"What MCP tools do I have access to?"
```

### Test Database Query
```
"Use postgres MCP to show me the schema for the Manga model"
```

### Search Documentation
```
"Search docs for AsyncResult error handling patterns"
```

### Find Related Code
```
"Use filesystem MCP to find all tRPC procedures related to manga"
```

### Create GitHub Issue
```
"Create a GitHub issue for: Improve manga search performance"
```

---

## ⚠️ Remember

1. **MCP enhances, doesn't replace** - Always validate outputs
2. **Security first** - Never expose credentials
3. **Follow project standards** - Check DEVELOPMENT_RULES.md
4. **Validate before committing** - Run `/commit`
5. **Document new servers** - Update MCP_SERVERS.md

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| MCP server not responding | Restart Claude Desktop |
| Tool not found | Check claude_desktop_config.json |
| Permission denied | Verify environment variables |
| Invalid output | Validate against project standards |
| Rate limit hit | Check with `check_rate_limits` tool |

---

## 📖 Full Documentation

- **MCP_USAGE_DIRECTIVE.md** - Complete directive and rules
- **MCP_IMPLEMENTATION_GUIDE.md** - Server implementation details
- **docs/development/MCP_SERVERS.md** - Setup and troubleshooting
- **CLAUDE.md** - Main development guide

---

## 💡 Pro Tips

1. **Combine tools**: Use MCP for exploration, ast-grep for precision
2. **Document patterns**: If MCP finds something useful, document it
3. **Test iteratively**: Start with simple queries, refine based on results
4. **Share findings**: Good MCP patterns → team knowledge
5. **Monitor usage**: Track what works, iterate on what doesn't

---

*Print this card and keep it visible while coding!*
