import type { en } from './en'

// Complete, not Partial: a string missing in Spanish is a compile error.
export const es: Record<keyof typeof en, string> = {}
