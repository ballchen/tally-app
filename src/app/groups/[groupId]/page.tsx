"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

import { useGroupDetails } from "@/hooks/use-group-details";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowLeft,
  Copy,
  ArrowRight,
  Trash2,
  History as HistoryIcon,
  Archive,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import { AddExpenseDrawer } from "@/components/expenses/add-expense-drawer";
import { InviteMemberDialog } from "@/components/groups/invite-member-dialog";
import { EditGroupDialog } from "@/components/groups/edit-group-dialog";
import { useBalances } from "@/hooks/use-balances";
import { SettleUpDialog } from "@/components/settlement/settle-up-dialog";
import { useGranularSettle } from "@/hooks/use-granular-settle";
import { useUndoSettlement } from "@/hooks/use-undo-settlement";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { useProfile } from "@/hooks/use-profile";
import { toast } from "sonner";
import { getCurrencySymbol } from "@/lib/currency";
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
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

export default function GroupDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(
    null
  );
  const [scrollY, setScrollY] = useState(0);
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const t = useTranslations("GroupDetails");

  const INITIAL_EXPENSE_LIMIT = 5;

  // Get current user
  const { data: profile } = useProfile();
  const currentUserId = profile?.id || "";

  // Enable realtime sync for this group
  useRealtimeSync(groupId);
  const { data, isLoading, error, refetch } = useGroupDetails(groupId);
  const queryClient = useQueryClient();

  // Handle scroll for sticky header effects
  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        setScrollY(scrollContainerRef.current.scrollTop);
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, []);

  const [view, setView] = useState<"current" | "history">("current");
  const { debts } = useBalances(
    data?.expenses || [],
    data?.members || [],
    data?.group?.base_currency || "TWD"
  );
  const { mutate: settle, isPending: isSettling } = useGranularSettle();
  const { mutate: undoSettlement, isPending: isUndoing } = useUndoSettlement();

  // Reset showAllExpenses when view changes
  useEffect(() => {
    setShowAllExpenses(false);
  }, [view]);

  // Pull-to-refresh
  const { pullDistance, isRefreshing, containerRef: scrollContainerRef } = usePullToRefresh({
    onRefresh: async () => {
      // Invalidate and refetch group details
      await queryClient.invalidateQueries({ queryKey: ["group-details", groupId] });
      await refetch();
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <p className="text-destructive">{t("errorLoading")}</p>
        <Button onClick={() => router.push("/groups")}>{t("backToGroups")}</Button>
      </div>
    );
  }

  const { group, members, expenses } = data;

  // Check group status
  const isArchived = !!group.archived_at;
  const currentMember = members?.find((m: { user_id: string }) => m.user_id === currentUserId);
  const isHidden = !!currentMember?.hidden_at;

  const filteredExpenses = expenses?.filter((e) => {
    if (e.type === "repayment") {
      return view === "history";
    }
    // Check if fully settled (all splits have a settlement_id)
    const isFullySettled =
      e.expense_splits?.length > 0 &&
      e.expense_splits.every(
        (s: { settlement_id: string | null }) => s.settlement_id
      );

    if (view === "current") return !isFullySettled;
    return isFullySettled;
  });

  // Calculate displayed expenses
  const displayedExpenses = showAllExpenses
    ? filteredExpenses
    : filteredExpenses?.slice(0, INITIAL_EXPENSE_LIMIT);
  const hasMoreExpenses = filteredExpenses && filteredExpenses.length > INITIAL_EXPENSE_LIMIT;

  const copyInviteCode = () => {
    navigator.clipboard.writeText(group.invite_code);
    toast.success(t("inviteCodeCopied"));
  };

  // Calculate when to show sticky title
  const coverHeight = 160; // h-40 = 160px
  const showStickyTitle = scrollY > coverHeight;

  return (
    <div className="h-screen flex flex-col max-w-2xl mx-auto relative">
      {/* Sticky Header with Title (shows when scrolled past cover) */}
      {showStickyTitle && (
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-4 px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/groups")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{group.name}</h2>
                {isArchived && (
                  <Badge variant="secondary" className="text-xs">
                    <Archive className="h-3 w-3 mr-1" />
                    {t("archived")}
                  </Badge>
                )}
              </div>
            </div>
            <EditGroupDialog
              group={group}
              currentUserId={currentUserId}
              isHidden={isHidden}
            />
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto relative">
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
        />
        {/* Cover Image */}
        {group.cover_image_url && (
          <div className="relative w-full h-40 overflow-hidden">
            <Image
              key={group.cover_image_url}
              src={group.cover_image_url}
              alt={`${group.name} cover`}
              fill
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          </div>
        )}

        <div className="space-y-6 p-4">
          {/* Header - Hidden when sticky shows */}
          <div
            className="flex items-center gap-4 transition-opacity duration-200"
            style={{ opacity: showStickyTitle ? 0 : 1 }}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/groups")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{group.name}</h1>
                {isArchived && (
                  <Badge variant="secondary" className="text-xs">
                    <Archive className="h-3 w-3 mr-1" />
                    {t("archived")}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{t("code")}: {group.invite_code}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={copyInviteCode}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <EditGroupDialog
              group={group}
              currentUserId={currentUserId}
              isHidden={isHidden}
            />
          </div>

          {/* Members Scroll */}
          <div className="flex gap-4 overflow-x-auto pb-2">
            {members?.map((member: { user_id: string; profiles: { avatar_url?: string | null; display_name: string | null } | null }) => (
              <div
                key={member.user_id}
                className="flex flex-col items-center gap-1 min-w-[60px]"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.profiles?.avatar_url || ""} />
                  <AvatarFallback>
                    {member.profiles?.display_name?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs truncate max-w-[60px]">
                  {member.profiles?.display_name || "Unknown"}
                </span>
              </div>
            ))}
            <InviteMemberDialog
              inviteCode={group.invite_code}
              groupName={group.name}
            />
          </div>

          {/* Settlement & Balances */}
          {debts.length > 0 && (
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("outstandingBalances")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {debts.map((debt, i) => {
                  // Helper to find member profile safely
                  const fromUser = members?.find(
                    (m: { user_id: string }) => m.user_id === debt.from
                  )?.profiles;
                  const toUser = members?.find(
                    (m: { user_id: string }) => m.user_id === debt.to
                  )?.profiles;

                  return (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center">
                          <Avatar className="h-8 w-8 border-2 border-background z-0">
                            <AvatarImage src={fromUser?.avatar_url || ""} />
                            <AvatarFallback>
                              {fromUser?.display_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <ArrowRight className="h-4 w-4 -ml-1 -mr-1 text-muted-foreground z-10 bg-background rounded-full" />
                          <Avatar className="h-8 w-8 border-2 border-background z-0">
                            <AvatarImage src={toUser?.avatar_url || ""} />
                            <AvatarFallback>
                              {toUser?.display_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium leading-none">
                            {fromUser?.display_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t("owes")} {toUser?.display_name}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="font-bold text-right">
                          <div className="text-sm">
                            {getCurrencySymbol(group.base_currency)} {debt.amount.toFixed(0)}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 text-xs bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary"
                          disabled={isSettling || isArchived}
                          onClick={() =>
                            settle({
                              groupId,
                              debtorId: debt.from,
                              creditorId: debt.to,
                              amount: debt.amount,
                              currency: group.base_currency,
                            })
                          }
                        >
                          {t("settle")}
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {!isArchived && (
                  <div className="pt-2">
                    <SettleUpDialog
                      groupId={groupId}
                      debts={debts}
                      members={members || []}
                      currency={group.base_currency}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Expenses List - Always visible */}
          <div className="space-y-4 pb-20">
            <div className="flex items-center justify-between">
              <div className="flex bg-muted rounded-lg p-1">
                <button
                  className={`px-3 py-1 text-sm rounded-md transition-all ${
                    view === "current"
                      ? "bg-background shadow-sm font-medium"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => setView("current")}
                >
                  {t("current")}
                </button>
                <button
                  className={`px-3 py-1 text-sm rounded-md transition-all ${
                    view === "history"
                      ? "bg-background shadow-sm font-medium"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => setView("history")}
                >
                  {t("history")}
                </button>
              </div>
            </div>

            {/* Settlements History List */}
            {view === "history" &&
              data?.settlements &&
              data.settlements.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                    {t("recentSettlements")}
                  </h3>
                  {data.settlements.map((settlement) => (
                    <Card
                      key={settlement.id}
                      className="bg-muted/10 border-dashed"
                    >
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <HistoryIcon className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <div className="text-sm font-medium">
                              {t("settledBy")}{" "}
                              {settlement.creator?.display_name || "Unknown"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(
                                new Date(settlement.created_at),
                                "MMM d, yyyy HH:mm"
                              )}
                            </div>
                          </div>
                        </div>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              disabled={isUndoing || isArchived}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {t("undoSettlement")}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("undoSettlementDesc")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => undoSettlement(settlement.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                {t("confirmUndo")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

            {filteredExpenses?.length === 0 &&
            (!data?.settlements || data.settlements.length === 0) ? (
              <Card className="p-12 text-center border-dashed">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <div className="text-4xl">
                    {view === "current" ? "✨" : "📜"}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-foreground">
                      {view === "current"
                        ? t("allSettledUp")
                        : t("noHistoryYet")}
                    </h3>
                    <p className="text-sm">
                      {view === "current"
                        ? t("addExpenseToStart")
                        : t("pastSettlements")}
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              <>
                {displayedExpenses?.map((expense) => {
                const isFullySettled =
                  expense.expense_splits?.length > 0 &&
                  expense.expense_splits.every(
                    (s: { settlement_id: string | null }) => s.settlement_id
                  );
                const isEditable =
                  !isFullySettled &&
                  expense.type !== "repayment" &&
                  !isArchived;
                return (
                  <Card
                    key={expense.id}
                    className={`transition-colors ${
                      isEditable
                        ? "cursor-pointer hover:bg-muted/50"
                        : "opacity-80"
                    } ${
                      expense.type === "repayment"
                        ? "bg-muted/20 border-l-4 border-l-primary/50"
                        : ""
                    }`}
                    onClick={() =>
                      isEditable && setSelectedExpenseId(expense.id)
                    }
                  >
                    <CardContent className="px-4 py-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="text-center min-w-[3rem] shrink-0">
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(expense.date), "MMM")}
                          </div>
                          <div className="font-bold text-lg">
                            {format(new Date(expense.date), "dd")}
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <div className="font-medium leading-none truncate">
                            {expense.description || t("expense")}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {expense.type === "repayment"
                              ? t("settlement")
                              : t("paidBy", { name: expense.payer?.display_name || "" })}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="font-bold whitespace-nowrap">
                          {getCurrencySymbol(expense.currency)} {expense.amount}
                        </div>
                        {expense.type !== "repayment" && (
                          <div className="flex items-center -space-x-1.5 pt-1">
                            {!expense.expense_splits ||
                            expense.expense_splits.length === 0 ? (
                              <span className="text-[10px] text-muted-foreground/50">
                                {t("detailsNotLoaded")}
                              </span>
                            ) : (
                              expense.expense_splits.map(
                                (split: {
                                  user_id: string;
                                  profiles?: {
                                    display_name?: string;
                                    avatar_url?: string;
                                  };
                                }) => (
                                  <Avatar
                                    key={split.user_id}
                                    className="h-5 w-5 border-2 border-background"
                                  >
                                    <AvatarImage
                                      src={split.profiles?.avatar_url || ""}
                                    />
                                    <AvatarFallback className="text-[8px]">
                                      {split.profiles?.display_name?.[0] || "?"}
                                    </AvatarFallback>
                                  </Avatar>
                                )
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Show More / Show Less Button */}
              {hasMoreExpenses && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full max-w-xs shadow-sm hover:shadow-md transition-all"
                    onClick={() => setShowAllExpenses(!showAllExpenses)}
                  >
                    {showAllExpenses ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2" />
                        {t("showLess")}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t("showing", {count: filteredExpenses?.length})}
                        </span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        {t("showAll")}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t("more", {count: filteredExpenses?.length - INITIAL_EXPENSE_LIMIT})}
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
            )}
          </div>
        </div>
      </div>

      {/* Floating Add Button & Drawers */}
      {members && !isArchived && (
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
              if (!open) setSelectedExpenseId(null);
            }}
          />
        </>
      )}
    </div>
  );
}
