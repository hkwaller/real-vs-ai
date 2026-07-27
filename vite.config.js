import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { promises as fs } from 'node:fs'

// ---------------------------------------------------------------------------
// Browser-free static SEO
// ---------------------------------------------------------------------------
// Injects real <head> meta tags into the built HTML at build time (pure string
// work — no headless browser, so it always builds on Vercel). Tags carry
// Helmet's `data-rh="true"` markers, so when the SPA mounts, react-helmet
// *adopts* them instead of appending duplicates. Non-JS crawlers / OG scrapers
// get the tags directly; Googlebot renders the JS for the rest.
//
// Only content-stable routes are emitted. /daily* is deliberately excluded
// (its content changes daily) and relies on client-side Helmet.

const SITE_URL = 'https://real-vs-ai.buzz'
const SITE_NAME = 'Real or AI'
const OG_IMAGE = `${SITE_URL}/og-image.png`
const DEFAULT_DESCRIPTION =
  'Two photos, one is real and one is AI-generated. You get 15 seconds to spot the fake. Free multiplayer party game plus a new daily challenge - no account needed to play.'

const ROUTES = {
  '/': {
    title: 'Real or AI - Spot the fake. Beat your friends.',
    description: DEFAULT_DESCRIPTION,
  },
  '/go-ad-free': {
    title: 'Go Ad-Free - Real or AI',
    description:
      'Remove ads and support Real or AI. Get an ad-free pass and enjoy uninterrupted rounds of spotting the fake.',
  },
}

const esc = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

function metaBlock(routePath, { title, description }) {
  const url = SITE_URL + routePath
  const t = esc(title)
  const d = esc(description)
  const tag = (s) => s + ' data-rh="true">'
  return (
    '<!--seo-->' +
    `<title>${t}</title>` +
    tag(`<link rel="canonical" href="${url}"`) +
    tag(`<meta name="description" content="${d}"`) +
    tag('<meta property="og:type" content="website"') +
    tag(`<meta property="og:site_name" content="${SITE_NAME}"`) +
    tag(`<meta property="og:title" content="${t}"`) +
    tag(`<meta property="og:description" content="${d}"`) +
    tag(`<meta property="og:url" content="${url}"`) +
    tag(`<meta property="og:image" content="${OG_IMAGE}"`) +
    tag('<meta property="og:image:width" content="1200"') +
    tag('<meta property="og:image:height" content="630"') +
    tag(`<meta property="og:image:alt" content="${t}"`) +
    tag('<meta name="twitter:card" content="summary_large_image"') +
    tag(`<meta name="twitter:title" content="${t}"`) +
    tag(`<meta name="twitter:description" content="${d}"`) +
    tag(`<meta name="twitter:image" content="${OG_IMAGE}"`) +
    '<!--/seo-->'
  )
}

function staticSeo() {
  return {
    name: 'static-seo',
    apply: 'build', // dev serves the plain shell; client Helmet fills the head
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // Inject the home route's meta into the main index.html.
        return html.replace('</head>', metaBlock('/', ROUTES['/']) + '</head>')
      },
    },
    async writeBundle(options) {
      const outDir = options.dir || 'dist'
      const base = await fs.readFile(path.join(outDir, 'index.html'), 'utf8')
      for (const [routePath, meta] of Object.entries(ROUTES)) {
        if (routePath === '/') continue
        const html = base.replace(
          /<!--seo-->[\s\S]*?<!--\/seo-->/,
          metaBlock(routePath, meta),
        )
        const dir = path.join(outDir, routePath.replace(/^\//, ''))
        await fs.mkdir(dir, { recursive: true })
        await fs.writeFile(path.join(dir, 'index.html'), html)
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), staticSeo()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
