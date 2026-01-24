"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Calculator } from "@/components/expenses/calculator";
import { Plus } from "lucide-react";
import { useAddExpense } from "@/hooks/use-add-expense";
import { useAuthStore } from "@/store/useAuthStore";
import { SplitDetails } from "@/components/expenses/split-details";
import { useSplitForm } from "@/hooks/use-split-form";
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
} from "@/components/ui/alert-dialog";
import { useExpense } from "@/hooks/use-expense";
import { useUpdateExpense } from "@/hooks/use-update-expense";
import { useDeleteExpense } from "@/hooks/use-delete-expense";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

// ... imports

// ... function component

interface AddExpenseDrawerProps {
  groupId: string;
  currency: string;
  members: {
    user_id: string;
    profiles: { display_name: string | null; avatar_url: string | null } | null;
  }[];
  expenseId?: string | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddExpenseDrawer({
  groupId,
  currency,
  members,
  expenseId,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: AddExpenseDrawerProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Derived open state (controlled vs uncontrolled)
  const isControlled = typeof controlledOpen !== "undefined";
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = (val: boolean) => {
    if (isControlled) {
      setControlledOpen?.(val);
    } else {
      setInternalOpen(val);
    }
  };

  const [step, setStep] = useState<"amount" | "details">("amount");
  const [amount, setAmount] = useState(0);
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [drawerHeight, setDrawerHeight] = useState("90vh");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const drawerContentRef = useRef<HTMLDivElement>(null);

  const { user } = useAuthStore();
  const addExpense = useAddExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const t = useTranslations("AddExpense");

  // Fetch expense if editing
  const { data: expenseData, isLoading: isLoadingExpense } = useExpense(
    isOpen && expenseId ? expenseId : null
  );

  const handleDelete = () => {
    if (!expenseId) return;
    deleteExpense.mutate(expenseId, {
      onSuccess: () => {
        toast.success(t("expenseDeleted"));
        setIsOpen(false);
      },
      onError: (error) => {
        toast.error(t("failedToDelete"), {
          description: error.message,
        });
      },
    });
  };

  // Handle keyboard appearance on mobile using Visual Viewport API
  useEffect(() => {
    if (!isOpen || typeof window === "undefined" || !window.visualViewport) {
      return;
    }

    let resizeTimeout: NodeJS.Timeout;

    const handleResize = () => {
      const viewport = window.visualViewport;
      if (!viewport) return;

      // Calculate the available height
      // When keyboard appears, viewport.height becomes smaller
      const availableHeight = viewport.height;
      const windowHeight = window.innerHeight;

      // If viewport height is significantly smaller than window height, keyboard is open
      const keyboardHeight = windowHeight - availableHeight;

      if (keyboardHeight > 100) {
        // Keyboard is open - adjust drawer height
        const newHeight = Math.min(availableHeight * 0.95, windowHeight * 0.9);
        setDrawerHeight(`${newHeight}px`);
      } else {
        // Keyboard is closed - use taller height when input is focused
        // This provides more space before keyboard appears and reduces feeling of being cramped
        setDrawerHeight(isInputFocused ? "96vh" : "90vh");
      }
    };

    // Handle focus in - increase drawer height for better input experience
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      // Check if focused element is an input or textarea
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        setIsInputFocused(true);
        // Immediately resize to taller height (before keyboard appears)
        setTimeout(() => {
          handleResize();
        }, 50);
      }
    };

    // Handle focus out with delay to allow keyboard animation
    const handleFocusOut = () => {
      // Clear any pending resize checks
      if (resizeTimeout) clearTimeout(resizeTimeout);

      // Mark input as not focused
      setIsInputFocused(false);

      // Wait for keyboard to fully hide (iOS keyboard animation takes ~300-500ms)
      resizeTimeout = setTimeout(() => {
        handleResize();

        // Double check after additional delay to ensure viewport has settled
        setTimeout(() => {
          handleResize();
        }, 200);
      }, 300);
    };

    // Initial check
    handleResize();

    // Listen to viewport changes
    window.visualViewport.addEventListener("resize", handleResize);
    window.visualViewport.addEventListener("scroll", handleResize);

    // Listen to focus events to catch keyboard show/hide
    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);

    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("scroll", handleResize);
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
    };
  }, [isOpen, isInputFocused]);

  const form = useSplitForm(amount, members);
  const initializedRef = useRef<string | null>(null);

  // Initialize form when expense data is ready for editing
  useEffect(() => {
    if (
      expenseData &&
      isOpen &&
      expenseId &&
      initializedRef.current !== expenseId
    ) {
      initializedRef.current = expenseId;
      // Batch state updates in a single render cycle
      requestAnimationFrame(() => {
        setAmount(expenseData.amount);
        setSelectedCurrency(expenseData.currency);
        setStep("details"); // Skip calculator for edit, go straight to details
        form.setValues({
          amount: expenseData.amount,
          description: expenseData.description || "",
          payerId: expenseData.payer_id,
          splits: expenseData.splits.map(
            (s: { user_id: string; owed_amount: number }) => ({
              userId: s.user_id,
              amount: s.owed_amount,
            })
          ),
        });
      });
    }
  }, [expenseData, isOpen, expenseId, form]);

  const handleConfirmAmount = (val: number) => {
    setAmount(val);
    setStep("details");
  };

  const handleOpenChange = (val: boolean) => {
    setIsOpen(val);
    if (val) {
      // Initialize when opening
      initializedRef.current = null;
      if (!expenseId) {
        // New expense: reset to initial state
        setStep("amount");
        setAmount(0);
        setSelectedCurrency(currency);
        form.reset();
      }
    } else {
      // Reset after close animation
      setTimeout(() => {
        setStep("amount");
        setAmount(0);
        setSelectedCurrency(currency);
        form.reset();
        initializedRef.current = null;
      }, 300);
    }
  };

  const handleSave = () => {
    if (!form.isValid) return;

    const splits = form.getSplits();
    const commonData = {
      groupId,
      payerId: form.payerId,
      amount,
      currency: selectedCurrency,
      description: form.description || "Expense",
      split: splits,
    };

    if (expenseId) {
      updateExpense.mutate(
        {
          expenseId,
          ...commonData,
        },
        {
          onSuccess: () => {
            toast.success(t("expenseUpdated"));
            setIsOpen(false);
          },
          onError: (error) => {
            toast.error(t("failedToUpdate"), {
              description: error.message,
            });
          },
        }
      );
    } else {
      addExpense.mutate(commonData, {
        onSuccess: () => {
          toast.success(t("expenseAdded"));
          setIsOpen(false);

          // Trigger Push Notification (Fire and forget)
          if (user) {
            const targetUserIds = members
              .filter((m) => m.user_id !== user.id)
              .map((m) => m.user_id);

            if (targetUserIds.length > 0) {
              const payerName =
                members.find((m) => m.user_id === user.id)?.profiles
                  ?.display_name || "Someone";

              fetch("/api/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userIds: targetUserIds,
                  title: t("pushTitle"),
                  body: t("pushBody", {
                    name: payerName,
                    description: form.description || "Expense",
                    amount: `${selectedCurrency} ${amount}`
                  }),
                  url: `/groups/${groupId}`,
                }),
              }).catch((err) => console.error("Push failed", err));
            }
          }
        },
        onError: (error) => {
          toast.error(t("failedToAdd"), {
            description: error.message,
          });
        },
      });
    }
  };

  const isPending = addExpense.isPending || updateExpense.isPending;

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

      <DrawerContent
        className="flex flex-col transition-all duration-200"
        style={{ height: drawerHeight }}
        ref={drawerContentRef}
      >
        <DrawerHeader className="relative">
          <DrawerTitle className="text-center">
            {isLoadingExpense
              ? t("loading")
              : step === "amount"
              ? t("enterAmount")
              : expenseId
              ? t("editExpense")
              : t("details")}
          </DrawerTitle>
          {expenseId && !isLoadingExpense && (
            <div className="absolute right-4 top-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("deleteDesc")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {t("delete")}
                    </AlertDialogAction>
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
                  baseCurrency={currency}
                  onCurrencyChange={setSelectedCurrency}
                  initialValue={amount}
                />
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-hidden">
                  <SplitDetails
                    amount={amount}
                    currency={selectedCurrency}
                    baseCurrency={currency}
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
                    {isPending
                      ? t("saving")
                      : form.isValid
                      ? expenseId
                        ? t("updateExpense")
                        : t("saveSplit")
                      : t("checkAllocation")}
                  </Button>
                </DrawerFooter>
              </>
            )}
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
