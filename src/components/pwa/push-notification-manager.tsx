"use client"

import { Button } from "@/components/ui/button"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { Bell, BellOff, Loader2 } from "lucide-react"

export function PushNotificationManager() {
  const { isSupported, subscription, isSubscribing, permission, subscribe, sendTestNotification } = usePushNotifications()

  if (!isSupported) {
    return null // Don't show if not supported
  }

  if (permission === "denied") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-destructive/10 p-2 rounded-md">
        <BellOff className="h-4 w-4" />
        <span>Notifications blocked</span>
      </div>
    )
  }

  if (subscription) {
    return (
       <div className="flex flex-col gap-2">
         <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded-md">
           <Bell className="h-4 w-4" />
           <span>Notifications active</span>
         </div>
         {/* Optional: Test Button */}
         {/* <Button variant="outline" size="sm" onClick={sendTestNotification}>Test Push</Button> */}
       </div>
    )
  }

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={subscribe} 
      disabled={isSubscribing}
      className="w-full gap-2"
    >
      {isSubscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
      Enable Notifications
    </Button>
  )
}
