# Plan 26: a theme matching the human's Ubuntu terminal

> **Status:** stub, written 2026-11-09 with the human; low priority, after every other plan, not
> before 2026-11-10. Needs analysis and `/design-plan`.
>
> **Exit, when executed:** `docs/look.md` (or the look doc that exists then) for the new theme and
> what was found; decision in `plans/00-STATUS.md` §1; the rest → `git log`.

## Goal (the human, 2026-11-09)

Neither look the human uses today is quite right for reading Claude Code: one shows Claude Code's
text in its different colors but feels dark and short on contrast; the other is warmer and easier
to read but shows the text all in one color. The human's Ubuntu terminal sits in between and is
what they like. Add it as a new theme option — keep the current ones.

## What `set` read (2026-11-09, read only)

- The terminal is GNOME Terminal, default profile `b1dcc9dd-…` ("Unnamed"), **`use-theme-colors =
  true`**: background and foreground come from the desktop theme, which is **Yaru-dark**
  (`color-scheme = prefer-dark`) — the profile's own `#ffffff` / `#171421` are not used.
- Its 16-colour palette is GNOME's: `#171421 #c01c28 #26a269 #a2734c #12488b #a347ba #2aa1b3 #d0cfcc
  #5e5c64 #f66151 #33da7a #e9ad0c #2a7bde #c061cb #33c7de #ffffff`. Font: the system monospace, 12.
- Menkar already has many colour themes (`THEME_NAMES` in `src/core/theme.ts`: Default, Tango Dark,
  Solarized, Dracula, Gruvbox, Nord, Catppuccin Mocha, Tokyo Night, Monokai, One Dark…) besides the
  two interface styles; the human's "two themes" is likely the two styles (Terminal workspace with
  Default/Catppuccin, Classic with its VTE-like terminal colours, decision 1.10).

## To analyse

1. The exact background/foreground GNOME Terminal draws with Yaru-dark theme colours (read from a
   screenshot of the human's terminal or from Yaru's CSS), and the cursor/selection colours.
2. **Why Claude Code's text is all one colour in one of Menkar's looks**: Claude Code paints with
   truecolor when it detects it (`COLORTERM`, `TERM`) and its own theme; check what env Menkar's
   ptys pass in each style, and what the Classic terminal palette maps. This may be a bug, not a
   taste — fix it in its own right.
3. Then add the theme ("Ubuntu Terminal" or the name the human picks): the GNOME palette above,
   Yaru-dark's bg/fg, UI roles derived as for the others; selectable in both styles; a screenshot of
   a real Claude Code reply (a stand-in printing Claude Code's colour sequences) next to the human's
   own terminal for comparison before committing.
