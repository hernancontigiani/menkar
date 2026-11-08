export interface Package {
  control: string
  files: string[]
  postinst: string
  profile: string
  desktop: string
}
export function checkPackage(pkg: Package): string[]
