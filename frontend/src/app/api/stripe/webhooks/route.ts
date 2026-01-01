import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover' as any,
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  const supabase = await createServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any

        // Update subscription in database
        await supabase
          .from('subscriptions')
          .update({
            stripe_subscription_id: subscriptionId,
            status: 'active',
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any
        const customerId = subscription.customer as string

        let status: string = 'free'
        if (subscription.status === 'active') status = 'active'
        else if (subscription.status === 'trialing') status = 'trialing'
        else if (subscription.status === 'past_due') status = 'past_due'
        else if (subscription.status === 'canceled') status = 'canceled'

        await supabase
          .from('subscriptions')
          .update({
            status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any
        const customerId = subscription.customer as string

        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            stripe_subscription_id: null,
            current_period_end: null,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any
        const customerId = invoice.customer as string

        await supabase
          .from('subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)

        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
