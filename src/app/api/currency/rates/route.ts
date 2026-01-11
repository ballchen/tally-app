import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const EXTERNAL_API_URL = "https://tw.rter.info/capi.php"

// Lazy initialize Supabase Admin client
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    // 1. Get today's date (formatted as YYYY-MM-DD for uniqueness)
    const today = new Date().toISOString().split("T")[0]

    // 2. Check Cache
    const { data: cache, error: cacheError } = await supabaseAdmin
      .from("exchange_rates")
      .select("rates")
      .eq("date", today)
      .single()

    if (cache && !cacheError) {
      return NextResponse.json(cache.rates)
    }

    // 3. Fetch from External API if not cached
    const res = await fetch(EXTERNAL_API_URL)
    if (!res.ok) {
      throw new Error("Failed to fetch exchange rates")
    }
    const rates = await res.json()

    // 4. Update Cache (Insert new record)
    const { error: insertError } = await supabaseAdmin
      .from("exchange_rates")
      .insert({
        date: today,
        rates: rates
      })

    if (insertError) {
      // If error is duplicate key (race condition), just ignore it as another request might have cached it.
      console.error("Cache insert error:", insertError)
    }

    return NextResponse.json(rates)

  } catch (error) {
    console.error("Currency API Error:", error)
    return NextResponse.json({ error: "Failed to retrieve exchange rates" }, { status: 500 })
  }
}
