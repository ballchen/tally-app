import { adminClient, corsHeaders, json, requireUser } from "../_shared/auth.ts"

const EXTERNAL_API_URL = "https://tw.rter.info/capi.php"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const user = await requireUser(req)
  if (!user) return json({ error: "Unauthorized" }, 401)

  const admin = adminClient()
  const today = new Date().toISOString().split("T")[0]

  const { data: cached } = await admin
    .from("exchange_rates")
    .select("rates")
    .eq("date", today)
    .maybeSingle()

  if (cached?.rates) return json(cached.rates)

  const res = await fetch(EXTERNAL_API_URL)
  if (!res.ok) return json({ error: "Failed to fetch exchange rates" }, 502)
  const rates = await res.json()

  // Duplicate-key errors from concurrent callers are harmless: the row already exists.
  const { error } = await admin.from("exchange_rates").insert({ date: today, rates })
  if (error && error.code !== "23505") console.error("Cache insert error:", error)

  return json(rates)
})
