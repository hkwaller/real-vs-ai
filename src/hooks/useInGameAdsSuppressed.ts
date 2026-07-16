import { useStorage } from '@/liveblocks.config'
import { useAdFree } from '@/hooks/useAdFree'

/**
 * In-game ad suppression = my own ad-free entitlement OR the host's.
 *
 * The host perk: if the device that started the game is ad-free, everyone in
 * the room is (per-user Clerk metadata isn't visible across devices, so the
 * host stamps `hostAdFree` into room storage at game start).
 *
 * MUST be called inside a RoomProvider — `useStorage` throws otherwise. For a
 * component rendered both in and out of a room, pass suppression as a prop.
 */
export function useInGameAdsSuppressed(): boolean {
  const { isAdFree } = useAdFree()
  const hostAdFree = useStorage((root) => root.hostAdFree) ?? false
  return isAdFree || hostAdFree
}
