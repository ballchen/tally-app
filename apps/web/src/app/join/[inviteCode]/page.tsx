"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuthStore } from "@/store/useAuthStore"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Users } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

type InviteGroup = { id: string; name: string; base_currency: string }

export default function JoinGroupPage() {
  const params = useParams()
  const router = useRouter()
  const inviteCode = params.inviteCode as string
  const { user, isLoading: isAuthLoading } = useAuthStore()
  const supabase = createClient()
  
  const t = useTranslations("JoinGroup")
  const [group, setGroup] = useState<InviteGroup | null>(null)
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
            setError(t("notFound"))
        } else {
            setGroup(data as InviteGroup)
        }
        setLoading(false)
    }
    fetchGroup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteCode])

  // 2. Handle Join
  const handleJoin = async () => {
      if (!user || !group) {
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
        .maybeSingle()

      if (member) {
          toast.info(t("alreadyMember"))
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
          toast.error(t("joinFailed"), {
            description: joinError.message
          })
          setJoining(false)
      } else {
          toast.success(t("joined", { name: group.name }))
          
          // Get current user's profile for notification
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", user.id)
            .single()
          
          // Get all existing members to notify using RPC
          const { data: allMembers } = await supabase
            .rpc('get_group_members_batch', { p_group_ids: [group.id] })

          // Filter out the new member
          const existingMembers = (allMembers as { user_id: string }[])
            ?.filter((m: { user_id: string }) => m.user_id !== user.id)
            .map((m: { user_id: string }) => ({ user_id: m.user_id }))
          
          // Send push notification to existing members
          if (existingMembers && existingMembers.length > 0) {
            const memberName = profile?.display_name || "Someone"
            
            fetch("/api/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userIds: existingMembers.map(m => m.user_id),
                groupId: group.id,
                title: t("pushTitle"),
                body: t("pushBody", { name: memberName, group: group.name }),
                url: `/groups/${group.id}`
              })
            }).catch(err => console.error("Push notification failed", err))
          }
          
          router.push(`/groups/${group.id}`)
      }
  }

  if (loading || isAuthLoading) {
      return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>
  }

  if (error || !group) {
      return (
          <div className="h-screen flex flex-col items-center justify-center gap-4 p-4 text-center">
              <h1 className="text-2xl font-bold">{t("oops")}</h1>
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={() => router.push("/")}>{t("goHome")}</Button>
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
                <CardTitle className="text-2xl">{t("title")}</CardTitle>
                <CardDescription>{t("invited")}</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
                <div className="text-xl font-bold">{group.name}</div>
                <div className="text-sm text-muted-foreground bg-muted/50 py-2 px-4 rounded-full inline-block">
                    {t("baseCurrency")}: {group.base_currency}
                </div>
            </CardContent>
            <CardFooter>
                <Button className="w-full text-lg h-12" onClick={handleJoin} disabled={joining}>
                    {joining ? <Loader2 className="mr-2 animate-spin" /> : t("join")}
                </Button>
            </CardFooter>
        </Card>
    </div>
  )
}
