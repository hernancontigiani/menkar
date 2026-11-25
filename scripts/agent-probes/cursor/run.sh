#!/bin/bash
# run.sh [probe…]: the Cursor probes against the build MENKAR_E2E_EXECUTABLE names (README.md).
# Each run spends the human's real Cursor requests.
set -uo pipefail
here=$(dirname "$(readlink -f "$0")")
: "${MENKAR_E2E_EXECUTABLE:?set it to an extracted build (README.md)}"
# Electron's singleton socket needs a short path; the app's root, which holds the login's copy,
# lands here and is removed when the app closes.
export TMPDIR=${PROBE_TMPDIR:-/tmp/menkar-cursor-probe}
mkdir -p -m 700 "$TMPDIR"
cd "$here/../../.."
for v in $(env | grep -o '^CLAUDE[A-Z_]*\|^AI_AGENT\|^TRACEPARENT\|^MENKAR_PANE\|^MENKAR_FILES'); do unset "$v"; done
xvfb-run -a env MENKAR_E2E_XVFB=1 npx playwright test -c "$here/playwright.config.ts" "$@"
status=$?
if ls -d "$TMPDIR"/menkar-e2e-* >/dev/null 2>&1; then
  echo "An app root outlived the run, with a copy of the Cursor login: remove $TMPDIR/menkar-e2e-*" >&2
fi
exit $status
