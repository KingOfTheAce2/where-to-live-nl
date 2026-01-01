'use client'

import { useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  locale: string
}

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
  })

  const supabase = createClient()

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return data as Profile | null
  }, [supabase])

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user ?? null
        let profile = null

        if (user) {
          profile = await fetchProfile(user.id)
        }

        setState({
          user,
          session,
          profile,
          loading: false,
        })
      } catch (error) {
        // Supabase not configured or network error - fail gracefully
        console.warn('Auth session error:', error)
        setState({
          user: null,
          session: null,
          profile: null,
          loading: false,
        })
      }
    }

    getSession()

    let subscription: { unsubscribe: () => void } | null = null
    try {
      const { data } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          try {
            const user = session?.user ?? null
            let profile = null

            if (user) {
              profile = await fetchProfile(user.id)
            }

            setState({
              user,
              session,
              profile,
              loading: false,
            })
          } catch (error) {
            console.warn('Auth state change error:', error)
          }
        }
      )
      subscription = data.subscription
    } catch (error) {
      console.warn('Auth subscription error:', error)
    }

    return () => {
      subscription?.unsubscribe()
    }
  }, [supabase, fetchProfile])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })
    return { error }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error }
  }

  const signInWithGitHub = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    return { error }
  }

  return {
    ...state,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithGitHub,
    signOut,
    resetPassword,
  }
}
