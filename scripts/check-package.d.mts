export interface Package {
  version: string
  control: string
  files: string[]
  postinst: string
  profile: string
  desktop: string
}
export function checkPackage(pkg: Package, flavour?: 'menkar' | 'sandbox'): string[]
export const FLAVOURS: Readonly<
  Record<
    'menkar' | 'sandbox',
    { name: string; app: string; release: string; builderConfig: string }
  >
>
export function sharedPaths(sandbox: string[], menkar: string[], directories: string[]): string[]
