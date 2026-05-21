# MCP (Model Context Protocol) Usage Directive

*Status: Active*  
*Author: Development Team*  
*Created: 2025-10-26*  
*Based on: CLAUDE.md v2025-10-14*

## Executive Summary

This directive establishes **mandatory guidelines** for when and how to leverage Model Context Protocol (MCP) servers during development of Mugiwara Kaizoku. MCP is an open standard that enables AI assistants to securely connect with external data sources, tools, and services in a standardized way.

**Key Principle**: MCP servers act as bridges between AI coding assistants and external systems, extending capabilities beyond what's possible with training data alone.

---

## 📋 CLAUDE.md Analysis Summary

### Current Development Environment

**Strengths:**
- ✅ Comprehensive documentation structure (110 files → 14 guides consolidation)
- ✅ Strong type safety enforcement (TypeScript strict mode)
- ✅ Mature tooling ecosystem (ast-grep, tRPC, Prisma)
- ✅ Clear architectural patterns (AsyncResult, adapters, error handling)
- ✅ Automated validation workflows (`/start`, `/rules`, `/commit`)

**Identified Gaps for MCP Integration:**
- 🔶 **Database operations**: Currently manual Prisma queries could benefit from natural language query construction
- 🔶 **External API integrations**: MangaDex, Fandom, ComicVine adapters could use MCP for live testing/debugging
- 🔶 **Documentation management**: 40+ docs could benefit from semantic search via MCP
- 🔶 **Git operations**: Complex git workflows could be simplified with GitHub MCP server
- 🔶 **Development workflow**: Context switching between tools could be reduced

---

## 🎯 When to Use MCP Servers

### ALWAYS Use MCP For:

1. **Database Query Construction & Analysis**
   - Natural language to SQL/Prisma queries
   - Schema exploration and relationship mapping
   - Query performance analysis
   - Data validation and testing
   
   **Example MCP Servers:**
   - PostgreSQL MCP Server
   - Prisma Inspector (custom)

2. **External API Testing & Integration**
   - Real-time API endpoint testing
   - Response validation against schemas
   - Rate limit monitoring
   - Authentication flow testing
   
   **Example MCP Servers:**
   - Custom MangaDex MCP
   - Custom Fandom/ComicVine MCP
   - REST API Testing MCP

3. **Git & GitHub Operations**
   - Branch management
   - PR creation and status checks
   - Issue triage and tracking
   - Commit history analysis
   
   **Example MCP Servers:**
   - GitHub MCP Server
   - Git MCP Server

4. **Documentation Navigation & Search**
   - Semantic search across 40+ markdown files
   - Finding canonical documentation
   - Cross-referencing related docs
   - Identifying documentation gaps
   
   **Example MCP Servers:**
   - File System MCP Server
   - Custom Documentation Search MCP

5. **Development Environment Management**
   - Server status checks (port 3000)
   - Process management (Bun, Node)
   - Dependency version checks
   - Environment variable validation
   
   **Example MCP Servers:**
   - Desktop Commander MCP
   - System Monitor MCP (custom)

### CONSIDER Using MCP For:

1. **Code Pattern Analysis**
   - Finding similar implementations
   - Identifying refactoring opportunities
   - Analyzing code complexity
   - Suggesting improvements
   
   **When**: Complex refactoring tasks, architectural reviews
   **Complement with**: ast-grep for structural patterns

2. **Real-time Data Visualization**
   - Database statistics
   - API response times
   - Job queue metrics
   - Error rate tracking
   
   **When**: Performance optimization, monitoring setup
   **Complement with**: Existing Pino logging infrastructure

3. **Multi-Service Coordination**
   - Coordinating changes across frontend/backend
   - Managing database migrations with code changes
   - Orchestrating multi-step deployments
   
   **When**: Large-scale refactorings, feature deployments

### NEVER Use MCP For:

1. **Security-Sensitive Operations**
   - ❌ API key management
   - ❌ Database credential storage
   - ❌ Authentication token handling
   - ❌ Production database modifications
   
   **Why**: Security risks, audit trail requirements, compliance

2. **Critical Path Operations**
   - ❌ Production deployments
   - ❌ Database schema changes in production
   - ❌ User data modifications
   
   **Why**: Requires human verification, rollback complexity

3. **Tasks Already Handled Well by Existing Tools**
   - ❌ Type checking (use `bun run type-check`)
   - ❌ Linting (use `bun run lint`)
   - ❌ Code search (use `ast-grep`)
   - ❌ Testing (use Jest)
   
   **Why**: Established workflows, better performance, project standards

4. **Simple CRUD Operations**
   - ❌ Basic Prisma queries you know by heart
   - ❌ Standard REST endpoint patterns
   - ❌ Common React component patterns
   
   **Why**: Faster to write directly, no context switching needed

---

## 🏗️ MCP Server Architecture for Mugiwara Kaizoku

### Recommended MCP Server Stack

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mugiwara_kaizoku"],
      "description": "Direct PostgreSQL access for query analysis"
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      },
      "description": "GitHub repo management and PR operations"
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/mugiwara-kaizoku"],
      "description": "Documentation search and file operations"
    },
    "custom-docs": {
      "command": "node",
      "args": ["./mcp-servers/documentation-search.js"],
      "description": "Semantic search across project documentation"
    },
    "custom-adapter-tester": {
      "command": "node",
      "args": ["./mcp-servers/adapter-tester.js"],
      "description": "Test external API adapters (MangaDex, Fandom, ComicVine)"
    }
  }
}
```

### Priority Implementation Order

1. **Phase 1 (Immediate Value)**
   - PostgreSQL MCP Server → database query assistance
   - GitHub MCP Server → PR and issue management
   - File System MCP Server → documentation navigation

2. **Phase 2 (Enhanced Productivity)**
   - Custom Documentation Search MCP → semantic doc search
   - Custom Adapter Tester MCP → API integration testing

3. **Phase 3 (Advanced Integration)**
   - Custom Development Monitor MCP → server status, process health
   - Custom Code Pattern Analyzer MCP → refactoring assistance

---

## 📐 Integration Rules & Best Practices

### Rule 1: MCP Complements, Not Replaces

**DO:**
- ✅ Use MCP to generate complex Prisma queries, then validate with `ast-grep`
- ✅ Use MCP to explore database schema, then implement with established patterns
- ✅ Use MCP to draft PR descriptions, then review against `DEVELOPMENT_RULES.md`

**DON'T:**
- ❌ Bypass TypeScript type checking via MCP
- ❌ Skip ESLint validation via MCP
- ❌ Ignore project conventions because MCP suggested something different

### Rule 2: Validate MCP Outputs Against Project Standards

**Validation Checklist:**
```bash
# After using MCP to generate code:
1. Run: ast-grep --pattern 'any' src/  # No 'any' types allowed
2. Run: bun run type-check              # TypeScript must pass
3. Run: bun run lint                    # ESLint must pass
4. Review: DEVELOPMENT_RULES.md         # Follow all rules
5. Test: bun test                       # Tests must pass
```

### Rule 3: MCP Server Security Guidelines

**Authentication:**
- Use environment variables for API tokens (never hardcode)
- Implement least-privilege access (read-only when possible)
- Use Docker containers for MCP servers when available (isolation)

**Data Protection:**
- Never pass sensitive data through MCP prompts
- Sanitize outputs before using in production code
- Log MCP operations for audit trails (development only)

**Example Secure Configuration:**
```json
{
  "mcpServers": {
    "postgres": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "--network=host",
        "mcp/postgres",
        "postgresql://localhost/mugiwara_kaizoku"
      ],
      "description": "Containerized PostgreSQL access"
    }
  }
}
```

### Rule 4: MCP Tool Budget Management

**Tool Budget Principle**: Limit the number of tools per MCP server to avoid overwhelming AI agents

**For Mugiwara Kaizoku:**
- **Maximum 10 tools per MCP server**
- **Use prompts for complex operations** (chaining multiple tools)
- **Group related operations** (e.g., all database schema operations in one tool)

**Example - Good Tool Design:**
```typescript
// GOOD: Focused, single-purpose tool
{
  name: "analyze_manga_query_performance",
  description: "Analyzes performance of Prisma queries against Manga model",
  inputSchema: {
    query: "string",
    includeExplainPlan: "boolean"
  }
}

// BAD: Too broad, unclear purpose
{
  name: "database_operations",
  description: "Does database stuff",
  inputSchema: {
    operation: "string",
    params: "any"
  }
}
```

### Rule 5: Error Handling with MCP

**MCP-Specific Error Patterns:**
```typescript
// When using MCP results in code
type MCPResult<T> = AsyncResult<T, MCPError>;

interface MCPError {
  source: 'mcp_server';
  serverName: string;
  originalError: Error;
  retryable: boolean;
}

// Example integration
async function queryWithMCP(query: string): MCPResult<QueryResult> {
  try {
    const mcpResult = await mcpClient.executeTool('postgres', 'execute_query', { query });
    
    // Validate result against project standards
    if (!isValidPrismaQuery(mcpResult)) {
      return Err({
        source: 'mcp_server',
        serverName: 'postgres',
        originalError: new Error('MCP generated invalid Prisma query'),
        retryable: true
      });
    }
    
    return Ok(mcpResult);
  } catch (error) {
    return Err({
      source: 'mcp_server',
      serverName: 'postgres',
      originalError: error as Error,
      retryable: false
    });
  }
}
```

### Rule 6: Documentation Requirements

**For Each MCP Server Integration:**

1. **Document in `/docs/development/MCP_SERVERS.md`**
   - Server name and purpose
   - Installation instructions
   - Available tools/resources
   - Usage examples
   - Troubleshooting guide

2. **Update CLAUDE.md**
   - Add MCP server to technology stack
   - Include common usage patterns
   - Add to quick reference section

3. **Create Usage Examples**
   - Store in `/examples/mcp/`
   - Include common workflows
   - Show integration with existing tools

---

## 🚀 Workflow Integration

### Standard Development Flow with MCP

```
1. Pre-Coding Phase
   ├─ Run: /start
   ├─ Run: /rules
   └─ [MCP] Query database schema if needed
       └─ Tool: postgres.describe_schema
   
2. Coding Phase
   ├─ [MCP] Generate complex queries
   │   └─ Validate with ast-grep
   ├─ [MCP] Check API responses
   │   └─ Validate against Zod schemas
   └─ [Traditional] Write code following DEVELOPMENT_RULES.md
   
3. Testing Phase
   ├─ [Traditional] bun test
   ├─ [MCP] Analyze test coverage gaps
   └─ [MCP] Suggest additional test cases
   
4. Pre-Commit Phase
   ├─ Run: /commit
   ├─ [MCP] GitHub: Check for related PRs
   └─ [Traditional] Git commit if validation passes
```

### Example: Adding a New Manga Search Feature

```typescript
// Step 1: Use MCP to explore current implementation
// MCP Tool: filesystem.search_code
// Query: "Search for existing manga search implementations"

// Step 2: Use MCP to analyze database requirements
// MCP Tool: postgres.analyze_query_performance
// Query: "SELECT * FROM Manga WHERE title ILIKE '%search%'"

// Step 3: Write code following project standards
// - Use domain types from @/types/domain/manga-types
// - Implement AsyncResult pattern
// - Add withEnhancedErrorHandling
// - Follow tRPC v11 patterns

// Step 4: Use MCP to validate
// MCP Tool: custom-adapter-tester.test_search
// Input: Sample search queries

// Step 5: Traditional validation
// Run: /commit
```

---

## 🔍 Custom MCP Server Specifications

### 1. Documentation Search MCP Server

**Purpose**: Semantic search across 40+ project documentation files

**Tools:**
```typescript
{
  "find_canonical_docs": {
    description: "Find canonical documentation files",
    output: "List of canonical docs with topics"
  },
  "search_documentation": {
    description: "Semantic search across all docs",
    input: { query: string, scope?: string },
    output: "Ranked list of relevant doc sections"
  },
  "find_related_docs": {
    description: "Find docs related to current file",
    input: { filePath: string },
    output: "List of related documentation"
  },
  "check_doc_freshness": {
    description: "Check if documentation is up to date",
    input: { filePath: string },
    output: "Last updated, status, recommendations"
  }
}
```

**Implementation Priority**: HIGH (addresses doc navigation pain point)

### 2. Adapter Tester MCP Server

**Purpose**: Test external API adapters (MangaDex, Fandom, ComicVine)

**Tools:**
```typescript
{
  "test_adapter_endpoint": {
    description: "Test specific adapter endpoint",
    input: { 
      adapter: "mangadex" | "fandom" | "comicvine",
      endpoint: string,
      parameters: Record<string, unknown>
    },
    output: "Response data, validation results, performance metrics"
  },
  "validate_adapter_response": {
    description: "Validate response against Zod schema",
    input: {
      adapter: string,
      response: unknown,
      schemaPath: string
    },
    output: "Validation results, errors, suggestions"
  },
  "check_rate_limits": {
    description: "Check current rate limit status",
    input: { adapter: string },
    output: "Remaining requests, reset time, recommendations"
  }
}
```

**Implementation Priority**: MEDIUM (improves adapter development workflow)

### 3. Development Monitor MCP Server

**Purpose**: Monitor development server and process health

**Tools:**
```typescript
{
  "check_server_status": {
    description: "Check if dev server is running",
    output: "Status, port, process info, uptime"
  },
  "check_prerequisites": {
    description: "Validate all prerequisites (ast-grep, git, bun)",
    output: "List of tools with versions and status"
  },
  "analyze_server_logs": {
    description: "Analyze recent server logs for errors",
    input: { lines?: number },
    output: "Error summary, warnings, recommendations"
  }
}
```

**Implementation Priority**: LOW (nice-to-have, covered by /start command)

---

## ⚠️ Common Pitfalls & Solutions

### Pitfall 1: Over-Reliance on MCP

**Problem**: Using MCP for everything, even simple tasks

**Solution**: 
- Use MCP for complex, unfamiliar, or exploratory tasks
- Use traditional tools for standard, well-known operations
- Always validate MCP outputs against project standards

### Pitfall 2: Ignoring Project Conventions

**Problem**: MCP suggests code that violates DEVELOPMENT_RULES.md

**Solution**:
- Always run `/commit` validation
- Treat MCP as a first draft, not final code
- Manually review for type safety, error handling, imports

### Pitfall 3: Security Misconfigurations

**Problem**: Exposing credentials or sensitive data through MCP

**Solution**:
- Use environment variables
- Containerize MCP servers
- Implement read-only access by default
- Never commit MCP configuration with credentials

### Pitfall 4: Tool Budget Overflow

**Problem**: MCP server with 50+ tools, overwhelming the AI agent

**Solution**:
- Maximum 10 tools per server
- Use prompts for complex operations
- Create multiple focused servers instead of one mega-server

### Pitfall 5: Poor Error Handling

**Problem**: MCP returns error messages meant for humans, not agents

**Solution**:
- Return machine-readable error codes
- Include actionable suggestions
- Distinguish between configuration errors and permission errors
- Example: "ECONFIG001: Database connection not configured" vs "Access denied"

---

## 📊 Success Metrics

### Measure MCP Effectiveness:

1. **Time Saved**
   - Time to write complex Prisma queries
   - Time to navigate documentation
   - Time to set up API tests

2. **Code Quality**
   - Reduction in type errors
   - Increase in test coverage
   - Faster code reviews

3. **Developer Experience**
   - Reduced context switching
   - Faster onboarding for new features
   - Improved documentation findability

### Target Metrics (3 Months):
- 30% reduction in time spent writing complex queries
- 50% faster documentation navigation
- 25% increase in API test coverage
- Zero security incidents related to MCP usage

---

## 🔄 Continuous Improvement

### Monthly Review:
- Evaluate MCP server usage patterns
- Identify new opportunities for MCP integration
- Review security audit logs
- Update documentation based on learnings

### Quarterly Assessment:
- Measure against success metrics
- Survey team on MCP effectiveness
- Decide on new MCP server priorities
- Update this directive based on findings

---

## 📚 Additional Resources

### Official Documentation:
- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [MCP GitHub Repository](https://github.com/modelcontextprotocol)
- [Anthropic MCP Introduction](https://www.anthropic.com/news/model-context-protocol)

### Docker MCP Servers:
- [Docker MCP Catalog](https://hub.docker.com/r/mcp/)
- [MCP Server Best Practices](https://www.docker.com/blog/mcp-server-best-practices/)

### Tutorials & Guides:
- [Introduction to MCP Course](https://anthropic.skilljar.com/introduction-to-model-context-protocol)
- [Building MCP Servers Guide](https://composio.dev/blog/mcp-server-step-by-step-guide-to-building-from-scrtch)

---

## 🎯 Quick Reference

### When to Use MCP - Decision Tree

```
Is this a security-sensitive operation?
├─ YES → ❌ Don't use MCP
└─ NO → Continue
    │
    Is there an existing project tool that handles this well?
    ├─ YES → ✅ Use existing tool (ast-grep, /commit, etc.)
    └─ NO → Continue
        │
        Is this a complex/unfamiliar task?
        ├─ YES → ✅ Use MCP (with validation)
        └─ NO → 🤔 Evaluate if MCP adds value
            │
            Would MCP save significant time?
            ├─ YES → ✅ Use MCP (with validation)
            └─ NO → ✅ Use traditional approach
```

### MCP Validation Checklist

```bash
# After using MCP to generate code:
□ Code follows TypeScript strict mode (no 'any' types)
□ Imports use domain types (@/types/domain/*)
□ Error handling uses AsyncResult pattern
□ Mantine v7 props used correctly (fw, gap, justify)
□ tRPC v11 syntax followed (isPending for mutations)
□ Documentation updated if needed
□ Tests written and passing
□ /commit validation passed
```

---

## 📝 Revision History

| Version | Date       | Author         | Changes                                    |
|---------|------------|----------------|--------------------------------------------|
| 1.0     | 2025-10-26 | Development    | Initial MCP usage directive created        |
|         |            | Team           | Based on CLAUDE.md analysis and MCP research|

---

*This directive is a living document. Update it as we learn more about effective MCP integration in Mugiwara Kaizoku development.*

**Next Steps:**
1. Review and approve this directive with the team
2. Implement Phase 1 MCP servers (PostgreSQL, GitHub, File System)
3. Create `/docs/development/MCP_SERVERS.md` with detailed setup instructions
4. Update CLAUDE.md to reference this directive
5. Begin measuring success metrics
