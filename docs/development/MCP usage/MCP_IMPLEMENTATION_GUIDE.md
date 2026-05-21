# MCP Server Implementation Guide - Mugiwara Kaizoku

*Companion document to: MCP_USAGE_DIRECTIVE.md*  
*Author: Development Team*  
*Created: 2025-10-26*

## Overview

This guide provides practical implementation examples for custom MCP servers tailored to Mugiwara Kaizoku project needs. Each server includes complete TypeScript code, configuration, and usage examples.

---

## 📦 Project Structure

```
mugiwara-kaizoku/
├── mcp-servers/                    # Custom MCP server implementations
│   ├── documentation-search/
│   │   ├── index.ts               # Main server entry point
│   │   ├── tools.ts               # Tool implementations
│   │   ├── resources.ts           # Resource definitions
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── adapter-tester/
│   │   ├── index.ts
│   │   ├── tools.ts
│   │   ├── adapters/              # Adapter-specific testers
│   │   │   ├── mangadex.ts
│   │   │   ├── fandom.ts
│   │   │   └── comicvine.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── dev-monitor/
│       ├── index.ts
│       ├── tools.ts
│       ├── package.json
│       └── tsconfig.json
├── .mcp/
│   └── config.json                # MCP server configuration
└── docs/development/
    └── MCP_SERVERS.md             # Detailed MCP documentation
```

---

## 🔧 1. Documentation Search MCP Server

### Purpose
Semantic search and navigation across 40+ project documentation files with awareness of canonical docs and documentation hierarchy.

### Installation

```bash
# Navigate to project root
cd mugiwara-kaizoku

# Create MCP server directory
mkdir -p mcp-servers/documentation-search
cd mcp-servers/documentation-search

# Initialize package
cat > package.json << 'EOF'
{
  "name": "@mugiwara/mcp-documentation-search",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "fast-glob": "^3.3.2",
    "gray-matter": "^4.0.3",
    "node-nlp": "^4.27.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.8.2"
  }
}
EOF

# Install dependencies
bun install
```

### Implementation

**index.ts** - Main Server
```typescript
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { tools, executeTool } from './tools.js';

const server = new Server(
  {
    name: 'mugiwara-documentation-search',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools as Tool[],
  };
});

// Execute tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    const result = await executeTool(name, args ?? {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: errorMessage }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Documentation Search MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
```

**tools.ts** - Tool Implementations
```typescript
import { readFile, readdir } from 'fs/promises';
import { join, relative } from 'path';
import matter from 'gray-matter';
import fg from 'fast-glob';
import { NlpManager } from 'node-nlp';

const PROJECT_ROOT = process.cwd();
const DOCS_DIR = join(PROJECT_ROOT, 'docs');

interface DocMetadata {
  title?: string;
  canonical?: boolean;
  status?: string;
  author?: string;
  lastUpdated?: string;
}

interface DocSection {
  file: string;
  title: string;
  section?: string;
  content: string;
  relevanceScore: number;
  metadata: DocMetadata;
}

// Tool definitions
export const tools = [
  {
    name: 'find_canonical_docs',
    description: 'Find all canonical documentation files marked with *Canonical: Yes*',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Optional topic filter (e.g., "typescript", "database", "api")',
        },
      },
    },
  },
  {
    name: 'search_documentation',
    description: 'Semantic search across all project documentation with relevance scoring',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (natural language)',
        },
        scope: {
          type: 'string',
          enum: ['all', 'architecture', 'development', 'api', 'testing', 'migration'],
          description: 'Limit search to specific documentation area',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (default: 10)',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'find_related_docs',
    description: 'Find documentation related to a specific file or topic',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to file to find related docs for',
        },
        topic: {
          type: 'string',
          description: 'Topic to find related docs for',
        },
      },
    },
  },
  {
    name: 'check_doc_freshness',
    description: 'Check when documentation was last updated and its current status',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to documentation file',
        },
      },
      required: ['filePath'],
    },
  },
];

// Initialize NLP manager for semantic search
let nlpManager: NlpManager | null = null;

async function initNlp() {
  if (nlpManager) return nlpManager;
  
  nlpManager = new NlpManager({ languages: ['en'] });
  
  // Train with common documentation topics
  const topics = [
    'typescript types interfaces',
    'database prisma schema',
    'api trpc endpoints',
    'testing jest unit integration',
    'architecture patterns design',
    'error handling asyncresult',
    'documentation standards',
    'migration bun npm',
  ];
  
  for (const topic of topics) {
    await nlpManager.addDocument('en', topic, topic);
  }
  
  await nlpManager.train();
  return nlpManager;
}

// Tool execution
export async function executeTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'find_canonical_docs':
      return findCanonicalDocs(args.topic as string | undefined);
    
    case 'search_documentation':
      return searchDocumentation(
        args.query as string,
        args.scope as string | undefined,
        (args.maxResults as number) ?? 10
      );
    
    case 'find_related_docs':
      return findRelatedDocs(
        args.filePath as string | undefined,
        args.topic as string | undefined
      );
    
    case 'check_doc_freshness':
      return checkDocFreshness(args.filePath as string);
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function findCanonicalDocs(topic?: string): Promise<DocSection[]> {
  const markdownFiles = await fg('docs/**/*.md', { cwd: PROJECT_ROOT });
  const canonicalDocs: DocSection[] = [];
  
  for (const file of markdownFiles) {
    const filePath = join(PROJECT_ROOT, file);
    const content = await readFile(filePath, 'utf-8');
    const { data, content: body } = matter(content);
    
    // Check for canonical marker
    const isCanonical = 
      data.canonical === true || 
      body.includes('*Canonical: Yes*') ||
      body.includes('Canonical: Yes');
    
    if (isCanonical) {
      const docTopic = data.topic || extractTopicFromPath(file);
      
      // Filter by topic if provided
      if (!topic || docTopic.toLowerCase().includes(topic.toLowerCase())) {
        canonicalDocs.push({
          file,
          title: data.title || extractTitleFromContent(body),
          content: body.slice(0, 500), // First 500 chars as preview
          relevanceScore: 1.0,
          metadata: {
            title: data.title,
            canonical: true,
            status: data.status,
            author: data.author,
            lastUpdated: data.lastUpdated,
          },
        });
      }
    }
  }
  
  return canonicalDocs.sort((a, b) => a.file.localeCompare(b.file));
}

async function searchDocumentation(
  query: string,
  scope?: string,
  maxResults = 10
): Promise<DocSection[]> {
  const manager = await initNlp();
  
  // Build search pattern based on scope
  let searchPattern = 'docs/**/*.md';
  if (scope && scope !== 'all') {
    searchPattern = `docs/${scope}/**/*.md`;
  }
  
  const markdownFiles = await fg(searchPattern, { cwd: PROJECT_ROOT });
  const results: DocSection[] = [];
  
  for (const file of markdownFiles) {
    const filePath = join(PROJECT_ROOT, file);
    const content = await readFile(filePath, 'utf-8');
    const { data, content: body } = matter(content);
    
    // Calculate relevance score
    const score = calculateRelevance(query, body, data);
    
    if (score > 0.3) {
      // Threshold for relevance
      const sections = extractRelevantSections(body, query);
      
      for (const section of sections) {
        results.push({
          file,
          title: data.title || extractTitleFromContent(body),
          section: section.title,
          content: section.content,
          relevanceScore: score,
          metadata: {
            title: data.title,
            canonical: data.canonical || body.includes('*Canonical: Yes*'),
            status: data.status,
            author: data.author,
            lastUpdated: data.lastUpdated,
          },
        });
      }
    }
  }
  
  // Sort by relevance and return top results
  return results
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);
}

async function findRelatedDocs(
  filePath?: string,
  topic?: string
): Promise<DocSection[]> {
  if (!filePath && !topic) {
    throw new Error('Must provide either filePath or topic');
  }
  
  let searchQuery: string;
  
  if (filePath) {
    // Extract keywords from file path and content
    const fullPath = join(PROJECT_ROOT, filePath);
    const content = await readFile(fullPath, 'utf-8');
    const { data, content: body } = matter(content);
    
    searchQuery = [
      data.title,
      extractTopicFromPath(filePath),
      extractKeywords(body).join(' '),
    ]
      .filter(Boolean)
      .join(' ');
  } else {
    searchQuery = topic!;
  }
  
  return searchDocumentation(searchQuery, undefined, 5);
}

async function checkDocFreshness(filePath: string): Promise<{
  file: string;
  lastUpdated?: string;
  status?: string;
  daysSinceUpdate?: number;
  recommendation: string;
}> {
  const fullPath = join(PROJECT_ROOT, filePath);
  const content = await readFile(fullPath, 'utf-8');
  const { data } = matter(content);
  
  const lastUpdated = data.lastUpdated || data['last-updated'] || data.date;
  let daysSinceUpdate: number | undefined;
  
  if (lastUpdated) {
    const updateDate = new Date(lastUpdated);
    daysSinceUpdate = Math.floor(
      (Date.now() - updateDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }
  
  let recommendation: string;
  if (!lastUpdated) {
    recommendation = 'Consider adding a "Last Updated" field to track freshness';
  } else if (daysSinceUpdate! > 90) {
    recommendation = 'Documentation is >90 days old - review for accuracy';
  } else if (daysSinceUpdate! > 30) {
    recommendation = 'Documentation is >30 days old - verify current practices';
  } else {
    recommendation = 'Documentation is recent';
  }
  
  return {
    file: filePath,
    lastUpdated,
    status: data.status,
    daysSinceUpdate,
    recommendation,
  };
}

// Helper functions
function extractTopicFromPath(filePath: string): string {
  const parts = filePath.split('/');
  const category = parts[1] || 'general'; // e.g., 'architecture', 'development'
  return category;
}

function extractTitleFromContent(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1] : 'Untitled';
}

function extractKeywords(content: string): string[] {
  // Simple keyword extraction - could be enhanced with NLP
  const words = content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);
  
  // Count frequency
  const freq: Record<string, number> = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }
  
  // Return top 10 most frequent words
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function calculateRelevance(
  query: string,
  content: string,
  metadata: Record<string, unknown>
): number {
  const queryLower = query.toLowerCase();
  const contentLower = content.toLowerCase();
  
  let score = 0;
  
  // Title match (high weight)
  if (
    metadata.title &&
    String(metadata.title).toLowerCase().includes(queryLower)
  ) {
    score += 0.5;
  }
  
  // Content frequency (medium weight)
  const matches = (contentLower.match(new RegExp(queryLower, 'g')) || []).length;
  score += Math.min(matches / 10, 0.3);
  
  // Canonical docs (slight boost)
  if (metadata.canonical) {
    score += 0.1;
  }
  
  // Recent docs (slight boost)
  if (metadata.lastUpdated) {
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(String(metadata.lastUpdated)).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (daysSinceUpdate < 30) {
      score += 0.1;
    }
  }
  
  return Math.min(score, 1.0);
}

function extractRelevantSections(
  content: string,
  query: string
): Array<{ title: string; content: string }> {
  const sections: Array<{ title: string; content: string }> = [];
  const lines = content.split('\n');
  
  let currentSection: { title: string; content: string } | null = null;
  let inRelevantSection = false;
  
  for (const line of lines) {
    // Check for section headers
    const headerMatch = line.match(/^##\s+(.+)$/);
    if (headerMatch) {
      // Save previous section if relevant
      if (currentSection && inRelevantSection) {
        sections.push(currentSection);
      }
      
      // Start new section
      currentSection = { title: headerMatch[1], content: '' };
      inRelevantSection = false;
    }
    
    // Check if line is relevant
    if (line.toLowerCase().includes(query.toLowerCase())) {
      inRelevantSection = true;
    }
    
    // Add line to current section
    if (currentSection) {
      currentSection.content += line + '\n';
    }
  }
  
  // Add last section if relevant
  if (currentSection && inRelevantSection) {
    sections.push(currentSection);
  }
  
  return sections.slice(0, 3); // Return top 3 relevant sections
}
```

**tsconfig.json**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./",
    "module": "ES2022",
    "moduleResolution": "node",
    "target": "ES2022"
  },
  "include": ["*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Configuration

Add to `.mcp/config.json`:
```json
{
  "mcpServers": {
    "documentation-search": {
      "command": "node",
      "args": ["./mcp-servers/documentation-search/dist/index.js"],
      "description": "Semantic search across project documentation"
    }
  }
}
```

### Usage Examples

**Example 1: Find Canonical Documentation**
```
User: What are the canonical documentation files for TypeScript?
Assistant: [Uses documentation-search.find_canonical_docs tool]
Result:
- docs/typescript/type-system-architecture-standardization.md
- docs/typescript/typescript-patterns-guide.md
- docs/configuration/typescript-configuration-guide.md
```

**Example 2: Search for Error Handling Patterns**
```
User: How should I handle errors in adapters?
Assistant: [Uses documentation-search.search_documentation tool]
Result:
1. docs/user-guides/asyncresult-pattern-complete-guide.md
   Section: "Error Handling in Adapters"
   Relevance: 0.95
   
2. docs/adapters-clients/adapter-pattern-comprehensive-guide.md
   Section: "Error Handling Best Practices"
   Relevance: 0.87
```

---

## 🧪 2. Adapter Tester MCP Server

### Purpose
Test and validate external API adapters (MangaDex, Fandom, ComicVine) with rate limit monitoring and response validation.

### Installation

```bash
mkdir -p mcp-servers/adapter-tester
cd mcp-servers/adapter-tester

cat > package.json << 'EOF'
{
  "name": "@mugiwara/mcp-adapter-tester",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "axios": "^1.8.4",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.8.2"
  }
}
EOF

bun install
```

### Implementation (Simplified)

**tools.ts**
```typescript
export const tools = [
  {
    name: 'test_adapter_endpoint',
    description: 'Test a specific adapter endpoint with parameters',
    inputSchema: {
      type: 'object',
      properties: {
        adapter: {
          type: 'string',
          enum: ['mangadex', 'fandom', 'comicvine'],
        },
        endpoint: {
          type: 'string',
          description: 'Endpoint to test (e.g., "/manga/{id}")',
        },
        parameters: {
          type: 'object',
          description: 'Endpoint parameters',
        },
      },
      required: ['adapter', 'endpoint'],
    },
  },
  {
    name: 'validate_adapter_response',
    description: 'Validate adapter response against Zod schema',
    inputSchema: {
      type: 'object',
      properties: {
        adapter: { type: 'string' },
        response: { type: 'object' },
        schemaName: {
          type: 'string',
          description: 'Name of Zod schema to validate against',
        },
      },
      required: ['adapter', 'response', 'schemaName'],
    },
  },
  {
    name: 'check_rate_limits',
    description: 'Check current rate limit status for adapter',
    inputSchema: {
      type: 'object',
      properties: {
        adapter: { type: 'string' },
      },
      required: ['adapter'],
    },
  },
];

// Implementation would include actual adapter testing logic
// referencing the project's adapter implementations
```

---

## 📝 3. Configuration Management

### Claude Desktop Configuration

**~/.config/Claude/claude_desktop_config.json** (Mac/Linux):
```json
{
  "mcpServers": {
    "postgres": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--network=host",
        "mcp/postgres",
        "postgresql://localhost:5432/mugiwara_kaizoku"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/mugiwara-kaizoku"
      ]
    },
    "documentation-search": {
      "command": "node",
      "args": [
        "/path/to/mugiwara-kaizoku/mcp-servers/documentation-search/dist/index.js"
      ],
      "cwd": "/path/to/mugiwara-kaizoku"
    },
    "adapter-tester": {
      "command": "node",
      "args": [
        "/path/to/mugiwara-kaizoku/mcp-servers/adapter-tester/dist/index.js"
      ],
      "cwd": "/path/to/mugiwara-kaizoku",
      "env": {
        "MANGADEX_API_KEY": "${MANGADEX_API_KEY}",
        "COMICVINE_API_KEY": "${COMICVINE_API_KEY}"
      }
    }
  }
}
```

### Environment Variables

**.env.mcp** (gitignored):
```bash
# Database
DATABASE_URL=postgresql://localhost:5432/mugiwara_kaizoku

# GitHub
GITHUB_TOKEN=ghp_your_token_here

# API Keys
MANGADEX_API_KEY=your_key_here
COMICVINE_API_KEY=your_key_here
FANDOM_API_KEY=your_key_here

# Security
MCP_SERVER_SECRET=your_secret_here
```

---

## 🔐 Security Checklist

- [ ] All API keys in environment variables
- [ ] No credentials in code or config files
- [ ] `.env.mcp` added to `.gitignore`
- [ ] MCP servers run with least privilege
- [ ] Docker containers used where possible
- [ ] Audit logging enabled for production
- [ ] Rate limiting implemented
- [ ] Input validation on all tools
- [ ] Error messages don't expose sensitive data
- [ ] OAuth 2.1 used for HTTP transports

---

## 🧪 Testing MCP Servers

### Unit Tests

```typescript
// tests/mcp-servers/documentation-search.test.ts
import { describe, it, expect } from 'bun:test';
import { executeTool } from '../../mcp-servers/documentation-search/tools';

describe('Documentation Search MCP', () => {
  it('should find canonical docs', async () => {
    const result = await executeTool('find_canonical_docs', {});
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('metadata.canonical', true);
  });
  
  it('should search documentation with relevance scoring', async () => {
    const result = await executeTool('search_documentation', {
      query: 'AsyncResult pattern',
      maxResults: 5,
    });
    expect(result).toBeInstanceOf(Array);
    expect(result[0].relevanceScore).toBeGreaterThan(0.5);
  });
});
```

### Integration Tests

```bash
# Test MCP server directly
echo '{"method":"tools/list"}' | node mcp-servers/documentation-search/dist/index.js

# Test with Claude Desktop
# Use Claude Desktop UI to call tools and verify responses
```

---

## 📚 Next Steps

1. **Build Custom Servers**
   ```bash
   cd mcp-servers/documentation-search
   bun run build
   ```

2. **Configure Claude Desktop**
   - Update `claude_desktop_config.json`
   - Set environment variables
   - Restart Claude Desktop

3. **Test Integration**
   - Ask Claude to search documentation
   - Verify tool calls work correctly
   - Check performance and relevance

4. **Monitor Usage**
   - Track tool call frequency
   - Measure time saved
   - Gather team feedback

5. **Iterate**
   - Refine relevance scoring
   - Add new tools as needed
   - Update based on usage patterns

---

*For detailed setup instructions and troubleshooting, see `/docs/development/MCP_SERVERS.md` (to be created).*
