import { createBrowserClient } from '@supabase/ssr'
import { customStorageAdapter } from './storage-adapter'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return customStorageAdapter.getAll()
        },
        setAll(cookiesToSet) {
          customStorageAdapter.setAll(cookiesToSet)
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      }
    }
  )
}
