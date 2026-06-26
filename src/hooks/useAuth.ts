import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../services/supabase'

type AuthActionResult = {
  error: string | null
}

function getReadableProfileError(message: string, code?: string) {
  const normalizedMessage = message.toLowerCase()

  if (code === '23505' || normalizedMessage.includes('duplicate') || normalizedMessage.includes('unique')) {
    return 'Ce pseudo est déjà pris.'
  }

  return message
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [pseudo, setPseudo] = useState<string | null>(null)
  const [hasProfile, setHasProfile] = useState(false)
  const [isAuthLoading, setIsAuthLoading] = useState(isSupabaseConfigured)

  const loadProfile = useCallback(async (nextUser: User | null) => {
    if (!supabase || !nextUser) {
      setPseudo(null)
      setHasProfile(false)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('pseudo')
      .eq('id', nextUser.id)
      .maybeSingle<{ pseudo: string | null }>()

    if (error || !data) {
      setPseudo(null)
      setHasProfile(false)
      return
    }

    setPseudo(data.pseudo)
    setHasProfile(Boolean(data.pseudo))
  }, [])

  useEffect(() => {
    if (!supabase) {
      setIsAuthLoading(false)
      return
    }

    const client = supabase
    let mounted = true

    async function initSession() {
      const { data } = await client.auth.getSession()
      if (!mounted) return

      const sessionUser = data.session?.user ?? null
      setUser(sessionUser)
      await loadProfile(sessionUser)

      if (mounted) {
        setIsAuthLoading(false)
      }
    }

    void initSession()

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null
      setUser(sessionUser)
      void loadProfile(sessionUser)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signInWithMagicLink = useCallback(async (email: string): Promise<AuthActionResult> => {
    if (!supabase) {
      return { error: 'Connexion en ligne non configurée.' }
    }

    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      return { error: 'Entre une adresse email.' }
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    return { error: error?.message ?? null }
  }, [])

  const createProfile = useCallback(
    async (nextPseudo: string): Promise<AuthActionResult> => {
      if (!supabase) {
        return { error: 'Connexion en ligne non configurée.' }
      }

      if (!user) {
        return { error: 'Connecte-toi avant de choisir un pseudo.' }
      }

      const normalizedPseudo = nextPseudo.trim()
      if (normalizedPseudo.length < 3 || normalizedPseudo.length > 20) {
        return { error: 'Entre 3 à 20 caractères.' }
      }

      const { error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          pseudo: normalizedPseudo,
        })

      if (error) {
        return { error: getReadableProfileError(error.message, error.code) }
      }

      setPseudo(normalizedPseudo)
      setHasProfile(true)
      return { error: null }
    },
    [user],
  )

  const signOut = useCallback(async () => {
    if (!supabase) return

    await supabase.auth.signOut()
    setUser(null)
    setPseudo(null)
    setHasProfile(false)
  }, [])

  return {
    user,
    pseudo,
    hasProfile,
    isAuthLoading,
    signInWithMagicLink,
    createProfile,
    signOut,
  }
}
