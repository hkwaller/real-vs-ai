import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { publicPages } from './public-pages.mjs'
import path from 'path'
import { promises as fs } from 'node:fs'

// ---------------------------------------------------------------------------
// Browser-free static SEO
// ---------------------------------------------------------------------------
// Injects real <head> meta tags into the built HTML at build time (pure string
// work — no headless browser, so it always builds on Vercel). Tags carry
// Helmet's `data-rh="true"` markers, so when the SPA mounts, react-helmet
// *adopts* them instead of appending duplicates. Non-JS crawlers / OG scrapers
// receive metadata and useful static public content before JavaScript runs.
//
// Daily routes get stable rules and navigation in their static shell.
// Live challenge data continues to load in the client.

const SITE_URL = 'https://realvsai.playam.app'
const SITE_NAME = 'Real or AI'
const OG_IMAGE = `${SITE_URL}/og-image.png`
const DEFAULT_DESCRIPTION =
  'Two photos, one is real and one is AI-generated. You get 15 seconds to spot the fake. Free multiplayer party game plus a new daily challenge - no account needed to play.'

const ROUTES = {
  '/': {
    title: 'Real or AI - Spot the fake. Beat your friends.',
    description: DEFAULT_DESCRIPTION,
  },
  '/daily': { title: 'Daily Challenge - Real or AI', description: 'Play a fresh Real-or-AI challenge each day. Compare photographs, spot the AI-generated image and build your streak.' },
  '/daily/archive': { title: 'Daily Challenge Archive - Real or AI', description: 'Browse and replay past Real-or-AI daily challenges. Practise spotting AI-generated photos.' },
  '/privacy': { title: 'Privacy - Real vs AI', description: 'How Real vs AI handles your information.' },
  '/terms': { title: 'Terms - Real vs AI', description: 'Terms for playing Real vs AI.' },
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
        return html.replace('</head>', metaBlock('/', ROUTES['/']) + '</head>').replace('<div id="root"></div>', `<div id="root" data-static-shell="true">${publicPages['/']}</div>`)
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
        ).replace(/<div id="root" data-static-shell="true">[\s\S]*?<\/div>/, `<div id="root" data-static-shell="true">${publicPages[routePath]}</div>`)
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
