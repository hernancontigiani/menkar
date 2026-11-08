# History of `docs/spec/look.md`

## Acceptance cases

> Left on 2026-11-08: built by plan 08, described in `docs/window.md`.
- **LOOK-2** Window background (content area, empty state) is `#1e1e2e`; the content header row has
  the same `#1e1e2e` (no separate bar color); the sidebar, including its header row, is `#181825`.
- **LOOK-3** The line between sidebar and content is 1 px of `fg` at 15 % over the background:
  `#38394b` in Mocha.
- **LOOK-6** Press `F9`: the sidebar disappears, the content starts at the window's left edge, the
  toggle is unchecked. Press `F9` again: the sidebar is back at 300 px and the toggle checked.
- **LOOK-23** One open tab "JWT auth" selected: the tab is a square rectangle of accent `#cba6f7`
  with text `#1e1e2e`, measured 34 px tall, starting 6 px right of the divider; the `+` sits right
  after it, 2 px away; the strip's background is `#1e1e2e`.
- **LOOK-37** Theme `Nord`, scheme Dark or Light, Terminal workspace: sidebar `#282d35`, window
  `#2e3440`, selected tab `#b48ead` with text `#2e3440`, unselected tab `#424854`, focused frame
  `#b48ead`, unfocused frame `#505662`, idle dot ring `#a3be8c`.
- **LOOK-39** Theme `Default`, scheme Light, Terminal workspace: window `#eff1f5`, sidebar
  `#e6e9ef`, divider `#d6d9e0` (all measured), selected tab `#8839ef` with text `#eff1f5`,
  unselected tab `#ccd0da` with text `#6c6f85`, terminal background `#eff1f5` and text `#4c4f69`.
