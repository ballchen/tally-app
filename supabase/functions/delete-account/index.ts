import { adminClient, corsHeaders, json, requireUser } from "../_shared/auth.ts"

// App Store requires in-app account deletion. The profile row is kept as an
// anonymised tombstone (see migration 20260905000002) because expenses and
// splits reference it; only the auth user and personal data are removed.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405)

  const user = await requireUser(req)
  if (!user) return json({ error: "Unauthorized" }, 401)

  const admin = adminClient()

  const { error: tombstoneError } = await admin.rpc("tombstone_profile", { p_user_id: user.id })
  if (tombstoneError) {
    console.error("tombstone_profile failed", tombstoneError)
    return json({ error: "Failed to delete account" }, 500)
  }

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error("deleteUser failed", error)
    return json({ error: "Failed to delete account" }, 500)
  }

  return json({ success: true })
})
