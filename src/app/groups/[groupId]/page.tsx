"use client"

import { useState } from "react"

import { useGroupDetails } from "@/hooks/use-group-details"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Plus, ArrowLeft, Copy } from "lucide-react"
import { format } from "date-fns"
import { AddExpenseDrawer } from "@/components/expenses/add-expense-drawer"
import { InviteMemberDialog } from "@/components/groups/invite-member-dialog"

export default function GroupDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const groupId = params.groupId as string
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null)
  const { data, isLoading, error } = useGroupDetails(groupId)

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <p className="text-destructive">Error loading group</p>
        <Button onClick={() => router.push("/groups")}>Back to Groups</Button>
      </div>
    )
  }

  const { group, members, expenses } = data

  const copyInviteCode = () => {
    navigator.clipboard.writeText(group.invite_code)
    // TODO: Add toast notification
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/groups")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
             <span>Code: {group.invite_code}</span>
             <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyInviteCode}>
                <Copy className="h-3 w-3" />
             </Button>
          </div>
        </div>
      </div>

      {/* Members Scroll */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {members?.map((member) => (
          <div key={member.user_id} className="flex flex-col items-center gap-1 min-w-[60px]">
            <Avatar className="h-10 w-10">
              <AvatarImage src={member.profiles?.avatar_url || ""} />
              <AvatarFallback>{member.profiles?.display_name?.[0] || "?"}</AvatarFallback>
            </Avatar>
            <span className="text-xs truncate max-w-[60px]">
              {member.profiles?.display_name || "Unknown"}
            </span>
          </div>
        ))}
         <InviteMemberDialog inviteCode={group.invite_code} groupName={group.name} />
      </div>

      {/* Expenses List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Expenses</h2>
        </div>
        
        {expenses?.length === 0 ? (
           <Card className="p-8 text-center text-muted-foreground">
             No expenses yet. Tap + to add one.
           </Card>
        ) : (
          expenses?.map((expense) => (
            <Card 
                key={expense.id} 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedExpenseId(expense.id)}
            >
              <CardContent className="px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="text-center min-w-[3rem] shrink-0">
                        <div className="text-xs text-muted-foreground">{format(new Date(expense.date), "MMM")}</div>
                        <div className="font-bold text-lg">{format(new Date(expense.date), "dd")}</div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <div className="font-medium leading-none">{expense.description || "Expense"}</div>
                        <div className="text-xs text-muted-foreground">
                            paid by {expense.payer?.display_name}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="font-bold">
                        {expense.currency} {expense.amount}
                    </div>
                    <div className="flex items-center -space-x-1.5 pt-1">
                        {(!expense.expense_splits || expense.expense_splits.length === 0) ? (
                            <span className="text-[10px] text-muted-foreground/50">Details not loaded</span>
                        ) : (
                            expense.expense_splits.map((split: any) => (
                                <Avatar key={split.user_id} className="h-5 w-5 border-2 border-background">
                                    <AvatarImage src={split.profiles?.avatar_url || ""} />
                                    <AvatarFallback className="text-[8px]">{split.profiles?.display_name?.[0] || "?"}</AvatarFallback>
                                </Avatar>
                            ))
                        )}
                    </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Floating Add Button & Drawers */}
      {members && (
        <>
            {/* Drawer for Adding - Uncontrolled Trigger */}
            <AddExpenseDrawer 
                groupId={groupId} 
                currency={group.base_currency} 
                members={members} 
            />

            {/* Drawer for Editing - Controlled by selectedExpenseId */}
            <AddExpenseDrawer 
                groupId={groupId} 
                currency={group.base_currency} 
                members={members}
                expenseId={selectedExpenseId}
                open={!!selectedExpenseId}
                onOpenChange={(open) => {
                    if (!open) setSelectedExpenseId(null)
                }}
            />
        </>
      )}
    </div>
  )
}
