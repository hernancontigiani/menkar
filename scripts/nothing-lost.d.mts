export function mirrorOf(path: string): string | null
export function removedLines(diff: string): Array<[number, string]>
export function check(root: string, path: string, base?: string): string[]
export function mirroredDocuments(root: string): string[]
export function main(paths: string[], base?: string): number
