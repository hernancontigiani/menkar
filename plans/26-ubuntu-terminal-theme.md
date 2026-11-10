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

## Findings (`b2`, 2026-11-10, read-only)

- **Every shell Menkar starts lacks COLORTERM.** The installed app's main process has no `TERM`
  or `COLORTERM`, since it is started from the desktop, not a terminal. Every pty gets
  `TERM=xterm-256color` (node-pty's `name`) and the main process's environment.
- **The human's terminal has truecolor.** The `claude` in the human's GNOME Terminal has
  `COLORTERM=truecolor`.
- **So Claude Code gets 256 colours in Menkar.** Its colour depth is Node's `getColorDepth`:
  `COLORTERM=truecolor` gives 24 bits, `TERM=xterm-256…` gives 8. It ships the tip "Try setting
  environment variable COLORTERM=truecolor for richer colors" for exactly this case.
- **In the human's screenshot, Claude Code paints with its own RGB theme**, not the terminal's
  palette: text `#ffffff`, inline code `#b1b9f9`, grey `#999999`, rule `#888888`, the auto-mode
  yellow `#ffc107`. The background is GNOME's `#300a24` (Yaru-dark's terminal aubergine) on most
  pixels. The text samples are read as the most frequent colour among pixels far from the
  background, since subpixel antialiasing fringes the edges.
- **Not yet explained:** which look shows Claude Code's text in one colour. 256 colours alone keep
  the colours distinct. `set` is asking the human for the look and a screenshot.

## Execution blocks

- **B1, truecolor in every pty:** `COLORTERM=truecolor` in the environment `src/main/terminal.ts`
  gives its pty. Agent panes, shell panes and the drawer all start there. Test (e2e): a shell
  pane and the drawer print `$COLORTERM`; seen red first.
- **B2, the "Ubuntu" theme:**
  - bg `#300a24`, fg `#ffffff`, GNOME's palette (`#171421 #c01c28 #26a269 #a2734c #12488b #a347ba
    #2aa1b3 #d0cfcc #5e5c64 #f66151 #33da7a #e9ad0c #2a7bde #c061cb #33c7de #ffffff`).
  - Added to `PALETTES` and `THEME_NAMES` (Settings lists it), with its UI roles derived as for
    the other non-Catppuccin themes. Usable in both styles.
  - Tests: the theme's roles are within the derived rule, and the Settings theme list includes it.
  - A screenshot of a stand-in printing Claude Code's truecolor sequences in the new theme, beside
    the human's screenshot.
- **B3, the one-colour look:** once the human names it, reproduce it with the stand-in at 256 and
  at 24 bits, and fix its cause if B1 did not. The decision goes to `set` (§1), and the docs to
  `docs/window.md` (Look).

## Execution log
- **B1, delivered 2026-11-10:**
  - `src/main/terminal.ts` gives every pty `{ ...process.env, COLORTERM: 'truecolor' }`. Agent
    panes, shell panes and the drawer all start there.
  - Test: `e2e/terminal.spec.ts` "every pty says truecolor". The app is launched with
    `COLORTERM` empty, and a pane and the drawer print it. Seen red: the pane printed `pane=[]`.
- **B2, delivered 2026-11-10:**
  - The `Ubuntu` theme lives in `PALETTES` and is listed last in `THEME_NAMES`: bg `#300a24`, fg
    `#ffffff`, GNOME's palette.
  - Tests: `tests/core/theme.test.ts`, with the names list plus one test that the palette holds in
    both styles and schemes, and that Terminal workspace is dark. Both seen red.
    - A first assertion that Classic is dark too was wrong: Classic keeps the desktop's chrome, as
      Nord does in Classic light.
  - PRF-14's list gains "Ubuntu".
  - `e2e/ubuntu-theme.spec.ts` is a stand-in printing a Claude Code reply with the 24-bit colours
    read from the human's screenshot. It saves `/tmp/menkar-shots/ubuntu-{tui,classic}.png`, and
    `/tmp/menkar-shots/ubuntu-compare.png` puts it under the human's own terminal.
    - The colours match.
    - The type size differs: GNOME's system monospace at 12 pt against Menkar's default 10 pt.
      That is the Font setting, not the theme.
- **B3:** waits for the human's answer on the one-colour look.
