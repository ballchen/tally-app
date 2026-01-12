"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react"

export function PushDiagnostics() {
  const [diagnostics, setDiagnostics] = useState({
    isIOS: false,
    iOSVersion: "",
    isPWA: false,
    serviceWorkerSupported: false,
    pushManagerSupported: false,
    notificationPermission: "default" as NotificationPermission,
    vapidKeyPresent: false,
    isStandalone: false,
  })

  useEffect(() => {
    const ua = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua)
    const match = ua.match(/OS (\d+)_(\d+)/)
    const iOSVersion = match ? `${match[1]}.${match[2]}` : "Unknown"
    
    setDiagnostics({
      isIOS,
      iOSVersion,
      isPWA: (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches,
      serviceWorkerSupported: 'serviceWorker' in navigator,
      pushManagerSupported: 'PushManager' in window,
      notificationPermission: 'Notification' in window ? Notification.permission : 'default',
      vapidKeyPresent: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      isStandalone: (window.navigator as any).standalone || false,
    })
  }, [])

  const DiagnosticItem = ({ 
    label, 
    status, 
    value 
  }: { 
    label: string
    status: 'success' | 'error' | 'warning'
    value: string 
  }) => (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-2">
        {status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
        {status === 'error' && <XCircle className="h-4 w-4 text-destructive" />}
        {status === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Badge variant={status === 'success' ? 'default' : status === 'error' ? 'destructive' : 'secondary'}>
        {value}
      </Badge>
    </div>
  )

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Push Notification 診斷</CardTitle>
        <CardDescription>檢查您的裝置是否支援推送通知</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <DiagnosticItem
          label="裝置類型"
          status={diagnostics.isIOS ? 'success' : 'warning'}
          value={diagnostics.isIOS ? `iOS ${diagnostics.iOSVersion}` : 'Not iOS'}
        />
        
        {diagnostics.isIOS && (
          <>
            <DiagnosticItem
              label="iOS 版本支援"
              status={parseFloat(diagnostics.iOSVersion) >= 16.4 ? 'success' : 'error'}
              value={parseFloat(diagnostics.iOSVersion) >= 16.4 ? '✓ iOS 16.4+' : '✗ 需要 16.4+'}
            />
            
            <DiagnosticItem
              label="PWA 模式"
              status={diagnostics.isPWA ? 'success' : 'error'}
              value={diagnostics.isPWA ? '✓ 已加入主畫面' : '✗ 請加入主畫面'}
            />
          </>
        )}
        
        <DiagnosticItem
          label="Service Worker"
          status={diagnostics.serviceWorkerSupported ? 'success' : 'error'}
          value={diagnostics.serviceWorkerSupported ? '✓ 支援' : '✗ 不支援'}
        />
        
        <DiagnosticItem
          label="Push Manager"
          status={diagnostics.pushManagerSupported ? 'success' : 'error'}
          value={diagnostics.pushManagerSupported ? '✓ 支援' : '✗ 不支援'}
        />
        
        <DiagnosticItem
          label="通知權限"
          status={
            diagnostics.notificationPermission === 'granted' ? 'success' :
            diagnostics.notificationPermission === 'denied' ? 'error' : 'warning'
          }
          value={
            diagnostics.notificationPermission === 'granted' ? '✓ 已授予' :
            diagnostics.notificationPermission === 'denied' ? '✗ 已拒絕' : '⚠ 未設定'
          }
        />
        
        <DiagnosticItem
          label="VAPID Key"
          status={diagnostics.vapidKeyPresent ? 'success' : 'error'}
          value={diagnostics.vapidKeyPresent ? '✓ 已設定' : '✗ 未設定'}
        />
      </CardContent>
    </Card>
  )
}
