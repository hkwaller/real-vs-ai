/* global process */
import { createClerkClient, verifyToken } from '@clerk/backend'

export async function hasAdminSession(req) {
  const secretKey = process.env.CLERK_SECRET_KEY
  const match = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '')
  if (!secretKey || !match) return false

  try {
    const { sub } = await verifyToken(match[1], { secretKey })
    const user = await createClerkClient({ secretKey }).users.getUser(sub)
    return user.publicMetadata?.role === 'admin'
  } catch {
    return false
  }
}
