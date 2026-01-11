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
      {/* Header / Navbar */}
      <header className="flex items-center justify-between py-2">
        {/* Left: App Title */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-lg">T</span>
          </div>
          <h1 className="text-xl font-semibold">Tally</h1>
        </div>
        
        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <PushNotificationManager />
          <ProfileSettingsDialog />
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleLogout} 
            title="Logout"
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Section Title + Create Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-muted-foreground">My Groups</h2>
        <CreateGroupDialog />
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
