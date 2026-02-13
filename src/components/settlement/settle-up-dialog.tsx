"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Debt } from "@/hooks/use-balances"
import { useSettleUp } from "@/hooks/use-settle-up"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { getCurrencySymbol } from "@/lib/currency"

interface SettleUpDialogProps {
  groupId: string
  debts: Debt[]
  members: { user_id: string; profiles: { avatar_url?: string | null; display_name?: string | null } | null }[]
  currency: string
}

export function SettleUpDialog({ groupId, debts, members, currency }: SettleUpDialogProps) {
  const [open, setOpen] = useState(false)
  const settleUp = useSettleUp()
  const t = useTranslations("SettleUp")

  const getMember = (id: string) => members.find((m: { user_id: string }) => m.user_id === id)?.profiles

  const handleSettle = () => {
    settleUp.mutate({
        groupId,
        repayments: debts,
        repaymentNames: debts.map(d => ({
          fromName: getMember(d.from)?.display_name || "",
          toName: getMember(d.to)?.display_name || "",
          amount: d.amount,
        })),
    }, {
        onSuccess: () => setOpen(false)
    })
  }

  if (debts.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full border-primary/20 bg-primary/5 text-primary hover:bg-primary/10">
          {t("viewBalancesAndSettle")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
            {debts.map((debt, i) => {
                const fromUser = getMember(debt.from)
                const toUser = getMember(debt.to)
                
                return (
                    <div key={i} className="flex items-center justify-between bg-muted/30 p-3 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={fromUser?.avatar_url || undefined} />
                                <AvatarFallback>{fromUser?.display_name?.[0]}</AvatarFallback>
                            </Avatar>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={toUser?.avatar_url || undefined} />
                                <AvatarFallback>{toUser?.display_name?.[0]}</AvatarFallback>
                            </Avatar>
                        </div>
                        <div className="font-semibold text-right">
                            <div className="text-xs text-muted-foreground">{t("pays")}</div>
                            {getCurrencySymbol(currency)} {debt.amount.toFixed(0)}
                        </div>
                    </div>
                )
            })}
        </div>

        <DialogFooter className="sm:justify-between gap-2">
           <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              <span>{t("marksAsSettled")}</span>
           </div>
           <Button onClick={handleSettle} disabled={settleUp.isPending}>
             {settleUp.isPending ? t("settling") : t("settleAll")}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
