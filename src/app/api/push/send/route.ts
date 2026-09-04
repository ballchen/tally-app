import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import webpush from "web-push"

// Configured lazily so a build without VAPID env vars still succeeds.
function configureWebPush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@tally.app", publicKey, privateKey)
  return true
}

type SendPushPayload = {
  userIds: string[]
  groupId?: string
  title: string
  body: string
  url?: string
}

export async function POST(request: Request) {
  try {
    if (!configureWebPush()) {
      return NextResponse.json({ error: "Push not configured" }, { status: 503 })
    }
    const payload: SendPushPayload = await request.json()
    if (!Array.isArray(payload.userIds) || !payload.title || !payload.body) {
      return NextResponse.json({ error: "Bad Request" }, { status: 400 })
    }

    const {
      data: { user },
    } = await (await createClient()).auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // RLS on group_members and push_subscriptions only exposes the caller's own rows,
    // so membership checks and subscription lookup must bypass RLS.
    const admin = createAdminClient()

    let targetUserIds: string[]
    if (payload.groupId) {
      const { data: members } = await admin
        .from("group_members")
        .select("user_id")
        .eq("group_id", payload.groupId)

      const memberIds = new Set(members?.map(m => m.user_id) || [])
      if (!memberIds.has(user.id)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      targetUserIds = payload.userIds.filter(id => memberIds.has(id))
    } else {
      // Without a group context a user may only notify themselves (test notification).
      targetUserIds = payload.userIds.filter(id => id === user.id)
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({ success: true, count: 0 })
    }

    const { data: subscriptions, error } = await admin
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds)

    if (error || !subscriptions) {
      console.error("Fetch Subscriptions Error:", error)
      return NextResponse.json({ error: "Database Error" }, { status: 500 })
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url,
    })

    const notifications = subscriptions.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notificationPayload
        )
        .catch((err: { statusCode?: number } & Error) => {
          if (err.statusCode === 404 || err.statusCode === 410) {
            return admin.from("push_subscriptions").delete().eq("id", sub.id)
          }
          console.error("Error sending push:", err)
        })
    )

    await Promise.all(notifications)

    return NextResponse.json({ success: true, count: notifications.length })
  } catch (error) {
    console.error("Error sending push notifications:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
