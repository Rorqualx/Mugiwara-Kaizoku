# Mugiwara-Kaizoku

A self-hosted manga library manager. Tracks your collection, enriches metadata from multiple providers, fetches missing chapters, and gives you a clean reading interface — all behind a single Next.js app you run on your own hardware.

**Status:** v0.9.0 — pre-release. Public 1.0 in progress; expect rough edges.

> Inspired by [oae/kaizoku](https://github.com/oae/kaizoku) — Mugiwara-Kaizoku began as an homage to that project but has since been **completely rewritten** from the ground up into a new application with its own architecture and feature set. Full credit to [@oae](https://github.com/oae) for the original idea.

---

## Screenshots

| | |
|---|---|
| ![Home — trending banner & continue reading](docs/screenshots/Screenshot%202026-06-22%20at%207.43.59%E2%80%AFPM.png) | ![Discovery — trending & most popular](docs/screenshots/Screenshot%202026-06-22%20at%207.44.36%E2%80%AFPM.png) |
| Home — trending banner & continue reading | Discovery — trending & most popular |
| ![Library — your manga collection](docs/screenshots/Screenshot%202026-06-22%20at%207.43.31%E2%80%AFPM.png) | ![Release calendar & monitored series](docs/screenshots/Screenshot%202026-06-22%20at%207.51.04%E2%80%AFPM.png) |
| Library — your manga collection | Release calendar & monitored series |
| ![Title detail — overview & metadata](docs/screenshots/Screenshot%202026-06-22%20at%207.45.26%E2%80%AFPM.png) | ![Title detail — gallery & sources](docs/screenshots/Screenshot%202026-06-22%20at%207.45.41%E2%80%AFPM.png) |
| Title detail — overview & metadata | Title detail — gallery & sources |
| ![Volumes & chapters](docs/screenshots/Screenshot%202026-06-22%20at%207.46.22%E2%80%AFPM.png) | ![Chapter detail & download history](docs/screenshots/Screenshot%202026-06-22%20at%207.46.33%E2%80%AFPM.png) |
| Volumes & chapters | Chapter detail & download history |
| ![Metadata provider binding](docs/screenshots/Screenshot%202026-06-22%20at%207.48.12%E2%80%AFPM.png) | ![Settings & preferences](docs/screenshots/Screenshot%202026-06-22%20at%207.52.44%E2%80%AFPM.png) |
| Metadata provider binding | Settings & preferences |

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

Next.js 14 · React 18 · Mantine v7 · TanStack Query · Zustand · tRPC v11 · Prisma 7 · PostgreSQL · Socket.io · Pino · Bun 1.3

## Prerequisites

- **Bun** 1.3+ (or Node 20+ if you really want to)
- **PostgreSQL** 14+
- **Java** runtime (for the bundled Suwayomi engine — see below)
- ~2 GB free RAM, plus whatever your library needs on disk

Optional (only if you want those features):
- **FlareSolverr** for Cloudflare-protected sources is **bundled** — the app downloads and manages the `flaresolverr-go` binary as a subprocess automatically, and it's enabled by default (`FLARESOLVERR_ENABLED=true`). It needs Google Chrome on the host: this is already included in the Docker image, so install Chrome yourself only for local/dev runs. To use an external instance instead of the managed one, set `FLARESOLVERR_EXTERNAL_URL`.
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
curl -O https://raw.githubusercontent.com/Rorqualx/Mugiwara-Kaizoku/main/docker-compose.yml
LIBRARY_PATH=/path/to/your/manga CONFIG_PATH=/path/to/your/config docker compose up -d
```

Two paths to set, everything else is automatic. Visit `http://localhost:3000` and complete `/setup`. First boot takes 60–90s while Postgres initializes inside the container.

**After first boot:** Settings → Libraries → add `/library` as a scan path.

| Mount | Purpose |
|---|---|
| `${LIBRARY_PATH}` → `/library` | Your manga files |
| `${CONFIG_PATH}` → `/config` | Everything else (secrets, Postgres, downloads cache, Suwayomi state, logs) |

Postgres, Suwayomi, and FlareSolverr are all bundled inside the image — no sidecar containers needed.

**Want external Postgres?** See [`docker-compose.advanced.yml`](docker-compose.advanced.yml) for the layout that runs Postgres as a separate `db` service (Suwayomi and FlareSolverr stay bundled subprocesses either way). Both compose files use the same image — the entrypoint detects which mode based on `DATABASE_URL`.

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

## License

[MIT](LICENSE) — see the `LICENSE` file.

This app interacts with third-party services that have their own terms of use. You are responsible for complying with those terms.
