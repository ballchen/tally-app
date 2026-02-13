"use client"

import { useCallback, useEffect, useRef } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { History, Loader2 } from "lucide-react"
import { useActivityLogs, type ActivityLog } from "@/hooks/use-activity-logs"
import { useTranslations } from "next-intl"
import { format, isToday, isYesterday } from "date-fns"

interface ActivityLogSheetProps {
  groupId: string
  members: { user_id: string; profiles: { display_name?: string | null; avatar_url?: string | null } | null }[]
}

const ACTION_COLORS: Record<string, string> = {
  "expense.create": "bg-green-500",
  "expense.restore": "bg-green-500",
  "expense.update": "bg-blue-500",
  "expense.delete": "bg-red-500",
  "settlement.create": "bg-yellow-500",
  "settlement.undo": "bg-red-500",
  "group.update": "bg-gray-400",
  "group.archive": "bg-gray-400",
  "group.unarchive": "bg-gray-400",
}

function getDateLabel(dateStr: string, t: (key: string) => string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return t("today")
  if (isYesterday(date)) return t("yesterday")
  return format(date, "MMM d, yyyy")
}

function ActionDescription({ log, t }: { log: ActivityLog; t: (key: string, values?: Record<string, string>) => string }) {
  const actorName = log.profiles?.display_name || "Unknown"
  const changes = log.changes || {}

  switch (log.action) {
    case "expense.create":
      return <span>{t("expenseCreated", { actor: actorName, description: (changes.description as string) || "" })}</span>
    case "expense.update":
      return <span>{t("expenseUpdated", { actor: actorName })}</span>
    case "expense.delete":
      return <span>{t("expenseDeleted", { actor: actorName, description: (changes.description as string) || "" })}</span>
    case "expense.restore":
      return <span>{t("expenseRestored", { actor: actorName, description: (changes.description as string) || "" })}</span>
    case "settlement.create":
      return <span>{t("settlementCreated", { actor: actorName })}</span>
    case "settlement.undo":
      return <span>{t("settlementUndone", { actor: actorName })}</span>
    case "group.update":
      return <span>{t("groupUpdated", { actor: actorName })}</span>
    case "group.archive":
      return <span>{t("groupArchived", { actor: actorName })}</span>
    case "group.unarchive":
      return <span>{t("groupUnarchived", { actor: actorName })}</span>
    default:
      return <span>{actorName} — {log.action}</span>
  }
}

function ChangeDetails({ log, t }: { log: ActivityLog; t: (key: string, values?: Record<string, string>) => string }) {
  const changes = log.changes || {}

  if (log.action === "expense.create" || log.action === "expense.delete" || log.action === "expense.restore") {
    const amount = changes.amount
    const currency = changes.currency as string
    if (amount !== undefined && currency) {
      return <div className="text-xs text-muted-foreground">{currency} {String(amount)}</div>
    }
    return null
  }

  if (log.action === "expense.update") {
    const fields = Object.entries(changes).filter(
      ([, v]) => v && typeof v === "object" && "old" in (v as Record<string, unknown>) && "new" in (v as Record<string, unknown>)
    )
    if (fields.length === 0) return null
    return (
      <div className="text-xs text-muted-foreground space-y-0.5">
        {fields.map(([field, value]) => {
          const v = value as { old: string; new: string }
          return (
            <div key={field}>
              {t("changedTo", { field: t(field as "amount" | "description" | "currency" | "payer"), old: String(v.old), new: String(v.new) })}
            </div>
          )
        })}
      </div>
    )
  }

  if (log.action === "settlement.create") {
    const repayments = changes.repayments as { from_name?: string; fromName?: string; to_name?: string; toName?: string; amount?: number; currency?: string }[] | undefined
    if (!repayments || repayments.length === 0) return null
    return (
      <div className="text-xs text-muted-foreground space-y-0.5">
        {repayments.map((r, i) => (
          <div key={i}>
            {r.from_name || r.fromName} → {r.to_name || r.toName}: {r.currency ?? ""} {r.amount}
          </div>
        ))}
      </div>
    )
  }

  if (log.action === "group.update") {
    const fields = Object.entries(changes).filter(
      ([, v]) => v && typeof v === "object" && "old" in (v as Record<string, unknown>) && "new" in (v as Record<string, unknown>)
    )
    if (fields.length === 0) return null
    return (
      <div className="text-xs text-muted-foreground space-y-0.5">
        {fields.map(([field, value]) => {
          const v = value as { old: string; new: string }
          return (
            <div key={field}>
              {t("changedTo", { field, old: String(v.old), new: String(v.new) })}
            </div>
          )
        })}
      </div>
    )
  }

  return null
}

export function ActivityLogSheet({ groupId }: ActivityLogSheetProps) {
  const t = useTranslations("ActivityLog")
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useActivityLogs(groupId)

  const scrollRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || !hasNextPage || isFetchingNextPage) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  const allLogs = data?.pages.flatMap(p => p.data) ?? []

  // Group logs by date
  const groupedLogs: { label: string; logs: ActivityLog[] }[] = []
  let currentLabel = ""
  for (const log of allLogs) {
    const label = getDateLabel(log.created_at, t)
    if (label !== currentLabel) {
      currentLabel = label
      groupedLogs.push({ label, logs: [] })
    }
    groupedLogs[groupedLogs.length - 1].logs.push(log)
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground">
          <History className="h-3 w-3 mr-1" />
          {t("viewHistory")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : allLogs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {t("noActivity")}
            </p>
          ) : (
            <div className="space-y-4">
              {groupedLogs.map((group) => (
                <div key={group.label}>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    {group.label}
                  </div>
                  <div className="space-y-3">
                    {group.logs.map((log) => (
                      <div key={log.id} className="flex gap-3">
                        <div className="flex flex-col items-center pt-1">
                          <div className={`h-2 w-2 rounded-full ${ACTION_COLORS[log.action] || "bg-gray-400"}`} />
                          <div className="w-px flex-1 bg-border mt-1" />
                        </div>
                        <div className="flex-1 min-w-0 pb-2">
                          <div className="flex items-start gap-2">
                            <Avatar className="h-5 w-5 shrink-0">
                              <AvatarImage src={log.profiles?.avatar_url || ""} />
                              <AvatarFallback className="text-[8px]">
                                {log.profiles?.display_name?.[0] || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm leading-tight">
                                <ActionDescription log={log} t={t} />
                              </div>
                              <ChangeDetails log={log} t={t} />
                              <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                                {format(new Date(log.created_at), "HH:mm")}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
