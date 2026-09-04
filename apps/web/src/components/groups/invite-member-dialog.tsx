"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, Copy, Share2 } from "lucide-react"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"

interface InviteMemberDialogProps {
  inviteCode: string
  groupName: string
}

export function InviteMemberDialog({ inviteCode, groupName }: InviteMemberDialogProps) {
  const [copied, setCopied] = useState(false)
  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/join/${inviteCode}` : ""
  const t = useTranslations("InviteMember")

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleNativeShare = async () => {
      if (navigator.share) {
          try {
              await navigator.share({
                  title: t("shareTitle", { groupName }),
                  text: t("shareText", { groupName }),
                  url: inviteUrl
              })
          } catch (err) {
              console.error("Share failed", err)
          }
      }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="flex flex-col items-center gap-1 min-w-[60px] cursor-pointer">
            <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-dashed border-2">
              <Plus className="h-4 w-4" />
            </Button>
            <span className="text-xs">{t("invite")}</span>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md glass-card border-none ring-1 ring-white/20">
        <DialogHeader>
          <DialogTitle>{t("title", { groupName })}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="link" className="sr-only">
              Link
            </Label>
            <Input
              id="link"
              defaultValue={inviteUrl}
              readOnly
              className="bg-muted/50 font-mono text-sm"
            />
          </div>
          <Button type="submit" size="sm" className="px-3" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <DialogFooter className="sm:justify-start">
          <Button
            type="button"
            variant="secondary"
            className="w-full gap-2"
            onClick={handleNativeShare}
          >
            <Share2 className="h-4 w-4" />
            {t("shareVia")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
