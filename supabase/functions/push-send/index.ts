import webpush from "npm:web-push@3"
import { adminClient, corsHeaders, json, requireUser } from "../_shared/auth.ts"

type Payload = {
  userIds: string[]
  groupId?: string
  title: string
  body: string
  url?: string
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
const EXPO_BATCH = 100

function configureWebPush(): boolean {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:admin@tally.app", publicKey, privateKey)
  return true
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405)

  const user = await requireUser(req)
  if (!user) return json({ error: "Unauthorized" }, 401)

  const payload = (await req.json()) as Payload
  if (!Array.isArray(payload.userIds) || !payload.title || !payload.body) {
    return json({ error: "Bad Request" }, 400)
  }

  const admin = adminClient()

  let targetUserIds: string[]
  if (payload.groupId) {
    const { data: members } = await admin
      .from("group_members")
      .select("user_id")
      .eq("group_id", payload.groupId)
    const memberIds = new Set((members ?? []).map((m) => m.user_id))
    if (!memberIds.has(user.id)) return json({ error: "Forbidden" }, 403)
    targetUserIds = payload.userIds.filter((id) => memberIds.has(id))
  } else {
    // Without a group context a user may only notify themselves (test notification).
    targetUserIds = payload.userIds.filter((id) => id === user.id)
  }
  if (targetUserIds.length === 0) return json({ success: true, web: 0, expo: 0 })

  const [{ data: webSubs }, { data: deviceTokens }] = await Promise.all([
    admin.from("push_subscriptions").select("*").in("user_id", targetUserIds),
    admin.from("device_tokens").select("id, expo_token").in("user_id", targetUserIds),
  ])

  const data = { url: payload.url ?? "/" }

  // --- web-push ---
  let webCount = 0
  if (webSubs?.length && configureWebPush()) {
    const body = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url })
    await Promise.all(
      webSubs.map((sub) =>
        webpush
          .sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body)
          .then(() => { webCount++ })
          .catch(async (err: { statusCode?: number }) => {
            if (err.statusCode === 404 || err.statusCode === 410) {
              await admin.from("push_subscriptions").delete().eq("id", sub.id)
            } else {
              console.error("web-push error", err)
            }
          })
      )
    )
  }

  // --- Expo push ---
  let expoCount = 0
  const tokens = deviceTokens ?? []
  for (let i = 0; i < tokens.length; i += EXPO_BATCH) {
    const batch = tokens.slice(i, i + EXPO_BATCH)
    const messages = batch.map((t) => ({
      to: t.expo_token,
      title: payload.title,
      body: payload.body,
      data,
      sound: "default",
    }))
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    })
    if (!res.ok) {
      console.error("Expo push HTTP error", res.status, await res.text())
      continue
    }
    const { data: tickets } = (await res.json()) as {
      data: Array<{ status: string; details?: { error?: string } }>
    }
    await Promise.all(
      tickets.map(async (ticket, idx) => {
        if (ticket.status === "ok") {
          expoCount++
        } else if (ticket.details?.error === "DeviceNotRegistered") {
          await admin.from("device_tokens").delete().eq("id", batch[idx].id)
        } else {
          console.error("Expo ticket error", ticket)
        }
      })
    )
  }

  return json({ success: true, web: webCount, expo: expoCount })
})
