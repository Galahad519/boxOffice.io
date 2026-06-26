import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Film, Ticket, Trophy, X } from 'lucide-react'
import { CategorySelectScreen } from '../../components/CategorySelectScreen'
import { PosterCard } from '../../components/PosterCard'
import { ScoreBoard } from '../../components/ScoreBoard'
import { VsDivider } from '../../components/VsDivider'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Skeleton } from '../../components/ui/skeleton'
import { Toaster } from '../../components/ui/sonner'
import { useBoxOfficeGame } from '../../hooks/useBoxOfficeGame'
import type { LeaderboardEntry, SubmittedScore } from '../../types/movie'

export function BoxOfficeDuel() {
  const {
    bestScore,
    categories,
    champion,
    challenger,
    closeGameOverModal,
    handlePick,
    isGameOver,
    isGameOverModalOpen,
    isBuildingPool,
    leaderboard,
    leaderboardMessage,
    leaderboardStatus,
    profileError,
    phase,
    pickSide,
    pool,
    pseudo,
    restartGame,
    score,
    screen,
    selectedCategory,
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
    user,
    wasCorrect,
  } = useBoxOfficeGame()

  if (screen === 'category-select') {
    return (
      <>
        <CategorySelectScreen
          categories={categories}
          selectedCategoryId={selectedCategory.id}
          onSelectCategory={startCategory}
        />
        <Toaster />
      </>
    )
  }

  if (!champion || !challenger) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[radial-gradient(ellipse_at_top,#221e2a_0%,#15131a_65%)] px-4 text-center text-[#f3eee3]">
        <div className="flex items-center justify-center gap-2 text-3xl font-black tracking-widest text-[#e8b339] drop-shadow-[0_0_18px_rgba(232,179,57,0.35)]">
          <Film size={20} strokeWidth={2.2} />
          <span>DUEL BOX-OFFICE</span>
        </div>
        <div className="flex w-full max-w-[560px] flex-col items-center gap-3.5 sm:flex-row sm:items-stretch sm:justify-center">
          <PosterSkeleton />
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-2 border-[#c8253d] bg-[#c8253d]/10 text-sm font-bold text-[#c8253d]">
            VS
          </span>
          <PosterSkeleton />
        </div>
        {isBuildingPool && (
          <p className="m-0 font-mono text-xs text-[#e8b339]">
            {pool.length} film{pool.length === 1 ? '' : 's'} prêt{pool.length === 1 ? '' : 's'}
          </p>
        )}
        <Toaster />
      </div>
    )
  }

  const revealed = phase !== 'guessing'
  const championIsWinner = revealed && champion.revenue >= challenger.revenue
  const challengerIsWinner = revealed && challenger.revenue >= champion.revenue
  const championIsLoserPick = revealed && pickSide === 'champion' && wasCorrect === false
  const challengerIsLoserPick = revealed && pickSide === 'challenger' && wasCorrect === false
  const usingPool = pool.length >= 2

  return (
    <>
      <div className="flex min-h-screen flex-col items-center justify-center gap-3.5 bg-[radial-gradient(ellipse_at_top,#221e2a_0%,#15131a_65%)] px-4 py-4 text-[#f3eee3] sm:py-6">
        <header className="max-w-[480px] text-center">
          <div className="flex items-center justify-center gap-2 text-3xl font-black tracking-widest text-[#e8b339] drop-shadow-[0_0_18px_rgba(232,179,57,0.35)]">
            <Film size={20} strokeWidth={2.2} />
            <span>DUEL BOX-OFFICE</span>
          </div>
          <p className="mt-1.5 text-[13px] text-[#9a93a6]">
            Quel film a rapporté le plus au box-office mondial ?
          </p>
        </header>

        <ScoreBoard score={score} bestScore={bestScore} timeLeft={timeLeft} />

        <div className="flex w-full max-w-[560px] flex-col items-center gap-3.5 sm:flex-row sm:items-stretch sm:justify-center">
          <PosterCard
            key={champion.id}
            movie={champion}
            revealed={revealed}
            disabled={phase !== 'guessing' || isGameOver}
            isWinner={championIsWinner}
            isLoserPick={championIsLoserPick}
            onClick={() => handlePick('champion')}
          />

          <VsDivider revealed={revealed} />

          <PosterCard
            key={challenger.id}
            movie={challenger}
            revealed={revealed}
            disabled={phase !== 'guessing' || isGameOver}
            isWinner={challengerIsWinner}
            isLoserPick={challengerIsLoserPick}
            onClick={() => handlePick('challenger')}
          />
        </div>

        <div className="flex min-h-[50px] flex-col items-center justify-center gap-2.5 text-center">
          {!isGameOver && phase === 'guessing' && (
            <p className="m-0 text-[13px] text-[#9a93a6]">
              Clique sur l'affiche qui, selon toi, a généré le plus de recettes.
            </p>
          )}
          {!isGameOver && phase === 'revealed' && wasCorrect && <ResultStamp variant="correct" label="BONNE PIOCHE" />}
          {!isGameOver && phase === 'revealed' && !wasCorrect && <ResultStamp variant="wrong" label="RATÉ" />}
        </div>

        <p className="m-0 max-w-[420px] text-center text-[10.5px] text-[#9a93a6]/70">
          {usingPool
            ? 'Films, affiches, budgets et recettes en direct depuis le catalogue TMDB.'
            : 'Chiffres de budget et de recettes mondiales approximatifs, à titre d’illustration.'}{' '}
          Ce produit utilise l'API TMDB mais n'est ni avalisé ni certifié par TMDB.
        </p>
      </div>
      {isGameOver && !isGameOverModalOpen && (
        <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 flex-col gap-2 rounded-lg border border-[#e8b339]/35 bg-[#241f2c] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.35)] sm:flex-row">
          <Button
            type="button"
            onClick={restartGame}
            className="bg-[#e8b339] text-sm font-bold text-[#15131a] hover:bg-[#f1c85b]"
          >
            Rejouer
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={showCategorySelect}
            className="border-[#e8b339]/35 bg-[#15131a] text-sm font-bold text-[#e8b339] hover:border-[#e8b339] hover:bg-[#2c2733] hover:text-[#e8b339]"
          >
            Changer de catégorie
          </Button>
        </div>
      )}
      {isGameOver && isGameOverModalOpen && (
        <GameOverModal
          score={score}
          bestScore={bestScore}
          leaderboard={leaderboard}
          leaderboardMessage={leaderboardMessage}
          leaderboardStatus={leaderboardStatus}
          onClose={closeGameOverModal}
          onRestart={restartGame}
          onChangeCategory={showCategorySelect}
          pseudo={pseudo}
          profileError={profileError}
          submittedScore={submittedScore}
          user={user}
          hasProfile={hasProfile}
          isSupabaseConfigured={isSupabaseConfigured}
          magicLinkSent={magicLinkSent}
          onCreateProfile={createProfile}
          onSignInWithMagicLink={signInWithMagicLink}
          onSignOut={signOut}
        />
      )}
      <Toaster />
    </>
  )
}

function GameOverModal({
  score,
  bestScore,
  leaderboard,
  leaderboardMessage,
  leaderboardStatus,
  onClose,
  onRestart,
  onChangeCategory,
  pseudo,
  profileError,
  submittedScore,
  user,
  hasProfile,
  isSupabaseConfigured,
  magicLinkSent,
  onCreateProfile,
  onSignInWithMagicLink,
  onSignOut,
}: {
  score: number
  bestScore: number
  leaderboard: LeaderboardEntry[]
  leaderboardMessage: string | null
  leaderboardStatus: 'idle' | 'loading' | 'ready' | 'unavailable'
  onClose: () => void
  onRestart: () => void
  onChangeCategory: () => void
  pseudo: string | null
  profileError: string | null
  submittedScore: SubmittedScore | null
  user: User | null
  hasProfile: boolean
  isSupabaseConfigured: boolean
  magicLinkSent: boolean
  onCreateProfile: (pseudo: string) => Promise<{ error: string | null }>
  onSignInWithMagicLink: (email: string) => Promise<{ error: string | null }>
  onSignOut: () => void
}) {
  const [email, setEmail] = useState('')
  const [profilePseudo, setProfilePseudo] = useState(pseudo ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    setProfilePseudo(pseudo ?? '')
  }, [pseudo])

  const playerIsInTop = leaderboard.some((entry) => {
    return (
      entry.pseudo === (submittedScore?.pseudo ?? pseudo) &&
      entry.score === score &&
      entry.createdAt === submittedScore?.createdAt
    )
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08060a]/75 px-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-over-title"
        className="relative w-full max-w-[860px] overflow-hidden rounded-xl border border-[#e8b339]/45 bg-[#241f2c] text-[#f3eee3] shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_35px_rgba(232,179,57,0.14)]"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Fermer sans enregistrer"
          className="absolute right-2 top-2 z-10 text-[#9a93a6] hover:bg-[#2c2733] hover:text-[#f3eee3]"
        >
          <X size={16} />
        </Button>
        <div className="absolute inset-x-0 top-0 h-1 bg-[#e8b339]" />
        <div className="grid gap-5 px-5 py-6 md:grid-cols-[minmax(0,0.92fr)_minmax(320px,1.08fr)] md:px-6 md:py-7">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[#e8b339]/50 bg-[#15131a] text-[#e8b339] shadow-[0_0_22px_rgba(232,179,57,0.18)]">
              <Trophy size={26} />
            </div>

            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.22em] text-[#9a93a6]">
              Projection terminée
            </p>
            <h2
              id="game-over-title"
              className="mt-2 text-3xl font-black uppercase tracking-[0.12em] text-[#e8b339]"
            >
              Temps écoulé
            </h2>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <ScorePanel icon={<Ticket size={16} />} label="Score" value={score} featured />
              <ScorePanel icon={<Trophy size={16} />} label="Record" value={bestScore} />
            </div>

            {isSupabaseConfigured && (
              <form
                className="mt-5 rounded-lg border border-dashed border-[#e8b339]/35 bg-[#15131a] p-3 text-left"
                onSubmit={async (event) => {
                  event.preventDefault()
                  setFormError(null)

                  if (!user) {
                    const result = await onSignInWithMagicLink(email)
                    if (result.error) {
                      setFormError(result.error)
                    }
                    return
                  }

                  if (!hasProfile) {
                    const nextPseudo = profilePseudo.trim()
                    if (nextPseudo.length < 3 || nextPseudo.length > 20) {
                      setFormError('Entre 3 à 20 caractères.')
                      return
                    }

                    const result = await onCreateProfile(nextPseudo)
                    if (result.error) {
                      setFormError(result.error)
                    }
                  }
                }}
              >
                <AuthScoreForm
                  email={email}
                  formError={formError ?? profileError}
                  hasProfile={hasProfile}
                  isLoading={leaderboardStatus === 'loading'}
                  magicLinkSent={magicLinkSent}
                  onEmailChange={setEmail}
                  onProfilePseudoChange={setProfilePseudo}
                  onSignOut={onSignOut}
                  profilePseudo={profilePseudo}
                  pseudo={pseudo}
                  user={user}
                />
              </form>
            )}

            <div className="mt-6 flex flex-col gap-3">
              <Button
                type="button"
                onClick={onRestart}
                className="h-10 bg-[#e8b339] text-sm font-bold text-[#15131a] hover:bg-[#f1c85b]"
              >
                Rejouer
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onChangeCategory}
                className="h-10 border-[#e8b339]/35 bg-[#15131a] text-sm font-bold text-[#e8b339] hover:border-[#e8b339] hover:bg-[#2c2733] hover:text-[#e8b339]"
              >
                Changer de catégorie
              </Button>
            </div>
          </div>

          <LeaderboardPanel
            entries={leaderboard}
            isPlayerInTop={playerIsInTop}
            message={leaderboardMessage}
            pseudo={pseudo}
            score={score}
            status={leaderboardStatus}
            submittedScore={submittedScore}
          />
        </div>
      </section>
    </div>
  )
}

function AuthScoreForm({
  email,
  formError,
  hasProfile,
  isLoading,
  magicLinkSent,
  onEmailChange,
  onProfilePseudoChange,
  onSignOut,
  profilePseudo,
  pseudo,
  user,
}: {
  email: string
  formError: string | null
  hasProfile: boolean
  isLoading: boolean
  magicLinkSent: boolean
  onEmailChange: (value: string) => void
  onProfilePseudoChange: (value: string) => void
  onSignOut: () => void
  profilePseudo: string
  pseudo: string | null
  user: User | null
}) {
  if (!user) {
    return (
      <>
        <label
          htmlFor="score-email"
          className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a93a6]"
        >
          Publier ton score
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            id="score-email"
            value={email}
            type="email"
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="ton@email.com"
            className="h-10 border-white/10 bg-[#241f2c] font-mono text-[#f3eee3] placeholder:text-[#9a93a6]/60 focus-visible:ring-[#e8b339]/45"
          />
          <Button
            type="submit"
            className="min-h-10 bg-[#e8b339] text-sm font-bold whitespace-normal text-[#15131a] hover:bg-[#f1c85b]"
            disabled={isLoading}
          >
            Recevoir un lien de connexion
          </Button>
        </div>
        <p className="mt-2 text-xs text-[#9a93a6]">
          Reçois un lien de connexion pour publier ton score dans le classement.
        </p>
        {magicLinkSent && (
          <p className="mt-2 text-xs font-semibold text-[#e8b339]">
            Vérifie tes emails sur cet appareil et clique sur le lien pour continuer.
          </p>
        )}
        {formError && <p className="mt-2 text-xs font-semibold text-[#c8253d]">{formError}</p>}
      </>
    )
  }

  if (!hasProfile) {
    return (
      <>
        <label
          htmlFor="score-profile-pseudo"
          className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a93a6]"
        >
          Choisir ton pseudo
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            id="score-profile-pseudo"
            value={profilePseudo}
            minLength={3}
            maxLength={20}
            onChange={(event) => onProfilePseudoChange(event.target.value)}
            placeholder="Ton pseudo"
            className="h-10 border-white/10 bg-[#241f2c] font-mono text-[#f3eee3] placeholder:text-[#9a93a6]/60 focus-visible:ring-[#e8b339]/45"
          />
          <Button
            type="submit"
            className="h-10 bg-[#e8b339] text-sm font-bold text-[#15131a] hover:bg-[#f1c85b]"
            disabled={isLoading}
          >
            Valider
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="m-0 text-xs text-[#9a93a6]">3 à 20 caractères.</p>
          <p className="m-0 font-mono text-xs text-[#9a93a6]">{profilePseudo.trim().length}/20</p>
        </div>
        {formError && <p className="mt-2 text-xs font-semibold text-[#c8253d]">{formError}</p>}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a93a6]">
          Score en ligne
        </p>
        <p className="mt-1 text-sm font-semibold text-[#f3eee3]">
          Connecté comme <span className="font-mono text-[#e8b339]">{pseudo ?? 'Joueur'}</span>
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={onSignOut}
        className="h-9 justify-start text-xs font-bold text-[#9a93a6] hover:bg-[#2c2733] hover:text-[#f3eee3] sm:justify-center"
      >
        Se déconnecter
      </Button>
    </div>
  )
}

function LeaderboardPanel({
  entries,
  isPlayerInTop,
  message,
  pseudo,
  score,
  status,
  submittedScore,
}: {
  entries: LeaderboardEntry[]
  isPlayerInTop: boolean
  message: string | null
  pseudo: string | null
  score: number
  status: 'idle' | 'loading' | 'ready' | 'unavailable'
  submittedScore: SubmittedScore | null
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#15131a] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-left text-sm font-black uppercase tracking-[0.16em] text-[#e8b339]">
          Classement global
        </h3>
        <Badge className="bg-[#2c2733] text-[#f3eee3]">Top 20</Badge>
      </div>

      {status === 'loading' && (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-9 rounded-md bg-[#2c2733]" />
          ))}
        </div>
      )}

      {status === 'idle' && (
        <p className="mt-4 rounded-md border border-white/10 bg-[#241f2c] px-3 py-3 text-sm text-[#9a93a6]">
          Connecte-toi pour publier ton score et afficher le classement global.
        </p>
      )}

      {status === 'unavailable' && (
        <p className="mt-4 rounded-md border border-white/10 bg-[#241f2c] px-3 py-3 text-sm text-[#9a93a6]">
          {message ?? "Classement en ligne indisponible."}
        </p>
      )}

      {status === 'ready' && (
        <>
          <ol className="mt-4 max-h-[310px] space-y-2 overflow-auto pr-1">
            {entries.map((entry, index) => {
              const isCurrentPlayer =
                entry.pseudo === (submittedScore?.pseudo ?? pseudo) &&
                entry.score === score &&
                entry.createdAt === submittedScore?.createdAt

              return (
                <li
                  key={`${entry.pseudo}-${entry.createdAt}-${index}`}
                  className={[
                    'grid grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-md border px-2.5 py-2 text-left',
                    isCurrentPlayer
                      ? 'border-[#e8b339]/70 bg-[#e8b339]/10'
                      : 'border-white/10 bg-[#241f2c]',
                  ].join(' ')}
                >
                  <span className="font-mono text-xs text-[#9a93a6]">#{index + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-[#f3eee3]">{entry.pseudo}</span>
                    <Badge
                      variant="secondary"
                      className="mt-1 h-auto rounded-full bg-[#2c2733] px-2 py-0.5 text-[10px] uppercase text-[#9a93a6]"
                    >
                      {entry.categoryLabel}
                    </Badge>
                  </span>
                  <span className="font-mono text-base font-bold text-[#e8b339]">
                    {String(entry.score).padStart(3, '0')}
                  </span>
                </li>
              )
            })}
          </ol>

          {!isPlayerInTop && (
            <p className="mt-3 rounded-md border border-[#e8b339]/25 bg-[#241f2c] px-3 py-2 text-sm text-[#f3eee3]">
              Ton score : <span className="font-mono text-[#e8b339]">{score}</span> — classé en dehors du top 20.
            </p>
          )}

          {message && <p className="mt-3 text-xs text-[#9a93a6]">{message}</p>}
        </>
      )}
    </div>
  )
}

function ScorePanel({
  icon,
  label,
  value,
  featured = false,
}: {
  icon: React.ReactNode
  label: string
  value: number
  featured?: boolean
}) {
  return (
    <div
      className={[
        'rounded-lg border bg-[#15131a] px-3 py-3',
        featured ? 'border-[#e8b339]/45' : 'border-white/10',
      ].join(' ')}
    >
      <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#9a93a6]">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-mono text-3xl font-bold text-[#f3eee3]">
        {String(value).padStart(3, '0')}
      </p>
    </div>
  )
}

function PosterSkeleton() {
  return (
    <div className="w-full max-w-[260px] overflow-hidden rounded-2xl border-2 border-white/10 bg-[#241f2c]">
      <Skeleton className="min-h-[230px] rounded-none bg-[#2c2733]" />
      <div className="space-y-2 border-t border-dashed border-[#f3eee3]/25 bg-[#2c2733] px-3.5 py-3">
        <Skeleton className="h-3 w-24 bg-[#9a93a6]/25" />
        <Skeleton className="h-3 w-32 bg-[#9a93a6]/20" />
      </div>
    </div>
  )
}

function ResultStamp({ variant, label }: { variant: 'correct' | 'wrong'; label: string }) {
  return (
    <div
      className={[
        '-rotate-3 rounded-md border-[3px] px-5 py-2 text-[22px] font-black tracking-[0.12em]',
        variant === 'correct' ? 'border-[#5fa776] text-[#5fa776]' : 'border-[#c8253d] text-[#c8253d]',
      ].join(' ')}
    >
      {label}
    </div>
  )
}
