'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from './useAuth'

export type SubscriptionStatus = 'free' | 'active' | 'canceled' | 'past_due' | 'trialing'

interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: SubscriptionStatus
  current_period_end: string | null
}

interface SubscriptionState {
  subscription: Subscription | null
  isPremium: boolean
  loading: boolean
}

export function useSubscription() {
  const { user } = useAuth()
  const [state, setState] = useState<SubscriptionState>({
    subscription: null,
    isPremium: false,
    loading: !isSupabaseConfigured ? false : true,
  })

  const supabase = createClient()

  // If Supabase is not configured, return default subscription state
  if (!isSupabaseConfigured) {
    return {
      ...state,
      canAccessFeature: () => true, // Allow all features when auth disabled
      getFeatureLimit: () => Infinity,
    }
  }

  const fetchSubscription = useCallback(async (userId: string) => {
    const { data } = await supabase!
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()
    return data as Subscription | null
  }, [supabase])

  useEffect(() => {
    const loadSubscription = async () => {
      if (!user) {
        setState({
          subscription: null,
          isPremium: false,
          loading: false,
        })
        return
      }

      const subscription = await fetchSubscription(user.id)
      const isPremium = subscription?.status === 'active' || subscription?.status === 'trialing'

      setState({
        subscription,
        isPremium,
        loading: false,
      })
    }

    loadSubscription()
  }, [user, fetchSubscription])

  const canAccessFeature = (feature: 'pdf' | 'savedSearches' | 'favorites' | 'advancedData') => {
    if (state.isPremium) return true

    // Free tier limits
    switch (feature) {
      case 'pdf':
        return false
      case 'savedSearches':
        return true // Limited to 3
      case 'favorites':
        return true // Limited to 5
      case 'advancedData':
        return false
      default:
        return false
    }
  }

  const getFeatureLimit = (feature: 'savedSearches' | 'favorites') => {
    if (state.isPremium) return Infinity

    switch (feature) {
      case 'savedSearches':
        return 3
      case 'favorites':
        return 5
      default:
        return 0
    }
  }

  return {
    ...state,
    canAccessFeature,
    getFeatureLimit,
  }
}
