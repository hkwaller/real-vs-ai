import { GUEST_KEY, ROOM_CODE, guestIdFromKey, signRoomTicket } from '../party/roomTicket.js'

// Issues a short-lived ticket for one room. The room Worker trusts the id inside it.
// Every device (host screen or phone) proves its id with a secret key it keeps in
// localStorage; nobody needs an account to play.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const secret = process.env.PARTY_SECRET
  if (!secret) return res.status(503).json({ error: 'Room service is not configured' })

  const { room, key } = req.body ?? {}
  if (typeof room !== 'string' || !ROOM_CODE.test(room)) return res.status(400).json({ error: 'Invalid room' })
  if (typeof key !== 'string' || !GUEST_KEY.test(key)) return res.status(400).json({ error: 'Invalid key' })

  const ticket = await signRoomTicket({ room, id: await guestIdFromKey(key) }, secret)
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ ticket })
}
