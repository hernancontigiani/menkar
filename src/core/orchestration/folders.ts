// The folders of the panes whose agent runs, each once, in the order the panes come.
export function teamFolders(
  panes: readonly { readonly cwd?: string | null | undefined; readonly running: boolean }[],
): string[] {
  return [...new Set(panes.flatMap((p) => (p.running && p.cwd ? [p.cwd] : [])))]
}
