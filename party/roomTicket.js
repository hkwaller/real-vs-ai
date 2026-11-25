/**
 * HMAC-SHA256 room tickets shared by /api/party-auth (Vercel, Node) and the room
 * Worker (Cloudflare). Plain JS with Web Crypto so both runtimes import it as is.
 * Types live in roomTicket.d.ts.
 */

/** A 4-character party code, as CreateGame/JoinGame produce. */
export const ROOM_CODE = /^[A-Z0-9]{4}$/
/** A device's secret guest key: 32 random bytes, base64url. */
export const GUEST_KEY = /^[A-Za-z0-9_-]{43}$/

const enc = new TextEncoder()

const toB64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

const hmacKey = (secret) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])

/**
 * Room ids are public (every snapshot lists them), so a guest's id is a hash of a
 * key only its device holds, and the device proves the id by sending the key.
 */
export async function guestIdFromKey(key) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`rvai-guest:${key}`)))
  return `g_${[...h.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

export async function signRoomTicket(ticket, secret, ttlSeconds = 60 * 60, now = Date.now()) {
  const body = toB64u(enc.encode(JSON.stringify({ ...ticket, exp: Math.floor(now / 1000) + ttlSeconds })))
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)))
  return `${body}.${toB64u(sig)}`
}

/** The ticket's identity, or null when it is forged, expired or for another room. */
export async function verifyRoomTicket(token, room, secret, now = Date.now()) {
  if (typeof token !== 'string' || token.split('.').length !== 2) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  try {
    if (!(await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64u(sig), enc.encode(body)))) return null
    const t = JSON.parse(new TextDecoder().decode(fromB64u(body)))
    if (t.room !== room || typeof t.id !== 'string' || !t.id || typeof t.exp !== 'number' || !(t.exp * 1000 > now)) return null
    return { id: t.id }
  } catch {
    return null
  }
}
