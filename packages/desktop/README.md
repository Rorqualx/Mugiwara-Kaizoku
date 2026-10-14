# Kaizoku Desktop (Windows)

A Tauri 2 shell for Kaizoku. Stage K0 of the Windows offline plan
(`docs/plans/windows-offline-plan.md`, which is gitignored along with the rest
of `docs/plans/`).

## What it does

One window, two surfaces:

- **Server reachable:** the window is navigated to the server's own origin
  (`http://<server>:3000/`) and Kaizoku runs there unmodified. It has to be the
  server's origin: the sign-in cookie, the relative tRPC URLs, the
  server-rendered pages and the WebSocket all assume it.
- **Server not reachable:** the window shows the shelf bundled in the installer
  (`shelf/`) instead of a browser error page. The shelf is a placeholder until
  downloads exist (stage K2).

The server address is asked for on first run, checked against the server's
login page, and saved as one line in `%APPDATA%\dev.kaizoku.desktop\server.txt`.
The **Kaizoku** menu switches between the library and the shelf and changes the
server.

## Building

From the Mac, with the Windows build host awake:

```bash
./scripts/build/desktop.sh              # installer -> dist-desktop/
./scripts/build/desktop.sh --install    # ...and install it on the build host
```

The build host needs Rust (MSVC) and Node. Nothing of the Next app is built:
the shelf is plain files with no build step.

## Things that are the way they are on purpose

- **No `package.json` here.** `packages/*` is a Bun workspace glob, so one
  would make this directory a workspace member, change `bun.lock`, and break
  the Docker image's frozen install. The Tauri CLI comes from `npx` at a
  version pinned in `scripts/build/desktop.sh`, and `.dockerignore` keeps this
  directory out of the image.
- **Tauri's sibling crates are pinned** in `src-tauri/Cargo.toml`. tauri 2.11.6
  accepts tauri-runtime 2.12.1 by its version range and does not compile
  against it. The CLI version in the build script must stay on the same minor.
- **The commands are reachable from the shelf only.** No capability lists a
  remote origin, so a page served by Kaizoku cannot call into the shell.
  Anything exposed to the server's origin is exposed to any script injected
  into the web app, so that surface is added deliberately, one command at a
  time, when downloads need it.
- **The shelf has no inline styles or scripts.** Its CSP has no
  `'unsafe-inline'`, and Tauri adds a nonce that would cancel it anyway.
- **Links to other sites open in the default browser.** The window has no
  address bar, so it only ever shows the server or the shelf.
