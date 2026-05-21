# Mugiwara-Kaizoku

A self-hosted manga library manager. Tracks your collection, enriches metadata from multiple providers, fetches missing chapters, and gives you a clean reading interface — all behind a single Next.js app you run on your own hardware.

**Status:** v0.9.0 — pre-release. Public 1.0 in progress; expect rough edges.

---

## What it does

- **Library:** organize manga across local paths and network shares, with per-title metadata and reading progress
- **Metadata enrichment:** combined AniList / MangaDex / ComicVine / Wikipedia / Fandom lookups with conflict resolution UI
- **Discovery:** trending banner, genre/tag rows, Top 100, infinite scroll
- **Downloads:** native sources (MangaDex / Suwayomi) plus Prowlarr-backed torrent + Usenet routing (Transmission / Deluge / SAB / NZBGet)
- **Pack import:** import existing CBZ/CBR/RAR collections; multi-part RAR handling, decimal/volume-range parsing
- **Reader:** in-app reader with bookmarks, reading history, and listening history hooks
- **Backups:** full backup file upload/restore
- **Reads its own logs:** integrated log viewer, job queue, real-time download progress over WebSockets

## Tech stack

Next.js 14 · React 18 · Mantine v7 · TanStack Query · Zustand · tRPC v11 · Prisma 6 · PostgreSQL · Socket.io · Pino · Bun 1.3

## Prerequisites

- **Bun** 1.3+ (or Node 24+ if you really want to)
- **PostgreSQL** 14+
- **Java** runtime (for the bundled Suwayomi engine — see below)
- ~2 GB free RAM, plus whatever your library needs on disk

Optional (only if you want those features):
- **FlareSolverr** for Cloudflare-protected sources. Not bundled in the Docker image — run [`ghcr.io/flaresolverr/flaresolverr:latest`](https://github.com/FlareSolverr/FlareSolverr) as a sidecar container. A commented-out service block is included in `docker-compose.yml`; uncomment it and set `FLARESOLVERR_ENABLED=true` on the `app` service to enable.
- **Prowlarr + a torrent client** (Transmission / Deluge / qBittorrent) or **Usenet client** (SABnzbd / NZBGet) for download automation

## Quick start (local)

```bash
git clone https://github.com/Rorqualx/Mugiwara-Kaizoku.git
cd Mugiwara-Kaizoku
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL, NEXTAUTH_SECRET, AUTH_SECRET
# Generate secrets: openssl rand -base64 32

bun install
bun run migrate          # apply Prisma migrations + generate client
bun run dev              # starts on http://localhost:3000
```

First time you open it, you'll be redirected to `/setup` to create the admin account.

## Quick start (Docker)

```bash
# Single-container — Postgres, Suwayomi, and FlareSolverr all bundled.
curl -O https://raw.githubusercontent.com/Rorqualx/Mugiwara-Kaizoku/main/docker-compose.yml
MANGA_LIBRARY_PATH=/path/to/your/manga docker compose up -d
```

That's it. Session secrets are **auto-generated on first boot** and persisted to the `kaizoku_config` volume. Visit `http://localhost:3000` and complete `/setup`. First boot takes 60–90s while Postgres initializes; subsequent boots are fast.

| Volume | What it stores |
|---|---|
| `kaizoku_config` | Auto-generated session secrets, user prefs |
| `kaizoku_data` | Postgres data, Suwayomi state, downloads cache |
| `kaizoku_logs` | App logs (`/logs` inside container) |
| `${MANGA_LIBRARY_PATH}` | Your manga library (host bind-mount) |

**Want external Postgres / sidecar containers?** See [`docker-compose.advanced.yml`](docker-compose.advanced.yml) for the multi-container layout (separate `db` + `flaresolverr` services). Both compose files use the same image — the entrypoint detects which mode based on `DATABASE_URL`.

## First run

1. **Admin account** — `/setup` wizard prompts for username/email/password
2. **Library paths** — add at least one local path or network share under Settings → Libraries
3. **(Optional) Metadata API keys** — paste an AniList client and/or ComicVine API key under Settings → Providers
4. **(Optional) Download providers** — point Prowlarr / torrent / Usenet clients at the app under Settings → Download

Sample admin shortcut if the wizard ever wedges:

```bash
bun run create-admin
```

## Configuration

All configuration is via `.env` (see `.env.example` for the full annotated list). Highlights:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `NEXTAUTH_SECRET` / `AUTH_SECRET` | yes | Session signing; generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | yes | Public URL the app is reachable at |
| `KAIZOKU_PORT` | no (default 3000) | HTTP port |
| `KAIZOKU_LOG_PATH` | no | Override the log directory |
| `DOCKER` | no | Set to `true` only when running inside Docker (switches `BASE_DATA_DIR` to `/app/data`) |
| `USE_AI_AGENT` | no | Enable the optional local AI agent (requires extra setup) |

Anything not in `.env` falls back to UI-editable settings stored in the DB.

## Data sources & attribution

Mugiwara-Kaizoku queries the following public APIs to enrich your library. Please respect each provider's terms of service.

- **[AniList](https://anilist.co)** — primary metadata source. Per AniList API terms, this app credits AniList where its data is displayed. Set your AniList client ID in `.env` if you intend to make heavy use of the API.
- **[MangaDex](https://mangadex.org)** — chapter manifests and downloads
- **[ComicVine](https://comicvine.gamespot.com)** — volume metadata for Western comics (requires a free API key)
- **[Wikipedia](https://www.wikipedia.org)** — supplementary metadata
- **[Fandom](https://www.fandom.com)** — per-series wiki enrichment (chapter titles, volume infoboxes)

The bundled **Suwayomi** engine is started and managed as a child process by the app; you don't connect to an external Suwayomi instance.

This project does not host, distribute, or sell manga content. It only manages files **you** acquire through legal means.

## Documentation

In-depth docs live under [`docs/`](docs/):

- [`docs/README.md`](docs/README.md) — documentation index
- [`docs/architecture/architecture-overview.md`](docs/architecture/architecture-overview.md)
- [`docs/development/developer-quickstart-guide.md`](docs/development/developer-quickstart-guide.md)
- [`docs/NETWORK_STORAGE_SETUP.md`](docs/NETWORK_STORAGE_SETUP.md) — SMB/NFS setup notes
- [`docs/database/`](docs/database/) — Prisma schema overview and migration notes
- [`CHANGELOG.md`](CHANGELOG.md) — release notes

## Development

```bash
bun run dev                # dev server with HMR (custom WebSocket-aware server)
bun run type-check         # tsc --noEmit
bun run lint               # eslint src
bun run build              # production build
bun run start              # run the production build
```

Contributing guidelines and code conventions are in [`CLAUDE.md`](CLAUDE.md) (originally written for AI assistance, but it doubles as a human style guide).

## License

[MIT](LICENSE) — see the `LICENSE` file.

This app interacts with third-party services that have their own terms of use. You are responsible for complying with those terms.
