# Mugiwara-Kaizoku Documentation

Reference documentation organized by topic. Internal development artifacts
(refactor notes, fix logs, migration progress reports, lint/type-check
campaigns) are intentionally not kept here — see the project's git history if
you need them.

## Getting started

- [User Guides](./user-guides/) — setup, authentication, Suwayomi/Java, Postgres, troubleshooting
- [Quick Download Guide](./QUICK_DOWNLOAD_GUIDE.md) — how downloading works
- [Network Storage Setup](./NETWORK_STORAGE_SETUP.md) — SMB/NFS notes
- [Architecture Overview](./architecture/architecture-overview.md) — system design

## Core reference

| Topic | What's there |
|---|---|
| [Architecture](./architecture/) | System design and architecture references |
| [Adapters & Clients](./adapters-clients/) | Adapter pattern + per-provider guides (MangaDex, ComicVine, Fandom, Prowlarr) |
| [API](./api/) | tRPC / API references |
| [Database](./database/) | Schema and Prisma reference |
| [Configuration](./configuration/) | Settings, environment variables, validation |
| [Integrations](./integrations/) | External-service integrations (Kapowarr, metadata providers) |
| [System](./system/) | Events, notifications, status page |

## Development

| Topic | What's there |
|---|---|
| [Development](./development/) | Coding standards, debugging, performance, security, ast-grep, hooks |
| [TypeScript](./typescript/) | Type-system architecture, patterns, references |
| [Testing](./testing/) | Testing and Playwright guides |
| [Components](./components/) / [Hooks](./hooks/) / [UI/UX](./ui-ux/) | Frontend patterns |
| [Templates](./templates/) | Doc templates for new features/integrations |
| [Examples](./examples/) | Reference code samples |
| [Migration](./migration/) | Operational migration & platform guides |

## Conventions

Contributor conventions live in the repo root [`CLAUDE.md`](../CLAUDE.md) and
[`docs/development/DEVELOPMENT_RULES.md`](./development/DEVELOPMENT_RULES.md).
Documentation rules: [`documentation-meta/CLAUDE_DOCUMENTATION_RULES.md`](./documentation-meta/CLAUDE_DOCUMENTATION_RULES.md).
