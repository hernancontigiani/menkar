export interface Package {
  version: string
  control: string
  files: string[]
  postinst: string
  profile: string
  desktop: string
}
export function checkPackage(pkg: Package): string[]
