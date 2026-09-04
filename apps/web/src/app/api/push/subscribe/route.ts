import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const subscription = await request.json()
    const supabase = await createClient()

    // 1. Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Upsert subscription
    // Endpoint is unique, so we can use it to determine uniqueness.
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      )

    if (error) {
      console.error("Subscription Error:", error)
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving subscription:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
