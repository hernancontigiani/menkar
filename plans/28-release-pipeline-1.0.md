# Plan 28: going public at 1.0 — branches, GitHub CI, releases, packages, contributing

> **Status:** stub, written 2026-11-10 with the human. For the 1.0 release, not before. Needs
> `/design-plan` then.
>
> **Exit, when executed:** `CONTRIBUTING.md` (new), `.github/` (workflows, issue/PR templates),
> `docs/packaging.md` (the formats and the release pipeline), `README.md` (install per platform,
> links to Releases and the site); decision 1.5 superseded in `plans/00-STATUS.md` §1; the rest →
> `git log`.

## Decided (the human, 2026-11-10)

- **The repository goes public** on GitHub at 1.0.
- **Branches, model A**: `main` is the development line and the default branch; all work happens
  on a branch (`feature/…`, `fix/…`) and enters `main` through a pull request; `main` is protected
  (no merge without green CI). **Releases are tags** (`vX.Y.Z`), not merges; a fix for an older
  version goes on `release/X.Y` cut from its tag.
- **GitHub Actions CI from 1.0**, replacing decision 1.5's "no hosted CI" once branches are in
  place. Until then `npm run ci` stays the local gate.
  - **No run on push to a branch** — pushing as often as one likes costs nothing. The PR workflow
    listens to `pull_request` (`opened`, `synchronize`, `reopened`, `ready_for_review`) and skips
    drafts (`if: github.event.pull_request.draft == false`): a **draft PR** is the "not ready yet"
    state, "Ready for review" is "ready to merge". `concurrency` with `cancel-in-progress` keeps only
    the latest run per PR. Optional: path filters for docs-only changes.
  - What runs on a PR: `npm run ci` and the e2e suite (parallel, plan 22) on Linux.
- **The release workflow** listens to `v*` tags only: the full suite, then the packages, then a
  GitHub Release with them attached.
  - **Linux** (one Ubuntu runner): `.deb`, `.rpm`, AppImage; x64 (ARM later, on demand).
  - **Windows** (a `windows-latest` runner, so `node-pty` is built natively): an NSIS installer,
    x64, per-user (no admin). No 32-bit. Unsigned at first (SmartScreen warns); a signing
    certificate is a later decision. Needs plan 27's platform isolation first.
  - macOS: later; needs an Apple Developer account for notarization.
  - Flatpak/Snap: not offered (Flatpak's sandbox stops Menkar from launching the host's `claude`
    and real shells).
- **Distribution**: GitHub Releases for the binaries; GitHub Pages for a small site (what Menkar
  is, screenshots, install per platform, link to the latest release). No in-app update check
  ("nothing leaves the machine"); the site says users update by downloading.
- **Contributing**: `CONTRIBUTING.md` (fork, branch from `main`, `npm run ci`, PR with a
  description), issue templates (bug, feature request) and a PR template; **DCO** sign-off
  (`Signed-off-by:`) rather than a CLA, fitting GPL-3.0-or-later.
