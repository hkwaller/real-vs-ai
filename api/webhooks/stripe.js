import Stripe from 'stripe'
import { createClerkClient } from '@clerk/backend'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

async function getRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
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

  const subscription = event.data.object
  const clerkUserId = subscription.metadata?.clerkUserId

  if (!clerkUserId) {
    // No Clerk user attached — nothing to update
    return res.status(200).json({ received: true })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const isActive = subscription.status === 'active' || subscription.status === 'trialing'
        const priceId = subscription.items.data[0]?.price.id
        const plan =
          priceId === process.env.STRIPE_PRICE_ID_MONTHLY
            ? 'monthly'
            : priceId === process.env.STRIPE_PRICE_ID_YEARLY
              ? 'yearly'
              : 'pro'

        await clerk.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            subscriptionStatus: isActive ? 'active' : 'inactive',
            subscriptionPlan: plan,
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: subscription.customer,
          },
        })
        break
      }

      case 'customer.subscription.deleted': {
        await clerk.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            subscriptionStatus: 'inactive',
            subscriptionPlan: null,
            stripeSubscriptionId: null,
          },
        })
        break
      }
    }
  } catch (err) {
    console.error('Failed to update Clerk metadata:', err)
    return res.status(500).json({ error: 'Failed to update user metadata' })
  }

  return res.status(200).json({ received: true })
}
