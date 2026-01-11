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

interface InviteMemberDialogProps {
  inviteCode: string
  groupName: string
}

export function InviteMemberDialog({ inviteCode, groupName }: InviteMemberDialogProps) {
  const [copied, setCopied] = useState(false)
  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/join/${inviteCode}` : ""

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleNativeShare = async () => {
      if (navigator.share) {
          try {
              await navigator.share({
                  title: `Join ${groupName} on Tally`,
                  text: `Click to join the group ${groupName}`,
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
            <span className="text-xs">Invite</span>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md glass-card border-none ring-1 ring-white/20">
        <DialogHeader>
          <DialogTitle>Invite to {groupName}</DialogTitle>
          <DialogDescription>
            Share this link with friends to let them join the group.
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
            Share via...
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
