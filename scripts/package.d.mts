export function debianRevision(tree: {
  count: number
  hash: string
  dirty: boolean
  now: Date
}): string
export function packageFlavour(argv: string[], built: string | null): 'menkar' | 'sandbox'
export function packageTargets(argv: string[], flavour: 'menkar' | 'sandbox'): Array<'deb' | 'rpm'>
export const BUILDER_CONFIG: { menkar: string; sandbox: string }
