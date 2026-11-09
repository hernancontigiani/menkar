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
