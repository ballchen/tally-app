import type { SupabaseClient } from "@supabase/supabase-js"

export type PushPayload = {
  userIds: string[]
  groupId?: string
  title: string
  body: string
  url?: string
}

export type PushResult = {
  success: boolean
  web: number
  expo: number
}

export async function sendPush(
  supabase: SupabaseClient,
  payload: PushPayload
): Promise<PushResult | null> {
  const { data, error } = await supabase.functions.invoke<PushResult>("push-send", {
    body: payload,
  })
  // Notifications are best-effort; a failure must never break the caller's flow.
  if (error) {
    console.error("Push notification failed", error)
    return null
  }
  return data
}
