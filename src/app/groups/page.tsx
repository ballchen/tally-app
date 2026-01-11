"use client"

import { useAuthStore } from "@/store/useAuthStore"
import { useGroups } from "@/hooks/use-groups"
import { CreateGroupDialog } from "@/components/groups/create-group-dialog"
import { ProfileSettingsDialog } from "@/components/profile/profile-settings-dialog"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, LogOut, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PushNotificationManager } from "@/components/pwa/push-notification-manager"
import { useRealtimeGroups } from "@/hooks/use-realtime-sync"

export default function GroupsPage() {
  const { user } = useAuthStore()
  const { data: groups, isLoading } = useGroups()
  const supabase = createClient()
  const router = useRouter()
  
  // Enable realtime sync for groups list
  useRealtimeGroups()

  const handleLogout = async () => {
      await supabase.auth.signOut()
      router.push("/login")
  }

  if (isLoading) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">My Groups</h1>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                <LogOut className="h-5 w-5 text-muted-foreground" />
            </Button>
        </div>

        <div className="flex items-center gap-2">
            <PushNotificationManager />
            <ProfileSettingsDialog />
            <CreateGroupDialog />
        </div>
      </div>

      {/* Groups List */}
      <div className="grid grid-cols-1 gap-4">
        {groups?.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                <Users className="h-10 w-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">No groups yet</h3>
                <p className="text-sm max-w-sm">
                  Create your first group to start splitting bills with friends!
                </p>
              </div>
              <CreateGroupDialog />
            </div>
          </Card>
        ) : (
          groups?.map((group) => (
            <Card 
                key={group.id} 
                className="glass-card cursor-pointer hover:border-primary/50 hover:shadow-md transition-all active:scale-[0.99]"
                onClick={() => router.push(`/groups/${group.id}`)}
            >
              <CardHeader>
                <CardTitle>{group.name}</CardTitle>
                <CardDescription>
                  Base Currency: {group.base_currency}
                </CardDescription>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
