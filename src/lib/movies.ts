import type { Movie } from '../types/movie'
import type { Category } from '../data/categories'

export function formatMoney(value: number) {
  if (value >= 1000000000) {
    const billions = value / 1000000000
    return `${billions.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} Md$`
  }

  if (value >= 1000000) {
    const millions = value / 1000000
    const decimals = millions < 10 ? 1 : 0
    return `${millions.toLocaleString('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })} M$`
  }

  if (value >= 1000) {
    return `${Math.round(value / 1000).toLocaleString('fr-FR')} k$`
  }

  return `${value.toLocaleString('fr-FR')} $`
}

export function drawPair(source: Movie[], excludeIds: string[] = []): [Movie, Movie] {
  const pool = source.filter((movie) => !excludeIds.includes(movie.id))
  const pickFrom = pool.length >= 2 ? pool : source
  const first = pickFrom[Math.floor(Math.random() * pickFrom.length)]
  let second = pickFrom[Math.floor(Math.random() * pickFrom.length)]

  while (second.id === first.id) {
    second = pickFrom[Math.floor(Math.random() * pickFrom.length)]
  }

  return [first, second]
}

export function shuffleItems<T>(items: T[]) {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }

  return shuffled
}

export function filterMoviesByCategory(source: Movie[], category: Category) {
  if (category.id === 'random') return source

  const keywords = category.fallbackKeywords.map(normalize)
  const matches = source.filter((movie) => {
    const tag = normalize(movie.tag)
    return keywords.some((keyword) => tag.includes(keyword))
  })

  return matches.length >= 2 ? matches : source
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}
