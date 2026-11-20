// Each page as Markdown, at `<page>.md`: what the Copy page menu copies and links. The page's own
// source with the site's extensions rendered as the HTML renders them, so an agent reads the labels
// and images a person sees.

import { type CollectionEntry, getCollection } from 'astro:content'
import type { APIRoute, GetStaticPaths, ImageMetadata } from 'astro'
import type { Nodes, Parents, Root } from 'mdast'
import { directiveFromMarkdown, directiveToMarkdown } from 'mdast-util-directive'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown, gfmToMarkdown } from 'mdast-util-gfm'
import { toMarkdown } from 'mdast-util-to-markdown'
import { directive } from 'micromark-extension-directive'
import { gfm } from 'micromark-extension-gfm'
import { SKIP, visit } from 'unist-util-visit'
import { createMenkar, localeOf, markdownPath, transformNode } from '../remark/menkar.mjs'

const images = import.meta.glob<{ default: ImageMetadata }>('../assets/captures/*/*/*.png', {
  eager: true,
})
const menkar = createMenkar()

// The route id Starlight gives a page: `index` and a folder's `index` drop their last part.
function routeId(entry: CollectionEntry<'docs'>): string {
  return entry.id === 'index' ? '' : entry.id.replace(/\/index$/, '')
}

export const getStaticPaths = (async () => {
  const entries = await getCollection('docs')
  return entries.map((entry) => ({
    params: { slug: markdownPath(routeId(entry)).replace(/\.md$/, '') },
    props: { entry },
  }))
}) satisfies GetStaticPaths

export const GET: APIRoute<{ entry: CollectionEntry<'docs'> }> = ({ props, site }) => {
  const { entry } = props
  const locale = localeOf(`/content/docs/${entry.id}`)
  const imageUrl = (path: string): string => {
    const key = `../assets/captures/${path}`
    const image = images[key]
    if (!image) throw new Error(`no capture file at ${key}`)
    return new URL(image.default.src, site).href
  }
  const tree = fromMarkdown(entry.body ?? '', {
    extensions: [directive(), gfm()],
    mdastExtensions: [directiveFromMarkdown(), gfmFromMarkdown()],
  })
  const context = {
    locale,
    shot: (slug: string) => menkar.shotForMarkdown(slug, locale, imageUrl),
  }
  visit(tree, (node: Nodes, index, parent: Parents | undefined) => {
    if (parent === undefined || index === undefined) return
    const nodes = transformNode(node, context) as Nodes[] | undefined
    if (!nodes) return
    parent.children.splice(index, 1, ...(nodes as Parents['children']))
    return [SKIP, index + nodes.length]
  })
  const title: Root = {
    type: 'root',
    children: [
      { type: 'heading', depth: 1, children: [{ type: 'text', value: entry.data.title }] },
    ],
  }
  const body = toMarkdown(
    { type: 'root', children: [...title.children, ...tree.children] },
    { extensions: [directiveToMarkdown(), gfmToMarkdown()] },
  )
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } })
}
