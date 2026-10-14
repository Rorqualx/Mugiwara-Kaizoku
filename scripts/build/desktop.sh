#!/usr/bin/env bash
#
# Builds the Windows desktop app (packages/desktop). Runs HERE, on the Mac, and
# drives the Windows build host over ssh:
#
#   ./scripts/build/desktop.sh              # build the installer, fetch it
#   ./scripts/build/desktop.sh --install    # ...and install it on the build host
#
# The installer lands in dist-desktop/. See docs/plans/windows-offline-plan.md.
#
# Nothing of the Next app is built here. The desktop app loads Kaizoku from the
# server; what the installer carries is the shell and the small offline shelf
# in packages/desktop/shelf, which are plain files with no build step.

set -euo pipefail

HOST=${KAIZOKU_WIN_HOST:?set KAIZOKU_WIN_HOST to user@windows-build-host}
REMOTE=${KAIZOKU_WIN_DIR:-code/kaizoku-desktop}
# Must stay on the same Tauri minor as the `tauri` crate in
# packages/desktop/src-tauri/Cargo.toml.
TAURI_CLI=2.11.5
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP="$ROOT/packages/desktop"
OUT="$ROOT/dist-desktop"

DO_INSTALL=0
for arg in "$@"; do
  case "$arg" in
    --install) DO_INSTALL=1 ;;
    *) echo "desktop: unknown option $arg" >&2; exit 2 ;;
  esac
done

# The host is a laptop on wifi. Asleep, it answers nothing at all, and ssh
# would otherwise spend a minute timing out before saying so less helpfully.
if ! ssh -o BatchMode=yes -o ConnectTimeout=8 "$HOST" 'exit 0' 2>/dev/null; then
  echo "desktop: $HOST is not answering — asleep, off, or off the network" >&2
  exit 1
fi

# OpenSSH on Windows hands commands to cmd.exe, which wants backslashes.
REMOTE_WIN="${REMOTE//\//\\}"

# target/ is excluded, which also exempts it from --delete. Otherwise every
# sync wipes Cargo's build cache and every build starts from cold.
ssh -o BatchMode=yes "$HOST" "if not exist $REMOTE_WIN mkdir $REMOTE_WIN"
rsync -az --delete \
  --exclude 'target/' \
  --exclude 'gen/schemas/' \
  "$APP/" "$HOST:$REMOTE/"

# The CLI comes from npx at a pinned version rather than from a package.json.
# packages/* is a Bun workspace glob, so a package.json here would make this
# directory a workspace member, change bun.lock, and break the Docker image's
# frozen install for something the server never uses.
ssh -o BatchMode=yes "$HOST" "cd $REMOTE_WIN && npx --yes @tauri-apps/cli@$TAURI_CLI build"

# Cargo.lock is generated over there and has to come back: the next --delete
# sync removes anything that exists only on the host, and the build after it
# would resolve its dependencies afresh.
scp -q "$HOST:$REMOTE/src-tauri/Cargo.lock" "$APP/src-tauri/Cargo.lock"

mkdir -p "$OUT"
BUNDLE="$REMOTE_WIN\\src-tauri\\target\\release\\bundle\\nsis"
installer="$(ssh -o BatchMode=yes "$HOST" "dir /b $BUNDLE\\*-setup.exe" | tr -d '\r' | tail -1)"
scp -q "$HOST:$REMOTE/src-tauri/target/release/bundle/nsis/$installer" "$OUT/"
echo "built -> dist-desktop/$installer"

if [ "$DO_INSTALL" -eq 1 ]; then
  # /S is NSIS's silent switch. The installer is per-user (installMode
  # currentUser in tauri.conf.json), so it needs no elevation.
  ssh -o BatchMode=yes "$HOST" "$BUNDLE\\$installer /S"
  echo "installed on $HOST"
fi
