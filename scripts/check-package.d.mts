export interface Package {
  version: string
  control: string
  files: string[]
  // app.asar's files, `/out/main/index.js`
  asar: string[]
  postinst: string
  profile: string
  desktop: string
}
export function checkPackage(pkg: Package, flavour?: 'menkar' | 'sandbox'): string[]
export interface Rpm {
  version: string
  info: string
  requires: string[]
  files: string[]
  // app.asar's files, `/out/main/index.js`
  asar: string[]
  postinst: string
  profile: string
  desktop: string
}
export function checkRpm(rpm: Rpm): string[]
export const FLAVOURS: Readonly<
  Record<
    'menkar' | 'sandbox',
    { name: string; app: string; release: string; builderConfig: string }
  >
>
export function sharedPaths(sandbox: string[], menkar: string[], directories: string[]): string[]
export const ASAR_HEADER_BYTES: number
export function asarEntries(bytes: Buffer): string[]
