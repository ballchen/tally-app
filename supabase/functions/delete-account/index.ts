import { adminClient, corsHeaders, json, requireUser } from "../_shared/auth.ts"

// App Store requires in-app account deletion. profiles cascades from auth.users,
// and group_members / device_tokens / push_subscriptions cascade from profiles.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405)

  const user = await requireUser(req)
  if (!user) return json({ error: "Unauthorized" }, 401)

  const admin = adminClient()

  // Groups the user owns would be orphaned; soft-delete them first.
  await admin
    .from("groups")
    .update({ deleted_at: new Date().toISOString() })
    .eq("created_by", user.id)
    .is("deleted_at", null)

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error("deleteUser failed", error)
    return json({ error: "Failed to delete account" }, 500)
  }

  return json({ success: true })
})
