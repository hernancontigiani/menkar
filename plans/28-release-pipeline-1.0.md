# Plan 28: going public at 1.0 — branches, GitHub CI, releases, packages, contributing

> **Status:** written 2026-11-19 (task 127) from the stub of 2026-11-10; **brought in line with
> the human's answers of 2026-11-19 (topic 72, §3) on 2026-11-20 (task 131)**. The repository is
> already public, the account is GitHub Free, and **until the first official release every
> workflow runs only by hand** (`workflow_dispatch`). Blocks 1–4 need nothing from the human;
> block 5 waits on the Cloudsmith set-up (§6 steps 4–8); blocks 6–7 are the first release (§7).
>
> **Comes from:** the stub written with the human on 2026-11-10; topic 72 (the APT and RPM
> service, and the answers of 2026-11-19); decision 1.189 (the public site, built under `site/`,
> `docs/site.md`); decision 1.190 (no native Windows).
>
> **Exit, when executed:**
> - `CONTRIBUTING.md` (new): fork, branch from `main`, `npm run ci`, a draft PR, "Ready for
>   review", the DCO sign-off.
> - `.github/` (new files beside the existing `dependabot.yml`): `workflows/checks.yml`, `pr.yml`,
>   `release.yml`, `publish.yml`; `CODEOWNERS`; `ISSUE_TEMPLATE/bug.yml`, `feature.yml`,
>   `config.yml`; `pull_request_template.md`.
> - `docs/packaging.md`: the formats (.deb, .rpm), the version at a tag, the release pipeline
>   (tag → draft → checklist → publish → the package service), installing from the repository
>   (the commands, source of truth for the site's Install page), and what was rejected (§2.9).
> - `docs/toolchain.md`: "The hosted CI" — the workflows, by hand until the first release then on
>   a PR and on a tag, the runner, the e2e workers measured there, the base-ref variables, the
>   release notes from `CHANGELOG.md`; the "Local CI" paragraph's "no hosted CI" at the first
>   release.
> - `docs/release-checklist.md`: checks the draft release's assets, not a local build; install
>   from the repository; the step that publishes.
> - `README.md`: "Install" for the `.deb` and the `.rpm` (the repository, the single file as
>   fallback; no other platform, 1.190), a link to the site and to `releases/latest`; the "small
>   site" wording goes.
> - `AGENTS.md`: "Local CI" and "Git and the shared tree" for model A (branches, PRs, `-s`), in
>   the first-release block only.
> - `CHANGELOG.md` (new, at the first release): one section per version, the release notes' only
>   source; written by `set` and approved by the human (`AGENTS.md`).
> - `plans/00-STATUS.md` §1: 1.5's "no hosted CI" and 1.85 superseded by the new rows; the
>   decisions of §3 as rows with their dates; topic 72 closed.
> - `docs/NOT_BUILT_YET.md`: ARM, the AppImage (D4), a self-hosted repository. Native Windows is
>   already there (1.190); macOS is decision 1.191's row until taken up.
> - Superseded text (1.5, 1.85, the "no hosted CI" sentences, the checklist's local-build
>   install) leaves verbatim for `docs/history/` in the same change; the README's old install
>   text goes to `git log` (README is not a decision document).
> - The rest → `git log`.

## 1. Decided, used as given

From the stub (the human, 2026-11-10), as amended by §3 (2026-11-19):

- **Public on GitHub**, `git@github.com:hernancontigiani/menkar.git`: the repository is already
  public and the account is GitHub Free (§3).
- **Model A**: `main` is the development line and the default branch; all work on a branch
  (`feature/…`, `fix/…`) entering `main` by a pull request; `main` protected, no merge without
  green CI. **Releases are tags** `vX.Y.Z`; a fix for an older version goes on `release/X.Y` cut
  from its tag.
- **GitHub Actions from 1.0**, replacing 1.5's "no hosted CI" once branches are in place; until
  then `npm run ci` stays the local gate. **No run on push to a branch**; the PR workflow listens
  to `pull_request` (`opened`, `synchronize`, `reopened`, `ready_for_review`), skips drafts,
  `concurrency` with `cancel-in-progress` per PR. It runs `npm run ci` and the e2e (one Xvfb per
  worker) on Linux.
- **Until the first official release every workflow triggers only by hand** (§3, D5 replaced):
  the workflows are written now, `on: workflow_dispatch` alone; no push, PR or tag trigger and no
  trial PR. The team keeps committing to `main`. Turning the triggers on, and model A with them,
  is a step of the first release (block 7).
- **The release workflow** builds from a `v*` tag: the full suite, the packages, a GitHub Release
  with them attached. Linux x64 on one Ubuntu runner, **`.deb` and `.rpm` only**: no AppImage
  (D4), no Windows (1.190), macOS experimental after 1.0 (1.191), no Flatpak or Snap. Until the
  first release it is started by hand with the tag as input; from then on the tag's push starts it.
- **Release notes: `CHANGELOG.md` is the one source** (§3): the release workflow copies the
  version's section into the GitHub Release.
- **Distribution**: GitHub Releases for the binaries; the site on GitHub Pages (`docs/site.md`); no
  in-app update check.
- **Contributing**: `CONTRIBUTING.md`, issue templates (bug, feature), a PR template, **DCO**
  rather than a CLA.
- **Who may merge**: two rulesets on `main` — "CI green" (required checks, no bypass) and
  "Review" (1 approving review from a code owner, `CODEOWNERS` = the maintainer for `*`, bypass:
  the repository admin role).
- **An APT repository and an RPM one on Cloudsmith** (D1), on its free open-source plan; the
  release uploads each published tag's `.deb` and `.rpm` there; the single downloaded file stays
  documented as the fallback; a self-hosted bucket is the later option. GitHub Pages cannot host
  it: the `.deb` of 0.1.0-387 is 102,659,364 bytes, above Pages' 100 MB file limit (checked by
  `set`).
- **Dependabot** is on (§3): version updates from `.github/dependabot.yml` (npm and GitHub
  Actions, weekly), alerts and security updates in the repository's settings. Until the triggers
  are on, its PRs run no workflow.
- **The site** (1.189) is built and owned apart (`site/`, `docs/site.md`). The boundary agreed
  with `menkar-t128` on 2026-11-19 is in §2.8.

## 2. Goal, what exists, and the design

### 2.1 Goal

At 1.0 a stranger can install Menkar with `apt install menkar` (or `dnf install menkar`), get
updates with `apt upgrade`, and send a pull request that is checked by the same gate the team
uses; the maintainer cuts a release by pushing a tag and pressing Publish after the checklist.
Until then the workflows exist and can be run by hand, and nothing runs on its own.

### 2.2 What exists in the tree (verified 2026-11-20)

- `electron-builder.yml`: `linux.target` is `deb` x64 only; `publish: null`; `deb.depends` adds
  `libasound2t64 | libasound2`. No `rpm` section.
- `scripts/package.mjs`: computes `debianRevision` (`<count>.g<hash>[.dirty.<UTC>]`) from
  `git rev-list --count HEAD` and hands it as `buildNumber`; takes the flavour from
  `out/main/flavor.txt` (`packageFlavour`, `--flavour` only as a check) and the builder config
  from `BUILDER_CONFIG`; runs `electron-builder --linux deb --x64`. **It needs the full
  history**: a shallow clone counts 1 commit.
- `electron.vite.config.ts`: the flavour comes from the branch unless `MENKAR_FLAVOR_BUILD` is
  set (`resolveBuildFlavor`); **a tag checkout is a detached HEAD and builds `sandbox`**
  (`docs/packaging.md`). `ui-check` sets `MENKAR_FLAVOR_BUILD=menkar`; `npm run package` does not.
- `scripts/ci.mjs`: Biome, tsc, Vitest (`CI=1`), "R10 unchanged" (compares with the local branch
  `main`; skipped when `HEAD` is `main`), code rules, i18n, test integrity, flaky quarantine,
  history.
- `scripts/check-test-integrity.mjs`: baseline `MENKAR_TEST_BASELINE` or `git merge-base main
  HEAD` — **a local branch `main`, absent in an Actions checkout of anything else** (only
  `origin/main` after a full fetch).
- `scripts/nothing-lost.mjs`: compares the tree with `HEAD` only — **on a clean CI checkout it
  checks nothing**: a PR that drops a decision line without its history passes.
- `scripts/check-package.mjs`: reads the `.deb` with `dpkg-deb` (`--flavour menkar|sandbox`);
  checks the Version is `<package.json version>-<commits>.g<hash>[.dirty.<time>]`. Nothing reads
  an `.rpm`. Its recorded inputs are in `tests/data/package/`.
- `playwright.config.ts`: `MENKAR_E2E_WORKERS` (4 by default), `retries: 0`, `forbidOnly`.
  `e2e/display.ts` starts one Xvfb per worker; `xvfb-run -a` wraps the run.
- electron-builder 26.18.0 (`app-builder-lib/out/targets/FpmTarget.js:68`) uses **the same
  `after-install.tpl` for `deb` and `rpm`**, so the AppArmor profile and `update-alternatives`
  steps run on RPM systems too; its default `rpm` depends (`linuxOptions.d.ts:100`) has **no
  ALSA** — the same gap the `.deb` had.
- `.github/dependabot.yml` exists (npm grouped minor-and-patch, GitHub Actions; weekly). No
  workflow, no `CONTRIBUTING.md`, no `CODEOWNERS`, no `CHANGELOG.md`.
- The `multi-agent` branch is alive (plan 39, P1a next), so R10's rule holds (§2.4).
- `rpmbuild` is not installed on the human's machine; `docker` is.
- 55 e2e spec files; the suite takes 4–5 minutes locally (107 s at 4 workers was measured on
  2026-11-10 with 260 tests, `docs/toolchain.md`).

### 2.3 The workflows

Four files, so a PR and a tag run the same checks from one place. **Until the first release each
has `workflow_dispatch` as its only trigger** (`checks.yml` is also callable, `workflow_call`,
which is not a trigger: it runs only when another workflow calls it). Each is written so that
turning its trigger on in block 7 adds lines to `on:` and changes nothing else:

- **`checks.yml`** (`on: workflow_call`, inputs `ref` — what to check out, empty for the
  caller's — and `base` — a commit or remote ref the base-diff checks compare against): three jobs
  on `ubuntu-24.04` (pinned, not `ubuntu-latest`, so an image switch is a change we make):
  - **`ci`**: `actions/checkout` with `ref` and `fetch-depth: 0`; `actions/setup-node` with
    `node-version: 22` and npm cache; `npm ci`; then, with
    `MENKAR_TEST_BASELINE=$(git merge-base <base> HEAD)`, `MENKAR_HISTORY_BASE=<same>`,
    `MENKAR_R10_BASE=<base>`: `npm run ci`.
  - **`e2e`**: the same set-up plus `sudo apt-get install -y xvfb xauth` and the Electron
    libraries the image lacks; `npm run ui-check` with `MENKAR_E2E_WORKERS` unset (4, the
    public runner's vCPUs) until block 7 measures it; on failure, upload `test-results/` as an
    artifact (7 days).
  - **`dco`**: every commit in the range `<base>..HEAD` (excluding merges) has a `Signed-off-by:`
    line matching its author's email; a script of ours, `scripts/check-dco.mjs`, with a Vitest
    test — no third-party GitHub App, so nothing is installed on the account.
- **`pr.yml`**: today `on: workflow_dispatch` with an input `base` (default `main`): checks the
  branch it is run on against `origin/<base>`. Block 7 adds `pull_request` with the four types;
  the job already carries `if: github.event_name != 'pull_request' ||
  !github.event.pull_request.draft`, `concurrency: { group: pr-${{
  github.event.pull_request.number || github.ref }}, cancel-in-progress: true }`, `permissions:
  contents: read`, and calls `checks.yml` with `base: origin/${{ github.base_ref || inputs.base
  }}`. The required checks are its three jobs (`checks / ci`, `checks / e2e`, `checks / dco`).
- **`release.yml`**: today `on: workflow_dispatch` with a required input `tag`; every step reads
  `TAG: ${{ inputs.tag || github.ref_name }}`, so block 7's `push: tags: ['v*']` needs no other
  change. Jobs:
  1. **`verify`**: the tag is `v` + `package.json`'s version at the tagged commit
     (`scripts/release-version.mjs`, refused otherwise); the tagged commit is reachable from
     `origin/main` or from `origin/release/X.Y` (refused otherwise); `CHANGELOG.md` at the tag
     has a non-empty section for the version (`scripts/release-notes.mjs`, refused otherwise).
  2. **`checks`**: `checks.yml` with `ref` and `base` = the tag — the code was gated before it
     reached `main`; here the suite proves the tagged tree, and the base-diff checks (integrity,
     history, R10, DCO) have nothing to compare, by design.
  3. **`package`** (needs both): checkout of the tag with `fetch-depth: 0`;
     `MENKAR_FLAVOR_BUILD=menkar`; `sudo apt-get install -y rpm`; `npm run package -- --targets
     deb,rpm`; `npm run package:check -- --targets deb,rpm`; `npm run package:smoke`; `sha256sum`
     into `SHA256SUMS`; the version's `CHANGELOG.md` section into a notes file; `gh release
     create "$TAG" --draft --verify-tag --title "Menkar X.Y.Z" --notes-file <notes>` with the
     `.deb`, the `.rpm` and `SHA256SUMS`. `permissions: contents: write` on this job only.
- **`publish.yml`**: `on: workflow_dispatch` with a `tag` input; block 7 adds `release: types:
  [published]`, skipped for a prerelease. Downloads the release's assets with `gh release
  download`, verifies `SHA256SUMS`, and pushes the `.deb` and `.rpm` to Cloudsmith with its
  official action. Its upload credential (OIDC, or an API key as fallback) is reachable only from
  a GitHub **environment** `packages` whose only allowed ref is tags `v*`, so no PR workflow can
  reach it.

**Why a draft and a second workflow:** `docs/release-checklist.md` says a build is a version only
after the human's checks pass on a real desktop. The draft is the candidate; the human checks the
draft's own `.deb` (the bytes that will ship, not a local build of the same commit); Publish is
the act that makes it a version, and only then does the APT repository get it. A Release that the
`GITHUB_TOKEN` creates would not trigger another workflow, but the human pressing Publish does.
A candidate that fails is deleted with its tag and the same version is tagged again (D3).

**Fork PRs:** `pull_request` from a fork runs with a read-only token and no secrets; the PR
checks need neither. `pull_request_target` is never used.

**The test that holds "by hand only"** (`tests/scripts/workflows.test.ts`, block 2): every file
under `.github/workflows/` has, as its `on:` keys, only `workflow_dispatch` and `workflow_call`.
Case: a `pr.yml` with `pull_request` added fails, naming the file and the trigger. Block 7 replaces
this assertion with the triggers of §1.

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
the `multi-agent` branch does (`docs/toolchain.md`), and that branch is alive (§2.2), so block 1
builds `MENKAR_R10_BASE`. **Block 7 settles R10 for model A**: if the branch has merged for good,
the step and its rule leave for their history; if not, `pr.yml` sets `MENKAR_R10_BASE` only for
the `multi-agent` head and skips the step for any other.

### 2.5 The version at 1.0

Today (1.45): `package.json` is `0.1.0`; the `.deb`'s Version is `0.1.0-<commits>.g<hash>`
(`.dirty.<UTC>` for an uncommitted tree); the file is `menkar_0.1.0_amd64.deb`. D2 keeps one scheme
for every build:

- **A release `X.Y.Z`** is one commit on `main` (or `release/X.Y`) that sets `package.json` and
  `package-lock.json` to `X.Y.Z` and adds `CHANGELOG.md`'s section for it, then the tag `vX.Y.Z`
  on it. The `.deb` is `X.Y.Z-<commits>.g<hash>` — the same formula as any local build of that
  commit — and the `.rpm` `X.Y.Z-<commits>.g<hash>` (fpm's `--iteration` gives the RPM Release;
  RPM forbids `-` there, and the revision has none). Files: `menkar_X.Y.Z_amd64.deb`,
  `menkar-X.Y.Z.x86_64.rpm` (confirmed by block 4's first build).
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
  commit itself (block 7).
- **The tests** (block 1): `debianRevision` gains no case. `releaseVersion(tag, version)`:
  `v1.0.0` + `1.0.0` → `1.0.0`; `v1.0.0` + `0.1.0` → refused; `v1.0` → refused; `1.0.0` (no `v`)
  → refused; `v1.0.0-rc.1` → refused (D3 has no rc tags). `releaseNotes(changelog, version)`: the
  body under `## 1.0.0` (or `## [1.0.0]`, with anything after the version on that line) up to the
  next `## ` heading, trimmed; refused when the section is missing or empty; `## 1.0.0` does not
  match `## 1.0.01` or `## 11.0.0`.

### 2.6 RPM

- `electron-builder.yml` gains an `rpm:` section with `depends` = electron-builder's default list
  plus **`alsa-lib`**, the ALSA library the `.deb` already needed; `linux.target` stays `deb`, and
  `package.mjs --targets deb,rpm` passes the targets on electron-builder's command line (default
  `deb`, so the human's local `npm run package` needs no `rpmbuild`).
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
projects**, which settled the stub's choice in practice; the human chose Cloudsmith (D1, §3).

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

**Cloudsmith (D1)**, with what it costs said plainly:

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
16 GB on a public repository, free
(https://docs.github.com/en/actions/reference/runners/github-hosted-runners,
https://docs.github.com/en/billing/concepts/product-billing/github-actions). Rulesets and Pages
work on a public repository on GitHub Free
(https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets,
https://docs.github.com/en/get-started/learning-about-github/githubs-plans). A Release asset may
be up to 2 GiB, with no limit on total size or bandwidth
(https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).

### 2.8 The boundary with the site (agreed with `menkar-t128`, 2026-11-19)

- **The site's work owns** `site/` whole, `.github/workflows/docs.yml`, the domain, and every page,
  including the Install page's text in English and Spanish.
- **Plan 28 owns** `release.yml`, `publish.yml`, `pr.yml`, `checks.yml`, the packages and their
  asset names, the package service and its key, `CONTRIBUTING.md`, and replaces README's "small
  site" wording with a link to the site.
- **The site links the latest release only as `https://github.com/hernancontigiani/menkar/releases/latest`**,
  so a release never needs a site change.
- **The install commands' source of truth is `docs/packaging.md`** ("Installing from the
  repository", block 6). The site is built (2026-11-20), so block 6 also fills the pending
  blocks in `site/src/content/docs/start/install.md` and `site/src/content/docs/es/start/install.md` —
  only between the markers `<!-- plan 28: apt commands -->` … `<!-- /plan 28 -->` and `<!-- plan
  28: rpm commands -->` … `<!-- /plan 28 -->`, nothing else on the page — and runs `npm run
  site:check -- --release`. The site check fails a page still holding a `plan 28:` marker only
  with `--release`.
- **The site's check in the PR workflow**: the site landed first (2026-11-20), so this plan adds a
  `site` job to `pr.yml` (path filter `site/**`, `npm run site:check`). **It is not a required
  check**: a required check that a path filter skips stays pending and blocks the merge.
- **The first Pages deploy** is a step of block 7 (the first release): Pages works from this
  public repository on Free.

### 2.9 Rejected, and why

- **Path filters on the required PR jobs** (the stub's "optional"): a required check skipped by
  a path filter stays "Expected — waiting" and the PR cannot merge. A docs-only PR runs the full
  checks; at the PR volume of a single maintainer that is cheaper than a filter job to maintain.
- **`ubuntu-latest`**: the label moves to a new Ubuntu without a change in the tree; pinning
  `ubuntu-24.04` makes the move a reviewed PR.
- **A DCO GitHub App** (probot/dco): one more app with access to the repository; a short script
  with a test does the same.
- **`pull_request_target`**: it runs fork code with the base's secrets; the PR checks need none.
- **Uploading to the package service from the tag workflow directly**: the APT repository would
  carry a build the human has not checked; `apt upgrade` would deliver it to every user.
- **GitHub Pages as the APT repository**: the 100 MB file limit (§1).
- **A `-dev` or `-rc` upstream version on `main`**: dpkg sorts `1.0.0~rc1` before `1.0.0` only
  with `~`, which RPM spells differently; the commit revision already orders every build with no
  second scheme (D2, D3).
- **A tag-specific version (`X.Y.Z-1`)** (D2): a tag branch in `package.mjs`, and a local build of
  the same commit would carry another Version than the shipped one.
- **Candidate tags `vX.Y.Z-rc.N`** (D3): the final tag rebuilds the same commit, so the shipped
  bytes are a rebuild, not the ones checked. **Burning a failed candidate's number** (D3): version
  gaps for no user's benefit, since nobody installed the deleted draft.
- **Rebase or merge commits into `main`** (D7): rebase lands more commits per change; merge
  commits stop the history being linear, which `debianRevision`'s commit count assumes.
- **Buildkite Package Registries** (packagecloud's successor, D1): 1 GB a month free, which a
  single release exhausts. **Self-hosting the repository now** (D1): a bill, a domain and the
  signing key in our hands; it stays the later option (`docs/NOT_BUILT_YET.md`).
- **The AppImage at 1.0** (D4): it cannot install the AppArmor profile, so on Ubuntu 24.04 it
  starts only with `--no-sandbox`, which `README.md`'s promise of a sandboxed app rules out.
- **A trial PR and a throwaway release tag before 1.0** (D5 replaced): nothing runs on its own
  until the first release; each workflow's pieces are scripts tested by Vitest and the package
  steps are reproduced in containers (block 4), and block 7 runs `pr.yml` by hand before the
  triggers go on. The first run of `release.yml` is the `v1.0.0` candidate, whose draft is
  harmless until Publish.
- **A gitleaks step in `release.yml`**: by the time a tag exists its commits are already pushed
  to the public repository, so a scan at release time reports a leak only after it happened. The
  whole history was scanned on 2026-11-19 (D6, two false positives, test fixtures); a scan earns
  its place before a push, not after.
- **GitHub's generated release notes**: the human decided `CHANGELOG.md` is the one source (§3).

## 3. Decisions of the human

**The human, 2026-11-19 (topic 72):**
- **The repository is already public**: `github.com/hernancontigiani/menkar` answers as public
  (checked by `set` through the GitHub API, 2026-11-19). **The account is GitHub Free.** Actions
  on a public repository have free standard runners, and Pages publishes from it.
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
  before pushing the 160 local commits (2026-11-19). **Done**: `set` ran it on 2026-11-19 and
  found two false positives, both test fixtures.
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

What each decision means, as the blocks build it:

- **D1. Cloudsmith, open-source visibility, upload by OIDC** (§2.7): the attribution line, users'
  sources naming `dl.cloudsmith.io`, download logs held by Cloudsmith, an API key in the
  `packages` environment only if OIDC is not offered on the free plan.
- **D2. The same formula as any build**: tag `vX.Y.Z`, `package.json` `X.Y.Z`, package
  `X.Y.Z-<commits>.g<hash>` (§2.5). Local builds keep 1.45.
- **D3. Draft → the human's checklist on the draft's own files → Publish**; a failed candidate's
  draft and tag are deleted, the fix goes in (by PR once model A is on), and the same version is
  tagged again on the new commit.
- **D4. The AppImage is deferred** to `docs/NOT_BUILT_YET.md`, trigger: a user on a distribution
  with neither APT nor RPM asks.
- **D7. Squash merge only**, with "Require linear history" in the "CI green" ruleset, the squash
  message defaulting to the PR's title and commit details (which carry each commit's
  `Signed-off-by:`): one commit per PR on `main`, the count still grows by one per merge.

## 4. Out of scope

- The site (`docs/site.md`), its workflow and its domain; the page that shows `CHANGELOG.md`.
- Windows (1.190: not built, in `docs/NOT_BUILT_YET.md`; no WSL2 promise), macOS (1.191:
  experimental, after 1.0; signing it would need an Apple Developer account), ARM, Flatpak, Snap,
  the AppImage (D4).
- Signing the `.deb` itself (`dpkg-sig`): the repository's signed `InRelease` is what apt checks.
- Writing `CHANGELOG.md`'s sections: `set` drafts each, the human approves it (`AGENTS.md`); this
  plan only reads them.
- A secrets scan in any workflow (§2.9).
- An in-app update check (never: nothing leaves the machine).
- Self-hosting the repository.

## 5. Do not touch

- The human's GitHub account and repository settings: every setting is in §6 for the human. No
  session creates an account, a key, a secret, a ruleset, pushes, tags or runs a workflow.
- `.github/dependabot.yml`: the human's, as it is.
- `site/` and `docs.yml` beyond §2.8's markers.
- `electron-builder.sandbox.yml` and the sandbox flavour: the sandbox is never released, and
  `package.mjs --flavour sandbox` keeps building the `.deb` alone.
- The `.deb`'s contents, post-install, profile and depends: `package:check` stays green with no
  change to its `.deb` assertions.
- How `set` commits today (directly on `main`, 1.5/1.85) until block 7.

## 6. What the human does by hand

No session does any of these: each is the human's, on their own accounts. A block that needs one
says so and waits.

**Before any workflow is run by hand (block 7, or earlier if the human wants a run):**

1. Repository → Settings → Actions → General:
   - Actions permissions: "Allow hernancontigiani, and select non-hernancontigiani actions",
     listing `actions/checkout@*`, `actions/setup-node@*`, `actions/upload-artifact@*`,
     `actions/download-artifact@*` and `cloudsmith-io/cloudsmith-cli-action@*`.
   - Workflow permissions: **Read repository contents** (the default token is read-only; the
     release job asks for `contents: write` itself).
   - "Allow GitHub Actions to create and approve pull requests": **off**.
   - Fork pull request workflows: **Require approval for all external contributors**.

**For block 5 (Cloudsmith):**

> **Recorded (the human, 2026-11-23):** workspace `menkar`; repository `menkar-packages` (the slug
> `menkar` stayed reserved after a first, private repository was deleted), created as a Broadcast
> with visibility Open source, licence GNU GPL v3.0 or later, project URL the GitHub repository.
> Service account `sa-menkar` (Write on `menkar-packages`); OIDC provider `github-actions`
> (`https://token.actions.githubusercontent.com`, claims `repository` = `hernancontigiani/menkar`,
> `environment` = `packages`); an API key is also stored as `CLOUDSMITH_API_KEY` in the `packages`
> environment, to be deleted once OIDC is seen to work. GPG key (Cloudsmith provided), fingerprint
> `4D80 2D23 F528 B669 95C6  529D 32B2 97F2 B56D 38CD`; its expiry is not shown in the web app, so
> block 5 reads it from the public key (`gpg --show-keys`).

2. Create a Cloudsmith account with two-factor authentication, and a workspace for Menkar.
3. Create a repository `menkar`, visibility **Open Source**, licence GPL-3.0-or-later, project
   URL the GitHub repository, accepting the open-source hosting terms.
4. Create a **service account** with push rights on that repository only, and an **OIDC
   provider** for `https://token.actions.githubusercontent.com` whose claims require
   `repository = hernancontigiani/menkar` and `environment = packages`. Tell `set` the
   workspace slug, the service account's slug and the provider's namespace (none is a secret).
   If OIDC is not offered, create an API key for the service account instead (step 5).
5. GitHub → repository → Settings → Environments → **`packages`**: deployment branches and tags
   = "Selected", tag pattern `v*`. Only with the API-key fallback: a secret `CLOUDSMITH_API_KEY`
   in this environment.
6. From the Cloudsmith repository's page: the GPG key's fingerprint and the expiry of the key and
   of each subkey; tell `set` (they go in `docs/packaging.md`), and put a reminder 60 days before
   the first expiry.

**At the first release (block 7):**

7. GitHub → Settings → Rules → a **tag ruleset** on `v*`: restrict creation, update and deletion,
   with the repository admin role in the bypass list (D3 deletes a failed candidate's tag).
8. GitHub → Settings → General → Pull Requests: allow **squash merging** only, default message
   "Pull request title and commit details"; "Automatically delete head branches" on.
9. Turn on "Keep my email addresses private" and use the no-reply address for new commits.
10. Actions → `pr` → Run workflow on `main` (block 7's measurement), once each worker count block
    7 names; tell `set` the run links.
11. Settings → Rules → **"CI green"** on the default branch: require a pull request; required
    status checks `checks / ci`, `checks / e2e`, `checks / dco`, from GitHub Actions; require
    linear history; block force pushes; restrict deletions; **no bypass**. (Only after the
    triggers are on: a required check that never runs blocks every merge.)
12. Settings → Rules → **"Review"** on the default branch: 1 approving review, require review
    from Code Owners, dismiss stale approvals on new commits; **bypass list: Repository admin**.
13. Settings → Pages → Source: **GitHub Actions**; then Actions → `docs` → Run workflow (the
    site's first deploy).
14. Verify the two rulesets (the stub's check): a throwaway PR of yours merges green with no
    review and is refused while red; a PR from a second account is refused until you approve.
    Close and delete both.
15. Approve `CHANGELOG.md`'s 1.0.0 section; when `set` has merged the 1.0 commit: push the tag
    `v1.0.0` (or ask `set` to), run `docs/release-checklist.md` on the draft's files, and press
    **Publish release**.

## 7. Order

| When | What | Blocks | Needs |
|---|---|---|---|
| **Now** | The base-ref variables, the DCO check, the release version and notes | 1 | nothing from the human |
| **Now** | `checks.yml` and `pr.yml`, by hand only, checked with `actionlint` and the workflow test | 2 | nothing from the human; nothing is run on GitHub |
| **Now** | `package.mjs --targets`, `release.yml` by hand only | 3 | nothing from the human |
| **Now** | The `.rpm` built, checked and installed in a Fedora container | 4 | nothing from the human |
| **When the human sets up Cloudsmith** | `publish.yml` by hand only, the install commands | 5 | §6 steps 2–6 |
| **At the first release** | `CONTRIBUTING.md`, templates, `CODEOWNERS`, README | 6 | block 5 |
| **At the first release** | The measured run by hand, the triggers on, model A, R10 settled, the decision rows, rulesets, Pages, `CHANGELOG.md`, the 1.0 commit and tag | 7 | §6 steps 1, 7–15 |

Nothing before block 7 runs on GitHub: blocks 1–5 leave files in the tree that `set` pushes, and
the workflows sit unused until the human runs one or block 7 turns their triggers on. The first
upload to Cloudsmith is `v1.0.0` itself; `publish.yml`'s `workflow_dispatch` with a `tag` input
re-runs a failed upload without a new tag.

## 8. Execution blocks

Every block ends with `npm run ci` green, reported with its output. Every new test is seen to fail
once against a defect put in on purpose. **No session pushes, tags, runs a workflow, or changes a
GitHub setting**: where a block needs one, it asks `set`, who acts only when the human has asked
(1.85). Workflow files are checked locally with `actionlint` in a container
(`docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:<pinned version>`), since nothing
runs them before block 7. Every `uses:` is pinned to a full commit SHA with its version in a
comment (Dependabot's `github-actions` updates keep them current).

### Block 1 — the checks that compare against a base, the DCO check, the release version and notes

- [ ] `scripts/nothing-lost.mjs`: `MENKAR_HISTORY_BASE` — when set, every comparison made against
  `HEAD` (the diff, `cat-file -e`, `show`) is made against that commit. Test
  (`tests/scripts/nothing-lost.test.ts`): in a temporary repository, base commit holds a decision
  line, a later commit removed it, the tree = `HEAD` → passes unset, **fails with the variable set
  to the base**; with the line added to its history mirror → passes.
- [ ] `scripts/ci.mjs`, R10: `MENKAR_R10_BASE` (unset = `main`, as today; set = compare with that
  ref, and the "on `main`" skip applies only when unset), with a test in the same
  temporary-repository style. The rule's settlement for model A is block 7's (§2.4).
- [ ] `scripts/check-dco.mjs` (new) with `.d.mts`: given `<base>` (argument) and `HEAD`, every
  non-merge commit in `base..HEAD` carries `Signed-off-by: <name> <email>` whose email is the
  commit's author email; prints each failing commit's short hash and subject. Test
  (`tests/scripts/check-dco.test.ts`): signed → passes; unsigned → fails naming it; signed with
  another email → fails; a merge commit unsigned → ignored; an empty range → passes.
- [ ] `scripts/release-version.mjs` (new) with `.d.mts`: `releaseVersion(tag, version)` returns
  the version or throws our sentence; run as a script with the tag, it reads `package.json`.
  Test cases as §2.5 lists.
- [ ] `scripts/release-notes.mjs` (new) with `.d.mts`: `releaseNotes(changelog, version)` returns
  the section's body or throws our sentence; run as a script with the version and an output
  path, it reads `CHANGELOG.md` and writes the notes. Test cases as §2.5 lists.
- [ ] `docs/toolchain.md`: the three variables in "The checks in `npm run ci`".
- Verification: `npm run ci`; each new test seen red once.

### Block 2 — `checks.yml` and `pr.yml`, by hand only

- [ ] `.github/workflows/checks.yml` and `pr.yml` exactly as §2.3 describes, `pr.yml` with
  `workflow_dispatch` as its only trigger; `timeout-minutes` on each job (30 for e2e, 15 for the
  others, revised in block 7).
- [ ] `js-yaml` and `@types/js-yaml` as exact-pinned dev dependencies (`js-yaml` is already in
  the tree through electron-builder; the workflow test parses YAML and must not depend on a
  transitive package).
- [ ] `tests/scripts/workflows.test.ts` reads every `.github/workflows/*.yml` and asserts: **every
  file's `on:` keys are only `workflow_dispatch` and `workflow_call`** (§2.3's case); `pr.yml`'s
  job skips a draft PR and has `cancel-in-progress: true` grouped by PR number or ref; **no file
  uses `pull_request_target`**; every `uses:` of another repository is `owner/repo@<40 hex>`;
  every job that runs `npm run package` sets `MENKAR_FLAVOR_BUILD: menkar` and checks out with
  `fetch-depth: 0`; the only job with `contents: write` is `release.yml`'s `package`; the only job
  naming the `packages` environment is `publish.yml`'s. (Blocks 3 and 5 extend it as their files
  land.)
- [ ] `actionlint` clean.
- [ ] `docs/toolchain.md`, new section "The hosted CI": the workflows and what each runs, **by
  hand only until the first release**, the pinned image, the base-ref variables, why no path
  filter and no `ubuntu-latest` (§2.9). The measured worker table comes with block 7. "Local CI"
  in `AGENTS.md` stays until block 7.
- Verification: `npm run ci`; `actionlint`.

### Block 3 — `package.mjs --targets` and `release.yml`

- [ ] `scripts/package.mjs`: `--targets deb,rpm` (default `deb`), passed to electron-builder;
  refuses an unknown target and `rpm` with `--flavour sandbox`. Test: parsing cases.
- [ ] `scripts/check-package.mjs`: `--targets` likewise; the `.deb` path unchanged.
- [ ] `.github/workflows/release.yml` as §2.3: `workflow_dispatch` with the `tag` input only;
  `verify` (`release-version.mjs`, `git merge-base --is-ancestor` against `origin/main` or
  `origin/release/X.Y`, `release-notes.mjs`), `checks`, `package`. Until block 4 is done,
  `--targets deb`.
- [ ] Workflow test extended for `release.yml`: the `tag` input is required; every job reads the
  tag through `inputs.tag || github.ref_name`.
- [ ] A local dry run of `verify`'s three commands against the current tree (`v0.1.0`, a
  `CHANGELOG.md` written in the scratchpad clone only): accepted; `v9.9.9` refused; a version
  without a section refused.
- Verification: `npm run ci`; `actionlint`; the dry run's output in the report.

### Block 4 — the `.rpm`

- [ ] `electron-builder.yml`: an `rpm:` section, `depends` = electron-builder 26.18.0's default
  list plus `alsa-lib`, with the same comment as the `.deb`'s ALSA line.
- [ ] `scripts/check-package.mjs`: the `.rpm` checks of §2.6, reading with `rpm`/`rpm2cpio`; a
  recorded copy of its scripts and requires in `tests/data/package/rpm/`, with Vitest cases as
  the `.deb`'s (missing `alsa-lib` fails; an update feed fails; a Version without the revision
  fails).
- [ ] Build in a throwaway Ubuntu 24.04 container with `rpm` installed, from a clean clone in the
  scratchpad (`MENKAR_FLAVOR_BUILD=menkar npm run package -- --targets deb,rpm`); note the file
  name and size; `package:check -- --targets deb,rpm` there.
- [ ] In a throwaway `fedora:latest` container: `dnf install ./menkar-*.rpm` succeeds; `rpm -q
  menkar` shows the Version formula; `/usr/bin/menkar` resolves to `/opt/Menkar/menkar`;
  `chrome-sandbox` is `0755`; `menkar --version` under `xvfb-run` prints the version; `dnf remove
  menkar` takes `/opt/Menkar` and the link away. AppArmor is absent there: the post-install's
  profile branch is skipped without error.
- [ ] `release.yml`: `--targets deb,rpm`, `sudo apt-get install -y rpm` in `package`.
- [ ] `docs/packaging.md`: "The RPM" — depends, the post-install on SELinux and AppArmor
  systems, the container checks; the AppImage paragraph per D4 (deferred).
- [ ] `docs/NOT_BUILT_YET.md`: "The AppImage" (D4: deferred; trigger: a user on a distribution
  with neither APT nor RPM asks).
- Verification: `npm run ci`; the container transcripts (commands and exit codes) in a file in
  `$MENKAR_FILES`, named in the report; containers stopped by their ID.

### Block 5 — `publish.yml` and installing from the repository (after §6 steps 2–6)

- [x] `.github/workflows/publish.yml` as §2.3: `workflow_dispatch` with a `tag` input only; job
  `environment: packages`, `permissions: { contents: read, id-token: write }`; download, verify
  `SHA256SUMS`, then `cloudsmith push deb <workspace>/menkar/any-distro/any-version <deb>` and
  `cloudsmith push rpm <workspace>/menkar/any-distro/any-version <rpm>` through the official
  action with OIDC (or the API key in the environment).
- [x] Workflow test extended: `publish.yml` names the `packages` environment and asks no
  `contents: write`.
- [x] `docs/packaging.md`, "Installing from the repository": the manual APT setup (the key to
  `/usr/share/keyrings/menkar-archive-keyring.gpg` with `gpg --dearmor`, one `deb [signed-by=…]`
  line in `/etc/apt/sources.list.d/menkar.list`, `apt update && apt install menkar`), the `dnf`
  equivalent (`rpm --import`, a `.repo` file, `dnf install menkar`), the fingerprint and expiry
  from §6 step 6, and the single-file fallback (`/tmp` or `dpkg -i` + `apt -f install`). **The
  manual commands, not `curl … | sudo bash`**: a reader sees what is added to their system.
  The 200 GB limit and its trigger; Cloudsmith's download logs.
- [x] The same commands between the markers in
  `site/src/content/docs/start/install.md` and `site/src/content/docs/es/start/install.md` (§2.8),
  then `npm run site:check -- --release`.
- [x] `docs/release-checklist.md`, "1. Install": from the draft's `.deb` (download, `apt install
  /tmp/…`), and a new last step: after Publish, on a clean Ubuntu 24.04 container, the repository
  setup from `docs/packaging.md` then `apt install menkar` with no signature warning; the same on
  Fedora with `dnf`.
- [x] `docs/NOT_BUILT_YET.md`: "A self-hosted package repository" (trigger: the plan's limits are
  reached, the plan ends, or the download logs become a concern).
- Verification: `npm run ci`; `actionlint`. The first real run is `v1.0.0` (block 7).

### Block 6 — contributing, templates, README (at the first release)

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

### Block 7 — the first release: the triggers on, model A, 1.0

- [ ] Add the `site` job to `pr.yml` (the site's build and `site:check`, Node 22.23.x), as §2.8 assigns to the plan that lands second; the site landed first (`set`, 2026-11-20).

- [ ] The measured run (§6 steps 1 and 10): the human runs `pr` by hand on `main` with
  `MENKAR_E2E_WORKERS` 2, 3 and 4 (a temporary input of `pr.yml`, or one commit per value, `set`'s
  call): record wall time, peak memory (`free -m` in a background step every 10 s) and result for
  each; pick the fastest green; set it in `checks.yml`; the table with its date and runner size in
  `docs/toolchain.md`; `timeout-minutes` revised.
- [ ] The triggers on: `pr.yml` gains `pull_request` with the four types; `release.yml` gains
  `push: tags: ['v*']`; `publish.yml` gains `release: types: [published]` with `if:
  !github.event.release.prerelease`. The workflow test's "by hand only" assertion becomes: `pr.yml`
  has no `push` trigger and lists exactly the four `pull_request` types; `release.yml` is
  triggered by `v*` tags and by hand; `publish.yml` has no `push` or `pull_request` trigger.
  `actionlint` clean.
- [ ] R10 for model A (§2.4): ask `set` whether `multi-agent` has merged for good; either the step
  and its rule leave for their history, or `pr.yml` sets `MENKAR_R10_BASE` only for that head and
  skips the step for any other.
- [ ] `AGENTS.md`: "Local CI" says the hosted CI is the gate on a PR and `npm run ci` the local
  one; "Git and the shared tree" for model A: `set` works on a branch and opens a PR, commits with
  `-s`, merges by squash (D7); workers still do not commit. The old text to
  `docs/history/root/AGENTS.history.md`.
- [ ] `docs/toolchain.md` "The hosted CI": on a PR and on a tag, no longer by hand only.
- [ ] `plans/00-STATUS.md` §1: rows for model A, the hosted CI, the release pipeline, the
  decisions of §3 with their dates; 1.5's "no hosted CI" and 1.85 marked superseded (their text
  to the history); topic 72 closed.
- [ ] `docs/NOT_BUILT_YET.md`: ARM (trigger: a user asks).
- [ ] The 1.0 commit, prepared for `set`: `package.json` and `package-lock.json` to `1.0.0`;
  `CHANGELOG.md` with its 1.0.0 section as `set` drafted it and the human approved it;
  `README.md` and `docs/release-checklist.md` name 1.0.0. `set` merges it by PR (the first under
  the rulesets, §6 steps 11–14) and the human tags (§6 step 15).
- Verification: `npm run ci`; `actionlint`; after the human publishes, the release checklist's
  repository install passes on Ubuntu and Fedora containers and the site's Install page commands
  match `docs/packaging.md`.

## Execution log

(Written by the session that executes it.)

### Blocks 1 and 2 — `menkar-t131` (task 131), 2026-11-20

Blocks 3 and 4 went to `packager` (task 132), which writes `release.yml` against the interfaces
below.

- **Block 1.** `nothing-lost.mjs`: `check(root, path, base)` and `main(paths, base)`, `base` from
  `MENKAR_HISTORY_BASE` (empty counts as unset). `ci.mjs`: the R10 comparison is
  `r10Problems(root, base)`, exported with `scripts/ci.d.mts`; the steps now run only when the file
  is executed, so a test can import it. With `MENKAR_R10_BASE` set, being on `main` skips nothing.
  New `check-dco.mjs`, `release-version.mjs`, `release-notes.mjs`, each with `.d.mts`. CLIs agreed
  with `packager`: `release-version.mjs <tag>` prints the version, exit 1 with the reason on
  stderr; `release-notes.mjs <version> <out-path>`, exit 1 when there is no `CHANGELOG.md` or no
  non-empty section; `check-dco.mjs <base>`, exit 1 listing each unsigned commit. Tests:
  `tests/scripts/nothing-lost.test.ts` (one case), `ci-r10.test.ts`, `check-dco.test.ts`,
  `release.test.ts` (version and notes together), each seen red against an injected defect.
- **Block 2.** `checks.yml` (`workflow_call`, inputs `ref` default `''` and `base` required; jobs
  `ci`, `e2e`, `dco`) and `pr.yml` (`workflow_dispatch`, input `base` default `main`). Pins:
  `actions/checkout` v7.0.1, `actions/setup-node` v7.1.0, `actions/upload-artifact` v7.0.2 (their
  tags are lightweight, so `git ls-remote` gives the commit SHA); `actionlint` 1.7.12, clean.
  `js-yaml` 4.3.2 (the version already in the tree) and `@types/js-yaml` 4.0.9, exact.
  `tests/scripts/workflows.test.ts` checks every workflow file with one rule function, and also
  feeds that function hand-written bad workflows, so each rule is seen failing on every run.
- **Not foreseen:** the e2e job installs Xvfb and a fixed list of Electron's libraries
  (`libnss3 libgbm1 libasound2t64 libgtk-3-0t64 libxss1 libnotify4 libsecret-1-0`). The plan
  wanted the list the runner lacks found by a trial run, which no longer happens; block 7's first
  run by hand confirms or trims it. Until model A, the DCO job fails on any branch whose commits
  `set` made without `-s` (today all of them): run by hand on `main` against `main`, its range is
  empty.
- **Choices of mine, labelled in the report:** the CHANGELOG heading (`## X.Y.Z` or `## [X.Y.Z]`,
  anything after on the line); a version heading with no body is refused.

### Blocks 3 and 4 — `packager` (task 132), 2026-11-20

- **Block 3.** `package.mjs`: `packageTargets(argv, flavour)` reads `--targets deb,rpm` (default
  `deb`), refuses an unknown or empty target, a missing value, and `rpm` with the sandbox, and
  passes the list to `electron-builder --linux`. `check-package.mjs` takes the same `--targets`
  (it imports `packageTargets`) and checks each file; the `.deb` path and assertions are as they
  were, its checks now split into the control part and the contents both formats share. Without
  `rpm2cpio` on the PATH it says to install `rpm` and `cpio` instead of failing with a stack.
  `release.yml` as §2.3: `workflow_dispatch` with a required `tag`; a workflow-level
  `TAG: ${{ inputs.tag || github.ref_name }}`, which the checkouts read as `env.TAG` and the call to
  `checks.yml` writes out (a reusable-workflow call cannot read `env`); `verify` (the version as
  the job's output, the ancestry against `origin/main` or `origin/release/X.Y`, the notes),
  `checks` (`ref` and `base` = the tag), `package` (needs both; `contents: write`;
  `MENKAR_FLAVOR_BUILD: menkar`; `rpm cpio xvfb` and the e2e job's libraries; package, check and
  smoke with `--targets deb,rpm`; `SHA256SUMS`; `gh release create --draft --verify-tag`). It went
  straight to `deb,rpm`, block 4 being done in the same task. Its own assertions are in
  `tests/scripts/release-workflow.test.ts` (agreed with `menkar-t131`, so the two of us were never
  on one file); `workflows.test.ts`'s rules pass on it. `actionlint` 1.7.12 clean, and seen
  failing on a misspelt job output.
- **The dry run of `verify`** (a scratchpad clone, with a `CHANGELOG.md` and the tags `v0.1.0` and
  `v9.9.9` there only): `v0.1.0` accepted (version `0.1.0`, an ancestor of `origin/main`, its
  notes written); `v9.9.9` refused ("the tag v9.9.9 does not match package.json's version 0.1.0");
  `v0.1.0` with no 0.1.0 section refused ("CHANGELOG.md has no section for 0.1.0").
- **Block 4.** `electron-builder.yml`'s `rpm:` with electron-builder 26.18.0's list plus
  `alsa-lib`. Built in Ubuntu 24.04 (`rpm` 4.18.2) from a scratchpad clone: `menkar-0.1.0.x86_64.rpm`,
  Release = the revision, `package:check -- --targets deb,rpm` passes. Installed in
  `fedora:latest` (Fedora 45): `dnf install` succeeds, `rpm -q menkar` carries the revision,
  `/usr/bin/menkar` → `/opt/Menkar/menkar` through `alternatives`, no AppArmor and the profile
  branch silent.
- **Not foreseen, fixed:** `dnf remove menkar` left `/opt/Menkar`'s directories, empty: fpm lists
  only files. `rpm.fpm: ['--directories', '/opt/Menkar']` makes the folder the package's, and
  `package:check` now fails an `.rpm` that does not own it; after it, the removal takes the folder.
- **Not foreseen, explained:** in a plain `docker run`, `chrome-sandbox` came out `4755`, because
  Docker's default seccomp refuses `unshare --user` and the template falls back to the setuid
  helper. With `--security-opt seccomp=unconfined` (user namespaces as on a Fedora host) it is
  `0755`. `docs/packaging.md`, "The RPM", says both.
- **Not foreseen, not mine:** `menkar --version` prints no version: `--version` is treated as a
  leading option and the app starts (`src/core/launch.ts` only keeps it attached). The Fedora check
  used the app's window under `xvfb-run` instead (its log's `first_window_shown`).
- Recorded data: `tests/data/package/rpm/` (`info` with the packager's address scrubbed,
  `requires`, `scripts`); the `.rpm`'s post-install equals the `.deb`'s, asserted. Docs:
  `docs/packaging.md` "The RPM", the AppImage sentence (old text to its history),
  `docs/NOT_BUILT_YET.md` "The AppImage". Container transcripts: `packager-t132-containers.txt` and
  `packager-t132-verify-dryrun.txt` in the project's files folder.

### Block 5 — `menkar-t210` (task 210), 2026-11-23

- **The repository is `menkar-packages`**, not `menkar` as the block's text says (the human's
  recorded note under §6): every push, URL and doc names `menkar/menkar-packages`.
- **`publish.yml`**: `workflow_dispatch` with `tag`; `TAG: ${{ inputs.tag ||
  github.event.release.tag_name }}` and the job's `if:` skipping a prerelease are already there,
  so block 7 adds only `release: types: [published]`. Job `upload`, `environment: packages`,
  `permissions: { contents: read, id-token: write }`: `gh release download` of the version's
  `.deb`, `.rpm` and `SHA256SUMS`, `sha256sum --check --strict`, then
  `cloudsmith-io/cloudsmith-cli-action` v3.2.5 (pinned by SHA; it pins CLI 1.31.4) by OIDC
  (`oidc-namespace: menkar`, `oidc-service-slug: sa-menkar`, `verify-auth: 'true'`,
  `continue-on-error`); only when that step fails, the same action with `api-key:
  secrets.CLOUDSMITH_API_KEY` (the action's own script: a given key takes precedence over the
  OIDC settings the first step exported); a step that says which one uploads (a `::warning::` for
  the fallback); `cloudsmith push deb|rpm menkar/menkar-packages/any-distro/any-version …
  --republish`. No secret is echoed; the action masks the key.
- **Not foreseen:** the `packages` environment allows only `v*` tags, so a run by hand must be
  started *from the tag* ("Use workflow from"), not from `main`, or GitHub refuses the job. Said in
  the workflow's header and `docs/packaging.md`.
- **The key**: served without auth at `…/gpg.32B297F2B56D38CD.key` (the Debian docs' URL),
  `…/cfg/gpg/gpg.32B297F2B56D38CD.key` (the RPM docs') and `…/gpg.key`, the same bytes. `gpg
  --show-keys`: RSA 3072, created 2026-11-23, fingerprint as recorded, **no expiry, no subkeys**.
- **Not proven until `v1.0.0`**: the OIDC exchange with these claims, `--republish` on the free
  plan, apt and dnf reading `any-distro/any-version` (`…/deb/any-distro/dists/any-version/InRelease`
  is 404 while the repository is empty), and the `.repo` without Cloudsmith's `noarch` and
  `source` sections.
- **`actionlint` not run**: no binary on this machine, and the `rhysd/actionlint:1.7.12` image's
  `docker run` was refused by the session's permission classifier.
