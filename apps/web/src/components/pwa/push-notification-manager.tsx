"use client"

import { Button } from "@/components/ui/button"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function PushNotificationManager() {
  const { isSupported, subscription, isSubscribing, permission, subscribe } = usePushNotifications()

  if (!isSupported) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <a href="/diagnostics">
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <BellOff className="h-5 w-5" />
              </Button>
            </a>
          </TooltipTrigger>
          <TooltipContent>
            <p>Push not supported - Click for help</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (permission === "denied") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <a href="/diagnostics">
              <Button variant="ghost" size="icon" className="text-destructive">
                <BellOff className="h-5 w-5" />
              </Button>
            </a>
          </TooltipTrigger>
          <TooltipContent>
            <p>Notifications blocked - Click for help</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (subscription) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="text-green-600">
              <BellRing className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Notifications active</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={subscribe} 
            disabled={isSubscribing}
            className="text-muted-foreground hover:text-foreground"
          >
            {isSubscribing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Bell className="h-5 w-5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Enable notifications</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
