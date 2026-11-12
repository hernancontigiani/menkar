// The name a session started to answer questions about a file takes (decision 1.95): unique among
// the names `taken`, by a number after it.
export function askName(fileName: string, taken: ReadonlySet<string>): string {
  const base = `about ${fileName}`
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base} ${n}`)) n += 1
  return `${base} ${n}`
}
