"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter
} from "@/components/ui/drawer"
import { Calculator } from "@/components/expenses/calculator"
import { Plus } from "lucide-react"
import { useAddExpense } from "@/hooks/use-add-expense"
import { useAuthStore } from "@/store/useAuthStore"
import { SplitDetails } from "@/components/expenses/split-details"
import { useSplitForm } from "@/hooks/use-split-form"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useExpense } from "@/hooks/use-expense"
import { useUpdateExpense } from "@/hooks/use-update-expense"
import { useDeleteExpense } from "@/hooks/use-delete-expense"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ... imports

// ... function component



interface AddExpenseDrawerProps {
  groupId: string
  currency: string
  members: { 
      user_id: string 
      profiles: { display_name: string | null; avatar_url: string | null } | null 
  }[]
  expenseId?: string | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AddExpenseDrawer({ groupId, currency, members, expenseId, open: controlledOpen, onOpenChange: setControlledOpen }: AddExpenseDrawerProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  
  // Derived open state (controlled vs uncontrolled)
  const isControlled = typeof controlledOpen !== "undefined"
  const isOpen = isControlled ? controlledOpen : internalOpen
  const setIsOpen = (val: boolean) => {
      if (isControlled) {
          setControlledOpen?.(val)
      } else {
          setInternalOpen(val)
      }
  }

  const [step, setStep] = useState<"amount" | "details">("amount")
  const [amount, setAmount] = useState(0)
  const [selectedCurrency, setSelectedCurrency] = useState(currency)

  const { user } = useAuthStore()
  const addExpense = useAddExpense()
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()
  
  // Fetch expense if editing
  const { data: expenseData, isLoading: isLoadingExpense } = useExpense(isOpen && expenseId ? expenseId : null)

  const handleDelete = () => {
    if (!expenseId) return
    deleteExpense.mutate(expenseId, {
        onSuccess: () => {
            toast.success("Expense deleted")
            setIsOpen(false)
        },
        onError: (error) => {
            toast.error("Failed to delete expense", {
                description: error.message
            })
        }
    })
  }

  const form = useSplitForm(amount, members)

  // Initialize form when editing
  useEffect(() => {
      if (expenseData && isOpen && expenseId) {
          setAmount(expenseData.amount)
          setSelectedCurrency(expenseData.currency)
          setStep("details") // Skip calculator for edit, go straight to details
          form.setValues({
              amount: expenseData.amount,
              description: expenseData.description || "",
              payerId: expenseData.payer_id,
              splits: expenseData.splits.map((s: any) => ({ userId: s.user_id, amount: s.owed_amount }))
          })
      } else if (isOpen && !expenseId) {
          setSelectedCurrency(currency)
      }
  }, [expenseData, isOpen, expenseId, currency])

  const handleConfirmAmount = (val: number) => {
    setAmount(val)
    setStep("details")
  }

  const handleOpenChange = (val: boolean) => {
      setIsOpen(val)
      if (!val) {
          // Reset after close animation
          setTimeout(() => {
            setStep("amount")
            setAmount(0)
            setSelectedCurrency(currency)
            form.reset()
          }, 300)
      }
  }

  const handleSave = () => {
    if (!form.isValid) return

    const splits = form.getSplits()
    const commonData = {
        groupId,
        payerId: form.payerId,
        amount,
        currency: selectedCurrency,
        description: form.description || "Expense",
        split: splits
    }

    if (expenseId) {
        updateExpense.mutate({
            expenseId,
            ...commonData
        }, {
            onSuccess: () => {
                toast.success("Expense updated")
                setIsOpen(false)
            },
            onError: (error) => {
                toast.error("Failed to update expense", {
                    description: error.message
                })
            }
        })
    } else {
        addExpense.mutate(commonData, {
            onSuccess: () => {
                toast.success("Expense added")
                setIsOpen(false)
                
                // Trigger Push Notification (Fire and forget)
                if (user) {
                    const targetUserIds = members
                        .filter(m => m.user_id !== user.id)
                        .map(m => m.user_id)
                    
                    if (targetUserIds.length > 0) {
                        const payerName = members.find(m => m.user_id === user.id)?.profiles?.display_name || "Someone"
                        
                        fetch("/api/push/send", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                userIds: targetUserIds,
                                title: "New Expense Added",
                                body: `${payerName} added: ${form.description || 'Expense'} (${selectedCurrency} ${amount})`,
                                url: `/groups/${groupId}`
                            })
                        }).catch(err => console.error("Push failed", err))
                    }
                }
            },
            onError: (error) => {
                toast.error("Failed to add expense", {
                    description: error.message
                })
            }
        })
    }
  }

  const isPending = addExpense.isPending || updateExpense.isPending

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DrawerTrigger asChild>
            <Button 
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40"
                size="icon"
            >
                <Plus className="h-6 w-6" />
            </Button>
        </DrawerTrigger>
      )}
      
      <DrawerContent className="h-[90vh] flex flex-col">
        <DrawerHeader className="relative">
          <DrawerTitle className="text-center">
              {isLoadingExpense ? "Loading..." : (step === "amount" ? "Enter Amount" : (expenseId ? "Edit Expense" : "Details"))}
          </DrawerTitle>
          {expenseId && !isLoadingExpense && (
             <div className="absolute right-4 top-3">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This cannot be undone. This will permanently remove the expense and all associated splits.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
             </div>
          )}
        </DrawerHeader>
        
        {isLoadingExpense ? (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        ) : (
            <>
                {step === "amount" ? (
                    <div className="p-4 flex items-center justify-center flex-1 h-[50vh]">
                        <Calculator 
                            onConfirm={handleConfirmAmount} 
                            currency={selectedCurrency} 
                            onCurrencyChange={setSelectedCurrency}
                        />
                    </div>
                ) : (
                    <>
                        <div className="flex-1 overflow-hidden">
                            <SplitDetails 
                                amount={amount}
                                currency={selectedCurrency}
                                members={members}
                                currentUser={user}
                                {...form}
                                onEditAmount={() => setStep("amount")}
                            />
                        </div>
                        <DrawerFooter className="pt-2 pb-6 px-4">
                            <Button 
                                className="w-full h-12 text-lg shadow-lg shadow-primary/20" 
                                onClick={handleSave} 
                                disabled={isPending || !form.isValid}
                            >
                                {isPending ? "Saving..." : (form.isValid ? (expenseId ? "Update Expense" : "Save Split") : "Check Allocation")}
                            </Button>
                        </DrawerFooter>
                    </>
                )}
            </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
