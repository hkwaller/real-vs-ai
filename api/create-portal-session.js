import Stripe from 'stripe'
import { createClerkClient, verifyToken } from '@clerk/backend'

const baseUrl =
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

// Resolve the caller from their Clerk session token - never trust ids in the body.
async function getAuthedUser(req) {
  const token = req.headers.authorization?.replace(/^Bearer /, '')
  if (!token) return null
  try {
    const { sub } = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
    return await clerk.users.getUser(sub)
  } catch {
    return null
  }
}

const primaryEmail = (user) =>
  user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
  user.emailAddresses[0]?.emailAddress

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getAuthedUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const userEmail = primaryEmail(user)

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  // Prefer the customer id cached on the Clerk user; fall back to email lookup.
  let customerId = user.privateMetadata?.stripeCustomerId

  if (!customerId && userEmail) {
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 })
    if (customers.data.length > 0) customerId = customers.data[0].id
  }

  if (!customerId) {
    return res.status(404).json({ error: 'No Stripe customer found' })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl}/go-ad-free`,
  })

  return res.status(200).json({ url: session.url })
}
