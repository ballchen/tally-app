"use client"

import { useAuthStore } from "@/store/useAuthStore"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader2 } from "lucide-react"

export default function Home() {
  const { user, isLoading, session } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (!session) {
        router.push("/login")
      } else {
        router.push("/groups")
      }
    }
  }, [isLoading, session, router])

  // Just show a spinner while deciding where to go
  return (
    <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
