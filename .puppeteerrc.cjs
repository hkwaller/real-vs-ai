const { join } = require('path')

/**
 * Store puppeteer's downloaded Chromium under node_modules/.cache, which Vercel
 * persists between builds. This makes `npx puppeteer browsers install chrome`
 * (run in the build script) a cache hit after the first deploy, and lets the
 * prerender plugin find the browser during `vite build`.
 * @type {import('puppeteer').Configuration}
 */
module.exports = {
  cacheDirectory: join(__dirname, 'node_modules', '.cache', 'puppeteer'),
}
