import type { CategoryId } from '../data/categories'
import type { LeaderboardEntry, SubmittedScore } from '../types/movie'
import { isSupabaseConfigured, supabase } from './supabase'

type SubmitScoreInput = {
  categoryId: CategoryId
  categoryLabel: string
  score: number
}

type ScoreRow = {
  user_id: string
  pseudo: string | null
  category_id: string
  category_label: string
  score: number
  created_at: string
}

type LeaderboardRow = {
  user_id: string
  pseudo: string | null
  category_label: string
  score: number
  created_at: string
}

type ProfileRow = {
  id: string
  pseudo: string | null
}

async function fetchPseudoByUserId(userId: string) {
  if (!supabase) return 'Joueur'

  const { data } = await supabase
    .from('profiles')
    .select('pseudo')
    .eq('id', userId)
    .maybeSingle<{ pseudo: string | null }>()

  return data?.pseudo?.trim() || 'Joueur'
}

function getRowPseudo(row: { pseudo?: string | null; user_id: string }, pseudoByUserId: Map<string, string>) {
  return row.pseudo?.trim() || pseudoByUserId.get(row.user_id) || 'Joueur'
}

async function fetchPseudoMap(userIds: string[]) {
  if (!supabase || userIds.length === 0) return new Map<string, string>()

  const uniqueUserIds = [...new Set(userIds)]
  const { data } = await supabase
    .from('profiles')
    .select('id, pseudo')
    .in('id', uniqueUserIds)

  return new Map(
    ((data ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile.pseudo?.trim() || 'Joueur',
    ]),
  )
}

export async function submitScore({
  categoryId,
  categoryLabel,
  score,
}: SubmitScoreInput): Promise<{ data: SubmittedScore | null; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: 'Classement en ligne non configuré.' }
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    const user = userData.user

    if (userError || !user) {
      return { data: null, error: 'Connecte-toi pour publier ton score.' }
    }

    const pseudo = await fetchPseudoByUserId(user.id)

    const { data, error } = await supabase
      .from('scores')
      .insert({
        user_id: user.id,
        pseudo,
        category_id: categoryId,
        category_label: categoryLabel,
        score,
      })
      .select('user_id, pseudo, category_id, category_label, score, created_at')
      .single<ScoreRow>()

    if (error) {
      return { data: null, error: error.message }
    }

    return {
      data: {
        pseudo: data.pseudo?.trim() || pseudo,
        categoryId: data.category_id,
        categoryLabel: data.category_label,
        score: data.score,
        createdAt: data.created_at,
      },
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Erreur réseau Supabase.',
    }
  }
}

export async function fetchTopScores(
  limit = 20,
): Promise<{ data: LeaderboardEntry[]; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: 'Classement en ligne non configuré.' }
  }

  try {
    const { data, error } = await supabase
      .from('scores')
      .select('user_id, pseudo, category_label, score, created_at')
      .order('score', { ascending: false })
      .limit(limit)

    if (error) {
      return { data: [], error: error.message }
    }

    const rows = (data ?? []) as LeaderboardRow[]
    const pseudoByUserId = await fetchPseudoMap(rows.map((row) => row.user_id))

    return {
      data: rows.map((row) => ({
        pseudo: getRowPseudo(row, pseudoByUserId),
        score: row.score,
        categoryLabel: row.category_label,
        createdAt: row.created_at,
      })),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Erreur réseau Supabase.',
    }
  }
}

export async function fetchBestScore(): Promise<{ data: number | null; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: 'Classement en ligne non configuré.' }
  }

  try {
    const { data, error } = await supabase
      .from('scores')
      .select('score')
      .order('score', { ascending: false })
      .limit(1)
      .maybeSingle<{ score: number }>()

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data?.score ?? 0, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Erreur réseau Supabase.',
    }
  }
}
