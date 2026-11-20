// `npm run site:check`'s scan of the built site: nothing loads from another origin, links out pass,
// every image is in the build, and a release holds no pending block.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  isForeign,
  markerProblems,
  missingImages,
  siteAddress,
  trackingProblems,
} from '../../site/scripts/check.mjs'

const ORIGIN = 'https://owner.github.io'

describe('the tracking scan', () => {
  test.each([
    ['a remote script', '<script src="https://example.com/a.js"></script>'],
    ['a protocol-relative script', '<script src="//example.com/a.js"></script>'],
    ['a remote stylesheet', '<link rel="stylesheet" href="https://fonts.example.com/a.css">'],
    ['a remote image', '<img src="https://example.com/pixel.gif" alt="">'],
    [
      'a remote image in a srcset',
      '<img src="/a.png" srcset="/a.png 1x, https://example.com/b.png 2x">',
    ],
    ['a frame', '<iframe src="https://example.com/embed"></iframe>'],
    ['an object', '<object data="https://example.com/a.swf"></object>'],
    ['a form posting out', '<form action="https://example.com/collect"></form>'],
    ['a video poster', '<video poster="https://example.com/p.jpg"></video>'],
    ['a style attribute', '<div style="background: url(https://example.com/p.png)"></div>'],
    ['an inline style', '<style>@import "https://example.com/a.css";</style>'],
    ['a beacon', '<script>navigator.sendBeacon("/x", data)</script>'],
    ['a fetch out', '<script>fetch("https://example.com/collect")</script>'],
  ])('fails %s in a page', (_name, html) => {
    expect(trackingProblems('page/index.html', html, ORIGIN)).toHaveLength(1)
  })

  test('fails a remote font in a stylesheet and a request in a script', () => {
    expect(
      trackingProblems(
        '_astro/a.css',
        '@font-face{src:url("https://example.com/f.woff2")}',
        ORIGIN,
      ),
    ).toHaveLength(1)
    expect(
      trackingProblems(
        '_astro/a.js',
        'const x=new XMLHttpRequest;x.open("POST","https://example.com/c")',
        ORIGIN,
      ),
    ).toHaveLength(1)
    expect(
      trackingProblems('_astro/a.js', 'import("https://example.com/m.js")', ORIGIN),
    ).toHaveLength(1)
  })

  test("passes links out, the site's own origin, relative paths and data: URLs", () => {
    const html = [
      '<a href="https://chatgpt.com/?q=hi" target="_blank">Open</a>',
      `<link rel="canonical" href="${ORIGIN}/menkar/">`,
      '<link rel="stylesheet" href="/menkar/_astro/a.css">',
      '<img src="../_astro/a.webp" srcset="../_astro/a.webp 1x">',
      '<div style="background:url(data:image/svg+xml;base64,AAAA)"></div>',
      '<script>fetch(path).then(r => r.text())</script>',
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    ].join('\n')
    expect(trackingProblems('page/index.html', html, ORIGIN)).toEqual([])
    expect(isForeign('mailto:someone@example.com', ORIGIN)).toBe(false)
  })
})

describe('the images', () => {
  test('an <img> whose file is not in the build fails; one that is passes', () => {
    const dist = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'dist-'))
    mkdirSync(join(dist, '_astro'))
    mkdirSync(join(dist, 'page'))
    writeFileSync(join(dist, '_astro', 'a.webp'), '')
    writeFileSync(
      join(dist, 'page', 'index.html'),
      '<img src="/menkar/_astro/a.webp" alt=""><img src="../_astro/a.webp" alt=""><img src="/menkar/_astro/gone.webp" alt="">',
    )
    expect(missingImages(dist, '/menkar')).toEqual([
      'page/index.html: <img> /menkar/_astro/gone.webp is not in the build',
    ])
  })
})

describe('the release', () => {
  test("a page still holding plan 28's block fails --release", () => {
    const pages = new Map([
      ['start/install.md', '## Install\n\n<!-- plan 28: apt commands -->\n<!-- /plan 28 -->'],
      ['start/agents.md', '## Agents'],
    ])
    expect(markerProblems(pages)).toEqual([
      'start/install.md still holds a pending <!-- plan … --> block',
    ])
  })
})

test("the site's address is read from astro.config.mjs", () => {
  expect(
    siteAddress(
      "export default defineConfig({ site: 'https://owner.github.io', base: '/menkar' })",
    ),
  ).toEqual({ origin: 'https://owner.github.io', base: '/menkar' })
})
