"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuthStore } from "@/store/useAuthStore"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Users } from "lucide-react"
import { toast } from "sonner"

export default function JoinGroupPage() {
  const params = useParams()
  const router = useRouter()
  const inviteCode = params.inviteCode as string
  const { user, isLoading: isAuthLoading } = useAuthStore()
  const supabase = createClient()
  
  const [group, setGroup] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 1. Fetch Group Info
  useEffect(() => {
    async function fetchGroup() {
        if (!inviteCode) return

        // Use RPC to bypass RLS for public invite link info
        const { data, error } = await supabase
            .rpc('get_group_by_invite_code', { code: inviteCode })
            .single()

        if (error || !data) {
            setError("Group not found or invalid link.")
        } else {
            setGroup(data)
        }
        setLoading(false)
    }
    fetchGroup()
  }, [inviteCode])

  // 2. Handle Join
  const handleJoin = async () => {
      if (!user) {
          router.push(`/login?next=/join/${inviteCode}`)
          return
      }

      setJoining(true)
      
      // Check if already member
      const { data: member } = await supabase
        .from("group_members")
        .select("*")
        .eq("group_id", group.id)
        .eq("user_id", user.id)
        .single()
        
      if (member) {
          toast.info("You're already a member!")
          router.push(`/groups/${group.id}`)
          return
      }

      // Join
      const { error: joinError } = await supabase
        .from("group_members")
        .insert({
            group_id: group.id,
            user_id: user.id
        })

      if (joinError) {
          toast.error("Failed to join group", {
            description: joinError.message
          })
          setJoining(false)
      } else {
          toast.success(`Joined ${group.name}!`)
          router.push(`/groups/${group.id}`)
      }
  }

  if (loading || isAuthLoading) {
      return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>
  }

  if (error || !group) {
      return (
          <div className="h-screen flex flex-col items-center justify-center gap-4 p-4 text-center">
              <h1 className="text-2xl font-bold">Oops!</h1>
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={() => router.push("/")}>Go Home</Button>
          </div>
      )
  }

  return (
    <div className="h-screen w-full flex items-center justify-center p-4 bg-gradient-to-tr from-primary/5 via-background to-secondary/5">
        <Card className="w-full max-w-sm glass-card border-none shadow-xl ring-1 ring-white/20">
            <CardHeader className="text-center pb-2">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
                    <Users className="h-8 w-8" />
                </div>
                <CardTitle className="text-2xl">Join Group</CardTitle>
                <CardDescription>You've been invited to join</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
                <div className="text-xl font-bold">{group.name}</div>
                <div className="text-sm text-muted-foreground bg-muted/50 py-2 px-4 rounded-full inline-block">
                    Base Currency: {group.base_currency}
                </div>
            </CardContent>
            <CardFooter>
                <Button className="w-full text-lg h-12" onClick={handleJoin} disabled={joining}>
                    {joining ? <Loader2 className="mr-2 animate-spin" /> : "Join Group"}
                </Button>
            </CardFooter>
        </Card>
    </div>
  )
}
