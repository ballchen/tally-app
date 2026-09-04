import { useCallback, useEffect, useRef } from "react"
import { useQueryClient, type QueryKey } from "@tanstack/react-query"

const DEFAULT_DELAY_MS = 400

export function useDebouncedInvalidate(delayMs = DEFAULT_DELAY_MS) {
  const queryClient = useQueryClient()
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  return useCallback(
    (queryKey: QueryKey) => {
      const key = JSON.stringify(queryKey)
      const existing = timersRef.current.get(key)
      if (existing) clearTimeout(existing)

      timersRef.current.set(
        key,
        setTimeout(() => {
          timersRef.current.delete(key)
          queryClient.invalidateQueries({ queryKey })
        }, delayMs)
      )
    },
    [queryClient, delayMs]
  )
}
