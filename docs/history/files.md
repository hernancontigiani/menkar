# History of `docs/files.md`

## The editor and the preview

> Left on 2026-11-10: the editor's syntax colours now come from the theme.
  is bundled into the renderer, so it is not a module the installer carries. The editor follows
  the app's light/dark state, not the color theme (two `EditorView.theme`s in a `Compartment`).

## The editor and the preview

> Left on 2026-11-10: the Ubuntu theme was removed (decision 1.40, amending 1.35).
  the CSS variables every theme sets, so each theme and scheme, Ubuntu's included, colours the

## The editor and the preview

> Left on 2026-11-10: one VS Code theme by the scheme, no Default (1.41 as amended), and a Terminal colors setting (1.42).
- **A theme may bring its own syntax colours** (decision 1.39): `syntaxOf` in `src/core/theme.ts`
  maps each syntax role to the theme's roles, unless the theme lists its own, used for a dark
  editor only. VS Code Dark lists VS Code's Dark+ token colours. The look sets them as
  `--syntax-<role>` variables, which the `HighlightStyle` reads.

## The file check and read only

> Left on 2026-11-12: files under Menkar's plugin folder open read only too (decision 1.91, plan 34).
  read only as well. The editor is not editable then, and `saveBuffer` refuses the agents' data

## The file check and read only

> Left on 2026-11-20: "Ask an agent" starts the focused agent pane's agent, else the agent last started (decision 1.155 Q2, plan 39 P1b.6).
  not, has the button at the left of its Save and Preview row. It starts a new Claude session in a
  tab right after the file's tab, in the shown project, through the same path as a new session
