import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ClerkProvider } from '@clerk/react'
import { HelmetProvider } from '@dr.pogodin/react-helmet'

const container = document.getElementById('root')!

const app = (
  <StrictMode>
    <HelmetProvider>
      <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
    </HelmetProvider>
  </StrictMode>
)

// Prerendered routes (see vite.config.js) ship real HTML: hydrate so React 19
// reconciles the existing <head> metadata instead of appending duplicates.
// Non-prerendered routes have an empty #root, so fall back to a fresh render.
if (container.hasChildNodes()) {
  hydrateRoot(container, app)
} else {
  createRoot(container).render(app)
}
