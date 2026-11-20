export function isForeign(url: string, origin: string): boolean
export function trackingProblems(file: string, text: string, origin: string): string[]
export function missingImages(dist: string, base: string): string[]
export function markerProblems(pages: Map<string, string>): string[]
export function siteAddress(config: string): { origin: string; base: string }
