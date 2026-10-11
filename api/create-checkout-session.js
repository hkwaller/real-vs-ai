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

// plan -> Stripe price id + checkout mode. Day pass is a one-time payment;
// month/year are recurring subscriptions. One entitlement (adFreeUntil) covers both.
const PLANS = {
  day: { price: process.env.STRIPE_PRICE_DAY, mode: 'payment' },
  month: { price: process.env.STRIPE_PRICE_MONTH, mode: 'subscription' },
  year: { price: process.env.STRIPE_PRICE_YEAR, mode: 'subscription' },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getAuthedUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const userId = user.id
  const userEmail = primaryEmail(user)

  const { plan } = req.body ?? {}

  if (!userEmail || !plan) {
    return res.status(400).json({ error: 'Missing required fields (email, plan)' })
  }

  const config = PLANS[plan]
  if (!config || !config.price) {
    return res.status(400).json({ error: `Unknown or unconfigured plan: ${plan}` })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  // Resolve the Stripe customer: prefer the id cached on the Clerk user, then
  // an existing customer by email, otherwise create one. Cache it for next time.
  let customerId = user.privateMetadata?.stripeCustomerId

  if (!customerId) {
    const existing = await stripe.customers.list({ email: userEmail, limit: 1 })
    if (existing.data.length > 0) {
      customerId = existing.data[0].id
    } else {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { clerkUserId: userId },
      })
      customerId = customer.id
    }
    // Cache on the Clerk user (best-effort).
    try {
      await clerk.users.updateUserMetadata(userId, {
        privateMetadata: { stripeCustomerId: customerId },
      })
    } catch (err) {
      console.error('Failed to cache stripeCustomerId on Clerk user:', err)
    }
  }

  const sessionParams = {
    customer: customerId,
    line_items: [{ price: config.price, quantity: 1 }],
    mode: config.mode,
    // Resolve the Clerk user in the webhook from either of these.
    client_reference_id: userId,
    metadata: { clerkUserId: userId, plan },
    success_url: `${baseUrl}/go-ad-free?status=success`,
    cancel_url: `${baseUrl}/go-ad-free?status=cancelled`,
  }

  if (config.mode === 'subscription') {
    sessionParams.subscription_data = { metadata: { clerkUserId: userId, plan } }
  } else {
    // Day pass: stamp grant length so the webhook can extend adFreeUntil.
    sessionParams.metadata.grant_hours = '24'
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  return res.status(200).json({ url: session.url })
}
