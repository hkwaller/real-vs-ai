import Stripe from 'stripe'
import { createClerkClient } from '@clerk/backend'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

// Node runtime + raw body — a parsed body breaks signature verification.
export const config = { api: { bodyParser: false } }

async function getRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

function planFromPriceId(priceId) {
  if (priceId === process.env.STRIPE_PRICE_MONTH) return 'month'
  if (priceId === process.env.STRIPE_PRICE_YEAR) return 'year'
  return null
}

// SDK v22+ moved current_period_end onto the subscription item; read the item
// first, fall back to the subscription for older SDKs.
function periodEndMs(subscription) {
  const item = subscription.items?.data?.[0]
  const secs = item?.current_period_end ?? subscription.current_period_end
  return secs ? secs * 1000 : null
}

// Resolve the Clerk user id from the object metadata, falling back to the
// Stripe customer's metadata.
async function resolveClerkUserId(obj) {
  const direct = obj.metadata?.clerkUserId || obj.client_reference_id
  if (direct) return direct
  const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id
  if (!customerId) return null
  try {
    const customer = await stripe.customers.retrieve(customerId)
    return customer?.metadata?.clerkUserId ?? null
  } catch {
    return null
  }
}

async function patchPublicMetadata(clerkUserId, patch) {
  const user = await clerk.users.getUser(clerkUserId)
  await clerk.users.updateUserMetadata(clerkUserId, {
    publicMetadata: { ...user.publicMetadata, ...patch },
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rawBody = await getRawBody(req)
  const sig = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Stripe webhook signature failed:', err.message)
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        // Subscriptions are handled by customer.subscription.* events.
        if (session.mode !== 'payment') break

        const clerkUserId = await resolveClerkUserId(session)
        if (!clerkUserId) break

        const grantHours = Number(session.metadata?.grant_hours) || 24
        const user = await clerk.users.getUser(clerkUserId)
        const existing = user.publicMetadata?.adFreeUntil
        const existingMs = existing ? new Date(existing).getTime() : 0
        // Stack onto any remaining time.
        const base = Math.max(Date.now(), Number.isFinite(existingMs) ? existingMs : 0)
        const until = new Date(base + grantHours * 60 * 60 * 1000).toISOString()

        await clerk.users.updateUserMetadata(clerkUserId, {
          publicMetadata: { ...user.publicMetadata, adFreeUntil: until, adFreePlan: 'day' },
        })
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const clerkUserId = await resolveClerkUserId(subscription)
        if (!clerkUserId) break

        const isActive =
          subscription.status === 'active' || subscription.status === 'trialing'
        const priceId = subscription.items?.data?.[0]?.price?.id
        const plan = planFromPriceId(priceId)

        if (isActive) {
          const endMs = periodEndMs(subscription)
          const patch = { subscriptionActive: true }
          if (endMs) {
            patch.adFreeUntil = new Date(endMs).toISOString()
            patch.adFreePlan = plan
          }
          await patchPublicMetadata(clerkUserId, patch)
        } else {
          // past_due / incomplete / canceled — stop marking active; existing
          // adFreeUntil expires on its own.
          await patchPublicMetadata(clerkUserId, { subscriptionActive: false })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const clerkUserId = await resolveClerkUserId(subscription)
        if (!clerkUserId) break
        // Keep adFreeUntil (paid through period end); just clear active flag.
        await patchPublicMetadata(clerkUserId, { subscriptionActive: false })
        break
      }
    }
  } catch (err) {
    console.error('Failed to process webhook:', err)
    return res.status(500).json({ error: 'Failed to update user metadata' })
  }

  return res.status(200).json({ received: true })
}
