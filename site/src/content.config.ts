import { defineCollection } from 'astro:content'
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders'
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema'
import { z } from 'astro/zod'
import en from './content/i18n/en.json'

// The site's own strings, beside Starlight's: every key English has, so a page or the menu cannot
// ask for one that does not exist.
const own = z.object(Object.fromEntries(Object.keys(en).map((key) => [key, z.string().optional()])))

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema({ extend: own }) }),
}
