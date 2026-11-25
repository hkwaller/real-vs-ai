import PartySocket from 'partysocket'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Action, GameState, RoomMessage } from '@/lib/partyRoom'

export type RoomStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

type RoomValue = {
  state: GameState | null
  /** Identities with an open socket, host screen included. */
  online: Set<string>
  /** This device's identity in the room. */
  me: string | null
  status: RoomStatus
  send: (action: Action) => void
}

const Context = createContext<RoomValue | null>(null)

export function usePartyRoom(): RoomValue {
  const value = useContext(Context)
  if (!value) throw new Error('PartyRoomProvider is missing')
  return value
}

/** 32 random bytes, base64url: the secret behind a device's room identity. */
export function newGuestKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const HOST_KEY = 'rvai_host_key'

/** The big screen keeps one identity across lobby, game and reloads. */
export function hostGuestKey(): string {
  try {
    const saved = localStorage.getItem(HOST_KEY)
    if (saved) return saved
    const key = newGuestKey()
    localStorage.setItem(HOST_KEY, key)
    return key
  } catch {
    return newGuestKey()
  }
}

type Snapshot = { state: GameState | null; online: string[]; me: string | null }
const EMPTY: Snapshot = { state: null, online: [], me: null }

/**
 * One socket to the room Worker for `code`. Each (re)connect fetches a fresh
 * ticket from /api/party-auth; the server's snapshot is the only source of truth.
 */
export function PartyRoomProvider({ code, guestKey, children }: { code: string; guestKey: string; children: ReactNode }) {
  const host = import.meta.env.VITE_PARTY_HOST as string | undefined
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY)
  const [status, setStatus] = useState<RoomStatus>(host ? 'connecting' : 'disconnected')
  const socket = useRef<PartySocket | null>(null)

  useEffect(() => {
    if (!host) {
      console.error('VITE_PARTY_HOST is not set, so multiplayer cannot connect.')
      return
    }
    let alive = true
    let received = false
    const controller = new AbortController()
    const s = new PartySocket({
      host,
      party: 'room',
      room: code,
      startClosed: true,
      maxEnqueuedMessages: 0,
      query: async () => {
        const response = await fetch('/api/party-auth', {
          signal: controller.signal,
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ room: code, key: guestKey }),
        })
        if (!response.ok) throw new Error(`party-auth ${response.status}`)
        return { ticket: ((await response.json()) as { ticket: string }).ticket }
      },
    })
    s.addEventListener('close', () => {
      if (alive) setStatus(received ? 'reconnecting' : 'connecting')
    })
    s.addEventListener('message', (e: MessageEvent) => {
      if (!alive) return
      try {
        const msg = JSON.parse(String(e.data)) as RoomMessage
        if (msg.type !== 'state' || !msg.state || !msg.me) return
        received = true
        setSnapshot({ state: msg.state, online: msg.online, me: msg.me })
        setStatus('connected')
      } catch {
        /* Ignore malformed server messages. */
      }
    })
    socket.current = s
    s.reconnect()
    return () => {
      alive = false
      controller.abort()
      s.close()
      socket.current = null
    }
  }, [host, code, guestKey])

  const send = useCallback((action: Action) => {
    const s = socket.current
    if (s && s.readyState === WebSocket.OPEN) s.send(JSON.stringify(action))
  }, [])

  const online = useMemo(() => new Set(snapshot.online), [snapshot.online])
  const value = useMemo<RoomValue>(
    () => ({ state: snapshot.state, online, me: snapshot.me, status, send }),
    [snapshot.state, online, snapshot.me, status, send],
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}
