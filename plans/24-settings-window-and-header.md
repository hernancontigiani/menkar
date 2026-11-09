# Plan 24: a Settings window with sections, non-blocking windows, the header reorganized, transcript retention

> **Status:** stub, written 2026-11-09 with the human, for 2026-11-10. Needs `/design-plan` into
> blocks before it runs (likely split between `b1`, header and window, and `b2`, Settings content
> and retention).
>
> **Exit, when executed:** `docs/preferences.md` (the window and its sections), `docs/window.md` (the
> header, the tab menu), `docs/context.md` or `docs/integrations` doc (retention); decisions in
> `plans/00-STATUS.md` §1; the rest → `git log`.

## Decided (the human, 2026-11-09)

1. **No window blocks the main one.** Settings, About and MCP become independent windows, as Usage
   already is (1.24): one each, brought to front when already open.
2. **Settings is one window**, opened directly by the header's Settings button (no drop-down), laid
   out like Ubuntu's Settings: a section list on the left, divided by separators into groups, the
   section's content on the right.
   Groups and sections (a starting point; the human may reorder):
   - **Appearance**: Appearance (scheme, style, theme) · Terminal (font, size, scrollback)
   - **Work**: Sessions (reopen tabs on start; folder path in Add session) · Notifications (notify,
     sound) · Context (the ring's thresholds)
   - **Data**: Usage & classifier (classify turns, classify earlier turns)
   - **Integrations**: Status line · Transcript retention (item 4) · MCP servers
   - **System**: Language · About
3. **The gear menu goes away.** Its items move: Preferences and About → sections of Settings;
   MCP servers → Integrations; Open session file… → the New ▾ menu, beside Open file; Show hidden
   sessions (the history's global hide) → a switch inside Add session → Existing; Usage → its own
   header button (item 5).
4. **Transcript retention (option A).** An integration, like the status line: with the user's
   consent it raises `cleanupPeriodDays` in `~/.claude/settings.json` so Claude Code stops deleting
   transcripts after 30 days; removable on its own, leaving the rest of the file as it was. (Option
   B — Menkar keeping its own copy of members' transcripts, viewable through the replay tab — is
   recorded in `docs/NOT_BUILT_YET.md` for later.) Design: the value offered (e.g. a large number of
   days), what the integrations record keeps, and the exact effect stated in the row.
5. **The header.** Icons with text: **"+ New ▾"**, **"⚙ Settings"**, and a new **"📊 Usage"** button
   (a chart icon) to the right of the title, away from New. **Close all leaves the header** and goes
   to the tab's right-click menu, with "Close other tabs", as editors and browsers do; still no
   confirmation dialog.
6. **Sidebar width** (pending the human's look at 300 px): proposed default 250 px (from 300),
   minimum 180 px (from 220), double-click on the divider resets to the default.

## b2's part: items 1, 2, 3 (the Settings side) and 4

`b1` builds item 5, the gear's removal from the header and item 6. `b2` builds the rest. The line
between them is the window action `{ type: 'openSettings'; section?: SettingsSection }`: `b1`'s
header button and menus call it, and `b2` builds what it opens.

### What it builds

- **One Settings window** (`settings.html`, `src/renderer/settings.ts`), with no parent: the same
  shape as Usage (1.24). There is one for the whole app. Asking again shows it, focuses it and
  switches it to the asked section (`settings:section`, main → page). It replaces the Preferences,
  About and MCP pages and their windows.
- **The layout**, as Ubuntu's Settings:
  - A list of sections on the left, with a separator between groups.
  - The chosen section on the right, under its title.
  - Up and Down move through the list.
  - The page remembers the last section while it stays open.

  | Group | Section (`SettingsSection`) | Content (today's rows, same `data-key`s) |
  |---|---|---|
  | Appearance | `appearance` Appearance | color scheme, interface style, color theme |
  | | `terminal` Terminal | font, scrollback |
  | Work | `sessions` Sessions | reopen tabs on start, folder path in Add session |
  | | `notifications` Notifications | notify, sound |
  | | `context` Context | the ring's two thresholds |
  | Data | `usage` Usage & classifier | classify turns, classify earlier turns |
  | Integrations | `statusline` Status line | the status line switch |
  | | `retention` Transcript retention | the new switch (item 4) |
  | | `mcp` MCP servers | today's MCP browser, read only, read when shown |
  | System | `language` Language | language, Restart now |
  | | `about` About | today's About page |

- **Actions:**
  - `openSettings` with an optional section.
  - `Ctrl+,` and `Ctrl+B s` open Settings.
  - `openPreferences`, `openAbout` and `openMcpServers` go away once `b1`'s gear removal has landed.
    Until then they open Settings on `appearance`, `about` and `mcp`.
  - Usage stays its own window, through `openUsage`.
- **Transcript retention (item 4, option A)**, in `src/core/context/integrations.ts` beside the
  status line:
  - **Turning it on** sets `cleanupPeriodDays` in `~/.claude/settings.json` to 3650 days, after a
    dated backup.
    - **Why 3650:** ten years reads as "keep them" while staying an ordinary number. `0` cannot be
      used because in Claude Code it does not mean "forever".
    - A value already set and larger is kept as it is, and is recorded as ours. Turning it on
      never shortens retention.
  - **The record** (`integrations.json`, key `retention`) holds `{ installed, previous }`, where
    `previous` is the value it replaced, or `null` when the key was absent.
  - **It reads as on** if and only if the record exists and the file still holds `installed`.
  - **Turning it off:**
    - Puts `previous` back, or deletes the key when `previous` is `null`.
    - Is refused with our sentence when the file no longer holds `installed`.
    - Every other key is left as the user had it.
  - **The row says the effect:** "Claude Code keeps transcripts for 10 years instead of deleting
    them after 30 days (cleanupPeriodDays in ~/.claude/settings.json). Turning it off puts back
    what was there."
  - **Option B** (Menkar keeping its own copy of the transcripts) goes to `docs/NOT_BUILT_YET.md`,
    with its trigger.

### Do not touch

- The header, the gear menu and the tab menu in `src/renderer/app.ts` belong to `b1`.
- Every edit to a shared file (`app.ts`, `main.ts`, `workspace.ts`, `shared/*`, `style.css`, the
  i18n catalogs) is a targeted edit.
- The human's `~/.claude/settings.json`: the tests write only under a temporary `HOME`.

### Verification

- **Vitest:** retention on, off and refused, round-tripping.
  - The previous value is kept, an absent key is deleted, and a larger value is kept.
  - The other keys survive.
  - A backup is written.
  - A changed file refuses removal.
  - The status line's entry in the record survives, and the reverse holds too.
- **e2e:**
  - Every PRF and integrations test kept, with only selectors moved.
  - Settings is not modal: the main window takes a click while it is open.
  - One window: a second open focuses it and switches the section.
  - Each section shows its rows.
  - MCP and About render inside Settings.
  - The retention switch writes and removes `cleanupPeriodDays` in a temporary `HOME`.
- **Screenshots:** `/tmp/menkar-shots/settings-{tui,classic}-{dark,light}.png`.
- `npm run ci`, and a full `npm run ui-check` from a clean `out/`, coordinated with `b1`.

### Execution blocks

- **B1, retention in core:** `installRetention`, `removeRetention`, `retentionInstalled`, with
  their tests, seen red. The IPC (`integrations:retention`, `integrations:set-retention`) and the
  `NOT_BUILT_YET` entry.
- **B2, the Settings window:**
  - The page, the sections and the `openSettings` action.
  - The single window in `windows.ts`, and `settings:section`.
  - Remove `preferences.html`, `about.html` and `mcp.html` and their entries.
  - Move the e2e selectors, and add the new e2e tests.
  - Write the screenshots.
- **B3, closing the actions:** once `b1`'s gear removal lands, remove `openPreferences`,
  `openAbout` and `openMcpServers`. Update the docs (`docs/preferences.md`, `docs/context.md`,
  §1 decisions), then run ci and the full ui-check.

### Execution log (b2)
- **B1, delivered 2026-11-10:**
  - **Core:** `RETENTION_DAYS` (3650), `installRetention`, `removeRetention` and
    `retentionInstalled`, beside the status line in `src/core/context/integrations.ts`. The dated
    backup became `backUp()`, shared by both pieces.
  - **IPC:** `integrations:retention` and `integrations:set-retention`.
  - **Tests:** `tests/core/context/retention.test.ts`, 8 tests.
    - Seen red: all 8 with no code, and 2 with the code in place, injected separately: a larger
      value overwritten, and a `null` previous left behind instead of the key being deleted.
  - Option B is in `docs/NOT_BUILT_YET.md`.
- **B2, delivered 2026-11-10:**
  - **The section list** (`SETTINGS_LIST`) lives in `src/core/preferences.ts`, not
    `src/shared/workspace.ts`, which holds types only. `SettingsSection` is derived from it.
  - **The page:** `settings.html` and `settings.ts` replace `preferences.*`; `about.ts`, `mcp.ts`
    and `integrations.ts` now export sections. `about.html` and `mcp.html` are deleted.
  - **i18n:** section titles go through a map of literal keys, because the i18n check refuses a
    computed `t()` key.
  - **Not anticipated:** test integrity flags every moved selector and the window's new title as a
    removed `expect(` line (10 lines, listed in the report to `set`). PRF-1 was reordered so the
    original assertions stay byte for byte.
  - **Seen red in `e2e/settings.spec.ts`:**
    - the section not sent to an open window;
    - a group separator missing;
    - retention not writing the key.
  - **Results:** the 8 touched specs, 89 passed. Screenshots in
    `/tmp/menkar-shots/settings-{tui,classic}-{dark,light}.png`.
- **Additions (the human, via `set`, 2026-11-10):**
  - An icon beside every section name: inline SVG in the text color, the header icons' stroke,
    16 px. The icons live in `settings.ts`, because `dom.ts` is the main window's and `b1` was
    editing it.
  - A "Settings" title ("Ajustes") over the list, in a header step like the main window's. The
    window title in Spanish became "Ajustes" to match.
  - The list grew from 220 to 250 px and its names no longer wrap: in Terminal workspace's
    monospace, "Usage & classifier" and "Transcript retention" wrapped onto two lines.
  - Test: the title and one 16 px icon per item, in the text color. Seen red with both removed.
- **B3, 2026-11-10:**
  - `openPreferences`, `openAbout` and `openMcpServers` are removed, once `b1`'s header had
    `#settings-button`.
  - The README's "Settings and usage" section is rewritten.
  - `set` records the §1 decisions (1.24 amended, 1.32).
- **Addition (the human, via `set`, 2026-11-10): the current retention.**
  - **What it shows:** before the switch, the section shows how long Claude Code keeps transcripts
    now.
    - It reads `cleanupPeriodDays` read-only through `retentionStatus()`, each time the section is
      shown and after each change; the section is not cached.
    - The shown value is always the file's.
    - An absent key reads "Not set: Claude Code's default applies, currently 30 days".
      `CLAUDE_DEFAULT_CLEANUP_DAYS` is the one named constant, with its source in a comment.
    - With the switch on, the text says whether the value was set by Menkar or is the user's own.
    - An unreadable file, or a value that is not a number, gets our own sentence.
    - The switch's subtitle no longer claims "30 days".
  - **Not anticipated:** the type moved to `src/core/context/types.ts`, because importing it from
    `integrations.ts` pulled Node into the renderer's typecheck.
  - **Tests:**
    - 5 in Vitest: absent, 45, 7, on, a larger value of the user's, malformed, non-number.
    - 4 in e2e: 7, absent, malformed, and the switch's round trip.
    - All seen red before the code.
  - **Screenshots:** `settings-*-retention.png`.
