export type RoomTicket = { room: string; id: string }

export const ROOM_CODE: RegExp
export const GUEST_KEY: RegExp
export function guestIdFromKey(key: string): Promise<string>
export function signRoomTicket(ticket: RoomTicket, secret: string, ttlSeconds?: number, now?: number): Promise<string>
export function verifyRoomTicket(token: string, room: string, secret: string, now?: number): Promise<{ id: string } | null>
