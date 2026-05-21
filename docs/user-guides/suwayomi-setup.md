# Suwayomi Setup

*Status: Active*
*Author: Documentation Team*
*Canonical: Yes*
*Last updated: 2026-04-26*

## Overview

Mugiwara-Kaizoku uses [Suwayomi-Server](https://github.com/Suwayomi/Suwayomi-Server) as a **headless library-source bridge**: a background JVM process that exposes Mihon/Tachiyomi source extensions over GraphQL so we can fetch chapter pages for titles where MangaDex doesn't have them. Suwayomi's own web UI is disabled; you only interact with it through Kaizoku's settings page and the per-manga "Suwayomi Plugin" panel on each manga's detail page.

This is different from older versions of Kaizoku where Suwayomi appeared as a separate search tab with its own library and reader. That surface was removed; Suwayomi is now purely a chapter-page provider for the existing library.

---

## What you get

- **Per-manga fallback.** When MangaDex misses a chapter (404, removed scanlation, missing language) and the manga has Suwayomi enabled in its plugin panel, Kaizoku enqueues a Suwayomi download for the same chapter. The output is a CBZ in your library — indistinguishable from a MangaDex-downloaded chapter, readable in the existing reader.
- **Mihon extension catalog.** Any source maintained in [keiyoushi/extensions](https://github.com/keiyoushi/extensions) can be installed by package name. WeebCentral is the recommended default for English titles.
- **No Suwayomi web UI.** Suwayomi runs with `webUIEnabled=false`. There is nothing to log into at `localhost:4567` — it only answers GraphQL.

---

## Requirements

### Java 21

Suwayomi v2.x requires **OpenJDK 21**. Older Java versions will not start the server (the JVM will boot but classes fail to initialize on newer Kotlin bytecode).

#### macOS

```bash
brew install openjdk@21
```

The installer prints a path like `/usr/local/Cellar/openjdk@21/.../libexec/openjdk.jdk/Contents/Home/bin/java`. Kaizoku auto-discovers Homebrew installs.

#### Linux (Ubuntu/Debian)

```bash
sudo apt update && sudo apt install openjdk-21-jre-headless
```

#### Linux (Fedora/RHEL)

```bash
sudo dnf install java-21-openjdk-headless
```

#### Linux (Arch)

```bash
sudo pacman -S jre21-openjdk-headless
```

#### Windows

Download from [Adoptium](https://adoptium.net/) (pick **Temurin 21**), run the MSI, and ensure the installer adds Java to `PATH`.

#### Docker

The container ships with OpenJDK 21 pre-installed; no extra steps.

---

## Enable Suwayomi in Kaizoku

1. Open **Settings → Download Clients**. Scroll to the **Suwayomi (headless library source)** section.
2. The **Server** tab shows Java + server status badges. If Java 21 is missing, install it (see above) and reload.
3. Click **Start server**. The first start downloads `Suwayomi-Server.jar` (~150 MB) into `data/suwayomi-server/`. Health check turns green within ~10 seconds.

The server stops when the Kaizoku process exits. To stop it manually, use the **Stop server** button on the same tab.

### Connection details

- Bind: `localhost:4567` (configurable via `SUWAYOMI_PORT` env var).
- GraphQL endpoint: `http://localhost:4567/api/graphql`.
- Web UI: disabled by default. There is no browser interface.
- Config file: `data/suwayomi-config/server.conf` (Suwayomi's HOCON format — Kaizoku writes it on first start).

---

## Install a Mihon source extension

In **Settings → Suwayomi → Extensions**:

1. Suwayomi needs an extension repository configured. The keiyoushi catalog is the de-facto standard. Add it once via Suwayomi's `server.conf` (`server.extensionRepos = ["https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json"]`) and restart the server.
2. Type a package name into the **Install by package name** input. Recommended starting set:
   - `eu.kanade.tachiyomi.extension.en.weebcentral` — English aggregator, very wide catalog, actively maintained.
   - `eu.kanade.tachiyomi.extension.all.mangadex` — official MangaDex extension (useful when Kaizoku's primary MangaDex client misses a title).
3. Click **Install**. The installed source appears in the list below with its numeric Suwayomi source id.

To remove a source, click **Uninstall** next to its row.

### About mangabuddy

Mangabuddy.com is **not** in the keiyoushi catalog as of writing. Some community forks ship a `mangabuddy` extension; sideload by dropping the unofficial JAR into Suwayomi's `data/suwayomi-config/extensions/` directory and restarting the server. WeebCentral covers most of the same English-translation gap with a maintained extension and is recommended instead.

---

## Per-manga setup

The global Settings page only manages the server and installed extensions. Matching a specific manga to a Suwayomi source happens on the manga's own detail page:

1. Open any manga in your library.
2. Expand the **Suwayomi Plugin** panel (collapsed by default; appears between the banner and the chapter list).
3. Toggle **Enable Suwayomi as a download fallback for this title**.
4. Pick a **Source extension** from the dropdown (only installed extensions appear).
5. Click **Run match**. The matcher searches the chosen source for the title and persists the resulting Suwayomi mangaId + slug onto `Manga.suwayomiPluginConfig` when confidence ≥ 0.85. You'll see "Matched as 'X' (1.000)".
6. Click **Sync chapters**. Kaizoku pulls Suwayomi's chapter list and writes `Chapter.suwayomiChapterId` onto every local chapter row whose `chapterNumber` lines up.
7. (Optional) **Test download #1** runs the full download path for chapter 1 — useful to confirm the source works before relying on the fallback.

After step 6, any future MangaDex download failure on this title automatically dispatches the equivalent Suwayomi download. The CBZ lands in the same library path; the reader treats it identically.

If the matcher returns the wrong manga, use the **Manual override** fields on the same panel (sourceId, mangaId, slug) and click any text input to save.

---

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| "Java not detected" badge | Install OpenJDK 21 (see above), reload page. |
| Server starts but health stays red | Check `data/suwayomi-config/server.conf` for HOCON syntax errors. Common cause: legacy half-written config. Delete `server.conf` and let Suwayomi regenerate it on next start. |
| Extensions list is empty after install | The keiyoushi repo is not configured in `server.conf`. Add it (see above), restart server, retry. |
| Match returns "no results" | Source extension may not have the title indexed. Try a different source, or set `sourceId`/`mangaId` manually in the panel. |
| `bun run scripts/surveys/test-suwayomi-match.ts <id> <sourceId>` returns 0 candidates | Suwayomi-Server isn't running, or the source extension hasn't been installed. Check the **Server** and **Extensions** tabs first. |

---

## Reference

- Suwayomi-Server: https://github.com/Suwayomi/Suwayomi-Server
- Mihon extension catalog: https://github.com/keiyoushi/extensions
- Suwayomi GraphQL schema: introspect at `http://localhost:4567/api/graphql` once the server is running
- In-repo bridge code:
  - `src/server/services/suwayomi/manga-matcher.ts` — title resolver
  - `src/server/services/suwayomi/chapter-sync.ts` — `suwayomiChapterId` populator
  - `src/server/services/native-download/downloaders/suwayomi-downloader.ts` — page fetcher + CBZ bundler
  - `src/server/queue/handlers/suwayomi-download.ts` — job handler (registered on `JobType.suwayomi_download`)
  - `src/components/manga/suwayomi-plugin/SuwayomiPluginPanel.tsx` — per-manga UI
