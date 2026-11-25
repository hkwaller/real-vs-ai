/**
 * PartyServer backend for multiplayer rooms: one hibernating SQLite Durable Object
 * per party code. The server owns the state. Clients send actions, it applies the
 * rules in src/lib/partyRoom.ts, saves, and broadcasts the room to every socket.
 *
 * Dev: npm run party:dev. Deploy: npm run party:deploy (see party/README.md).
 */
import { routePartykitRequest, Server, type Connection, type ConnectionContext, type WSMessage } from 'partyserver'
import { applyAction, initialRoom, parseAction, type GameState, type RoomMessage } from '../src/lib/partyRoom'
import { verifyRoomTicket } from './roomTicket.js'

type Env = { Room: DurableObjectNamespace<Room>; PARTY_SECRET: string }
type Who = { id: string }

/** Rooms nobody touched for this long are wiped, so a reused code starts clean. */
const IDLE_MS = 24 * 60 * 60 * 1000

export class Room extends Server<Env> {
  // Idle sockets cost nothing while hibernating; onStart reloads the state on wake.
  static options = { hibernate: true }

  game: GameState = initialRoom()

  async onStart() {
    this.game = (await this.ctx.storage.get<GameState>('game')) ?? initialRoom()
  }

  async onConnect(conn: Connection<Who>, ctx: ConnectionContext) {
    const ticket = new URL(ctx.request.url).searchParams.get('ticket') ?? ''
    const who = this.env.PARTY_SECRET ? await verifyRoomTicket(ticket, this.name, this.env.PARTY_SECRET) : null
    if (!who) return conn.close(4001, 'Unauthorized') // onBeforeConnect already refused it; belt and braces
    conn.setState(who)
    this.push()
  }

  onClose(conn: Connection<Who>) {
    this.push(conn.id)
  }

  async onMessage(conn: Connection<Who>, raw: WSMessage) {
    const who = conn.state
    if (!who || typeof raw !== 'string' || raw.length > 100_000) return
    let action
    try {
      action = parseAction(JSON.parse(raw))
    } catch {
      return
    }
    if (!action) return
    await this.ctx.blockConcurrencyWhile(async () => {
      const next = applyAction(this.game, who.id, this.online(), action, Date.now())
      if (next === this.game) {
        // Refused: resend the truth so an optimistic client snaps back.
        conn.send(JSON.stringify(this.message(conn)))
        return
      }
      await this.ctx.storage.put('game', next)
      await this.ctx.storage.setAlarm(Date.now() + IDLE_MS)
      this.game = next
      this.push()
    })
  }

  async onAlarm() {
    await this.ctx.storage.deleteAll()
    this.game = initialRoom()
    for (const c of this.getConnections()) c.close(4000, 'Room expired')
  }

  /** Identities with an open, authorized socket. `closing` is a socket that is going away. */
  online(closing?: string): Set<string> {
    const ids = new Set<string>()
    for (const c of this.getConnections<Who>()) if (c.id !== closing && c.state) ids.add(c.state.id)
    return ids
  }

  message(conn: Connection<Who>, closing?: string): RoomMessage {
    return { type: 'state', state: this.game, online: [...this.online(closing)], me: conn.state!.id }
  }

  push(closing?: string) {
    for (const c of this.getConnections<Who>()) {
      if (c.id === closing || !c.state) continue
      c.send(JSON.stringify(this.message(c, closing)))
    }
  }
}

export default {
  async fetch(req, env) {
    if (new URL(req.url).pathname === '/health') return Response.json({ ok: true })
    const res = await routePartykitRequest(req, env, {
      // Refuse a socket without a valid ticket before it reaches (and wakes) the room.
      onBeforeConnect: async (r, lobby) => {
        const ticket = new URL(r.url).searchParams.get('ticket') ?? ''
        if (!env.PARTY_SECRET || !(await verifyRoomTicket(ticket, lobby.name, env.PARTY_SECRET)))
          return new Response('Unauthorized', { status: 401 })
      },
    })
    return res ?? new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
