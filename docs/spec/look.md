# Look — the whole window, both styles, every theme

The window's look, which the human likes and Menkar reproduces as closely as HTML and CSS allow:
the window and its header, the sidebar (project dropdown, session rows, group headings), the tab
strip, panes and terminals, the dialogs, the Usage window, the two interface styles
(**Terminal workspace**, the default, and **Classic (Adwaita)**) and every color theme in its light
and dark variants, fonts and icons. Index rows specified here: **F29** (the sidebar toggle and its
remembered width, shared with `projects.md`), **F55** (themes coloring the whole window and the
Classic style, shared with `preferences.md`, which owns the settings' rows), **F58** (empty states),
**K11** (`F9`) and **K36** (`Ctrl+B b`). Every other area file names its widgets' behaviour; this
file is where their measurements and colors live.

Where a number comes from agent-tablet's own stylesheet or code it is stated as such. Where a widget
takes its look from libadwaita 1.5 (the toolkit agent-tablet uses; GTK 4.14) the libadwaita value is
given, since Menkar has no libadwaita and must write it itself. Colors read from the reference
screenshots (pixel samples at 1× scale) are marked "measured".

## Behaviour

### Interface style and theme, applied live (F55)

- Two settings decide the look: **Interface style** (`Terminal workspace` | `Classic (Adwaita)`)
  and **Color theme** (`Default` and eleven named themes, listed under Look). A third, **Color
  scheme** (`Follow system` | `Light` | `Dark`), decides light or dark. All three are changed in
  Preferences (`preferences.md`) and take effect at once, without a restart, in every open window:
  the chrome (header, sidebar, tab strip, dialogs, the Usage window) and every terminal's palette.
  agent-tablet re-colors the chrome of every window but re-applies the terminal palette and font
  only to the terminals of the window Preferences was opened from (the others keep the old palette
  until that window's Preferences is used); Menkar applies it to every window.
- **Terminal workspace** (the default) recolors the whole window from the theme: the chrome takes
  the theme's background, foreground and accent, the UI font becomes monospace, corners become
  square, and each terminal sits in a thin frame labelled with its agent.
- **Classic (Adwaita)** is the stock GNOME look (light or dark following the scheme): only the
  terminal takes the theme's colors; the chrome keeps the stock palette, the UI font is the system's
  sans font, and the terminal frame and its label are not drawn.
- **`Default` theme**: in Terminal workspace it means **Catppuccin Mocha** in dark and **Catppuccin
  Latte** in light, following the scheme. In Classic it means no theme: the terminal keeps its own
  default colors. Every named theme is the same in light and dark: choosing `Solarized Light` with
  the Dark scheme gives a light window in Terminal workspace.
- When the scheme is `Follow system` and the system flips between light and dark, every window
  re-colors (chrome and terminals), and the Usage window redraws its chart in the other palette.
- An unknown theme name in the settings file behaves as `Default`; an unknown style behaves as
  Classic for the chrome.
- An unfocused window keeps its bars at full strength in Terminal workspace (libadwaita fades them
  to 50 % in Classic).

### The sidebar: shown, hidden, resized (F29, K11, K36)

- The sidebar holds the project dropdown, the main menu (⚙), the current project's sessions and
  the "Add session" button. It is on the left of every window, shown on start.
- `F9` (K11), `Ctrl+B b` (K36) and the header's sidebar toggle (tooltip "Toggle sidebar (F9)") each
  hide it when shown and show it when hidden. The toggle button is pressed (checked) exactly while
  the sidebar is shown, whichever of the three changed it. Hidden, the content takes the window's
  whole width; shown again, it comes back at the width it had.
- Its width is dragged at the 1 px line between it and the content (the drag zone extends 8 px to
  the right of the line). It cannot be dragged under **220 px**; there is no maximum besides the
  window. Resizing the window grows or shrinks the content, never the sidebar.
- The width is remembered: saved 600 ms after the last change of the divider while the sidebar is
  shown, only when it is 150 px or more (with the 220 px minimum, always), into the setting
  `sidebar_width` (default **300**), shared by every window; each new window opens at the saved
  width. Hiding the sidebar does not save a width.
- Toggling is per window: hiding it in one window leaves the others as they are. Whether the
  sidebar is hidden is not remembered across starts.

### Empty states (F58)

Each is a centered status page: a large dim icon, a bold title, a dim description.

| Where | When | Icon (depicts) | Title | Description | Extra |
|---|---|---|---|---|---|
| Content area | The window's current project has no tab in this window (on start with nothing reopened, after its last tab closes, after switching to a project without tabs) | `utilities-terminal-symbolic` — a terminal window with a `>_` prompt | "No session open" | "Pick a session from the sidebar, or start a new one." | — |
| Sidebar, under the dropdown | The current project has no session the app knows (none added, or every member's transcript is gone) | `view-list-symbolic` — a bulleted list | "{name} has no sessions" ({name} = the project's name) | "Add one Claude already knows, or start a new one in any folder." | A pill button "Add session" in the accent color, opening Add session (on Existing) |
| Add session → Existing | No session of any agent was found at all | `folder-symbolic` — a folder | "No sessions found" | "Run claude in a project directory first — sessions will appear here automatically." | — |
| Usage window, Totals | The period has no turn | — | — | "Nothing in this period." as one line inside the table, 12 px above and below | — |
| Usage window, By day tooltip | The bar under the pointer is empty | — | — | The tooltip's date line, then "Nothing in this period." | — |

The tab strip stays visible when there is no tab: it then holds only its `+`.
The Usage window also has two status pages owned by `usage.md`: "Reading the transcripts…"
(`content-loading-symbolic`, a loading indicator) and "Usage history is from a newer version of
Menkar" with "It was left as it is. Update the app to see it." (`dialog-warning-symbolic`, a
triangle with `!`).

### Small visible behaviours of the chrome

- **Close all tabs** (header, `tab-close-symbolic`) is shown only while the window has two tabs or
  more, counting every project's tabs in that window.
- The **PREFIX pill** at the right end of the tab strip is shown from `Ctrl+B` until the next key
  (`terminal.md`).
- A tab shows a status dot only when its state is not idle; a context ring only when one of its
  sessions has a reading (`context.md`); a colored `●` only when every session in it belongs to the
  same group (found in the code — not in the index: the tab carries its group's color).
- A session row's folder line is shown only when the project's sessions are in more than one
  folder; then each row shows its folder's last component.
- The "No group" heading is shown only when the project has at least one group with a session in
  it; groups with no known session are not shown.
- Hovering a session row's status dot shows the state word ("working", "blocked", "done", "idle",
  "stopped"); agent-tablet shows it untranslated, Menkar passes it through t().

## Data contracts

The look reads these settings from `state.json` (`$XDG_CONFIG_HOME/menkar/state.json`, key
`settings`); `preferences.md` owns their rows.

| Key | Type | Default | Values and meaning |
|---|---|---|---|
| `ui_style` | string | `"tui"` | `"tui"` = Terminal workspace; `"classic"` = Classic (Adwaita); any other value = Classic for the chrome |
| `terminal_theme` | string | `"Default"` | One of the exact names: `Default`, `Tango Dark`, `Solarized Dark`, `Solarized Light`, `Dracula`, `Gruvbox Dark`, `Nord`, `Catppuccin Mocha`, `Tokyo Night`, `Monokai`, `One Dark`, `Catppuccin Latte` (this order is the Preferences order); unknown = `Default` |
| `color_scheme` | string | `"system"` | `"system"` (follow the desktop), `"light"`, `"dark"` |
| `font` | string | `""` | A font description, family then size in points (e.g. `"Monospace 10"`); `""` = the terminal's default, the system monospace font at 10 pt |
| `scrollback` | integer | `10000` | Terminal scrollback lines (range 1 000–1 000 000, step 1 000 in Preferences) |
| `sidebar_width` | integer (px) | `300` | The sidebar's width; written only when ≥ 150 |

Nothing else of the look is stored: window size (1280 × 800 on every open), sidebar visibility and
pane split positions are not saved by this area (the split layout is `projects.md`'s).

### Theme palettes

Each theme is a foreground, a background and 16 ANSI colors (indices 0–15), all `#rrggbb`. The
terminal uses all 18; the chrome uses `bg`, `fg`, ANSI 1 (red), 2 (green), 3 (yellow), 5 (magenta).

| Theme | fg | bg | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|---|---|
| Tango Dark | `#d3d7cf` | `#2e3436` | `#2e3436` | `#cc0000` | `#4e9a06` | `#c4a000` | `#3465a4` | `#75507b` | `#06989a` | `#d3d7cf` |
| Solarized Dark | `#839496` | `#002b36` | `#073642` | `#dc322f` | `#859900` | `#b58900` | `#268bd2` | `#d33682` | `#2aa198` | `#eee8d5` |
| Solarized Light | `#657b83` | `#fdf6e3` | `#073642` | `#dc322f` | `#859900` | `#b58900` | `#268bd2` | `#d33682` | `#2aa198` | `#eee8d5` |
| Dracula | `#f8f8f2` | `#282a36` | `#21222c` | `#ff5555` | `#50fa7b` | `#f1fa8c` | `#bd93f9` | `#ff79c6` | `#8be9fd` | `#f8f8f2` |
| Gruvbox Dark | `#ebdbb2` | `#282828` | `#282828` | `#cc241d` | `#98971a` | `#d79921` | `#458588` | `#b16286` | `#689d6a` | `#a89984` |
| Nord | `#d8dee9` | `#2e3440` | `#3b4252` | `#bf616a` | `#a3be8c` | `#ebcb8b` | `#81a1c1` | `#b48ead` | `#88c0d0` | `#e5e9f0` |
| Catppuccin Mocha | `#cdd6f4` | `#1e1e2e` | `#45475a` | `#f38ba8` | `#a6e3a1` | `#f9e2af` | `#89b4fa` | `#f5c2e7` | `#94e2d5` | `#bac2de` |
| Tokyo Night | `#c0caf5` | `#1a1b26` | `#15161e` | `#f7768e` | `#9ece6a` | `#e0af68` | `#7aa2f7` | `#bb9af7` | `#7dcfff` | `#a9b1d6` |
| Monokai | `#f8f8f2` | `#272822` | `#272822` | `#f92672` | `#a6e22e` | `#f4bf75` | `#66d9ef` | `#ae81ff` | `#a1efe4` | `#f8f8f2` |
| One Dark | `#abb2bf` | `#282c34` | `#282c34` | `#e06c75` | `#98c379` | `#e5c07b` | `#61afef` | `#c678dd` | `#56b6c2` | `#abb2bf` |
| Catppuccin Latte | `#4c4f69` | `#eff1f5` | `#5c5f77` | `#d20f39` | `#40a02b` | `#df8e1d` | `#1e66f5` | `#ea76cb` | `#179299` | `#acb0be` |

| Theme | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|
| Tango Dark | `#555753` | `#ef2929` | `#8ae234` | `#fce94f` | `#729fcf` | `#ad7fa8` | `#34e2e2` | `#eeeeec` |
| Solarized Dark | `#002b36` | `#cb4b16` | `#586e75` | `#657b83` | `#839496` | `#6c71c4` | `#93a1a1` | `#fdf6e3` |
| Solarized Light | `#002b36` | `#cb4b16` | `#586e75` | `#657b83` | `#839496` | `#6c71c4` | `#93a1a1` | `#fdf6e3` |
| Dracula | `#6272a4` | `#ff6e6e` | `#69ff94` | `#ffffa5` | `#d6acff` | `#ff92df` | `#a4ffff` | `#ffffff` |
| Gruvbox Dark | `#928374` | `#fb4934` | `#b8bb26` | `#fabd2f` | `#83a598` | `#d3869b` | `#8ec07c` | `#ebdbb2` |
| Nord | `#4c566a` | `#bf616a` | `#a3be8c` | `#ebcb8b` | `#81a1c1` | `#b48ead` | `#8fbcbb` | `#eceff4` |
| Catppuccin Mocha | `#585b70` | `#f38ba8` | `#a6e3a1` | `#f9e2af` | `#89b4fa` | `#f5c2e7` | `#94e2d5` | `#a6adc8` |
| Tokyo Night | `#414868` | `#f7768e` | `#9ece6a` | `#e0af68` | `#7aa2f7` | `#bb9af7` | `#7dcfff` | `#c0caf5` |
| Monokai | `#75715e` | `#f92672` | `#a6e22e` | `#f4bf75` | `#66d9ef` | `#ae81ff` | `#a1efe4` | `#f9f8f5` |
| One Dark | `#5c6370` | `#e06c75` | `#98c379` | `#e5c07b` | `#61afef` | `#c678dd` | `#56b6c2` | `#ffffff` |
| Catppuccin Latte | `#6c6f85` | `#d20f39` | `#40a02b` | `#df8e1d` | `#1e66f5` | `#ea76cb` | `#179299` | `#bcc0cc` |

`Default` has no palette of its own (see Behaviour).

### Chrome roles in Terminal workspace

The Terminal workspace stylesheet names eight roles, after herdr's Catppuccin roles; its look
matches herdr's built-in "catppuccin" theme. For the two Catppuccin themes they are exact values;
for every other theme they are derived from `bg` and `fg`:

| Role | Catppuccin Mocha | Catppuccin Latte | Any other theme |
|---|---|---|---|
| **mantle** (sidebar, the darkest panel) | `#181825` | `#e6e9ef` | `bg` shaded × 0.85 (HSL lightness and saturation each × 0.85) |
| **surface0** (cards, unselected tabs, entries) | `#313244` | `#ccd0da` | `bg` mixed 12 % toward `fg` |
| **surface1** (terminal frame) | `#45475a` | `#bcc0cc` | `bg` mixed 20 % toward `fg` |
| **overlay0** (dim text, stopped dot) | `#6c7086` | `#9ca0b0` | `bg` mixed 45 % toward `fg` |
| **subtext0** (row and unselected-tab text) | `#a6adc8` | `#6c6f85` | `bg` mixed 80 % toward `fg` |
| **accent** (selected tab, focused frame, frame label, suggested buttons) | `#cba6f7` | `#8839ef` | ANSI 5, except Dracula `#bd93f9` |
| **green** / **yellow** / **red** (status dots, badge) | ANSI 2 / 3 / 1 | ANSI 2 / 3 / 1 | ANSI 2 / 3 / 1 |

"Mixed t toward fg" is per channel `bg + (fg − bg) × t`. The resolved values (to ±1 per channel
from rounding):

| Theme | bg | fg | mantle | surface0 | surface1 | overlay0 | subtext0 | accent | green | yellow | red |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Tango Dark | `#2e3436` | `#d3d7cf` | `#282c2d` | `#424848` | `#4f5555` | `#787d7b` | `#b2b6b0` | `#75507b` | `#4e9a06` | `#c4a000` | `#cc0000` |
| Solarized Dark | `#002b36` | `#839496` | `#03232a` | `#103842` | `#1a4049` | `#3b5a61` | `#697f83` | `#d33682` | `#859900` | `#b58900` | `#dc322f` |
| Solarized Light | `#fdf6e3` | `#657b83` | `#f2dda6` | `#ebe7d7` | `#dfddd0` | `#b9bfb8` | `#839496` | `#d33682` | `#859900` | `#b58900` | `#dc322f` |
| Dracula | `#282a36` | `#f8f8f2` | `#23242d` | `#41434d` | `#52535c` | `#86878b` | `#cecfcc` | `#bd93f9` | `#50fa7b` | `#f1fa8c` | `#ff5555` |
| Gruvbox Dark | `#282828` | `#ebdbb2` | `#222222` | `#3f3d39` | `#4f4c44` | `#807966` | `#c4b796` | `#b16286` | `#98971a` | `#d79921` | `#cc241d` |
| Nord | `#2e3440` | `#d8dee9` | `#282d35` | `#424854` | `#505662` | `#7a808c` | `#b6bcc7` | `#b48ead` | `#a3be8c` | `#ebcb8b` | `#bf616a` |
| Catppuccin Mocha | `#1e1e2e` | `#cdd6f4` | `#181825` | `#313244` | `#45475a` | `#6c7086` | `#a6adc8` | `#cba6f7` | `#a6e3a1` | `#f9e2af` | `#f38ba8` |
| Tokyo Night | `#1a1b26` | `#c0caf5` | `#171820` | `#2e303f` | `#3b3e4f` | `#656a83` | `#9fa7cc` | `#bb9af7` | `#9ece6a` | `#e0af68` | `#f7768e` |
| Monokai | `#272822` | `#f8f8f2` | `#21221d` | `#40413b` | `#51524c` | `#858680` | `#cecec8` | `#ae81ff` | `#a6e22e` | `#f4bf75` | `#f92672` |
| One Dark | `#282c34` | `#abb2bf` | `#23262b` | `#383c45` | `#424750` | `#636873` | `#9197a3` | `#c678dd` | `#98c379` | `#e5c07b` | `#e06c75` |
| Catppuccin Latte | `#eff1f5` | `#4c4f69` | `#e6e9ef` | `#ccd0da` | `#bcc0cc` | `#9ca0b0` | `#6c6f85` | `#8839ef` | `#40a02b` | `#df8e1d` | `#d20f39` |

The roles then replace the toolkit's color names, so every stock widget follows the theme:

| Toolkit color | Terminal workspace value |
|---|---|
| window background / foreground | `bg` / `fg` |
| view (lists, text) background / foreground | `bg` / `fg` |
| header bar background (and its unfocused background) | mantle |
| sidebar background | mantle |
| card background / foreground (boxed lists, preference rows) | surface0 / `fg` |
| popover background / foreground | `bg` / `fg` |
| dialog background / foreground | `bg` / `fg` |
| accent background, accent text color | accent |
| text on accent | `bg` |

### Classic palette (libadwaita 1.5 stock)

| Color | Light | Dark |
|---|---|---|
| window background / foreground | `#fafafa` / `rgba(0,0,0,0.8)` | `#242424` / `#ffffff` |
| view background | `#ffffff` | `#1e1e1e` |
| header bar background | `#ffffff` | `#303030` |
| card background | `#ffffff` | `rgba(255,255,255,0.08)` |
| dialog, popover background | `#fafafa` dialog, `#ffffff` popover | `#383838` both |
| accent background / text on it | `#3584e4` / white | `#3584e4` / white |
| accent as text | `#1c71d8` | `#78aeed` |
| destructive background / as text | `#e01b24` / `#c01c28` | `#c01c28` / `#ff7b63` |
| dialog scrim | black at 14 % | black at 50 % |

On Ubuntu, the distribution's libadwaita may replace the blue accent with the desktop's (Yaru)
accent; Menkar's Classic uses the stock blue.

## Acceptance cases

Unless said otherwise: window 1280 × 800 at scale 1, theme `Default`, scheme Dark, style Terminal
workspace (so Catppuccin Mocha), sidebar shown at 300 px, a project "Client work" with a group
"api pair" (color `#5ec4b6`) holding two sessions and one session in no group, in two folders.

**Window and header**

- **LOOK-1** A first start opens a window of 1280 × 800 px titled "Menkar"; the header shows the
  title "Menkar" centered over the content area.
- **LOOK-2** Window background (content area, empty state) is `#1e1e2e`; the content header row has
  the same `#1e1e2e` (no separate bar color); the sidebar, including its header row, is `#181825`.
- **LOOK-3** The line between sidebar and content is 1 px of `fg` at 15 % over the background:
  `#38394b` in Mocha.
- **LOOK-4** With one tab open, the header shows (left to right) the sidebar toggle (checked: its
  background `fg` at 10 %, `#2f3042`), the New split button (tab-new icon, then a ▾ arrow after a
  thin separator), and no Close-all button; with a second tab open in any project of the window,
  the Close-all button appears right of the split button; closing back to one tab hides it.
- **LOOK-5** Window unfocused: the header and tab strip keep their colors and opacity (no fade).

**Sidebar (F29, K11, K36)**

- **LOOK-6** Press `F9`: the sidebar disappears, the content starts at the window's left edge, the
  toggle is unchecked. Press `F9` again: the sidebar is back at 300 px and the toggle checked.
- **LOOK-7** Press `Ctrl+B`, then `b`: the same as LOOK-6's first press; clicking the header toggle
  does it too; the three stay in step (after `F9` hides it, one click on the toggle shows it).
- **LOOK-8** Drag the divider to 420 px, wait 1 s, quit, start: the sidebar opens at 420 px and
  `state.json` has `"sidebar_width": 420`.
- **LOOK-9** Drag the divider toward the left edge: it stops at 220 px.
- **LOOK-10** With the sidebar at 300 px, widen the window from 1280 to 1600 px: the sidebar stays
  300 px, the content grows by 320 px.
- **LOOK-11** Hide the sidebar, quit, start: the sidebar is shown, at the width saved before hiding.
- **LOOK-12** Two windows; `F9` in one: the other's sidebar stays shown.
- **LOOK-13** The sidebar's header holds the project dropdown (stretched, button background
  `fg` at 10 % over mantle, measured `#2a2b3a`, showing "Client work" bold, then a ▾) and the ⚙ main
  menu button at its right; it has no window buttons. Its bottom holds "Add session", a full-width
  button 8 px from the sidebar's left, right and 6 px from bottom edges, measured 34 px tall.

**Rows**

- **LOOK-14** The project list shows a heading row "● api pair" (the ● in `#5ec4b6`, the text bold
  9 pt in overlay0 `#6c7086`), its two sessions, then a heading "No group" (no dot) and the third
  session. With every session in no group, no heading is shown.
- **LOOK-15** A session row shows, left to right: an 8 px status dot, the name (bold 11 pt, ellipsized
  at the end, color subtext0 `#a6adc8`), under it the folder's last component (9 pt, overlay0), then
  a 14 px context ring when there is a reading, then a ⋮ button. When all three sessions share one
  folder, no folder line is shown.
- **LOOK-16** Status dots in Terminal workspace (Mocha): stopped = transparent with a 1.5 px inner
  ring `#6c7086`; idle = transparent with a 1.5 px ring `#a6e3a1`; working = solid `#f9e2af`;
  done = solid `#a6e3a1`; blocked = solid `#f38ba8` with a 2 px outer halo of `#f38ba8` at 35 %.
- **LOOK-17** Status dots in Classic, any scheme: idle = 1.5 px ring `#2ec27e`; working = `#e5a50a`;
  done = `#2ec27e`; blocked = `#e01b24` (no halo); stopped = 1.5 px ring of the text color at 35 %.
- **LOOK-18** A session whose context is at 59 % draws a green ring (`rgb(0.40,0.75,0.45)` ≈
  `#66bf73`); at 60 % yellow (≈ `#f2bf40`); at 79 % yellow; at 80 % red (≈ `#eb5454`); at 100 %
  and above, red and full. The ring is the same in every theme and style.
- **LOOK-19** A ring at 25 %: the track is a full circle of the level color at 25 % opacity, the arc
  covers the quarter from 12 o'clock clockwise to 3 o'clock at full opacity, stroke 2.5 px, radius
  5.5 px inside the 14 × 14 box. For an estimated reading both are drawn at 45 % of those
  opacities and the tooltip reads "~25% of 200k (estimate)"; for a reported one "25% of 200k"; a
  1 000 000-token window reads "1M".
- **LOOK-20** A session with no reading shows no ring and takes no ring space.
- **LOOK-21** A session with Remote Control on shows a dim phone icon between its dot and its name,
  with the tooltip "Remote control on".
- **LOOK-22** The project dropdown with sessions blocked in other projects shows a red pill with
  their count right of the project name (Mocha: background `#f38ba8`, text `#181825`, bold,
  smaller text, radius 9 px, padding 0 6 px), tooltip "Sessions waiting for you"; with none, no pill.
  In Classic the pill is `#e01b24` with white text.

**Tab strip**

- **LOOK-23** One open tab "JWT auth" selected: the tab is a square rectangle of accent `#cba6f7`
  with text `#1e1e2e`, measured 34 px tall, starting 6 px right of the divider; the `+` sits right
  after it, 2 px away; the strip's background is `#1e1e2e`.
- **LOOK-24** Two tabs: the unselected one is a square rectangle of surface0 `#313244` with text
  subtext0 `#a6adc8` at full opacity; the tabs are 2 px apart.
- **LOOK-25** Classic, two tabs: the selected one has a background of `#D97757` at 22 % and a 3 px
  `#D97757` line along its bottom edge, its label bold; the unselected one is a flat button with
  its label at 60 % opacity.
- **LOOK-26** A tab titled with 40 characters shows its first 28 then "…"; hovering a resumed
  session's tab shows "{folder name} — {session id}"; a new session's tab "new {agent} session —
  {folder path}"; a file tab the file's path. (These tooltip texts are not translated in
  agent-tablet; Menkar passes them through t().)
- **LOOK-27** A tab's close × is at 70 % opacity; on hover it is at 100 % on a round background of
  the text color at 15 %; clicking it closes the tab without selecting it first.
- **LOOK-28** A tab whose sessions are both in "api pair" shows a `●` in `#5ec4b6` first; a tab
  mixing "api pair" and no-group sessions shows none.
- **LOOK-29** A working tab shows the yellow dot left of its title; an idle tab shows no dot.
- **LOOK-30** `Ctrl+B` pressed: "PREFIX" appears at the strip's right end in bold 0.8 em text,
  `#1e1e2e` on `#cba6f7`, padding 1 px 8 px, square; the next key hides it. Classic: white on
  `#3584e4`.

**Panes and terminal**

- **LOOK-31** A terminal tab (Terminal workspace): the terminal sits in a 1 px square frame, 12 px
  below the strip and 6 px from the left, right and bottom; the frame's top line carries the label
  "claude" (or "cursor", or "shell" for a split shell) in accent, 10 px from the frame's left, on
  the window background with 4 px either side, so the line is interrupted behind it.
- **LOOK-32** The focused pane's frame is accent `#cba6f7`; the other pane's frame is surface1
  `#45475a`. Moving focus with `Ctrl+B l` swaps the two colors.
- **LOOK-33** Classic: no frame line and no label around a terminal.
- **LOOK-34** The terminal's text area has 2 px top/bottom and 6 px left/right padding inside the
  frame; its colors are the theme's: Mocha background `#1e1e2e`, foreground `#cdd6f4`, ANSI 1
  `#f38ba8`.
- **LOOK-35** Split right: the two panes are side by side, separated by a 1 px line, each half the
  width; `Ctrl+B z` shows only the focused pane, with no other indicator; `Ctrl+B z` again restores
  both.
- **LOOK-36** `font` = `""`: the terminal uses the system monospace font at 10 pt (13.33 px);
  `font` = `"Monospace 14"`: every terminal in every window uses 14 pt at once.

**Themes**

- **LOOK-37** Theme `Nord`, scheme Dark or Light, Terminal workspace: sidebar `#282d35`, window
  `#2e3440`, selected tab `#b48ead` with text `#2e3440`, unselected tab `#424854`, focused frame
  `#b48ead`, unfocused frame `#505662`, idle dot ring `#a3be8c`.
- **LOOK-38** Theme `Dracula`: accent (selected tab, focused frame) `#bd93f9`, not ANSI 5
  `#ff79c6`.
- **LOOK-39** Theme `Default`, scheme Light, Terminal workspace: window `#eff1f5`, sidebar
  `#e6e9ef`, divider `#d6d9e0` (all measured), selected tab `#8839ef` with text `#eff1f5`,
  unselected tab `#ccd0da` with text `#6c6f85`, terminal background `#eff1f5` and text `#4c4f69`.
- **LOOK-40** Scheme `Follow system`, theme `Default`, the desktop switches dark → light: within the
  same second every window turns from Mocha to Latte, terminals included, without a restart.
- **LOOK-41** Theme `Solarized Light` with scheme Dark, Terminal workspace: the window is light
  (`#fdf6e3`), the sidebar `#f2dda6`.
- **LOOK-42** Switching Interface style from Terminal workspace to Classic in Preferences: at once
  the UI font becomes the system sans font, the frame labels disappear, the sidebar takes the
  window's background (dark: `#242424`), and the terminals keep the theme's palette.
- **LOOK-43** Classic, theme `Default`: the terminal uses its own default colors (no theme).
- **LOOK-44** `terminal_theme` = `"Matrix"` in `state.json`: the app starts as with `Default`, and
  Preferences shows `Default` selected.

**Empty states, dialogs, Usage**

- **LOOK-45** The current project has no tab: the content shows the terminal icon (128 px, text color
  at 55 %), "No session open" (20 pt, weight 800) and "Pick a session from the sidebar, or start a
  new one." centered; the tab strip shows only `+`.
- **LOOK-46** A project "Empty" with no session: the sidebar shows the list icon (96 px), "Empty has
  no sessions" (18 pt), "Add one Claude already knows, or start a new one in any folder." and a
  pill "Add session" in accent (Mocha `#cba6f7`, text `#1e1e2e`, padding 10 px 32 px, fully
  rounded); clicking it opens Add session on Existing.
- **LOOK-47** No session found anywhere: Add session → Existing shows the folder icon, "No sessions
  found" and "Run claude in a project directory first — sessions will appear here automatically."
- **LOOK-48** Any dialog over the window dims it with black at 50 % in dark (measured: sidebar
  `#181825` → `#0c0c12`) and 14 % in light.
- **LOOK-49** Add session opens a 560 × 640 dialog whose list area is mantle `#181825` and whose
  header (Existing / New switcher) is `#1e1e2e`; the selected switcher button is `fg` at 10 %
  (`#2f3042`).
- **LOOK-50** Usage, By day, dark: the bars of the first three projects are `#3987e5`, `#d95926`,
  `#199e70` (measured identical); light: `#2a78d6`, `#eb6834`, `#1baf7a`; "Other" is `#8f8e8a` in
  dark and `#8a8986` in light, whatever the theme.
- **LOOK-51** Usage, Totals, Mocha: the table rows sit on a card of surface0 `#313244` with 12 px
  rounded corners; rows are square-cornered.
- **LOOK-52** A toast ("The projects file could not be read…") is a fully rounded pill of black at
  70 % with white text at 90 %, 12 px from the content's sides and 24 px from its bottom.

## Look

Reference screenshots, Terminal workspace, demo data: `-dark` is Catppuccin Mocha, `-light` is
Catppuccin Latte (theme `Default` in each scheme). Pixel samples of the light set confirm the Latte
roles: window `#eff1f5`, sidebar `#e6e9ef`, selected tab and focused frame `#8839ef`, divider
`#d6d9e0`, dialog scrim 14 % (sidebar `#e6e9ef` → `#c5c8cd`).

| Screenshots | Show |
|---|---|
| `img/project-list-dark.png`, `img/project-list-light.png` | Window 1024 × 768, sidebar with a group and "No group", empty content |
| `img/context-rings-dark.png`, `img/context-rings-light.png` | Rings: a yellow one (60–79 %), dim ones |
| `img/two-windows-dark.png`, `img/two-windows-light.png` | A second window at 1280 × 800 on project Default |
| `img/open-tab-dark.png`, `img/open-tab-light.png` | A selected tab with group ●, ring and ×; the framed terminal labelled "claude" |
| `img/tab-ring-dark.png`, `img/tab-ring-light.png` | The ring on a tab |
| `img/tab-menu-dark.png`, `img/tab-menu-light.png` | The tab menu (sans font), a tooltip (monospace), a file tab |
| `img/project-dropdown-dark.png`, `img/project-dropdown-light.png` | The project dropdown's popover |
| `img/remote-control-menu-dark.png`, `img/remote-control-menu-light.png` | A toast, a row's phone icon |
| `img/add-session-existing-dark.png`, `img/add-session-existing-light.png`, `img/add-session-new-dark.png`, `img/add-session-new-light.png` | The Add session dialog, the dimmed window behind it |
| `img/preferences-dark.png`, `img/preferences-light.png`, `img/about-dark.png`, `img/about-light.png` | Preferences and About dialogs |
| `img/usage-totals-dark.png`, `img/usage-totals-light.png`, `img/usage-by-day-dark.png`, `img/usage-by-day-light.png`, `img/usage-month-dark.png`, `img/usage-month-light.png`, `img/usage-by-category-dark.png`, `img/usage-by-category-light.png` | The Usage window in both chart palettes |
| `img/file-tab-dark.png`, `img/file-tab-light.png` | A file tab in the strip ("notes.md •") |

### Fonts

- **Terminal workspace UI**: the whole window's font family is `monospace` (the system's monospace
  font; DejaVu Sans Mono / Ubuntu Sans Mono on the reference machine) at the system UI size (11 pt
  there). Popover menus (the ⋮ row menu, the tab menu, the `+` menu, the main menu) and the project
  dropdown's popover render in the system sans font (measured in `img/tab-menu-dark.png` and
  `img/project-dropdown-dark.png`); tooltips, dialogs, toasts and the Usage window are monospace.
- **Classic UI**: the system sans font at the system UI size.
- **Type scale** (both styles): bold body ("heading") 11 pt weight 700 — session names, the
  project name, the Usage month; caption 9 pt — folder lines, subtitles, footers; caption heading
  9 pt weight 700 — group headings; status-page title 20 pt weight 800 (18 pt in the compact pages
  of the sidebar and the history); buttons bold; the Usage chart's axis and tick labels "Sans 8"
  (sans in both styles); numbers in the Usage table use tabular figures.
- **Terminal**: the `font` setting, or the system monospace at 10 pt (Preferences shows it as
  "Monospace Regular 13.33px"). Menkar loads no font from the network: system fonts only.
- **Dim text**: in Classic, dim labels are the text color at 55 % opacity. In Terminal workspace,
  inside the sidebar (and the history, which carries the same sidebar class) dim labels are
  overlay0 at full opacity; elsewhere they are at 55 %.

### Window and header

- Default size **1280 × 800**, not remembered. Title "Menkar". Window icon: the app icon (below).
- Layout: a horizontal split; left the sidebar (default 300 px, minimum 220 px), a 1 px divider
  (`fg` at 15 %), right the content: header row, tab strip row, then the tab's content (or the empty
  state), with toasts over the content.
- **Content header** (measured ≈ 43 px tall; min-height 34 px in Terminal workspace, 46 px in
  Classic), no own background (it shows the window background), no bottom line. Left to right:
  sidebar toggle (`sidebar-show-symbolic`, a window outline with a left panel; tooltip "Toggle
  sidebar (F9)"), the New split button (`tab-new-symbolic`, a square with a plus, then ▾; tooltip
  "New session (Ctrl+Shift+T)"; its menu is `terminal.md`/`sessions.md`'s M7–M12), Close all tabs
  (`tab-close-symbolic`, bundled: a 13 × 13 square with 3 px rounded corners, stroke 1.25, with an ×
  inside; tooltip "Close all tabs"), then the centered title, then the window's minimize / maximize
  / close buttons at the right (round, measured background `fg` at 10 %).
- **Header buttons** are flat: transparent; hover `fg` at 7 %; pressed 16 %; checked 10 %
  (checked+hover 13 %). Square corners in Terminal workspace (flat buttons), 6 px rounded in Classic.
  Keyboard focus: a 2 px outline of the accent at 50 %.

### Sidebar

- Background: mantle in Terminal workspace (also behind its header, list and scroll area); in
  Classic, the window background (no separate sidebar color).
- **Sidebar header**: the project dropdown as its title, stretched to fill (measured 208 × 34 px at
  300 px width, starting 46 px from the sidebar's left), then the ⚙ main menu button
  (`emblem-system-symbolic`, a gear; tooltip "Main menu"; menu M1–M6). No window buttons.
- **Project dropdown button**: a normal (not flat) button, padding 4 px 8 px, background `fg` at 10 %
  (hover 15 %, open 30 %: measured `#4e5163` open in Mocha), content: the project's name (bold,
  ellipsized, left-aligned, filling), the blocked-count pill when > 0, a ▾ (`pan-down-symbolic`).
  Tooltip "Projects".
- **Project dropdown popover** (`img/project-dropdown-dark.png`): at least 280 px wide, popover
  background `bg` with 12 px rounded corners and an arrow pointing at the button; inside, the list
  of projects (its background mantle, since it is under the sidebar), a 1 px separator, then an
  entry "New project name" (background surface0, square) and a "Create" button (accent background,
  `bg` text), then an error line in the error color when a name is refused. Each project row
  (spacing 6 px, 4 px side margins): a ✓ (`object-select-symbolic`) visible only on the current
  project (the space is kept on the others), the name (ellipsized, filling), a blocked pill when that
  project has blocked sessions, "open in another window" (dim caption) when it is open elsewhere,
  the member count (dim; tooltip "Sessions in this project"), a ✎ (`document-edit-symbolic`, a
  pencil; "Rename project") and a 🗑 (`user-trash-symbolic`, a trash can; "Delete project"), both
  flat.
- **Add session** button at the bottom: margins 6 px top/bottom, 8 px left/right; a normal button
  (`fg` at 10 % over mantle, measured `#2a2b3a`), bold label "Add session".
- The list scrolls vertically only; no horizontal scroll.

### Rows

- **List**: 6 px padding above and below the list. Each row: min-height 36 px, padding 0 8 px,
  margin 0 6 px 2 px (6 px either side, 2 px below); Classic corners 6 px, Terminal workspace
  corners square. Hover `fg` at 7 %; pressed 16 %; no row is shown as selected. In Terminal
  workspace the row's text color is subtext0.
- **Group heading row** (not clickable): padding 10 px 10 px 4 px 10 px, spacing 8 px: a `●` in the
  group's color (none for "No group"), the name in caption heading, dim. Group colors are assigned
  in turn from `#5ec4b6` (teal), `#c17be0` (violet), `#e0b45b` (amber), `#7fb2ff` (blue), `#e57c9a`
  (pink): a new group takes the color at position (number of groups the project already has) mod 5,
so the first is teal; a stored group without a color is teal; the same in every theme.
- **Session row** (`img/project-list-dark.png`): margins 6 px top/bottom, 10 px left, 4 px right,
  spacing 8 px: status dot; the phone icon when Remote Control applies (`phone-symbolic`, a mobile
  phone, dim; its tooltip one of "Remote control on", "Remote control from this session's next
  start, or type /rc in it", "Remote control until this session restarts"); the text column (name,
  then the folder line); the context ring; the ⋮ button (`view-more-symbolic`, three vertical dots,
  flat; tooltip "Actions for {name}"). Measured: 48 px from one two-line row to the next.
- **Status dot**: 8 × 8 px circle; its base color is the text color at 25 %. States:

| State | Classic | Terminal workspace |
|---|---|---|
| idle | transparent, 1.5 px inner ring `#2ec27e` | transparent, 1.5 px inner ring green |
| working | `#e5a50a` | yellow |
| done | `#2ec27e` | green, no ring |
| blocked | `#e01b24` | red, plus a 2 px outer halo of red at 35 % |
| stopped (no tab) | transparent, 1.5 px inner ring of the text color at 35 % | transparent, 1.5 px inner ring overlay0 |
| open (history rows: has a tab) | `#2ec27e` | transparent, 1.5 px inner ring green |
| attention (history rows: the tab wants attention) | `#3584e4` | yellow |

- **Context ring** (`img/context-rings-dark.png`, `img/tab-ring-dark.png`): a 14 × 14 px drawing,
  vertically centered, hidden without a reading. Radius 5.5 px (half the size minus 1.5), stroke
  2.5 px. Levels: ok below 60 %, warn from 60 %, full from 80 %; colors ok `rgb(0.40, 0.75, 0.45)`,
  warn `rgb(0.95, 0.75, 0.25)` (measured `#f3bf40`), full `rgb(0.92, 0.33, 0.33)`, the same in every
  theme and style. The track: a full circle at 25 % opacity; the fill: an arc from 12 o'clock
  clockwise over the percentage (clamped to 0–100) at 100 %. An estimated reading draws both at
  45 % of those. Tooltip "{pct}% of {window}" or "~{pct}% of {window} (estimate)", the percentage
  rounded to an integer, the window as "{n}k" or "{n}M" (from 1 000 000).
- **History rows** (Add session → Existing; behaviour in `sessions.md`): an indented card with a
  left guide line. Classic: margins 20 px left, 16 px right; background text color at 6 %, left
  border 2 px of the text color at 15 %, corners 0 8 8 0; hover background 10 % and border 30 %.
  Terminal workspace: margins 20 px left, 6 px right; transparent; left border 1 px surface0; square;
  hover background `bg`. Inside (margins 8 px top/bottom, 10 px left, 12 px right, lines 2 px
  apart): a first line (spacing 6 px) with the select check (selection mode only), the status dot,
  the agent's icon (dim; `agent-claude-symbolic`, bundled: an eight-spoke asterisk, four 1.4 px
  round-capped strokes through the center of a 16 × 16 box; `agent-cursor-symbolic`, bundled: a
  mouse-pointer arrow), the name (bold, ellipsized, filling), the state badge (waiting:
  `dialog-question-symbolic`, a question mark in a circle, `#e5a50a`, tooltip "Claude is waiting
  for your reply"; interrupted: `process-stop-symbolic`, a stop sign, `#e01b24`, tooltip "You
  interrupted Claude here"; both fixed colors in every theme), a flat ✎ ("Rename session"), and the
  pick button ("Add" in accent; "Added" or "Move from <project>" flat); then the subtitle, the
  folder path (ellipsized at the start, so the last folder stays visible; only when the setting is
  on) and the preview, each a dim caption.
- **History folder heading**: spacing 6 px: ▸/▾ (`pan-end-symbolic` collapsed, `pan-down-symbolic`
  open; dim), a folder icon (dim), the folder's name in UPPERCASE caption heading, dim, filling;
  a count badge (text color at 10 %, padding 1 px 8 px, 0.8 em; corners 10 px in Classic, square in
  Terminal workspace) (`img/add-session-existing-dark.png`).

### Tab strip

- One row under the header, background the window background. Padding: Terminal workspace 2 px top,
  6 px left and right, 0 bottom; Classic 3 px top and bottom, 6 px left and right. Tabs 2 px apart,
  scrolled horizontally without a scrollbar when they overflow; the `+` follows the last tab.
- **Tab** (a button): padding 2 px 10 px, min-height 22 px in Terminal workspace (measured 34 px
  tall overall with the theme's font). Content spacing 6 px: the group `●` (when all its sessions
  share one group), the status dot (unless idle), the ring (the fullest of its sessions' readings),
  the title (at most 28 characters wide, ellipsized at the end; a split tab's title is its two
  names joined by " │ "), the close ×. Bold label in both styles.

| | Terminal workspace | Classic |
|---|---|---|
| Unselected | background surface0, text subtext0 at 100 %, square | flat (transparent; hover `fg` 7 %), label at 60 %, 6 px corners |
| Selected | background accent, text `bg`, square | background `#D97757` at 22 % and an inset 3 px `#D97757` bottom line, bold label |

- **Close ×** (`window-close-symbolic`, an ×): padding 2 px, margin-right −4 px, fully round,
  70 % opacity; hover 100 % on a background of the text color at 15 %. Pointer cursor. Tooltip
  "Close tab".
- **`+`** at the end of the tabs: a flat button labelled "+" (tooltip "New session in this
  project").
- **PREFIX pill**: the text "PREFIX" (not translated), bold, 0.8 em, padding 1 px 8 px, margin 0
  6 px, background accent, text on accent (`bg` in Terminal workspace, white in Classic), square
  corners; vertically centered at the strip's right end.

### Panes and terminal

- **Frame** (Terminal workspace only): 1 px solid surface1, square, margin 12 px top (room for the
  label), 6 px right, bottom and left; the focused pane's frame (keyboard focus inside it) is accent.
  This is the only focus indicator. A tab with one pane shows its frame in accent while the terminal
  has focus.
- **Frame label**: the agent's id ("claude", "cursor") or "shell", in accent, on the window
  background, padding 0 4 px, pulled up onto the frame's top line (its center on the line) and 10 px
  in from the frame's left (`img/open-tab-dark.png`: line at y = 149 px, label from x ≈ 383 px).
- **Classic**: no frame border, no label, no focus indicator.
- **Terminal**: padding 2 px top/bottom, 6 px left/right; colors: the theme's `fg`, `bg` and 16
  ANSI colors; font as under Fonts; scrollback from the setting; the pointer hides while typing.
  A message the app writes into the terminal (e.g. "[session manager] …") has its prefix in bold
  yellow (ANSI 1;33).
- **Split**: two panes in a horizontal (side by side) or vertical (stacked) split, separated by a
  1 px line (`fg` at 15 %) with an 8 px invisible drag zone; each starts at half the space and
  neither can be dragged to nothing. **Zoom** hides the other pane entirely; there is no badge or
  border change for a zoomed pane.
- **Find bar** (`Ctrl+Shift+G`, `terminal.md`): above the terminal, a search entry "Find in
  terminal…", ↑ (`go-up-symbolic`, "Previous match"), ↓ (`go-down-symbolic`, "Next match") and a
  close button.

### Dialogs

- **Alert dialogs** (rename, text input, confirmation, error, "Ctrl+B, then…", "Open in which
  window?", the advanced new session): background dialog color (Terminal workspace `bg`; Classic
  `#fafafa` / `#383838`), 13 px corners, message area padding 24 px 30 px, heading then body 10 px
  apart, an optional entry, then a row of response buttons (padding 10 px 14 px, square, divided by
  1 px lines); the suggested response's text is the accent color, a destructive one's the
  destructive color; Enter triggers the default response. The prefix help's body is a monospace
  block, one line per key: the key padded to 8 columns, a space, the description.
- **Sheet dialogs**: 12 px corners, the window behind dimmed (black 50 % dark, 14 % light),
  background the window background (Terminal workspace `bg`). Sizes: Add session 560 × 640
  (title "Add a session to {name}", a header with the Existing (`document-open-recent-symbolic`, a
  clock) / New (`list-add-symbolic`, a plus) switcher, icon and label side by side, the selected one
  at `fg` 10 %); Quick switcher / Go to agent 560 × 460 (a search entry 10 px from top and sides,
  rows with margins 7 px top/bottom, 12 px sides: dot + bold name, dim caption under it; the
  selected row at `fg` 10 %); Session details 480 × 560; MCP servers 540 × 600; Open file 560 wide.
- **Preferences**: two pages, General (`preferences-system-symbolic`, crossed tools) and
  Integrations (`application-x-addon-symbolic`, a puzzle piece), switched from the dialog's header;
  groups of rows on cards (surface0, 12 px corners; rows square in Terminal workspace). Each Color
  theme row carries a 130 × 22 px swatch: the theme's `bg` filling it, a 10 px block of `fg` at
  x = 6 px, 4 px from top and bottom, and ANSI 1–6 as six 13 px blocks 3 px apart ending 3 px
  from the right edge (the first at x = width − 96 px), 4 px from top and bottom; `Default`'s swatch
  is plain grey `rgb(0.55, 0.55, 0.55)`. In agent-tablet's Terminal workspace style the Font row's
  title wraps one letter per line (visible in `img/preferences-dark.png`): a defect, not to be
  reproduced.
- **About**: the stock about window (`img/about-dark.png`; contents in `preferences.md`).
- **Popover menus** (row ⋮, tab, `+`, main): popover background `bg` (Classic `#ffffff` /
  `#383838`), 12 px corners, 8 px inner padding, minimum 120 px wide, hovered item at `fg` 10 %
  (measured `#2f3042` in Mocha); sections separated by lines. A session row's menu points at its ⋮
  (also when opened by right-click); a history row's right-click menu opens at the pointer, without
  an arrow.
- **Tooltips**: black at 80 %, white text, 1 px border of white at 10 %, 9 px corners, padding 6 px
  10 px (measured `#060609` over Mocha).
- **Toasts**: black at 70 %, white text at 90 %, fully rounded, padding 6 px (12 px on the left),
  margin 12 px, 24 px from the bottom, centered over the content.
- **Entries**: min-height 34 px, padding 0 9 px, background `fg` at 10 % (in the sidebar
  surface0), 6 px corners in Classic, square in Terminal workspace; focused: border and a 2 px
  outline of the accent at 50 %.
- **Pill buttons** (empty-state "Add session", "Start session", Open file's button): padding
  10 px 32 px, fully rounded, accent background.

### Usage window

(Behaviour in `usage.md`; `img/usage-totals-dark.png`, `img/usage-by-day-dark.png`,
`img/usage-month-dark.png`, `img/usage-by-category-dark.png`.)

- A separate window, 760 × 600, titled "Usage", on top of the main window, themed like it (in
  Terminal workspace: `bg` background, monospace).
- Header: the period switch as its title: linked toggle buttons Today | 7 days | 30 days | Month
  (the checked one `fg` at 30 %, measured `#52556a`; the others `fg` at 10 %).
- Body: margins 12 px, items 12 px apart: the month stepper (only for Month: ‹ month name
  (16 characters wide, bold) › and an "All" toggle, 6 px apart, centered); the view row (centered,
  12 px apart: Totals | By day; in By day also Exec | Tokens | Cost and Project | Category); then the
  table or the chart; then the footer (dim, wrapping) and the classification hint (dim).
- **Table**: a heading row (12 px side margins): "Project / session" (dim, filling), then Exec,
  Blocked, Tokens, Cost right-aligned 7, 8, 8, 9 characters wide; then the rows on a boxed list
  (card background, 12 px corners). Each row: margins 6 px top/bottom, 12 px right, left 12 px +
  18 px per depth; a flat ▾/▸ toggle for rows with children (an invisible one keeps the space on
  leaves); the name (bold for projects, ellipsized); the four numbers.
- **Chart**: 260 px tall, full width; plot inset 64 px left, 8 px right, 10 px top, 22 px bottom.
  Three horizontal grid lines at 0, 50 and 100 % of the axis top (the next 1, 2 or 5 × a power of
  ten above the tallest bar), 1 px, the text color at 35 % (base line) and 12 %; their values right-
  aligned 6 px left of the plot at 70 %. Bars: one per bucket, centered in its slot, width
  70 % of the slot clamped to 2–28 px; stacked segments separated by a 2 px gap, the top segment
  with rounded top corners (radius min(4 px, half the bar)); tick labels under the bars at 70 %,
  thinned so ticks stay at least 28 px apart. Legend centered under the chart, items 18 px apart, a
  12 × 12 px square swatch then the name, 6 px apart.
- **Series colors**, by slot (projects use the first five, the largest first; categories one slot
  each in the order Plan, Design, Build, Test, Deploy, Maintain, Other):

| Slot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | "Other" projects / Unclassified |
|---|---|---|---|---|---|---|---|---|
| Light | `#2a78d6` | `#eb6834` | `#1baf7a` | `#eda100` | `#e87ba4` | `#008300` | `#6250d6` | `#8a8986` |
| Dark | `#3987e5` | `#d95926` | `#199e70` | `#c98500` | `#d55181` | `#008300` | `#9085e9` | `#8f8e8a` |

  The light/dark set follows the scheme, not the theme.

### Other surfaces' fixed colors

Named here so a theme change is known not to touch them:
- A file tab's read-only bar: the accent at 15 %; its changed-on-disk bar: the warning color at 30 %
  (`files.md`).
- Chat tabs (`chat.md`): the user's bubble `#D97757` with white text, the assistant's the text
  color at 8 %, 8 px 12 px padding, 14 px corners; tool lines 0.85 em at 60 %, padding 2 px 4 px.
- The question card over the terminal (`chat.md`; not carried over to Menkar, decision 1.7):
  border 1 px `#D97757` at 60 %, 12 px corners, 12 px padding.

### Icons

GTK symbolic icon names are given as the source; Menkar draws or picks an equivalent of each.

| Where | Icon | Depicts |
|---|---|---|
| Header: sidebar toggle | `sidebar-show-symbolic` | A window outline with a left panel |
| Header: New split button | `tab-new-symbolic` | A square with a plus |
| Header: Close all tabs | `tab-close-symbolic` (bundled) | A rounded square with an × |
| Dropdown arrows, history open group, Usage open row, Expand all | `pan-down-symbolic` | A small downward triangle |
| History collapsed group, Usage closed row | `pan-end-symbolic` | A small right-pointing triangle |
| History: Collapse all | `pan-up-symbolic` | A small upward triangle |
| Sidebar: main menu | `emblem-system-symbolic` | A gear |
| Session row: actions | `view-more-symbolic` | Three vertical dots |
| Session row: Remote Control | `phone-symbolic` | A mobile phone |
| Project dropdown: current | `object-select-symbolic` | A check mark (also History: Select sessions) |
| Rename (project, session) | `document-edit-symbolic` | A pencil |
| Delete project, trash selected | `user-trash-symbolic` | A trash can |
| Tab close | `window-close-symbolic` | An × |
| Empty content | `utilities-terminal-symbolic` | A terminal window with `>_` |
| Empty project | `view-list-symbolic` | A bulleted list |
| No sessions found, history group, New: chosen folder | `folder-symbolic` | A closed folder |
| New: "Another folder…" | `folder-open-symbolic` | An open folder |
| Claude rows | `agent-claude-symbolic` (bundled) | An eight-spoke asterisk |
| Cursor rows | `agent-cursor-symbolic` (bundled) | A mouse-pointer arrow |
| Waiting badge | `dialog-question-symbolic` | A question mark in a circle |
| Interrupted badge, chat Stop | `process-stop-symbolic` | A stop sign |
| History: refresh | `view-refresh-symbolic` | A circular arrow |
| Hide selected | `view-conceal-symbolic` | A crossed-out eye |
| Open selected in tabs | `tab-new-symbolic` | A square with a plus |
| Add session: Existing / New | `document-open-recent-symbolic` / `list-add-symbolic` | A clock / a plus |
| Reset font | `edit-clear-symbolic` | A backspace key with an × |
| Preferences pages | `preferences-system-symbolic` / `application-x-addon-symbolic` | Crossed tools / a puzzle piece |
| Find: previous / next | `go-up-symbolic` / `go-down-symbolic` | Up / down arrows |
| Usage: previous / next month | `go-previous-symbolic` / `go-next-symbolic` | Left / right chevrons |
| Usage loading / too new | `content-loading-symbolic` / `dialog-warning-symbolic` | A loading indicator / a triangle with `!` |
| Chat: Send | `document-send-symbolic` | A paper plane |
| Replay: previous / play / pause / next | `media-skip-backward-symbolic` / `media-playback-start-symbolic` / `media-playback-pause-symbolic` / `media-skip-forward-symbolic` | Media controls |

**The app icon** (128 × 128, a placeholder in agent-tablet): a tablet — an outer rounded rectangle
`#2b2d3a` (radius 16) and a screen `#1b1c26` (radius 9); on the left a session list (a selected row
`#c9a6ff` with a dark dot, three rows `#4a4d63`); on the right a pane `#25273a` with a green line
`#7fd1a8`, two grey lines `#8a8ea8` and a `>` prompt stroke in `#c9a6ff`. Whether Menkar keeps it
is the human's call.

### Not determined from the code

- The Classic terminal's colors with theme `Default` are the terminal widget's built-in defaults
  (VTE's); agent-tablet sets none. Menkar's xterm.js defaults differ (white on black); which pair
  Classic `Default` uses is a decision.
- The exact header height depends on the toolkit's padding: measured ≈ 43 px in Terminal workspace.
- In agent-tablet's Terminal workspace style the empty-content title and description wrap at
  about ten characters a line (`img/project-list-dark.png`), a side effect of the monospace font in
  the stock status page rather than a choice; Menkar centers them in a normal-width column unless
  the human wants the narrow look.
