import Stripe from 'stripe'

const baseUrl =
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userEmail } = req.body

  if (!userEmail) {
    return res.status(400).json({ error: 'Missing userEmail' })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  const customers = await stripe.customers.list({ email: userEmail, limit: 1 })
  if (customers.data.length === 0) {
    return res.status(404).json({ error: 'No Stripe customer found for this email' })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customers.data[0].id,
    return_url: `${baseUrl}/dashboard`,
  })

  return res.status(200).json({ url: session.url })
}
