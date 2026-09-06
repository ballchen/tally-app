"use client"

import { useState } from "react"
import { SupabaseProvider as SharedSupabaseProvider } from "@tally/shared/supabase-context"
import { createClient } from "@/lib/supabase/client"

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => createClient())

  return <SharedSupabaseProvider client={client}>{children}</SharedSupabaseProvider>
}
