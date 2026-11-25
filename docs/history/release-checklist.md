# History of `docs/release-checklist.md`

> Replaced 2026-11-09: the notifications setting was renamed ("Notify about sessions you're not
> watching").
background agents" off, no notification; with "Play a sound" off, no sound.

## (the header)

> Left on 2026-11-23: the version under check is the draft release's own file, not a local build (plan 28, block 5).
Version under check: **0.1.0**, `release/menkar_0.1.0_amd64.deb`, Ubuntu 24.04 amd64.
The build's own version, `0.1.0-<commits>.g<hash>`, is what
`dpkg-deb -f release/menkar_0.1.0_amd64.deb Version` prints; note it with the result.

## 1. Install

> Left on 2026-11-23: installed from the draft release's own files, not a local build (plan 28, block 5).
sudo apt install ./release/menkar_0.1.0_amd64.deb

## 2. First start, with the agent-tablet import

> Left on 2026-11-10: the header reorganized and the main menu removed (plan 24).
- the Usage window (⚙ → Usage, period "All") shows days from before Menkar's first start;

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
## 2. First start, with the agent-tablet import
Close agent-tablet first. Start Menkar from the launcher (not from a terminal).
  /opt/Menkar/menkar` shows no `--no-sandbox`);
- your agent-tablet projects, groups and settings (theme, font, language) are there;
- the Usage window (the header's Usage button, period "All") shows days from before Menkar's first start;
- agent-tablet's own files are unchanged (it still starts and shows the same projects).

## 3. A day of work

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
Use Menkar instead of agent-tablet for a working day: open your projects, start and resume

## 9. Retake the squeezed screenshots

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
## 9. Retake the squeezed screenshots
Some reference screenshots in `docs/spec/img/` came out wrong under the headless capture: the
Preferences and Integrations pages were drawn too narrow (titles wrap letter by letter), and the
Markdown preview could not start at all. Retake them from agent-tablet on a real display:
`preferences-{dark,light}.png`, `integrations-{dark,light}.png`, `file-preview-{dark,light}.png`.
**Passes when** each row's title is on one line and the preview shows rendered Markdown. Compare
them with Menkar's same pages; a difference you do not like is a defect to report.

## 8e. Codex in the orchestration mode (P1b)

> Left on 2026-11-24: Cursor's sessions can use Menkar's tools (plan 39 P3, task 223).
**Passes when** the card shows the Agent line only because two agents are installed, Cursor greyed
saying its sessions can't use Menkar's tools yet; the worker runs in the background under the

## 8g. Cursor's integrations items (P3)

> Left on 2026-11-24: the section became P3's whole hand check (plan 39 P3.5, task 223).
## 8g. Cursor's integrations items (P3)
In Menkar Sandbox, with your own `cursor-agent` installed. Before: copy `~/.cursor/hooks.json` and
Cursor's `cli-config.json` aside.
1. Settings → Cursor: the two switches, off. Turn each on, then off, comparing the files with
   your copies after each step.
2. **Before uninstalling Menkar Sandbox, turn both off here** (S11).
**Passes when** each switch adds only its own entries and turning it off gives back your file as
it was (`cli-config.json` as Cursor last rewrote it: Cursor rewrites it at each start); the other
switch's file is untouched throughout.
