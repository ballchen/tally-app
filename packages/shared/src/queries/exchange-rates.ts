import { useQuery, type UseQueryResult } from "@tanstack/react-query"
import { useSupabase } from "../supabase-context"

export type ExchangeRates = Record<string, { Exrate: number; UTC: string }>

const ONE_HOUR = 1000 * 60 * 60

export function useExchangeRates(): UseQueryResult<ExchangeRates, Error> {
  const supabase = useSupabase()

  return useQuery<ExchangeRates, Error>({
    queryKey: ["exchange-rates"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<ExchangeRates>("rates")
      if (error) throw error
      if (!data) throw new Error("Failed to fetch rates")
      return data
    },
    // Rates change at most daily; an hour of staleness is safe.
    staleTime: ONE_HOUR,
    gcTime: ONE_HOUR * 24,
  })
}
