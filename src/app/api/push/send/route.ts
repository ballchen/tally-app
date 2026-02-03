import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import webpush from "web-push"

// Configure web-push
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:admin@tally.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

type SendPushPayload = {
  userIds: string[]
  title: string
  body: string
  url?: string
}

export async function POST(request: Request) {
  try {
    const payload: SendPushPayload = await request.json()
    const supabase = await createClient()

    // 1. Auth check (Can restrict to authenticated users only)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Fetch subscriptions for target users
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", payload.userIds)

    if (error || !subscriptions) {
      console.error("Fetch Subscriptions Error:", error)
      return NextResponse.json({ error: "Database Error" }, { status: 500 })
    }

    // 3. Send notifications
    const notifications = subscriptions.map((sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      }

      const notificationPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url,
      })

      return webpush
        .sendNotification(pushSubscription, notificationPayload)
        .catch((err: { statusCode?: number } & Error) => {
          if (err.statusCode === 404 || err.statusCode === 410) {
            console.log("Subscription expired, deleting:", sub.id)
            // Cleanup expired subscription
            return supabase.from("push_subscriptions").delete().eq("id", sub.id)
          }
          console.error("Error sending push:", err)
        })
    })

    await Promise.all(notifications)

    return NextResponse.json({ success: true, count: notifications.length })
  } catch (error) {
    console.error("Error sending push notifications:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
