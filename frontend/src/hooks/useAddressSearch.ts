import { useState, useEffect, useCallback } from 'react'
import { searchAddresses, lookupAddress, type PDOKSuggestion, type PDOKAddress } from '@/lib/pdok'

export interface AddressSearchResult {
  id: string
  displayName: string
  type: string
  score: number
}

export function useAddressSearch(query: string, debounceMs: number = 300) {
  const [results, setResults] = useState<AddressSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([])
      return
    }

    setIsLoading(true)
    setError(null)

    const timeoutId = setTimeout(async () => {
      try {
        const suggestions = await searchAddresses(query, {
          limit: 10,
          type: 'adres', // Only search for addresses
        })

        const formattedResults: AddressSearchResult[] = suggestions.map((s) => ({
          id: s.id,
          displayName: s.weergavenaam,
          type: s.type,
          score: s.score,
        }))

        setResults(formattedResults)
      } catch (err) {
        setError('Failed to search addresses')
        console.error('Address search error:', err)
      } finally {
        setIsLoading(false)
      }
    }, debounceMs)

    return () => clearTimeout(timeoutId)
  }, [query, debounceMs])

  return { results, isLoading, error }
}

export function useAddressLookup() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookup = useCallback(async (id: string): Promise<PDOKAddress | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const address = await lookupAddress(id)
      return address
    } catch (err) {
      setError('Failed to lookup address')
      console.error('Address lookup error:', err)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { lookup, isLoading, error }
}
