import Stripe from 'stripe'
import { createClerkClient } from '@clerk/backend'

const baseUrl =
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId, userEmail } = req.body

  if (!userId && !userEmail) {
    return res.status(400).json({ error: 'Missing userId or userEmail' })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  // Prefer the customer id cached on the Clerk user; fall back to email lookup.
  let customerId
  if (userId) {
    try {
      const clerkUser = await clerk.users.getUser(userId)
      customerId = clerkUser.privateMetadata?.stripeCustomerId
    } catch {
      // ignore
    }
  }

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
