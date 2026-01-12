"use client"

import { PushDiagnostics } from "@/components/pwa/push-diagnostics"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export default function DiagnosticsPage() {
  const router = useRouter()
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="w-full max-w-md space-y-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => router.push("/groups")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Groups
        </Button>
        
        <PushDiagnostics />
        
        <div className="text-center text-sm text-muted-foreground mt-6">
          <p className="mb-2">💡 <strong>iOS 用戶注意：</strong></p>
          <p className="text-xs leading-relaxed max-w-sm mx-auto">
            必須先「加入主畫面」後，從主畫面的 App 圖示開啟，才能使用 Push Notification。
            在 Safari 瀏覽器中無法使用。
          </p>
        </div>
      </div>
    </div>
  )
}
