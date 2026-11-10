# History of `docs/files.md`

## The editor and the preview

> Left on 2026-11-10: the editor's syntax colours now come from the theme.
  is bundled into the renderer, so it is not a module the installer carries. The editor follows
  the app's light/dark state, not the color theme (two `EditorView.theme`s in a `Compartment`).

## The editor and the preview

> Left on 2026-11-10: the Ubuntu theme was removed (decision 1.40, amending 1.35).
  the CSS variables every theme sets, so each theme and scheme, Ubuntu's included, colours the
