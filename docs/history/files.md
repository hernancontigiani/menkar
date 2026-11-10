# History of `docs/files.md`

## The editor and the preview

> Left on 2026-11-10: the editor's syntax colours now come from the theme.
  is bundled into the renderer, so it is not a module the installer carries. The editor follows
  the app's light/dark state, not the color theme (two `EditorView.theme`s in a `Compartment`).
