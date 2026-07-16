import { useEffect, useRef } from 'react'
import { useAdFree } from '@/hooks/useAdFree'

const POPUNDER_SRC = import.meta.env.VITE_ADSTERRA_POPUNDER_SRC as string | undefined

type Props = {
  /** External suppression (multiplayer host perk). Component also self-gates locally. */
  suppressed?: boolean
}

/**
 * Adsterra popunder. Appends the invoke.js script to <body> once, guarded by a
 * ref so it fires a single time per mount. Self-gates on the ad-free
 * entitlement. Renders no DOM. In multiplayer, mount this only on player
 * devices — never the shared host display.
 */
const AdsterraPopunder: React.FC<Props> = ({ suppressed = false }) => {
  const { isAdFree, isLoaded } = useAdFree()
  const injectedRef = useRef(false)

  useEffect(() => {
    if (!isLoaded || isAdFree || suppressed || !POPUNDER_SRC) return
    if (injectedRef.current) return
    injectedRef.current = true

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = POPUNDER_SRC
    document.body.appendChild(script)
  }, [isLoaded, isAdFree, suppressed])

  return null
}

export default AdsterraPopunder
