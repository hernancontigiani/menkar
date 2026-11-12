#!/usr/bin/env bash
# Installs the .deb that `npm run package` left in release/, on this machine.
# Usage: ./install-local.sh   (asks for the sudo password; restart Menkar afterwards)
set -euo pipefail

deb="$(cd "$(dirname "$0")" && pwd)/release/menkar_0.1.0_amd64.deb"

if [[ ! -f "$deb" ]]; then
  echo "No package at $deb — run 'npm run package' first." >&2
  exit 1
fi

new="$(dpkg-deb -f "$deb" Version)"
old="$(dpkg-query -W -f='${Version}' menkar 2>/dev/null || echo 'not installed')"
echo "Installed: $old"
echo "Package:   $new"

if [[ "$new" == "$old" ]]; then
  echo "That version is already installed."
  exit 0
fi

sudo apt install -y "$deb"
echo "Now installed: $(dpkg-query -W -f='${Version}' menkar). Restart Menkar to use it."
