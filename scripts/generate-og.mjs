/**
 * Generates social + app icons into /public using headless Chromium (puppeteer).
 * Run with:  node scripts/generate-og.mjs
 *
 *  - og-image.png        1200x630  (Open Graph / Twitter card)
 *  - apple-touch-icon.png 180x180
 *  - icon-192.png         192x192  (web manifest)
 *  - icon-512.png         512x512  (web manifest)
 */
import puppeteer from 'puppeteer'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(__dirname, '..', 'public')

const BG = '#151936'
const CARD = '#1F2450'
const ORANGE = '#FF8552'
const CREAM = '#FFF8F0'
const TEAL = '#57E6D2'
const MUTED = '#9AA3D0'

const fontLink = `
  <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Space+Grotesk:wght@500;600&display=swap" rel="stylesheet">
`

const logoTile = (size, radius, font) => `
  <div style="transform:rotate(-6deg);width:${size}px;height:${size}px;border-radius:${radius}px;
    background:${ORANGE};box-shadow:0 ${size * 0.09}px 0 #C25327;
    display:flex;align-items:center;justify-content:center;">
    <span style="font-family:'Baloo 2',sans-serif;font-weight:800;color:${BG};font-size:${font}px;line-height:1;">R?</span>
  </div>
`

const ogHtml = `
<!doctype html><html><head><meta charset="utf-8">${fontLink}
<style>*{margin:0;box-sizing:border-box}</style></head>
<body style="width:1200px;height:630px;background:
  radial-gradient(1200px 600px at 15% -10%, #232a5e 0%, ${BG} 55%);
  display:flex;flex-direction:column;justify-content:space-between;padding:72px;font-family:'Space Grotesk',sans-serif;overflow:hidden;">

  <div style="display:flex;align-items:center;gap:22px;">
    ${logoTile(78, 20, 34)}
    <span style="font-family:'Baloo 2',sans-serif;font-weight:800;color:${CREAM};font-size:38px;margin-left:8px;">Real or AI</span>
  </div>

  <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:40px;">
    <div style="max-width:640px;">
      <div style="font-family:'Baloo 2',sans-serif;font-weight:800;color:${CREAM};font-size:82px;line-height:0.98;letter-spacing:-1px;">
        Spot the fake.<br><span style="color:${ORANGE};">Beat your friends.</span>
      </div>
      <div style="color:${MUTED};font-size:30px;margin-top:26px;font-weight:500;">
        Two photos, one is AI. You've got 15 seconds.
      </div>
    </div>

    <div style="display:flex;gap:18px;flex-shrink:0;">
      <div style="width:150px;height:190px;border-radius:24px;background:${CARD};border:1px solid rgba(255,255,255,0.08);
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;">
        <div style="font-size:56px;">📷</div>
        <div style="color:${TEAL};font-family:'Baloo 2',sans-serif;font-weight:700;font-size:22px;">REAL</div>
      </div>
      <div style="width:150px;height:190px;border-radius:24px;background:${CARD};border:1px solid rgba(255,255,255,0.08);
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;">
        <div style="font-size:56px;">🤖</div>
        <div style="color:${ORANGE};font-family:'Baloo 2',sans-serif;font-weight:700;font-size:22px;">AI</div>
      </div>
    </div>
  </div>
</body></html>
`

const iconHtml = (px) => `
<!doctype html><html><head><meta charset="utf-8">${fontLink}
<style>*{margin:0;box-sizing:border-box}</style></head>
<body style="width:${px}px;height:${px}px;background:${BG};display:flex;align-items:center;justify-content:center;">
  ${logoTile(px * 0.62, px * 0.16, px * 0.3)}
</body></html>
`

async function shoot(page, html, width, height, out) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready
  })
  await new Promise((r) => setTimeout(r, 400))
  await page.screenshot({ path: join(PUBLIC, out), type: 'png' })
  console.log('wrote', out)
}

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
const page = await browser.newPage()

await shoot(page, ogHtml, 1200, 630, 'og-image.png')
await shoot(page, iconHtml(512), 512, 512, 'icon-512.png')
await shoot(page, iconHtml(192), 192, 192, 'icon-192.png')
await shoot(page, iconHtml(180), 180, 180, 'apple-touch-icon.png')

await browser.close()
