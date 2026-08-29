#!/usr/bin/env bash
# Limmud desktop launcher: starts the Tauri dev app (vite + cargo) unless an
# instance is already running. Used by the ~/.local/share/applications entry.
set -u

if pgrep -f "node .*/tauri dev" > /dev/null 2>&1; then
  # Already running — the window is open; do not spawn a second instance.
  exit 0
fi

cd /home/abnzr/limmud || exit 1
exec npm run tauri dev
