export type Params = Readonly<Record<string, string | number>>

// A placeholder with no value stays visible as `{name}`: a gap the reader notices beats a blank.
export function interpolate(template: string, params: Params = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  )
}
