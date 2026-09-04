import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/")

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true)
      setPermission(Notification.permission)
      registerServiceWorker()
    }
  }, [])

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      if (!registration) return // PWA might not be ready

      const sub = await registration.pushManager.getSubscription()
      setSubscription(sub)
    } catch (error) {
      console.error("Error checking subscription:", error)
    }
  }

  const subscribe = async () => {
    if (!isSupported) return
    setIsSubscribing(true)

    try {
      // 1. Request Permission
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result !== "granted") {
        throw new Error("Permission denied")
      }

      // 2. Register with PushManager
      const registration = await navigator.serviceWorker.ready
      if (!VAPID_PUBLIC_KEY) throw new Error("VAPID Key missing")

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      setSubscription(sub)

      // 3. Send to Backend
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      })

    } catch (error) {
      console.error("Error subscribing:", error)
      alert("Failed to enable notifications. Please check your browser settings.")
    } finally {
      setIsSubscribing(false)
    }
  }

  // Debug function to manually send a test notification
  const sendTestNotification = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userIds: [user.id],
        title: "Test Notification",
        body: "This is a test notification from Tally!",
        url: window.location.pathname
      })
    })
  }

  return {
    isSupported,
    subscription,
    isSubscribing,
    permission,
    subscribe,
    sendTestNotification
  }
}
