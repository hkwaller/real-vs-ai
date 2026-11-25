/**
 * Authoritative room rules, shared by the Cloudflare room Worker (party/server.ts)
 * and the browser. The Worker applies every action here, saves the result and
 * broadcasts it; clients only send actions and render the state they receive.
 *
 * Keep this file pure: relative imports only, no DOM, no import.meta.env.
 */

export type Side = 'A' | 'B'
export type RevealMode = 'instant' | 'after_round'
export type GameStatus = 'waiting' | 'playing' | 'finished'
export type Settings = { rounds: number; timeLimit: number; revealMode: RevealMode }
export type RoundData = { id: string; realImageUrl: string; aiImageUrl: string }
export type Player = { id: string; name: string }
/** `remaining` is seconds left on the server clock when the vote landed. */
export type Vote = { choice: Side; remaining: number }
export type RoundResult = { round: number; correctChoice: Side; points: Record<string, number> }

export type GameState = {
  /** Identity of the big-screen device that opened the room. */
  hostId: string
  status: GameStatus
  settings: Settings
  rounds: RoundData[]
  roundIndex: number
  /** Server time (ms) the current round's pair went up. Scoring counts from here. */
  roundStartedAt: number
  revealed: boolean
  /** Votes for the current round, by player id. */
  votes: Record<string, Vote>
  /** The latest reveal. Stays until the next round starts so a reloading phone still sees it. */
  result: RoundResult | null
  players: Player[]
  scores: Record<string, number>
  /** Removed players. Their phones leave the room when they see their id here. */
  kicked: string[]
  /** A player who may start, reveal and advance from their phone. */
  bossId: string | null
  /** Host perk: the device that opened the room is ad-free. Stamped by the lobby. */
  hostAdFree: boolean
  /** Game-wide "fooled by the AI" tally. */
  stats: { totalVotes: number; wrongVotes: number }
}

export type Action =
  | { type: 'open'; settings: Settings; hostAdFree: boolean }
  | { type: 'join'; name: string }
  | { type: 'setBoss'; playerId: string | null }
  | { type: 'start' }
  | { type: 'setRounds'; rounds: RoundData[] }
  | { type: 'vote'; round: number; choice: Side }
  | { type: 'reveal' | 'next'; round: number }
  | { type: 'swap'; round: number; data: RoundData }
  | { type: 'kick'; playerId: string }
  | { type: 'rematch' }

export type RoomMessage = { type: 'state'; state: GameState; online: string[]; me: string }

export const DEFAULT_SETTINGS: Settings = { rounds: 10, timeLimit: 15, revealMode: 'instant' }
export const GRACE_PERIOD = 3
const MAX_PLAYERS = 100
const MAX_ROUNDS = 50
const MAX_NAME = 24

export function initialRoom(): GameState {
  return {
    hostId: '',
    status: 'waiting',
    settings: { ...DEFAULT_SETTINGS },
    rounds: [],
    roundIndex: 0,
    roundStartedAt: 0,
    revealed: false,
    votes: {},
    result: null,
    players: [],
    scores: {},
    kicked: [],
    bossId: null,
    hostAdFree: false,
    stats: { totalVotes: 0, wrongVotes: 0 },
  }
}

/** Which side shows the real photo. Derived from the round id, as it always has been. */
export function correctChoiceOf(round: RoundData): Side {
  return round.id.charCodeAt(0) % 2 === 0 ? 'A' : 'B'
}

/** Full 100 points inside the grace period, then linear down to 0 at the buzzer. */
export function pointsFor(remaining: number, timeLimit: number): number {
  const window = Math.max(1, timeLimit - GRACE_PERIOD)
  return remaining >= window ? 100 : Math.max(0, Math.round(100 * (remaining / window)))
}

const int = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback

function cleanSettings(s: unknown): Settings {
  const o = (s && typeof s === 'object' ? s : {}) as Partial<Settings>
  return {
    rounds: int(o.rounds, 1, MAX_ROUNDS, DEFAULT_SETTINGS.rounds),
    timeLimit: int(o.timeLimit, 5, 120, DEFAULT_SETTINGS.timeLimit),
    revealMode: o.revealMode === 'after_round' ? 'after_round' : 'instant',
  }
}

const isUrl = (v: unknown): v is string => typeof v === 'string' && v.length <= 2048 && /^https?:\/\//.test(v)

function cleanRound(r: unknown): RoundData | null {
  const o = (r && typeof r === 'object' ? r : {}) as Partial<RoundData>
  if (typeof o.id !== 'string' || !o.id || o.id.length > 64) return null
  if (!isUrl(o.realImageUrl) || !isUrl(o.aiImageUrl)) return null
  return { id: o.id, realImageUrl: o.realImageUrl, aiImageUrl: o.aiImageUrl }
}

const isRound = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

/** Shape check for a client message. The reducer still decides whether it is allowed. */
export function parseAction(raw: unknown): Action | null {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Record<string, unknown>
  switch (a.type) {
    case 'open':
      return { type: 'open', settings: cleanSettings(a.settings), hostAdFree: a.hostAdFree === true }
    case 'join':
      return typeof a.name === 'string' ? { type: 'join', name: a.name } : null
    case 'setBoss':
      return a.playerId === null || typeof a.playerId === 'string' ? { type: 'setBoss', playerId: a.playerId } : null
    case 'start':
    case 'rematch':
      return { type: a.type }
    case 'setRounds': {
      if (!Array.isArray(a.rounds) || a.rounds.length === 0 || a.rounds.length > MAX_ROUNDS) return null
      const rounds = a.rounds.map(cleanRound)
      return rounds.every(Boolean) ? { type: 'setRounds', rounds: rounds as RoundData[] } : null
    }
    case 'vote':
      return isRound(a.round) && (a.choice === 'A' || a.choice === 'B') ? { type: 'vote', round: a.round, choice: a.choice } : null
    case 'reveal':
    case 'next':
      return isRound(a.round) ? { type: a.type, round: a.round } : null
    case 'swap': {
      const data = cleanRound(a.data)
      return isRound(a.round) && data ? { type: 'swap', round: a.round, data } : null
    }
    case 'kick':
      return typeof a.playerId === 'string' ? { type: 'kick', playerId: a.playerId } : null
    default:
      return null
  }
}

function reveal(g: GameState) {
  const round = g.rounds[g.roundIndex]
  if (!round) return
  const correctChoice = correctChoiceOf(round)
  const points: Record<string, number> = {}
  let wrong = 0
  for (const [id, vote] of Object.entries(g.votes)) {
    const correct = vote.choice === correctChoice
    if (!correct) wrong++
    points[id] = correct ? pointsFor(vote.remaining, g.settings.timeLimit) : 0
    if (points[id] > 0) g.scores[id] = (g.scores[id] ?? 0) + points[id]
  }
  g.stats = { totalVotes: g.stats.totalVotes + Object.keys(g.votes).length, wrongVotes: g.stats.wrongVotes + wrong }
  g.result = { round: g.roundIndex, correctChoice, points }
  g.revealed = true
}

function newRound(g: GameState, now: number) {
  g.revealed = false
  g.votes = {}
  g.result = null
  g.roundStartedAt = now
}

function resetForLobby(g: GameState) {
  g.status = 'waiting'
  g.rounds = []
  g.roundIndex = 0
  g.roundStartedAt = 0
  g.revealed = false
  g.votes = {}
  g.result = null
  g.scores = Object.fromEntries(g.players.map((p) => [p.id, 0]))
  g.stats = { totalVotes: 0, wrongVotes: 0 }
  // Re-stamped from the host's entitlement when the lobby opens again.
  g.hostAdFree = false
}

/**
 * Applies `action` sent by identity `who`. Returns the same object when the action
 * is refused or changes nothing, else a new state. `online` holds the identities
 * with an open socket; `now` is the server clock.
 */
export function applyAction(game: GameState, who: string, online: Set<string>, action: Action, now: number): GameState {
  const g: GameState = structuredClone(game)
  const isHost = !!g.hostId && who === g.hostId
  const isPlayer = g.players.some((p) => p.id === who)
  const canDrive = isHost || (!!g.bossId && who === g.bossId && isPlayer)
  const round = g.rounds[g.roundIndex]

  switch (action.type) {
    case 'open': {
      // Another screen is hosting this code right now.
      if (g.hostId && g.hostId !== who && online.has(g.hostId)) return game
      if (g.hostId !== who) {
        // A new screen takes over an abandoned (or reused) code: start clean.
        const fresh = initialRoom()
        Object.assign(g, fresh, { hostId: who })
      } else if (g.status === 'finished') {
        resetForLobby(g)
      } else if (g.status === 'playing') {
        return game
      }
      g.settings = action.settings
      g.hostAdFree = action.hostAdFree
      break
    }
    case 'join': {
      if (who === g.hostId || g.kicked.includes(who)) return game
      const name = action.name.trim().slice(0, MAX_NAME) || 'Player'
      const existing = g.players.find((p) => p.id === who)
      if (existing) {
        if (existing.name === name) return game
        existing.name = name
      } else {
        if (g.players.length >= MAX_PLAYERS) return game
        g.players.push({ id: who, name })
        g.scores[who] = 0
      }
      break
    }
    case 'setBoss': {
      if (!isHost) return game
      if (action.playerId !== null && !g.players.some((p) => p.id === action.playerId)) return game
      g.bossId = action.playerId
      break
    }
    case 'start': {
      if (!canDrive || g.status !== 'waiting') return game
      g.status = 'playing'
      g.rounds = []
      g.roundIndex = 0
      g.stats = { totalVotes: 0, wrongVotes: 0 }
      newRound(g, now)
      break
    }
    case 'setRounds': {
      // The host display picks the pairs once per game, right after start.
      if (!isHost || g.status !== 'playing' || g.rounds.length > 0) return game
      g.rounds = action.rounds
      g.roundIndex = 0
      newRound(g, now)
      break
    }
    case 'vote': {
      if (g.status !== 'playing' || !isPlayer || !round || g.revealed) return game
      if (action.round !== g.roundIndex || g.votes[who]) return game
      const remaining = Math.max(0, g.settings.timeLimit - (now - g.roundStartedAt) / 1000)
      g.votes[who] = { choice: action.choice, remaining }
      // Everyone connected has voted: reveal straight away.
      const present = g.players.filter((p) => online.has(p.id) || g.votes[p.id])
      if (present.length > 0 && present.every((p) => g.votes[p.id])) reveal(g)
      break
    }
    case 'reveal': {
      if (!canDrive || g.status !== 'playing' || !round || g.revealed || action.round !== g.roundIndex) return game
      reveal(g)
      break
    }
    case 'next': {
      // Only from the reveal, so a round is never skipped unscored.
      if (!canDrive || g.status !== 'playing' || !g.revealed || action.round !== g.roundIndex) return game
      if (g.roundIndex + 1 >= g.rounds.length) {
        g.status = 'finished'
      } else {
        g.roundIndex += 1
        newRound(g, now)
      }
      break
    }
    case 'swap': {
      if (!isHost || g.status !== 'playing' || g.revealed || action.round !== g.roundIndex || !round) return game
      g.rounds[g.roundIndex] = action.data
      newRound(g, now)
      break
    }
    case 'kick': {
      if (!isHost || !g.players.some((p) => p.id === action.playerId)) return game
      g.players = g.players.filter((p) => p.id !== action.playerId)
      delete g.scores[action.playerId]
      delete g.votes[action.playerId]
      if (g.bossId === action.playerId) g.bossId = null
      g.kicked = [...g.kicked, action.playerId].slice(-200)
      break
    }
    case 'rematch': {
      if (!isHost) return game
      resetForLobby(g)
      break
    }
  }
  return g
}
