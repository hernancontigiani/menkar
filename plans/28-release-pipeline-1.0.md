# Plan 28: going public at 1.0 — branches, GitHub CI, releases, packages, contributing

> **Status:** written 2026-11-19 (task 127) from the stub of 2026-11-10, whose decisions are kept
> as given (§1). **D1–D7 are the human's (§3)**; blocks 1–4 can run on the private repository
> once D2, D3 and D5 are answered; blocks 5–6 wait on D1, blocks 7–8 on D6 and D7 (§7).
>
> **Comes from:** the stub written with the human on 2026-11-10; topic 72 (the APT and RPM
> service); decision 1.189 (the public site, plan 46, which owns everything under `site/`).
>
> **Exit, when executed:**
> - `CONTRIBUTING.md` (new): fork, branch from `main`, `npm run ci`, a draft PR, "Ready for
>   review", the DCO sign-off.
> - `.github/` (new): `workflows/checks.yml`, `pr.yml`, `release.yml`, `publish.yml`;
>   `CODEOWNERS`; `ISSUE_TEMPLATE/bug.yml`, `feature.yml`; `pull_request_template.md`.
> - `docs/packaging.md`: the formats (.deb, .rpm), the version at a tag, the release pipeline
>   (tag → draft → checklist → publish → the package service), installing from the repository
>   (the commands, source of truth for the site's Install page), and what was rejected (§2.9).
> - `docs/toolchain.md`: "The hosted CI" — what runs on a PR and on a tag, the runner, the e2e
>   workers measured there, the base-ref variables; the "Local CI" paragraph's "no hosted CI".
> - `docs/release-checklist.md`: checks the draft release's assets, not a local build; install
>   from the repository; the step that publishes.
> - `README.md`: "Install" for the `.deb` and the `.rpm` (the repository, the single file as
>   fallback; no other platform, 1.190), a link to
>   the site and to `releases/latest`; the "small site" wording goes.
> - `AGENTS.md`: "Local CI" and "Git and the shared tree" for model A (branches, PRs, `-s`), in
>   the going-public block only.
> - `plans/00-STATUS.md` §1: 1.5's "no hosted CI" and 1.85 superseded by the new rows; D1–D7 as
>   rows with their dates; topic 72 closed.
> - `docs/NOT_BUILT_YET.md`: macOS, ARM, the AppImage (if D4 defers it), a self-hosted
>   repository. Native Windows is already there (1.190).
> - Superseded text (1.5, 1.85, the "no hosted CI" sentences, the checklist's local-build
>   install) leaves verbatim for `docs/history/` in the same change; the README's old install
>   text goes to `git log` (README is not a decision document).
> - The rest → `git log`.

## 1. Decided, used as given

From the stub (the human, 2026-11-10), not reopened except where §3 D4 says so:

- **Public on GitHub at 1.0**, `git@github.com:hernancontigiani/menkar.git` (checked by `set`).
- **Model A**: `main` is the development line and the default branch; all work on a branch
  (`feature/…`, `fix/…`) entering `main` by a pull request; `main` protected, no merge without
  green CI. **Releases are tags** `vX.Y.Z`; a fix for an older version goes on `release/X.Y` cut
  from its tag.
- **GitHub Actions from 1.0**, replacing 1.5's "no hosted CI" once branches are in place; until
  then `npm run ci` stays the local gate. **No run on push to a branch**; the PR workflow listens
  to `pull_request` (`opened`, `synchronize`, `reopened`, `ready_for_review`), skips drafts,
  `concurrency` with `cancel-in-progress` per PR. It runs `npm run ci` and the e2e (one Xvfb per
  worker) on Linux.
- **The release workflow listens to `v*` tags only**: the full suite, the packages, a GitHub
  Release with them attached. Linux x64 on one Ubuntu runner (`.deb`, `.rpm`, AppImage — see D4);
  no Windows installer (1.190, §3); macOS experimental, after 1.0 (1.191); no Flatpak or Snap.
- **Distribution**: GitHub Releases for the binaries; the site on GitHub Pages (plan 46); no
  in-app update check.
- **Contributing**: `CONTRIBUTING.md`, issue templates (bug, feature), a PR template, **DCO**
  rather than a CLA.
- **Who may merge**: two rulesets on `main` — "CI green" (required checks, no bypass) and
  "Review" (1 approving review from a code owner, `CODEOWNERS` = the maintainer for `*`, bypass:
  the repository admin role).
- **An APT repository and an RPM one on a hosted service with a free open-source plan,
  Cloudsmith or packagecloud** (to choose: D1); the release uploads each tag's `.deb` and `.rpm`
  there; the single downloaded file stays documented as the fallback; a self-hosted bucket is the
  later option. GitHub Pages cannot host it: the `.deb` of 0.1.0-387 is 102,659,364 bytes, above
  Pages' 100 MB file limit (checked by `set`).
- **The site** (1.189) is plan 46's, whole. The boundary agreed with `menkar-t128` on
  2026-11-19 is in §2.8.

## 2. Goal, what exists, and the design

### 2.1 Goal

At 1.0 a stranger can install Menkar with `apt install menkar` (or `dnf install menkar`), get
updates with `apt upgrade`, and send a pull request that is checked by the same gate the team
uses; the maintainer cuts a release by pushing a tag and pressing Publish after the checklist.

### 2.2 What exists in the tree (verified 2026-11-19)

- `electron-builder.yml`: `linux.target` is `deb` x64 only; `publish: null`; `deb.depends` adds
  `libasound2t64 | libasound2`. No `rpm` section.
- `scripts/package.mjs`: computes `debianRevision` (`<count>.g<hash>[.dirty.<UTC>]`) from
  `git rev-list --count HEAD` and hands it as `buildNumber`; runs `electron-builder --linux deb
  --x64`. **It needs the full history**: a shallow clone counts 1 commit.
- `electron.vite.config.ts`: the flavour comes from the branch (`git rev-parse --abbrev-ref
  HEAD`) unless `MENKAR_FLAVOR_BUILD` is set; **a tag checkout is a detached HEAD and builds
  `sandbox`** (`docs/packaging.md` records it, seen 2026-11-18). `ui-check` sets
  `MENKAR_FLAVOR_BUILD=menkar`; `npm run package` does not.
- `scripts/ci.mjs`: Biome, tsc, Vitest (`CI=1`), "R10 unchanged" (compares with the local branch
  `main`; skipped when `HEAD` is `main`), code rules, i18n, test integrity, flaky quarantine,
  history.
- `scripts/check-test-integrity.mjs`: baseline `MENKAR_TEST_BASELINE` or `git merge-base main
  HEAD` — **a local branch `main`, absent in an Actions checkout** (only `origin/main` after a
  full fetch).
- `scripts/nothing-lost.mjs`: compares the tree with `HEAD` only — **on a clean CI checkout it
  checks nothing**: a PR that drops a decision line without its history passes.
- `scripts/check-package.mjs`: reads the `.deb` with `dpkg-deb`; checks the Version is
  `<package.json version>-<commits>.g<hash>[.dirty.<time>]`. Nothing reads an `.rpm`.
- `playwright.config.ts`: `MENKAR_E2E_WORKERS` (4 by default), `retries: 0`, `forbidOnly`.
  `e2e/display.ts` starts one Xvfb per worker; `xvfb-run -a` wraps the run.
- electron-builder 26.18.0 (`app-builder-lib/out/targets/FpmTarget.js:68`) uses **the same
  `after-install.tpl` for `deb` and `rpm`**, so the AppArmor profile and `update-alternatives`
  steps run on RPM systems too; its default `rpm` depends
  (`linuxOptions.d.ts:100`) has **no ALSA** — the same gap the `.deb` had.
- No `.github/`, no `CONTRIBUTING.md`, no `CODEOWNERS`. `rpmbuild` is not installed on the
  human's machine; `docker` is.
- 55 e2e spec files; the suite takes 4–5 minutes locally (the task's figure; 107 s at 4 workers
  was measured on 2026-11-10 with 260 tests, `docs/toolchain.md`).

### 2.3 The workflows

Four files, so a PR and a tag run the same checks from one place:

- **`checks.yml`** (`on: workflow_call`, input `base`): three jobs on `ubuntu-24.04` (pinned, not
  `ubuntu-latest`, so an image switch is a change we make):
  - **`ci`**: `actions/checkout` with `fetch-depth: 0`; `actions/setup-node` with
    `node-version-file: package.json`'s engines (22) and npm cache; `npm ci`; `node
    node_modules/electron/install.js` when the binary is missing; then, with
    `MENKAR_TEST_BASELINE=$(git merge-base origin/<base> HEAD)`,
    `MENKAR_HISTORY_BASE=<same>`, `MENKAR_R10_BASE=origin/<base>`: `npm run ci`.
  - **`e2e`**: the same set-up plus `sudo apt-get install -y xvfb xauth` and the Electron
    libraries the image lacks (block 1 finds the list); `MENKAR_E2E_WORKERS=<measured>` `npm run
    ui-check`; on failure, upload `test-results/` as an artifact (7 days).
  - **`dco`**: every commit in the range `<base>..HEAD` (excluding merges) has a `Signed-off-by:`
    line matching its author's email; a script of ours, `scripts/check-dco.mjs`, with a Vitest
    test — no third-party GitHub App, so nothing is installed on the account.
- **`pr.yml`**: `on: pull_request` with the four types, `if: github.event.pull_request.draft ==
  false`, `concurrency: { group: pr-${{ github.event.pull_request.number }},
  cancel-in-progress: true }`, `permissions: contents: read`; calls `checks.yml` with `base:
  ${{ github.base_ref }}`. The required checks are its three jobs (`checks / ci`, `checks / e2e`,
  `checks / dco`).
- **`release.yml`**: `on: push: tags: ['v*']`. Jobs:
  1. **`verify`**: the tag is `v` + `package.json`'s version (refused otherwise), and the tagged
     commit is reachable from `origin/main` or from `origin/release/X.Y` (refused otherwise).
  2. **`checks`**: `checks.yml` with base = the tag's commit itself — the code was gated by its
     PR; here the suite proves the tagged tree, and the base-diff checks (integrity, history,
     R10, DCO) have nothing to compare, by design.
  3. **`package`** (needs both): `fetch-depth: 0`; `MENKAR_FLAVOR_BUILD=menkar`; `sudo apt-get
     install -y rpm`; `npm run package -- --targets deb,rpm`; `npm run package:check -- --targets
     deb,rpm`; `npm run package:smoke`; `sha256sum` into `SHA256SUMS`; `gh release create
     "$TAG" --draft --verify-tag --title "Menkar X.Y.Z" --notes-file <generated>` with the
     `.deb`, the `.rpm` and `SHA256SUMS`. `permissions: contents: write` on this job only.
- **`publish.yml`**: `on: release: types: [published]`, skipped for a prerelease. Downloads the
  release's assets with `gh release download`, verifies `SHA256SUMS`, and pushes the `.deb` and
  `.rpm` to the package service (D1) with its official action or CLI. A secret
  (`PACKAGES_API_KEY`) lives in a GitHub **environment** `packages` whose only allowed ref is
  tags `v*`, so no PR workflow can reach it.

**Why a draft and a second workflow:** `docs/release-checklist.md` says a build is a version only
after the human's checks pass on a real desktop. The draft is the candidate; the human checks the
draft's own `.deb` (the bytes that will ship, not a local build of the same commit); Publish is
the act that makes it a version, and only then does the APT repository get it. A Release that the
`GITHUB_TOKEN` creates would not trigger another workflow, but the human pressing Publish does.
(D3 decides what happens to a candidate that fails.)

**Fork PRs:** `pull_request` from a fork runs with a read-only token and no secrets; the PR
checks need neither. `pull_request_target` is never used.

### 2.4 Base-ref variables (code changes)

Three checks compare against "main" or "HEAD" in ways an Actions checkout breaks:

| Check | Today | In CI |
|---|---|---|
| test integrity | `git merge-base main HEAD` | `MENKAR_TEST_BASELINE` (exists) set by the workflow |
| history (`nothing-lost.mjs`) | tree vs `HEAD` | new `MENKAR_HISTORY_BASE`: compare the tree with that commit instead of `HEAD`; unset = `HEAD`, as today |
| R10 unchanged (`ci.mjs`) | local branch `main` | new `MENKAR_R10_BASE`: the ref to compare with; unset = `main`, as today |

Each gets a Vitest case with the variable set and unset. **R10's own rule ("written on `main`
only") cannot survive model A as is**: once every change reaches `main` by PR, a PR that refreshes
R10 legitimately is indistinguishable from the multi-agent branch changing it. R10 lives only while
the `multi-agent` branch does (`docs/toolchain.md`). **Precondition of block 2: ask `set` whether
the branch has merged for good;** if it has, the R10 step and its rule leave for their history in
that block and `MENKAR_R10_BASE` is not built; if not, the PR workflow skips R10 for PRs whose head
is not `multi-agent` and runs it with `MENKAR_R10_BASE=origin/main` for that one.

### 2.5 The version at 1.0

Today (1.45): `package.json` is `0.1.0`; the `.deb`'s Version is `0.1.0-<commits>.g<hash>`
(`.dirty.<UTC>` for an uncommitted tree); the file is `menkar_0.1.0_amd64.deb`. D2 decides the
tag's version; the recommendation keeps one scheme for every build:

- **A release `X.Y.Z`** is one commit on `main` (or `release/X.Y`) that sets `package.json` and
  `package-lock.json` to `X.Y.Z`, then the tag `vX.Y.Z` on it. The `.deb` is
  `X.Y.Z-<commits>.g<hash>` — the same formula as any local build of that commit — and the
  `.rpm` `X.Y.Z-<commits>.g<hash>` (fpm's `--iteration` gives the RPM Release; RPM forbids `-`
  there, and the revision has none). Files: `menkar_X.Y.Z_amd64.deb`, `menkar-X.Y.Z.x86_64.rpm`
  (confirmed by block 4's first build).
- **Ordering**: dpkg and rpm compare the upstream version first, so `1.0.1-…` sorts after every
  `1.0.0-…`; within one upstream version the commit count orders builds. A local build of `main`
  after the tag (`1.0.0-450.g…`) sorts above the release `1.0.0-412.g…`, which is what the human
  wants on their own machine; the next release `1.0.1` or `1.1.0` overtakes it.
- **`main` after a release** keeps `package.json` at the released version until the next release
  commit bumps it. No `-dev` suffix: the revision already tells builds apart.
- **A `release/X.Y` fix**: the branch is cut from `vX.Y.Z`; the fix is cherry-picked from `main`;
  one commit sets `X.Y.(Z+1)`; tag. Its commit count is that branch's, and its upstream version is
  new, so the order holds.
- **Pre-1.0 local builds stay as 1.45 says.** The `0.1.0` → `1.0.0` bump is the 1.0 release
  commit itself (block 8).
- **The test**: `debianRevision` gains no case; block 3 adds `releaseVersion(tag, packageJson)`
  (`v1.0.0` + `1.0.0` → ok; `v1.0.0` + `0.1.0` → refused; `v1.0` → refused; `v1.0.0-rc.1` →
  refused unless D3 picks rc tags) with its Vitest test, used by `release.yml`'s `verify`.

### 2.6 RPM

- `electron-builder.yml` gains `linux.target: [deb, rpm]` only through `package.mjs --targets`
  (default `deb`, so the human's local `npm run package` needs no `rpmbuild`), and an `rpm:`
  section with `depends` = electron-builder's default list plus **`alsa-lib`**, the ALSA library
  the `.deb` already needed. `packageCategory`/`synopsis` follow the `.deb`.
- **The post-install on RPM systems**: the shared template's AppArmor branch runs only where
  `apparmor_parser` understands `abi/4.0` (openSUSE has AppArmor; Fedora has SELinux and skips
  it); Fedora does not restrict unprivileged user namespaces, so Chromium's sandbox works without a
  profile. `update-alternatives` exists on Fedora (`alternatives`). Block 4 proves both in a
  throwaway `fedora:latest` container: install, `menkar --version`, `/usr/bin/menkar` linked,
  `chrome-sandbox` `0755`, remove.
- **`package:check --targets rpm`** reads the `.rpm` with `rpm -qp --info --scripts --requires`
  and `rpm2cpio | cpio -t` (in the container, or on the runner which has `rpm`): the same file
  list as the `.deb` (app, `chrome-sandbox`, node-pty's module, launcher, icon), the post-install's
  link and profile lines, `alsa-lib` in Requires, no update feed, and the Version formula.
- **Rejected:** a separate RPM spec of our own — electron-builder's fpm target already shares the
  post-install, and a second template is a second thing to keep in step.

### 2.7 The package service (D1)

Compared on 2026-11-19 from their own pages (topic 72). **packagecloud is no longer open to new
projects**, which settles the stub's choice in practice; the human still confirms it as D1.

| | Cloudsmith | packagecloud |
|---|---|---|
| Open to a new project | Yes: any account, free Core plan included, creates a repository with "Open Source" visibility; no application, Cloudsmith may audit later [1][2] | **No**: since 2024-10-08 new sign-ups go to Buildkite Package Registries (`/users/new` redirects there) [6][7]; Buildkite bought it in 2023 [8] |
| Free open-source terms | Free for a project that is open source by definition (SPDX licence, public project URL), run by its maintainer; **attribution required**: a line in the README linking to Cloudsmith saying it provides the hosting; missing it can mean suspension [1][3] | The "Free for Open Source" programme of 2021 (manual review) [9] has nothing current; Buildkite's free tier is **1 GB a month, storage and bandwidth together, hard limit** (≈ nine downloads of the `.deb`); OSS pricing is "contact us" [10][11] |
| Storage / delivery | At least **50 GB stored + 200 GB delivered a month**, across the owner's open-source repositories, counted apart from the paid plan [1][4] | packagecloud's own free plan (closed to new accounts): 2 GB / 10 GB [12] |
| Over the limit | Not documented for open source; paid plans bill per GB with a cap at 200% [5] | Free: not documented; paid: account disabled at the overage cap [12] |
| Signing | A key per repository, generated by Cloudsmith, signs APT `InRelease` and RPM metadata and packages [13][14]; one's own key by `cloudsmith repos gpg upload` (possibly paid only, unconfirmed) | A key per repository signs metadata; one's own key signs packages only [15] |
| APT and RPM | One repository holds both; `any-distro/any-version` for a distro-neutral package [14][16] | One repository, both (`any/any`, `rpm_any/rpm_any`) [15]; Buildkite: one registry per format |
| From GitHub Actions | Official `cloudsmith-io/cloudsmith-cli-action@v3`, with **OIDC** (no stored secret) or an API key [17][18] | No official action: the `package_cloud` gem, the API, or community actions [15] |
| If the plan ends | No notice period or export procedure stated; suspension "after contacting you" [1]; we hold every file ourselves (the GitHub Release) | Buildkite's export script; Buildkite re-signs with its own keys, so every user changes key [19] |
| URL users put in their sources | `dl.cloudsmith.io/public/<owner>/<repo>/…`; **a custom domain only on Ultra/Enterprise** [20] | `packagecloud.io/<user>/<repo>/…`; custom domain by arrangement |
| What the service sees of users | Every download logged for the maintainer: time, user agent, IP and its location [21] | The same, through its API [22] |
| Known incident | 2026-10-01: Caddy's repository was signed with a subkey expired in 2024 and apt on Ubuntu 24.04 refused it; fixed the same day on a ticket [23] | — |

**Recommendation: Cloudsmith**, with what it costs said plainly:

- The README (and the site) carry the attribution line: "Package repository hosting is
  graciously provided by Cloudsmith", linking to cloudsmith.com: a condition of the free plan.
- **Users' sources name `dl.cloudsmith.io`**: leaving Cloudsmith later means every user changes
  their source line and key (a custom domain is not on the free plan). The GitHub Release keeps
  every file, so the exit is always possible; the cost falls on users once.
- **A privacy line** in README's install section: installing from the repository means apt or
  dnf contacts Cloudsmith, which logs the address of each download; Menkar itself still connects
  to nothing. The single downloaded file from GitHub Releases is the alternative.
- **200 GB a month** is about 1,900 downloads of a 102 MB file, upgrades included; past that
  the behaviour is undocumented. `docs/packaging.md` records the limit and the trigger to ask
  Cloudsmith for sponsorship or to self-host (`docs/NOT_BUILT_YET.md`).
- **The key's expiry is watched**: the human notes the key's and every subkey's expiry from
  the repository's page; `docs/packaging.md` records the fingerprint and the date; the release
  checklist checks `apt update` from the repository with no signature warning on every release.
- **Upload by OIDC**, so no long-lived secret exists in GitHub: a Cloudsmith service account
  with push rights only, whose OIDC claims accept only this repository's `publish.yml` in the
  `packages` environment. An API key in that environment is the fallback if OIDC is not offered
  on the free plan.

Sources (read 2026-11-19):
[1] https://docs.cloudsmith.com/open-source-hosting-policy ·
[2] https://cloudsmith.com/changelog/broadcasts-now-support-open-source-projects ·
[3] https://cloudsmith.com/blog/cloudsmith-loves-opensource ·
[4] https://cloudsmith.com/pricing (via search, the page refused automated reads) ·
[5] https://docs.cloudsmith.com/support/billing ·
[6] https://blog.packagecloud.io/packagecloud-is-now-buildkite-package-registries/ ·
[7] https://packagecloud.io/users/new ·
[8] https://buildkite.com/about/press/buildkite-announces-acquisition-of-packagecloud/ ·
[9] https://blog.packagecloud.io/packagecloud-loves-oss/ ·
[10] https://buildkite.com/docs/platform/limits ·
[11] https://buildkite.com/pricing ·
[12] https://packagecloud.io/pricing ·
[13] https://docs.cloudsmith.com/supply-chain-security/signing-keys ·
[14] https://docs.cloudsmith.com/formats/redhat-repository ·
[15] https://packagecloud.io/docs ·
[16] https://docs.cloudsmith.com/formats/debian-repository ·
[17] https://docs.cloudsmith.com/integrations/integrating-with-github-actions ·
[18] https://docs.cloudsmith.com/authentication/setup-cloudsmith-to-authenticate-with-oidc-in-github-actions ·
[19] https://buildkite.com/docs/package-registries/migration/from-packagecloud ·
[20] https://docs.cloudsmith.com/workspaces/custom-domains ·
[21] https://cloudsmith.com/changelog/client-logs-geoip-controls-for-open_source-repositories ·
[22] https://packagecloud.io/docs/api ·
[23] https://caddy.community/t/cloudsmith-debian-repository-signing-key-expired/33954

GitHub facts used elsewhere in this plan (read 2026-11-19): standard Linux runners are 4 vCPU /
16 GB on a public repository, free; 2 vCPU / 8 GB on a private one, from the plan's included
quota (about 2,000 Linux minutes a month on Free, now expressed as a dollar pool)
(https://docs.github.com/en/actions/reference/runners/github-hosted-runners,
https://docs.github.com/en/billing/concepts/product-billing/github-actions). **Rulesets work on a
private repository only with GitHub Pro, Team or Enterprise**; on Free only on a public one
(https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).
**Pages from a private repository is not on Free** either
(https://docs.github.com/en/get-started/learning-about-github/githubs-plans). A Release asset may
be up to 2 GiB, with no limit on total size or bandwidth
(https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).

### 2.8 The boundary with plan 46 (agreed with `menkar-t128`, 2026-11-19)

- **Plan 46 owns** `site/` whole, `.github/workflows/docs.yml`, the domain, and every page,
  including the Install page's text in English and Spanish.
- **Plan 28 owns** `release.yml`, `publish.yml`, `pr.yml`, `checks.yml`, the packages and their
  asset names, the package service and its key, `CONTRIBUTING.md`, and replaces README's "small
  site" wording with a link to the site.
- **The site links the latest release only as `https://github.com/hernancontigiani/menkar/releases/latest`**,
  so a release never needs a site change.
- **The install commands' source of truth is `docs/packaging.md`** ("Installing from the
  repository", block 6). If plan 46 has landed when block 6 runs, block 6 also fills the pending
  blocks in `site/src/content/docs/install.md` and `site/src/content/docs/es/install.md` —
  only between the markers `<!-- plan 28: apt commands -->` … `<!-- /plan 28 -->` and `<!-- plan
  28: rpm commands -->` … `<!-- /plan 28 -->`, nothing else on the page — and runs `npm run
  site:check`. If not, plan 46 copies them from `docs/packaging.md`. The site check fails a page
  still holding a `plan 28:` marker only with `--release`.
- **The site's check in the PR workflow**: whichever plan lands second adds a `site` job to
  `pr.yml` (path filter `site/**`, `npm run site:check`). **It is not a required check**: a
  required check that a path filter skips stays pending and blocks the merge.
- **The first Pages deploy** is a step of block 8 (going public): Pages on a private repository
  needs a paid plan.

### 2.9 Rejected, and why

- **Path filters on the required PR jobs** (the stub's "optional"): a required check skipped by
  a path filter stays "Expected — waiting" and the PR cannot merge. A docs-only PR runs the full
  checks; at the PR volume of a single maintainer that is cheaper than a filter job to maintain.
- **`ubuntu-latest`**: the label moves to a new Ubuntu without a change in the tree; pinning
  `ubuntu-24.04` makes the move a reviewed PR.
- **A DCO GitHub App** (probot/dco): one more app with access to the repository; a 30-line script
  with a test does the same.
- **`pull_request_target`**: it runs fork code with the base's secrets; the PR checks need none.
- **Uploading to the package service from the tag workflow directly**: the APT repository would
  carry a build the human has not checked; `apt upgrade` would deliver it to every user.
- **GitHub Pages as the APT repository**: the 100 MB file limit (§1).
- **A `-dev` or `-rc` upstream version on `main`**: dpkg sorts `1.0.0~rc1` before `1.0.0` only
  with `~`, which RPM spells differently; the commit revision already orders every build with no
  second scheme (D2, D3).

## 3. Decisions for the human

**The human, 2026-11-19 (topic 72), with a premise corrected:**
- **The repository is already public**: `github.com/hernancontigiani/menkar` answers as public
  (checked by `set` through the GitHub API, 2026-11-19), and its pushed history is public, about 160
  commits behind the local `main`. **The account is GitHub Free.** Everything written below for "the
  private repository" is wrong. Actions on a public repository have free standard runners, and
  Pages publishes from it. D6's "what becomes public" is already public: it becomes a secrets scan
  of what is already out.
- **D1: Cloudsmith.**
- **D4: the AppImage is deferred.**
- **D5, replaced: not now.** The workflows are written and planned, but **nothing runs while the
  work goes on**: until the first official release they trigger only by hand (`workflow_dispatch`),
  never on a push, a PR or a tag. The team keeps committing to `main`. They are turned on for the
  first official release, and so is the switch to branches and PRs (model A).
- **D2, D3, D7 as recommended** (the human, 2026-11-19): a tag's version is the same formula as any
  build; a failed candidate is a draft that is deleted and re-tagged at the same version; squash
  only, linear history.
- **D6 becomes a secrets scan now**, not at 1.0: gitleaks over the whole history, run by `set`
  before pushing the 160 local commits (2026-11-19).
- **Release notes: `CHANGELOG.md` is the one source**, a section per version. The release workflow
  copies the version's section into the GitHub Release, and the site shows it as a page. `set`
  drafts each section from the commits since the last tag, and the human approves it (AGENTS.md's
  `CHANGELOG.md` rule). APT needs nothing: no changelog inside the `.deb`.
- **Dependabot** (the human, 2026-11-19): turned on for the repository. Alerts and security
  updates are set in GitHub's settings by the human; version updates come from
  `.github/dependabot.yml`.
- **No Windows** (the human, 2026-11-19, decision 1.190, topic 74): no Windows runner and no NSIS
  installer. A release states only what it supports, Linux's `.deb` and `.rpm`; WSL2 is neither
  tested nor promised. Native Windows waits in `docs/NOT_BUILT_YET.md`, its trigger users asking
  for it. The stub's "Windows NSIS, per-user, unsigned" (§1) is withdrawn.

Each with options and one recommendation; the plan's blocks are written for the recommendation,
and say what changes otherwise.

**D1. The APT and RPM service** (topic 72; §2.7 has the comparison and its sources).

- (a) **Cloudsmith, open-source visibility, upload by OIDC** — *recommended*: the only one of
  the two still open to a new project; 50 GB / 200 GB a month; signs both formats; official
  action. Costs: the attribution line, sources naming `dl.cloudsmith.io`, download logs held by
  Cloudsmith.
- (b) Buildkite Package Registries (packagecloud's successor), asking for OSS pricing: today
  1 GB a month free, which a single release exhausts.
- (c) Self-hosted now (a repository built in Actions with `reprepro`/`createrepo_c`, served from
  an object store on a domain of ours): independence and no third-party logs, but a bill, a
  domain, and the signing key in our hands.
- Blocks 5–6 are written for (a). (c) would replace block 5 with a block of its own.

**D2. What a tagged release is called** (§2.5).

- (a) **The same formula as any build**: tag `vX.Y.Z`, `package.json` `X.Y.Z`, package
  `X.Y.Z-<commits>.g<hash>` — *recommended*: one scheme, no special case in `package.mjs`, the
  revision names the commit, and the release built locally from the tag has the same Version.
- (b) Debian convention `X.Y.Z-1` for a tag: needs a tag branch in `package.mjs`; a local build
  of the same commit has another Version than the shipped one.
- (c) `main` moves to the next version with a pre-release mark right after each release
  (`1.1.0~dev`): two spellings, since RPM writes the pre-release mark differently.
- Local builds keep 1.45 in every option.

**D3. A release candidate that fails the checklist** (§2.3).

- (a) **Draft → the human's checklist on the draft's own files → Publish**; a failed candidate's
  draft and tag are deleted, the fix goes in by PR, and the same version is tagged again on the
  new commit — *recommended*: one tag per version, and nothing reaches the APT repository before
  the checklist; a deleted tag no user installed from harms no one.
- (b) Candidate tags `vX.Y.Z-rc.N`, published as GitHub prereleases (never uploaded to the
  repository); the final tag rebuilds the same commit: the shipped bytes are a rebuild, not the
  ones checked.
- (c) A failed candidate burns its number (the next one is `X.Y.(Z+1)`): no tag is ever
  deleted, at the cost of version gaps.

**D4. The AppImage at 1.0 — this reopens part of the stub's 2026-11-10 decision.** The stub
lists `.deb`, `.rpm`, AppImage. `docs/packaging.md` records (2026-11-08) that an AppImage cannot
install the AppArmor profile, so **on Ubuntu 24.04 it starts only with `--no-sandbox`**, while
`README.md` promises the installed app "runs with the sandbox, never with `--no-sandbox`".

- (a) **Defer the AppImage** to `docs/NOT_BUILT_YET.md` (trigger: a user on a distribution with
  neither APT nor RPM asks) — *recommended*: APT and RPM cover Ubuntu, Debian, Fedora and
  openSUSE with the sandbox on.
- (b) Ship it with `--no-sandbox` built into its launcher, with a line on the release page: an
  unsandboxed renderer for the users who pick it.
- (c) Ship it as electron-builder makes it: on Ubuntu 24.04 it fails to start until the user
  adds `--no-sandbox` by hand.

**D5. When the team switches to branches and PRs (model A).** The stub: "GitHub Actions CI from
1.0 … until then `npm run ci` stays the local gate". On a Free account rulesets — the only thing
that makes "no merge without green CI" true — need a public repository.

- (a) **Write and try the workflows now on the private repository; the team keeps committing to
  `main` (1.5, 1.85) until the repository goes public; the rulesets and model A start that day**
  — *recommended*: the workflows are proven before anyone depends on them, and nothing changes
  for the sessions until 1.0.
- (b) Switch now with GitHub Pro (rulesets on a private repository): earlier practice, a
  subscription, and every task becomes a PR before the product needs it.
- First the human says which plan the account is on (§6, step 1); on Pro, (a) still holds unless
  the human wants (b).

**D6. What becomes public with the repository.** The whole history goes public: 389 commits
today, `plans/`, `prompts/` and their reports, `docs/history/`, the absolute paths under the
human's home in some documents, and **the author email in every commit**.

- (a) **Publish the history as it is, after an audit** — *recommended*: block 8 runs a secret
  scan (gitleaks in a container, on a clone in the scratchpad) and lists every hit, every
  personal path and every email for the human to read; the human decides on each; future
  commits use the GitHub no-reply address. The "rest → `git log`" exits of every closed plan
  stay readable.
- (b) Start the public repository from one commit at 1.0: nothing old leaks, and every
  "→ `git log`" exit since the start is lost.
- (c) Rewrite the history (`git filter-repo`) to drop chosen files or rewrite the email: every
  clone and worktree, the `multi-agent` one included, must be redone.

**D7. How a PR enters `main`.** `debianRevision` assumes a linear history ("the commit count
only grows on this linear history"), and DCO needs the sign-off in what lands.

- (a) **Squash merge only, with "Require linear history" in the "CI green" ruleset, the squash
  message defaulting to the PR's title and commit details** (which carry each commit's
  `Signed-off-by:`) — *recommended*: one commit per PR on `main`, the count still grows by one
  per merge.
- (b) Rebase merge only: the PR's commits land as they are, sign-offs included; more commits on
  `main` per change.
- (c) Merge commits: the history stops being linear; the count still grows but
  `git log --first-parent` becomes the readable view.

## 4. Out of scope

- The site (plan 46), its workflow and its domain.
- Windows (1.190: not built, in `docs/NOT_BUILT_YET.md`; no WSL2 promise), macOS (1.191:
  experimental, after 1.0; signing it would need an Apple Developer account), ARM, Flatpak, Snap.
- Signing the `.deb` itself (`dpkg-sig`): the repository's signed `InRelease` is what apt checks.
- A CHANGELOG (none until the first tagged release, then only with the human's approval —
  `AGENTS.md`); the release notes are GitHub's generated list, edited by the human in the draft.
- An in-app update check (never: nothing leaves the machine).
- Self-hosting the repository.

## 5. Do not touch

- The human's GitHub account and repository settings: every setting is in the checklist (§6) for
  the human. No session creates an account, a key, a secret, a ruleset, pushes or tags.
- `site/` and `docs.yml` beyond §2.8's markers.
- `electron-builder.sandbox.yml` and the sandbox flavour: the sandbox is never released.
- The `.deb`'s contents, post-install, profile and depends: `package:check` stays green with no
  change to its `.deb` assertions.
- How `set` commits today (directly on `main`, 1.5/1.85) until block 8.

## 6. What the human does by hand

No session does any of these: each is the human's, on their own accounts. A block that needs one
says so and waits.

**Now, on the private repository (before block 2's trial):**

1. GitHub → Settings → Billing and plans: note which plan the account is on (Free or Pro) and
   tell `set`. It decides D5's timing and whether the trial runs from the included quota.
2. Repository → Settings → Actions → General:
   - Actions permissions: "Allow hernancontigiani, and select non-hernancontigiani actions",
     listing `actions/checkout@*`, `actions/setup-node@*`, `actions/upload-artifact@*`,
     `actions/download-artifact@*` and, after D1, `cloudsmith-io/cloudsmith-cli-action@*`.
   - Workflow permissions: **Read repository contents** (the default token is read-only; the
     release job asks for `contents: write` itself).
   - "Allow GitHub Actions to create and approve pull requests": **off**.
   - Fork pull request workflows: **Require approval for all external contributors**.
3. Approve `set` pushing one trial branch and opening a draft PR (block 2), then closing it.

**At 1.0, before the first tag (after D1 = Cloudsmith):**

4. Create a Cloudsmith account with two-factor authentication, and a workspace for Menkar.
5. Create a repository `menkar`, visibility **Open Source**, licence GPL-3.0-or-later, project
   URL the GitHub repository, accepting the open-source hosting terms. If Cloudsmith asks for
   early access to open-source Broadcasts, request it.
6. Create a **service account** with push rights on that repository only, and an **OIDC
   provider** for `https://token.actions.githubusercontent.com` whose claims require
   `repository = hernancontigiani/menkar` and `environment = packages`. Tell `set` the
   workspace slug, the service account's slug and the provider's namespace (none is a secret).
   If OIDC is not offered, create an API key for the service account instead (step 7).
7. GitHub → repository → Settings → Environments → **`packages`**: deployment branches and tags
   = "Selected", tag pattern `v*`. Only with the API-key fallback: a secret `CLOUDSMITH_API_KEY`
   in this environment.
8. From the Cloudsmith repository's page: the GPG key's fingerprint and the expiry of the key and
   of each subkey; tell `set` (they go in `docs/packaging.md`), and put a reminder 60 days before
   the first expiry.
9. GitHub → Settings → Rules → a **tag ruleset** on `v*`: restrict creation, update and deletion,
   with the repository admin role in the bypass list (D3 (a) deletes a failed candidate's tag).
10. GitHub → Settings → General → Pull Requests (after D7): allow **squash merging** only,
    default message "Pull request title and commit details"; "Automatically delete head
    branches" on.

**On going public (block 8):**

11. Read block 8's audit list (D6) and decide each hit. Turn on "Keep my email addresses
    private" and use the no-reply address for new commits.
12. Settings → General → Danger zone → **Change visibility → Public**.
13. Settings → Rules → **"CI green"** on the default branch: require a pull request; required
    status checks `checks / ci`, `checks / e2e`, `checks / dco`, from GitHub Actions; require
    linear history; block force pushes; restrict deletions; **no bypass**.
14. Settings → Rules → **"Review"** on the default branch: 1 approving review, require review
    from Code Owners, dismiss stale approvals on new commits; **bypass list: Repository admin**.
15. Settings → Pages → Source: **GitHub Actions**; then Actions → `docs` → Run workflow (plan
    46's first deploy).
16. Verify the two rulesets (the stub's check): a throwaway PR of yours merges green with no
    review and is refused while red; a PR from a second account is refused until you approve.
    Close and delete both.
17. When `set` has pushed the 1.0 commit: push the tag `v1.0.0` (or ask `set` to), run
    `docs/release-checklist.md` on the draft's files, and press **Publish release**.

## 7. Order: now on the private repository, at 1.0, on going public

| When | What | Blocks | Needs |
|---|---|---|---|
| **Now, private** | The base-ref variables, the DCO check, the version check; `checks.yml` and `pr.yml`, tried on one draft PR that `set` pushes, the e2e worker count measured on the 2-vCPU runner | 1, 2 | §6 steps 1–3; D5 |
| **Now, private** | The `.rpm` built, checked and installed in a Fedora container | 4 | D4 only for the AppImage line |
| **Now, private** | `release.yml` tried with a throwaway tag on the current version (`v0.1.0`), producing a draft that is then deleted with its tag | 3 | D2, D3; `set` pushes the tag when the human asks |
| **At 1.0, still private** | `publish.yml`, the `packages` environment; `CONTRIBUTING.md`, templates, `CODEOWNERS`, README and checklist text | 5, 6 | D1; §6 steps 4–10 |
| **On going public** | The audit (D6), `AGENTS.md` for model A, the decision rows, public-runner re-measure, rulesets, Pages, the 1.0 commit and tag | 7, 8 | D6, D7; §6 steps 11–17 |

Nothing on the private repository depends on the repository being public except the rulesets
(Free), Pages (Free), and the Cloudsmith repository's "public project URL", which is why the
first upload is `v1.0.0` itself; `publish.yml` has a `workflow_dispatch` with a `tag` input so a
failed upload is re-run without a new tag.

**Cost of trying on the private repository:** each PR run spends the e2e's minutes on a 2-vCPU
runner from the account's quota; the trial PR in block 2 is a handful of runs, and the team does
not open PRs before model A, so the quota is not at risk.

## 8. Execution blocks

Every block ends with `npm run ci` green, reported with its output. Every new test is seen to fail
once against a defect put in on purpose. **No session pushes, tags, or changes a GitHub
setting**: where a block needs a push, it asks `set`, who pushes only when the human has asked
(1.85). Workflow files are checked locally with `actionlint` in a container
(`docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:<pinned version>`), since nothing
runs them before a push.

### Block 1 — the checks that compare against a base, the DCO check, the release version

Precondition: ask `set` whether the `multi-agent` branch has merged for good (§2.4).

- [ ] `scripts/nothing-lost.mjs`: `MENKAR_HISTORY_BASE` — when set, every comparison made against
  `HEAD` (the diff, `cat-file -e`, `show`) is made against that commit. Test
  (`tests/scripts/nothing-lost.test.ts`): in a temporary repository, base commit holds a decision
  line, the tree has removed it, `HEAD` = the tree → passes unset, **fails with the variable set
  to the base**; with the line added to its history mirror → passes.
- [ ] `scripts/ci.mjs`, R10: per the precondition, either retire the step and its rule (their
  text to `docs/history/`), or add `MENKAR_R10_BASE` (unset = `main`) with a test in the same
  temporary-repository style.
- [ ] `scripts/check-dco.mjs` (new) with `.d.mts`: given `<base>` and `HEAD`, every non-merge
  commit in `base..HEAD` carries `Signed-off-by: <name> <email>` whose email is the commit's
  author email; prints each failing commit's short hash and subject. Test
  (`tests/scripts/check-dco.test.ts`): signed → passes; unsigned → fails naming it; signed with
  another email → fails; a merge commit unsigned → ignored; an empty range → passes.
- [ ] `scripts/release-version.mjs` (new) with `.d.mts`: `releaseVersion(tag, version)` returns
  the version or throws our sentence. Test cases as §2.5 lists (rc tags refused unless D3 = (b)).
- [ ] `docs/toolchain.md`: the three variables in "The checks in `npm run ci`".
- Verification: `npm run ci`; each new test seen red once.

### Block 2 — `checks.yml` and `pr.yml`, tried on a draft PR

- [ ] `.github/workflows/checks.yml` and `pr.yml` exactly as §2.3 describes; every `uses:` pinned
  to a full commit SHA with its version in a comment; `timeout-minutes` on each job (30 for e2e,
  15 for the others, revised after the measurement).
- [ ] `js-yaml` 4.3.2 and `@types/js-yaml` as dev dependencies (already in the tree through
  electron-builder; the workflow test parses YAML and must not depend on a transitive package).
- [ ] `tests/scripts/workflows.test.ts` reads every `.github/workflows/*.yml` and asserts:
  `pr.yml` has no `push` trigger, lists exactly the four `pull_request` types, skips drafts and
  has `cancel-in-progress: true` grouped by PR number; **no file uses `pull_request_target`**;
  every `uses:` is `owner/repo@<40 hex>`; every job that runs `npm run package` sets
  `MENKAR_FLAVOR_BUILD: menkar` and checks out with `fetch-depth: 0`; the only job with
  `contents: write` is `release.yml`'s `package`; the only job naming the `packages` environment
  is `publish.yml`'s. (Blocks 3 and 5 extend it as their files land.)
- [ ] `actionlint` clean.
- [ ] Ask `set` for the trial (§6 step 3): branch `ci/trial`, a draft PR. Check: **a draft runs
  nothing**; "Ready for review" runs the three jobs; a second push cancels the first run. Try
  `MENKAR_E2E_WORKERS` 1, 2 and 3 (the runner has 2 vCPUs and 8 GB): record wall time, peak memory
  (`free -m` in a background step every 10 s) and result for each, pick the fastest green, set it
  in `checks.yml`. Then `set` closes the PR and deletes the branch.
- [ ] `docs/toolchain.md`, new section "The hosted CI": what runs on a PR and on a tag, the
  pinned image, the measured table with its date and runner size, the base-ref variables, why no
  path filter and no `ubuntu-latest` (§2.9). "Local CI" in `AGENTS.md` stays until block 8.
- Verification: `npm run ci`; `actionlint`; the trial's run links and the table in the report.

### Block 3 — `release.yml` and `package.mjs --targets`

- [ ] `scripts/package.mjs`: `--targets deb,rpm` (default `deb`), passed to electron-builder;
  refuses an unknown target. Test: parsing cases.
- [ ] `scripts/check-package.mjs`: `--targets` likewise; the `.deb` path unchanged.
- [ ] `.github/workflows/release.yml` as §2.3: `verify` (uses `release-version.mjs`, and
  `git merge-base --is-ancestor` against `origin/main` or `origin/release/X.Y`), `checks`,
  `package`; the notes file is GitHub's generated notes (`gh release create --generate-notes`).
  Until block 4 is done, `--targets deb`.
- [ ] Workflow test extended for `release.yml`: triggered by `push: tags: ['v*']` only.
- [ ] Ask `set` for the trial: tag `v0.1.0` on the current `main`; check the draft holds
  `menkar_0.1.0_amd64.deb` and `SHA256SUMS`, that `dpkg-deb -f … Version` is
  `0.1.0-<count>.g<hash>` of the tagged commit, and `dpkg-deb -f … Package` is `menkar` (not the
  sandbox). A tag `v9.9.9` is refused by `verify`. Then `set` deletes the draft and both tags.
- Verification: `npm run ci`; `actionlint`; the trial's results in the report.

### Block 4 — the `.rpm`

- [ ] `electron-builder.yml`: an `rpm:` section, `depends` = electron-builder 26.18.0's default
  list plus `alsa-lib`, with the same comment as the `.deb`'s ALSA line.
- [ ] `scripts/check-package.mjs`: the `.rpm` checks of §2.6, reading with `rpm`/`rpm2cpio`; a
  recorded copy of its scripts and requires in `tests/data/package/rpm/`, with Vitest cases as
  the `.deb`'s (missing `alsa-lib` fails; an update feed fails; a Version without the revision
  fails).
- [ ] Build in a throwaway Ubuntu 24.04 container with `rpm` installed, from a clean clone in the
  scratchpad (`MENKAR_FLAVOR_BUILD=menkar npm run package -- --targets deb,rpm`); note the file
  name and size.
- [ ] In a throwaway `fedora:latest` container: `dnf install ./menkar-*.rpm` succeeds; `rpm -q
  menkar` shows the Version formula; `/usr/bin/menkar` resolves to `/opt/Menkar/menkar`;
  `chrome-sandbox` is `0755`; `menkar --version` under `xvfb-run` prints the version; `dnf remove
  menkar` takes `/opt/Menkar` and the link away. AppArmor is absent there: the post-install's
  profile branch is skipped without error.
- [ ] `release.yml`: `--targets deb,rpm`, `sudo apt-get install -y rpm` in `package`.
- [ ] `docs/packaging.md`: "The RPM" — depends, the post-install on SELinux and AppArmor
  systems, the container checks; the "AppImage first" paragraph per D4.
- Verification: `npm run ci`; the container transcripts (commands and exit codes) in a file in
  `$MENKAR_FILES`, named in the report.

### Block 5 — `publish.yml` and installing from the repository (after D1 and §6 steps 4–8)

- [ ] `.github/workflows/publish.yml` as §2.3: `on: release: types: [published]` and
  `workflow_dispatch` with a `tag` input; `if: !github.event.release.prerelease`; job
  `environment: packages`, `permissions: { contents: read, id-token: write }`; download, verify
  `SHA256SUMS`, then `cloudsmith push deb <workspace>/menkar/any-distro/any-version <deb>` and
  `cloudsmith push rpm <workspace>/menkar/any-distro/any-version <rpm>` through the official
  action with OIDC (or the API key in the environment).
- [ ] Workflow test extended: `publish.yml` names the `packages` environment, has no `push` or
  `pull_request` trigger, and asks no `contents: write`.
- [ ] `docs/packaging.md`, "Installing from the repository": the manual APT setup (the key to
  `/usr/share/keyrings/menkar-archive-keyring.gpg` with `gpg --dearmor`, one `deb [signed-by=…]`
  line in `/etc/apt/sources.list.d/menkar.list`, `apt update && apt install menkar`), the `dnf`
  equivalent (`rpm --import`, a `.repo` file, `dnf install menkar`), the fingerprint and expiry
  from §6 step 8, and the single-file fallback (`/tmp` or `dpkg -i` + `apt -f install`). **The
  manual commands, not `curl … | sudo bash`**: a reader sees what is added to their system.
  The 200 GB limit and its trigger; Cloudsmith's download logs.
- [ ] If plan 46 has landed: the same commands between the markers in
  `site/src/content/docs/install.md` and `site/src/content/docs/es/install.md` (§2.8), then
  `npm run site:check`.
- [ ] `docs/release-checklist.md`, "1. Install": from the draft's `.deb` (download, `apt install
  /tmp/…`), and a new last step: after Publish, on a clean Ubuntu 24.04 container, the repository
  setup from `docs/packaging.md` then `apt install menkar` with no signature warning; the same on
  Fedora with `dnf`.
- [ ] `docs/NOT_BUILT_YET.md`: "A self-hosted package repository" (trigger: the plan's limits are
  reached, the plan ends, or the download logs become a concern).
- Verification: `npm run ci`; `actionlint`. The first real run is `v1.0.0` (§7).

### Block 6 — contributing, templates, README

- [ ] `CONTRIBUTING.md`: fork, a branch from `main`, `npm ci`, `npm run ci` (and `npm run
  ui-check` for anything seen), commits with `git commit -s` and what the sign-off certifies
  (the DCO 1.1 text, linked to developercertificate.org), a draft PR, "Ready for review" when it
  should be checked, English everywhere; no CLA.
- [ ] `.github/CODEOWNERS`: `* @hernancontigiani`.
- [ ] `.github/ISSUE_TEMPLATE/bug.yml` (version from About, distribution, steps, expected, seen,
  the log path `~/.cache/menkar/menkar.log`), `feature.yml`, `config.yml` (blank issues off);
  `.github/pull_request_template.md` (what and why, how it was checked, the sign-off reminder).
- [ ] `README.md` "Install": from the repository (the commands from `docs/packaging.md`), the
  single file from `releases/latest` as fallback, the privacy line (§2.7), the Cloudsmith
  attribution; the site's link replaces the "small site" wording; building from source moves
  under "Development".
- Verification: `npm run ci`; the README's commands are the same text as `docs/packaging.md`'s.

### Block 7 — before going public: the audit and the public runner (after D6)

- [ ] On a fresh clone in the scratchpad: gitleaks (in a container, pinned) over the whole
  history; a list of absolute home paths, emails and anything resembling a token in tracked files
  and in every commit's metadata. Write it to `$MENKAR_FILES/menkar-t<N>-public-audit.md` for
  the human (§6 step 11). Fix nothing in the history; current files with a finding are fixed
  by a normal change if the human says so.
- [ ] After the human has made the repository public (§6 step 12) and before the rulesets:
  re-run the e2e measurement of block 2 on the 4-vCPU runner (2, 3, 4 workers), set the count,
  update the table in `docs/toolchain.md`.
- Verification: the audit file exists and the human has answered each item; `npm run ci`.

### Block 8 — model A and 1.0

- [ ] `AGENTS.md`: "Local CI" says the hosted CI is the gate on a PR and `npm run ci` the local
  one; "Git and the shared tree" for model A: `set` works on a branch and opens a PR, commits with
  `-s`, merges by the method of D7; workers still do not commit; the R10 rule per block 1. The
  old text to `docs/history/root/AGENTS.history.md`.
- [ ] `plans/00-STATUS.md` §1: rows for model A, the hosted CI, the release pipeline, D1–D7 with
  their dates; 1.5's "no hosted CI" and 1.85 marked superseded (their text to the history);
  topic 72 closed.
- [ ] `docs/NOT_BUILT_YET.md`: macOS (1.191: experimental, after 1.0; trigger: 1.0 is out),
  ARM (trigger: a user asks), and the AppImage if D4 = (a).
- [ ] The 1.0 commit, prepared for `set`: `package.json` and `package-lock.json` to `1.0.0`;
  `README.md` and `docs/release-checklist.md` name 1.0.0. `set` merges it by PR (the first under
  the rulesets) and the human tags (§6 step 17).
- Verification: `npm run ci`; after the human publishes, the release checklist's repository
  install passes on Ubuntu and Fedora containers and the site's Install page commands match
  `docs/packaging.md`.

## Execution log

(Written by the session that executes it.)
