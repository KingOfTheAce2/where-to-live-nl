'use client'

import { createContext, useContext, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription, SubscriptionStatus } from '@/hooks/useSubscription'

interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  locale: string
}

interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: SubscriptionStatus
  current_period_end: string | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  subscription: Subscription | null
  isPremium: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signInWithGitHub: () => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  canAccessFeature: (feature: 'pdf' | 'savedSearches' | 'favorites' | 'advancedData') => boolean
  getFeatureLimit: (feature: 'savedSearches' | 'favorites') => number
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const subscription = useSubscription()

  // Default values for when auth is not configured
  const noopAsync = async () => ({ error: null as Error | null })

  const value: AuthContextType = {
    user: auth?.user ?? null,
    session: auth?.session ?? null,
    profile: auth?.profile ?? null,
    subscription: subscription?.subscription ?? null,
    isPremium: subscription?.isPremium ?? false,
    loading: (auth?.loading ?? false) || (subscription?.loading ?? false),
    signIn: auth?.signIn ?? noopAsync,
    signUp: auth?.signUp ?? noopAsync,
    signInWithGoogle: auth?.signInWithGoogle ?? noopAsync,
    signInWithGitHub: auth?.signInWithGitHub ?? noopAsync,
    signOut: auth?.signOut ?? noopAsync,
    resetPassword: auth?.resetPassword ?? noopAsync,
    canAccessFeature: subscription?.canAccessFeature ?? (() => false),
    getFeatureLimit: subscription?.getFeatureLimit ?? (() => 0),
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}
