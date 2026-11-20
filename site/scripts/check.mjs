// What `npm run site:check` checks after `astro build` (which has already failed on a broken link
// to a page or a section, through starlight-links-validator):
//   - the built site loads nothing from another origin (no analytics, no remote script, font,
//     image or frame); links out are navigation and pass;
//   - every <img> in the build resolves to a file in it;
//   - every page has its Spanish twin, alike in headings and captures;
//   - with --release, no page still holds a block another plan has to fill.
// Usage: node scripts/check.mjs [--release]
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readPages, twinProblems } from './twins.mjs'

const SITE = resolve(fileURLToPath(new URL('..', import.meta.url)))

/** @param {string} dir @returns {string[]} */
function filesUnder(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)],
  )
}

/**
 * Whether a URL leaves the site: absolute (`https:`, `ws:`…) or protocol-relative, and not the
 * site's own origin. `data:`, `blob:` and `#` stay on the page.
 * @param {string} url @param {string} origin
 */
export function isForeign(url, origin) {
  const value = url.trim()
  if (/^(data|blob|about|javascript|mailto|tel):/i.test(value)) return false
  if (!/^([a-z][a-z0-9+.-]*:)?\/\//i.test(value)) return false
  try {
    return new URL(value, origin).origin !== origin
  } catch {
    // A URL the browser cannot place is not one the scan can clear.
    return true
  }
}

/** @param {string} attributes @returns {Map<string, string>} */
function attributesOf(attributes) {
  const found = new Map()
  for (const match of attributes.matchAll(
    /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g,
  ))
    found.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '')
  return found
}

/** @param {string} css @param {string} origin @returns {string[]} */
function cssLoads(css, origin) {
  const urls = [
    ...[...css.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi)].map((m) => m[2]),
    ...[...css.matchAll(/@import\s+(['"])([^'"]*)\1/gi)].map((m) => m[2]),
  ]
  return urls.filter((url) => isForeign(url, origin))
}

// A request in script: fetch, XHR, a beacon, a socket, an import or an image's src set to an
// absolute URL written in the code. A URL built at run time is not readable here; a page's own
// scripts build theirs from relative paths.
const SCRIPT_LOADS = [
  /\bfetch\(\s*(['"`])([a-z][a-z0-9+.-]*:)?\/\/[^'"`]*\1/gi,
  /\.open\(\s*(['"`])[A-Z]+\1\s*,\s*(['"`])([a-z][a-z0-9+.-]*:)?\/\/[^'"`]*\2/gi,
  /\bimport\s*\(\s*(['"`])([a-z][a-z0-9+.-]*:)?\/\/[^'"`]*\1/gi,
  /\bfrom\s*(['"])([a-z][a-z0-9+.-]*:)?\/\/[^'"]*\1/gi,
  /\bnew\s+(WebSocket|EventSource|Worker|SharedWorker)\(\s*(['"`])([a-z][a-z0-9+.-]*:)?\/\/[^'"`]*\2/gi,
  /\.src\s*=\s*(['"`])([a-z][a-z0-9+.-]*:)?\/\/[^'"`]*\1/gi,
  /\bsendBeacon\b/g,
]

/** @param {string} js @param {string} origin @returns {string[]} */
function scriptLoads(js, origin) {
  return SCRIPT_LOADS.flatMap((pattern) => [...js.matchAll(pattern)].map((m) => m[0])).filter(
    (found) => {
      const url = /(?:[a-z][a-z0-9+.-]*:)?\/\/[^'"`]*/i.exec(found)?.[0]
      return url === undefined || isForeign(url, origin)
    },
  )
}

// The attributes that make the browser load a URL, by element; `*` is any element.
const LOADING = {
  '*': ['src', 'srcset', 'poster', 'background', 'data', 'action', 'formaction', 'xlink:href'],
  link: ['href', 'imagesrcset'],
  use: ['href'],
  image: ['href'],
  feimage: ['href'],
}

/**
 * Each load from another origin in one built file.
 * @param {string} file its path, for the extension and the message
 * @param {string} text its content
 * @param {string} origin the site's own origin
 * @returns {string[]}
 */
export function trackingProblems(file, text, origin) {
  const own = (/** @type {string} */ what) => `${file}: loads from another origin: ${what}`
  if (/\.css$/i.test(file)) return cssLoads(text, origin).map(own)
  if (/\.m?js$/i.test(file)) return scriptLoads(text, origin).map(own)
  if (!/\.html?$/i.test(file)) return []
  /** @type {string[]} */
  const found = []
  for (const match of text.matchAll(/<([a-zA-Z][\w:-]*)(\s[^>]*)?>/g)) {
    const tag = match[1].toLowerCase()
    const attributes = attributesOf(match[2] ?? '')
    const names = new Set([
      ...LOADING['*'],
      ...(LOADING[/** @type {keyof typeof LOADING} */ (tag)] ?? []),
    ])
    for (const name of names) {
      const value = attributes.get(name)
      if (value === undefined) continue
      const urls = /srcset$/.test(name)
        ? value.split(',').map((candidate) => candidate.trim().split(/\s+/)[0] ?? '')
        : [value]
      for (const url of urls) if (isForeign(url, origin)) found.push(`<${tag} ${name}="${url}">`)
    }
    const style = attributes.get('style')
    if (style) found.push(...cssLoads(style, origin))
  }
  for (const match of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))
    found.push(...cssLoads(match[1], origin))
  for (const match of text.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))
    found.push(...scriptLoads(match[1], origin))
  return found.map(own)
}

/**
 * Each <img> of a built page whose file is not in the build.
 * @param {string} dist @param {string} base the site's base path (`/menkar`)
 * @returns {string[]}
 */
export function missingImages(dist, base) {
  /** @type {string[]} */
  const missing = []
  for (const file of filesUnder(dist).filter((path) => path.endsWith('.html'))) {
    const page = readFileSync(file, 'utf8')
    for (const match of page.matchAll(/<img(\s[^>]*)>/gi)) {
      const attributes = attributesOf(match[1])
      const sources = [
        attributes.get('src') ?? '',
        ...(attributes.get('srcset') ?? '')
          .split(',')
          .map((candidate) => candidate.trim().split(/\s+/)[0] ?? ''),
      ].filter((url) => url && !/^(data|blob):/i.test(url))
      if (sources.length === 0) missing.push(`${relative(dist, file)}: an <img> without a source`)
      for (const url of sources) {
        const path = decodeURI(url.split(/[?#]/)[0] ?? '')
        const local = path.startsWith('/')
          ? join(dist, path.startsWith(`${base}/`) ? path.slice(base.length) : path)
          : join(file, '..', path)
        if (!existsSync(local))
          missing.push(`${relative(dist, file)}: <img> ${url} is not in the build`)
      }
    }
  }
  return missing
}

/**
 * Pages still holding a block another plan fills (`<!-- plan 28: … -->`): a release must not
 * publish one.
 * @param {Map<string, string>} pages
 * @returns {string[]}
 */
export function markerProblems(pages) {
  return [...pages]
    .filter(([, source]) => /<!--\s*plan\s+\d+\s*:/i.test(source))
    .map(([path]) => `${path} still holds a pending <!-- plan … --> block`)
}

/** The site's URL and base path, as astro.config.mjs states them. */
export function siteAddress(config) {
  const site = /\bsite:\s*(['"])([^'"]+)\1/.exec(config)?.[2]
  const base = /\bbase:\s*(['"])([^'"]*)\1/.exec(config)?.[2] ?? ''
  if (!site) throw new Error('astro.config.mjs states no site URL')
  return { origin: new URL(site).origin, base: base.replace(/\/$/, '') }
}

function main() {
  const release = process.argv.includes('--release')
  const dist = join(SITE, 'dist')
  if (!existsSync(dist)) {
    console.error('site:check: no dist/ — run astro build first')
    process.exit(1)
  }
  const { origin, base } = siteAddress(readFileSync(join(SITE, 'astro.config.mjs'), 'utf8'))
  const pages = readPages(join(SITE, 'src', 'content', 'docs'))
  const built = filesUnder(dist).filter((file) => /\.(html?|css|m?js)$/i.test(file))
  const problems = [
    ...built.flatMap((file) =>
      trackingProblems(
        relative(dist, file).split(sep).join('/'),
        readFileSync(file, 'utf8'),
        origin,
      ),
    ),
    ...missingImages(dist, base),
    ...twinProblems(pages),
    ...(release ? markerProblems(pages) : []),
  ]
  if (problems.length > 0) {
    console.error(`site:check: ${problems.length} problem(s)`)
    for (const problem of problems) console.error(`  ${problem}`)
    process.exit(1)
  }
  console.log(
    `site:check: ${built.length} built files load nothing from another origin; every image is in the build; ${pages.size} pages, every one with its twin${release ? '; no pending block' : ''}`,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
