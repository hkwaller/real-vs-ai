/**
 * Per-route document metadata using React 19's native metadata hoisting.
 * Rendering <title>/<meta>/<link> anywhere in the tree moves them into <head>.
 * One <Seo> per page keeps a single source of truth (no duplicate tags), and
 * react-snap bakes the result into the prerendered HTML for crawlers/scrapers.
 */

const SITE_URL = 'https://real-vs-ai.buzz'
const SITE_NAME = 'Real or AI'
const DEFAULT_DESCRIPTION =
  'Two photos, one is real and one is AI-generated. You get 15 seconds to spot the fake. Free multiplayer party game plus a new daily challenge — no account needed to play.'
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`

export interface SeoProps {
  /** Full <title>. Include the brand, e.g. "Daily Challenge — Real or AI". */
  title: string
  description?: string
  /** Route path for canonical/og:url, e.g. "/daily". Defaults to "/". */
  path?: string
  /** Absolute URL or root-relative path to a 1200x630 image. */
  image?: string
  /** Keep the page out of search results (gated / dynamic pages). */
  noindex?: boolean
  type?: 'website' | 'article'
}

export default function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  image = DEFAULT_IMAGE,
  noindex = false,
  type = 'website',
}: SeoProps) {
  const url = `${SITE_URL}${path}`
  const img = image.startsWith('http') ? image : `${SITE_URL}${image}`

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={title} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={img} />
    </>
  )
}
