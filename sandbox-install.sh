#!/usr/bin/env bash
# Installs the Menkar Sandbox .deb on this machine, beside the daily Menkar, which it leaves as it is.
# Usage: ./sandbox-install.sh   (asks for the sudo password; no restart of Menkar is needed)
set -euo pipefail

root="$(cd "$(dirname "$0")" && pwd)"
# `npm run package:sandbox` writes release/sandbox/; a package built elsewhere is copied to release/.
deb=""
for candidate in "$root/release/sandbox/menkar-sandbox_0.1.0_amd64.deb" \
  "$root/release/menkar-sandbox_0.1.0_amd64.deb"; do
  if [[ -f "$candidate" && ( -z "$deb" || "$candidate" -nt "$deb" ) ]]; then
    deb="$candidate"
  fi
done

if [[ -z "$deb" ]]; then
  echo "No Menkar Sandbox package in $root/release — run 'npm run package:sandbox' first." >&2
  exit 1
fi

new="$(dpkg-deb -f "$deb" Version)"
old="$(dpkg-query -W -f='${Version}' menkar-sandbox 2>/dev/null || echo 'not installed')"
echo "Package file: $deb"
echo "Installed:    $old"
echo "Package:      $new"

if [[ "$new" == "$old" ]]; then
  echo "That version is already installed."
  exit 0
fi

sudo apt install -y "$deb"
echo "Now installed: menkar-sandbox $(dpkg-query -W -f='${Version}' menkar-sandbox)."
echo "Menkar, the daily one, is still $(dpkg-query -W -f='${Version}' menkar 2>/dev/null || echo 'not installed')."
echo "Open it from the launcher as \"Menkar Sandbox\"."
