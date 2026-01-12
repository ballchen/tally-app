"use client"

import { useState } from "react"
import { useAuthStore } from "@/store/useAuthStore"
import { useGroups, type GroupFilter } from "@/hooks/use-groups"
import { CreateGroupDialog } from "@/components/groups/create-group-dialog"
import { ProfileSettingsDialog } from "@/components/profile/profile-settings-dialog"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, LogOut, Users, Archive, EyeOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PushNotificationManager } from "@/components/pwa/push-notification-manager"
import { useRealtimeGroups } from "@/hooks/use-realtime-sync"

export default function GroupsPage() {
  const { user } = useAuthStore()
  const [filter, setFilter] = useState<GroupFilter>("active")
  const { data: groups, isLoading } = useGroups(filter)
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
          <div className="h-9 w-9 rounded-xl overflow-hidden shadow-md">
            <img src="/icon-192x192.png" alt="Tally Logo" className="h-full w-full object-cover" />
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

      {/* Filter Tabs */}
      <div className="flex bg-muted rounded-lg p-1 w-fit">
        <button
          className={`px-3 py-1.5 text-sm rounded-md transition-all ${filter === "active" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
          onClick={() => setFilter("active")}
        >
          Active
        </button>
        <button
          className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1 ${filter === "archived" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
          onClick={() => setFilter("archived")}
        >
          <Archive className="h-3.5 w-3.5" />
          Archived
        </button>
        <button
          className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1 ${filter === "hidden" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
          onClick={() => setFilter("hidden")}
        >
          <EyeOff className="h-3.5 w-3.5" />
          Hidden
        </button>
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
          groups?.map((group) => {
            const isArchived = !!group.archived_at
            const isHidden = group.group_members?.some((m: any) => m.hidden_at)

            return (
              <Card
                key={group.id}
                className={`glass-card cursor-pointer hover:border-primary/50 hover:shadow-md transition-all active:scale-[0.99] ${isArchived ? "opacity-75" : ""}`}
                onClick={() => router.push(`/groups/${group.id}`)}
              >
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle className="flex-1">{group.name}</CardTitle>
                    {isArchived && (
                      <Badge variant="secondary" className="text-xs">
                        <Archive className="h-3 w-3 mr-1" />
                        Archived
                      </Badge>
                    )}
                    {isHidden && (
                      <Badge variant="outline" className="text-xs">
                        <EyeOff className="h-3 w-3 mr-1" />
                        Hidden
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    Base Currency: {group.base_currency}
                  </CardDescription>
                </CardHeader>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
