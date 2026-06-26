import { useCallback, useEffect, useRef, useState } from 'react'
import { CATEGORIES, getCategory, type CategoryId } from '../data/categories'
import { FALLBACK_MOVIES } from '../data/fallbackMovies'
import { drawPair, filterMoviesByCategory, shuffleItems } from '../lib/movies'
import { fetchBestScore, fetchTopScores, submitScore } from '../services/leaderboard'
import { isSupabaseConfigured } from '../services/supabase'
import { useAuth } from './useAuth'
import {
  fetchDiscoverPage,
  fetchMovieDetails,
  MAX_PAGES,
  PAGE_DELAY_MS,
  POOL_CAP,
  toInternalMovie,
  type TmdbMovieDetails,
} from '../services/tmdb'
import type { GamePhase, GameScreen, LeaderboardEntry, Movie, PickSide, SubmittedScore } from '../types/movie'

const BEST_SCORE_KEY = 'box-office-duel-best-score'
const LEADERBOARD_LIMIT = 20
const REVEAL_DELAY_MS = 900
const ROUND_DURATION_SECONDS = 60
const MIN_POOL_BEFORE_FIRST_TURN = 2
const TOP_100_POOL_CAP = 100
const TOP_100_DISCOVER_PAGES = 5
const INITIAL_TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY?.trim() ?? ''
const DISCOVER_SORT_OPTIONS = [
  'popularity.desc',
  'revenue.desc',
  'vote_count.desc',
  'vote_average.desc',
  'primary_release_date.desc',
]

export function useBoxOfficeGame() {
  const {
    user,
    pseudo,
    hasProfile,
    isAuthLoading,
    signInWithMagicLink: requestMagicLink,
    createProfile: createAuthProfile,
    signOut,
  } = useAuth()
  const [champion, setChampion] = useState<Movie | null>(null)
  const [challenger, setChallenger] = useState<Movie | null>(null)
  const [phase, setPhase] = useState<GamePhase>('guessing')
  const [pickSide, setPickSide] = useState<PickSide | null>(null)
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null)
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION_SECONDS)
  const [isGameOver, setIsGameOver] = useState(false)
  const [isGameOverModalOpen, setIsGameOverModalOpen] = useState(false)
  const [screen, setScreen] = useState<GameScreen>('category-select')
  const [selectedCategoryId, setSelectedCategoryId] = useState<CategoryId>('top-100')
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [tmdbKey] = useState(INITIAL_TMDB_KEY)
  const [pool, setPool] = useState<Movie[]>([])
  const [isBuildingPool, setIsBuildingPool] = useState(false)
  const [shouldBuildPool, setShouldBuildPool] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardStatus, setLeaderboardStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle')
  const [leaderboardMessage, setLeaderboardMessage] = useState<string | null>(null)
  const [submittedScore, setSubmittedScore] = useState<SubmittedScore | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const isGameOverRef = useRef(false)
  const lastPairRef = useRef<string[]>([])
  const seenMovieIdsRef = useRef<Set<string>>(new Set())
  const hasStartedFirstPairRef = useRef(false)
  const hasSubmittedScoreRef = useRef(false)

  function setNextPair(source: Movie[]) {
    const recentAndSeenIds = [...lastPairRef.current, ...seenMovieIdsRef.current]
    const enoughUnseenMovies = source.filter((movie) => !recentAndSeenIds.includes(movie.id)).length >= 2
    const excludeIds = enoughUnseenMovies ? recentAndSeenIds : lastPairRef.current
    const [first, second] = drawPair(source, excludeIds)

    setChampion(first)
    setChallenger(second)
    lastPairRef.current = [first.id, second.id]
    seenMovieIdsRef.current.add(first.id)
    seenMovieIdsRef.current.add(second.id)
  }

  function getFallbackSource(categoryId = selectedCategoryId) {
    return filterMoviesByCategory(FALLBACK_MOVIES, getCategory(categoryId))
  }

  function resetRunState() {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    setChampion(null)
    setChallenger(null)
    setPhase('guessing')
    setPickSide(null)
    setWasCorrect(null)
    setScore(0)
    setTimeLeft(ROUND_DURATION_SECONDS)
    setIsGameOver(false)
    setIsGameOverModalOpen(false)
    setPool([])
    setShouldBuildPool(false)
    setLeaderboard([])
    setLeaderboardStatus('idle')
    setLeaderboardMessage(null)
    setSubmittedScore(null)
    setMagicLinkSent(false)
    setProfileError(null)
    lastPairRef.current = []
    seenMovieIdsRef.current = new Set()
    hasStartedFirstPairRef.current = false
    hasSubmittedScoreRef.current = false
  }

  useEffect(() => {
    const savedBestScore = Number(localStorage.getItem(BEST_SCORE_KEY))
    if (Number.isFinite(savedBestScore)) {
      setBestScore(savedBestScore)
    }

    async function loadGlobalBestScore() {
      if (!isSupabaseConfigured) return

      const best = await fetchBestScore()
      if (typeof best.data === 'number') {
        setBestScore(best.data)
      }
    }

    void loadGlobalBestScore()

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isGameOver) {
      setMagicLinkSent(false)
      setProfileError(null)
      setIsGameOverModalOpen(true)
    }
  }, [isGameOver])

  useEffect(() => {
    isGameOverRef.current = isGameOver
  }, [isGameOver])

  useEffect(() => {
    if (screen !== 'playing' || !champion || !challenger || isGameOver) return

    const intervalId = window.setInterval(() => {
      setTimeLeft((currentTimeLeft) => {
        if (currentTimeLeft <= 1) {
          setIsGameOver(true)

          if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current)
            timeoutRef.current = null
          }

          return 0
        }

        return currentTimeLeft - 1
      })
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [champion, challenger, isGameOver, screen])

  useEffect(() => {
    if (screen === 'loading' && !hasStartedFirstPairRef.current && pool.length >= MIN_POOL_BEFORE_FIRST_TURN) {
      hasStartedFirstPairRef.current = true
      setNextPair(pool)
      setScreen('playing')
    }
  }, [pool, screen])

  useEffect(() => {
    if (!tmdbKey || !shouldBuildPool) return

    let cancelled = false
    let currentSize = 0
    let accumulatedPool: Movie[] = []
    setPool([])
    setIsBuildingPool(true)

    async function buildPool() {
      const category = getCategory(selectedCategoryId)
      const isTop100 = category.id === 'top-100'
      const targetPoolCap = isTop100 ? TOP_100_POOL_CAP : POOL_CAP
      const seenIds = new Set<number>()
      const queuedPages = [1]
      let hasQueuedCatalogPages = false
      const discoverSort = isTop100
        ? 'revenue.desc'
        : DISCOVER_SORT_OPTIONS[Math.floor(Math.random() * DISCOVER_SORT_OPTIONS.length)]

      while (!cancelled && queuedPages.length > 0 && currentSize < targetPoolCap) {
        const page = queuedPages.shift()
        let discoverData

        if (!page) break

        try {
          discoverData = await fetchDiscoverPage(tmdbKey, page, category.tmdbGenreId, discoverSort)
        } catch {
          break
        }

        if (cancelled) return

        if (!hasQueuedCatalogPages) {
          const pageLimit = isTop100 ? TOP_100_DISCOVER_PAGES : MAX_PAGES
          const maxPage = Math.min(discoverData.total_pages ?? pageLimit, pageLimit)
          const nextPages = Array.from({ length: Math.max(maxPage - 1, 0) }, (_, index) => index + 2)
          queuedPages.push(...(isTop100 ? nextPages : shuffleItems(nextPages)))
          hasQueuedCatalogPages = true
        }

        const candidates = (discoverData.results ?? []).filter((movie) => !seenIds.has(movie.id))
        candidates.forEach((movie) => seenIds.add(movie.id))

        const details = await Promise.all(
          candidates.map((movie) => fetchMovieDetails(tmdbKey, movie.id)),
        )

        if (cancelled) return

        const mapped = details
          .filter((details): details is TmdbMovieDetails => {
            if (!details) return false
            if (category.id === 'top-100') return true

            return details.genres?.[0]?.id === category.tmdbGenreId
          })
          .filter((details): details is NonNullable<typeof details> => {
            return Boolean(details?.budget && details.revenue && details.poster_path)
          })
          .map(toInternalMovie)

        if (mapped.length) {
          setPool((previousPool) => {
            const existingIds = new Set(previousPool.map((movie) => movie.id))
            const freshMovies = shuffleItems(mapped.filter((movie) => !existingIds.has(movie.id)))
            const nextPool = [...previousPool, ...freshMovies].slice(0, targetPoolCap)
            currentSize = nextPool.length
            accumulatedPool = nextPool

            if (!cancelled && !hasStartedFirstPairRef.current && nextPool.length >= MIN_POOL_BEFORE_FIRST_TURN) {
              hasStartedFirstPairRef.current = true
              window.setTimeout(() => {
                if (!cancelled) {
                  setNextPair(nextPool)
                  setScreen('playing')
                }
              }, 0)
            }

            return nextPool
          })
        }

        if (hasStartedFirstPairRef.current) {
          await new Promise((resolve) => {
            window.setTimeout(resolve, PAGE_DELAY_MS)
          })
        }
      }

      if (!cancelled) {
        if (!hasStartedFirstPairRef.current && accumulatedPool.length >= 2) {
          hasStartedFirstPairRef.current = true
          setNextPair(accumulatedPool)
          setScreen('playing')
        } else if (!hasStartedFirstPairRef.current) {
          hasStartedFirstPairRef.current = true
          setNextPair(getFallbackSource(selectedCategoryId))
          setScreen('playing')
        }

        setIsBuildingPool(false)
        setShouldBuildPool(false)
      }
    }

    void buildPool()

    return () => {
      // Changer de catégorie remonte ici via les dépendances de l'effet.
      // Le flag empêche les réponses réseau arrivées en retard d'ajouter des films
      // ou de remplacer la paire affichée pour la nouvelle catégorie.
      cancelled = true
      setIsBuildingPool(false)
    }
  }, [selectedCategoryId, shouldBuildPool, tmdbKey])

  const persistBestScore = useCallback((value: number) => {
    localStorage.setItem(BEST_SCORE_KEY, String(value))
  }, [])

  const startCategory = useCallback(
    (categoryId: CategoryId) => {
      resetRunState()
      setSelectedCategoryId(categoryId)

      if (!tmdbKey) {
        setNextPair(getFallbackSource(categoryId))
        setScreen('playing')
        return
      }

      setShouldBuildPool(true)
      setScreen('loading')
    },
    [tmdbKey],
  )

  const syncLeaderboard = useCallback(async () => {
    if (hasSubmittedScoreRef.current) return

    if (!isSupabaseConfigured) {
      setLeaderboardStatus('unavailable')
      setLeaderboardMessage('Classement en ligne non configuré.')
      return
    }

    hasSubmittedScoreRef.current = true
    setLeaderboardStatus('loading')
    setLeaderboardMessage(null)

    const category = getCategory(selectedCategoryId)
    const submitted = await submitScore({
      categoryId: category.id,
      categoryLabel: category.label,
      score,
    })

    if (submitted.data) {
      setSubmittedScore(submitted.data)
    }

    const topScores = await fetchTopScores(LEADERBOARD_LIMIT)
    setLeaderboard(topScores.data)

    const globalBestScore = topScores.data[0]?.score ?? submitted.data?.score
    if (typeof globalBestScore === 'number') {
      setBestScore(globalBestScore)
    }

    if (submitted.error || topScores.error) {
      setLeaderboardStatus(topScores.data.length ? 'ready' : 'unavailable')
      setLeaderboardMessage(submitted.error ?? topScores.error)
      return
    }

    setLeaderboardStatus('ready')
  }, [score, selectedCategoryId])

  useEffect(() => {
    if (!isGameOver) return

    if (!isSupabaseConfigured) {
      setLeaderboardStatus('unavailable')
      setLeaderboardMessage('Classement en ligne non configuré.')
      return
    }

    if (!user || !hasProfile || isAuthLoading) {
      setLeaderboardStatus('idle')
      return
    }

    void syncLeaderboard()
  }, [hasProfile, isAuthLoading, isGameOver, syncLeaderboard, user])

  const signInWithMagicLink = useCallback(
    async (email: string) => {
      setMagicLinkSent(false)
      setProfileError(null)

      const result = await requestMagicLink(email)
      if (result.error) {
        setProfileError(result.error)
        return result
      }

      setMagicLinkSent(true)
      return result
    },
    [requestMagicLink],
  )

  const createProfile = useCallback(
    async (nextPseudo: string) => {
      setProfileError(null)

      const result = await createAuthProfile(nextPseudo)
      if (result.error) {
        setProfileError(result.error)
        return result
      }

      if (isGameOver && !hasSubmittedScoreRef.current) {
        void syncLeaderboard()
      }

      return result
    },
    [createAuthProfile, isGameOver, syncLeaderboard],
  )

  const closeGameOverModal = useCallback(() => {
    setIsGameOverModalOpen(false)
  }, [])

  const showCategorySelect = useCallback(() => {
    resetRunState()
    setScreen('category-select')
  }, [])

  const restartGame = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    const source = pool.length >= 2 ? pool : getFallbackSource()
    setScore(0)
    setTimeLeft(ROUND_DURATION_SECONDS)
    setIsGameOver(false)
    setIsGameOverModalOpen(false)
    setPhase('guessing')
    setPickSide(null)
    setWasCorrect(null)
    setLeaderboard([])
    setLeaderboardStatus('idle')
    setLeaderboardMessage(null)
    setSubmittedScore(null)
    setMagicLinkSent(false)
    setProfileError(null)
    hasSubmittedScoreRef.current = false
    setNextPair(source)
  }, [pool])

  const handlePick = useCallback(
    (side: PickSide) => {
      if (phase !== 'guessing' || isGameOver || !champion || !challenger) return

      const correct =
        side === 'champion'
          ? champion.revenue >= challenger.revenue
          : challenger.revenue >= champion.revenue

      setPickSide(side)
      setWasCorrect(correct)
      setPhase('revealed')

      if (correct) {
        setScore((currentScore) => {
          const nextScore = currentScore + 1

          if (!isSupabaseConfigured) {
            setBestScore((currentBestScore) => {
              if (nextScore <= currentBestScore) return currentBestScore

              persistBestScore(nextScore)
              return nextScore
            })
          }

          return nextScore
        })
      }

      timeoutRef.current = window.setTimeout(() => {
        if (isGameOverRef.current) return

        const source = pool.length >= 2 ? pool : getFallbackSource()
        setNextPair(source)
        setPhase('guessing')
        setPickSide(null)
        setWasCorrect(null)
      }, REVEAL_DELAY_MS)
    },
    [champion, challenger, isGameOver, persistBestScore, phase, pool],
  )

  return {
    bestScore,
    categories: CATEGORIES,
    champion,
    challenger,
    handlePick,
    isGameOver,
    isGameOverModalOpen,
    isBuildingPool,
    leaderboard,
    leaderboardMessage,
    leaderboardStatus,
    phase,
    pickSide,
    pool,
    profileError,
    pseudo,
    restartGame,
    score,
    screen,
    selectedCategory: getCategory(selectedCategoryId),
    closeGameOverModal,
    showCategorySelect,
    signInWithMagicLink,
    signOut,
    startCategory,
    submittedScore,
    createProfile,
    hasProfile,
    isSupabaseConfigured,
    magicLinkSent,
    timeLeft,
    tmdbKey,
    user,
    wasCorrect,
  }
}
