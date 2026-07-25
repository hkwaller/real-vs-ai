import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import prerender from '@prerenderer/rollup-plugin'

// Public, content-stable routes to prerender into static HTML at build time so
// crawlers and social/OG scrapers get real markup + meta tags without running JS.
// Intentionally excludes /daily and /daily/archive: their content changes daily,
// so baking it at build time would ship stale HTML. Those rely on React 19's
// client-side metadata (Googlebot renders JS).
const PRERENDER_ROUTES = ['/', '/go-ad-free']

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    prerender({
      routes: PRERENDER_ROUTES,
      renderer: '@prerenderer/renderer-puppeteer',
      rendererOptions: {
        // Give Clerk, fonts and the intro animations time to settle before snapshot.
        renderAfterTime: 4000,
        headless: true,
        maxConcurrentRoutes: 1,
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
