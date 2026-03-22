import Stripe from 'stripe'

const baseUrl =
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId, userEmail, priceId } = req.body

  if (!userId || !userEmail || !priceId) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  // Reuse existing Stripe customer if one exists for this email
  const existing = await stripe.customers.list({ email: userEmail, limit: 1 })
  let customerId
  if (existing.data.length > 0) {
    customerId = existing.data[0].id
  } else {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { clerkUserId: userId },
    })
    customerId = customer.id
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${baseUrl}/dashboard?success=true`,
    cancel_url: `${baseUrl}/dashboard`,
    subscription_data: {
      trial_period_days: 7,
      metadata: { clerkUserId: userId },
    },
  })

  return res.status(200).json({ url: session.url })
}
