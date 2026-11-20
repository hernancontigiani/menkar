import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import starlightImageZoom from 'starlight-image-zoom'
import starlightLinksValidator from 'starlight-links-validator'
import starlightLlmsTxt from 'starlight-llms-txt'

// Each group lists a folder, so a page joins the sidebar by being written there: no page is ever
// named in this file.
const group = (label, es, directory) => ({
  label,
  translations: { es },
  items: [{ autogenerate: { directory } }],
})

export default defineConfig({
  site: 'https://hernancontigiani.github.io',
  base: '/menkar',
  integrations: [
    starlight({
      title: 'Menkar',
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        es: { label: 'Español', lang: 'es' },
      },
      sidebar: [
        group('Get started', 'Primeros pasos', 'start'),
        group('Orchestration mode', 'Modo orquestación', 'orchestration'),
        group('Work with sessions', 'Trabajar con sesiones', 'sessions'),
        group('Usage', 'Uso', 'usage'),
        group('Settings', 'Ajustes', 'settings'),
        group('Reference', 'Referencia', 'reference'),
      ],
      plugins: [starlightLinksValidator(), starlightImageZoom(), starlightLlmsTxt()],
    }),
  ],
})
