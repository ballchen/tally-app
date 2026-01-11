"use client"

import { useAuthStore } from "@/store/useAuthStore"
import { useGroups } from "@/hooks/use-groups"
import { CreateGroupDialog } from "@/components/groups/create-group-dialog"
import { ProfileSettingsDialog } from "@/components/profile/profile-settings-dialog"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function GroupsPage() {
  const { user } = useAuthStore()
  const { data: groups, isLoading } = useGroups()
  const supabase = createClient()
  const router = useRouter()

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
            <ProfileSettingsDialog />
            <CreateGroupDialog />
        </div>
      </div>

      <div className="grid gap-4">
        {groups?.length === 0 ? (
          <Card className="glass p-8 text-center text-muted-foreground border-dashed">
            No groups yet. Create one to get started!
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
