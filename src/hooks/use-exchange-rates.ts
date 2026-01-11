import { useQuery } from "@tanstack/react-query"

// Type definition based on currency.json structure
type ExchangeRates = Record<string, {
  Exrate: number
  UTC: string
}>

export function useExchangeRates() {
  return useQuery<ExchangeRates>({
    queryKey: ["exchange-rates"],
    queryFn: async () => {
      const res = await fetch("/api/currency/rates")
      if (!res.ok) {
        throw new Error("Failed to fetch rates")
      }
      return res.json()
    },
    staleTime: 1000 * 60 * 60, // 1 hour (Data changes at most daily, but 1h is safe)
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24h
  })
}
