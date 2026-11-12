import type { Stats } from 'node:fs'
import { readdir, readFile, stat, unlink } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { controlPaths, writeTextAtomic } from './files'

// A session's first prompt reaches its command line as a file the shell reads. A
// `prompt_file` an agent names is read here, in main, and copied: the command never reads a path an
// agent chose. The sentences go back to the agent that asked.

export const PROMPT_MAX_BYTES = 100 * 1024
export const PROMPT_KEEP_MS = 24 * 60 * 60 * 1000

export async function readPromptFile(
  path: string,
): Promise<{ text: string } | { refusal: string }> {
  if (!isAbsolute(path)) return { refusal: 'The prompt_file must be an absolute path.' }
  let info: Stats
  try {
    info = await stat(path)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR')
      return { refusal: 'There is no file at the prompt_file path.' }
    if (code === 'EACCES') return { refusal: 'Menkar may not read the prompt_file.' }
    throw error
  }
  if (!info.isFile()) return { refusal: 'The prompt_file must be a file, not a folder.' }
  if (info.size > PROMPT_MAX_BYTES) return { refusal: 'The prompt_file is larger than 100 KiB.' }
  return promptText(await readFile(path))
}

// The same checks for a prompt given inline.
export function promptText(bytes: Uint8Array): { text: string } | { refusal: string } {
  if (bytes.byteLength > PROMPT_MAX_BYTES) return { refusal: 'The prompt is larger than 100 KiB.' }
  if (bytes.includes(0)) return { refusal: 'The prompt holds NUL bytes.' }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  } catch (error) {
    if (error instanceof TypeError) return { refusal: 'The prompt is not UTF-8 text.' }
    throw error
  }
}

// The copy the command line reads, by the request's id.
export async function savePrompt(id: string, text: string): Promise<string> {
  const { prompts } = controlPaths()
  await writeTextAtomic(prompts, `${id}.md`, text)
  return join(prompts, `${id}.md`)
}

// Copies older than a day are deleted: the session they started read them long ago.
export async function sweepPrompts(now: number): Promise<void> {
  const { prompts } = controlPaths()
  let names: string[]
  try {
    names = await readdir(prompts)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  for (const name of names) {
    const path = join(prompts, name)
    const { mtimeMs } = await stat(path)
    if (now - mtimeMs > PROMPT_KEEP_MS) await unlink(path)
  }
}
