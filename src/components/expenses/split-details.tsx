"use client"

import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
// import { ScrollArea } from "@/components/ui/scroll-area" // Removed for better touch handling in Drawer
import { cn } from "@/lib/utils"
import { Check, User } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Member {
  user_id: string
  profiles: { display_name: string | null; avatar_url: string | null } | null
}

interface SplitDetailsProps {
  amount: number
  currency: string
  members: Member[]
  currentUser: any
  
  // State from hook
  splitMode: "EQUAL" | "EXACT" | "PERCENT"
  setSplitMode: (mode: "EQUAL" | "EXACT" | "PERCENT") => void
  
  description: string
  setDescription: (val: string) => void
  
  payerId: string
  setPayerId: (val: string) => void
  
  involvedIds: string[]
  toggleInvolved: (id: string) => void
  
  exactAmounts: Record<string, number>
  handleAmountChange: (id: string, val: string) => void
  
  percentAmounts: Record<string, number>
  handlePercentChange: (id: string, val: string) => void
  
  // Derived
  splitAmountEqual: number
  remainingExact: number
  remainingPercent: number
  onEditAmount?: () => void
}

export function SplitDetails({ 
  amount, 
  currency, 
  members, 
  currentUser,
  
  splitMode, setSplitMode,
  description, setDescription,
  payerId, setPayerId,
  involvedIds, toggleInvolved,
  exactAmounts, handleAmountChange,
  percentAmounts, handlePercentChange,
  
  splitAmountEqual,
  remainingExact,
  remainingPercent,
  onEditAmount
}: SplitDetailsProps) {

  return (
    <div className="flex flex-col h-full bg-background rounded-xl">
      <div className="p-4 bg-muted/20 border-b space-y-4">
         <div className="text-center">
            <div className="text-sm text-muted-foreground uppercase tracking-widest font-semibold">Total Bill</div>
            <div 
                className={cn("text-4xl font-bold mt-1 text-primary animate-in zoom-in-50 duration-300", onEditAmount && "cursor-pointer hover:opacity-80 transition-opacity")}
                onClick={onEditAmount}
            >
                {currency} {amount.toFixed(2)}
            </div>
             {splitMode === "EXACT" && (
                <div className={cn("text-xs mt-1 font-medium", Math.abs(remainingExact) < 0.05 ? "text-green-500" : "text-destructive")}>
                    {Math.abs(remainingExact) < 0.05 ? "Perfectly allocated" : `Remaining: ${remainingExact.toFixed(2)}`}
                </div>
             )}
             {splitMode === "PERCENT" && (
                <div className={cn("text-xs mt-1 font-medium", Math.abs(remainingPercent) < 0.1 ? "text-green-500" : "text-destructive")}>
                     {Math.abs(remainingPercent) < 0.1 ? "Total 100%" : `Remaining: ${remainingPercent.toFixed(1)}%`}
                </div>
             )}
        </div>

        <Tabs value={splitMode} onValueChange={(v: any) => setSplitMode(v)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="EQUAL">Equal</TabsTrigger>
                <TabsTrigger value="EXACT">Exact</TabsTrigger>
                <TabsTrigger value="PERCENT">Percent</TabsTrigger>
            </TabsList>
        </Tabs>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-6">
            <div className="space-y-2">
                <Input 
                    placeholder="Description (e.g. Sushi)" 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="h-12 text-lg bg-muted/50 border-transparent focus:border-primary transition-all text-center"
                    // Removed autoFocus to prevent keyboard jumping on mobile
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground ml-1">Who paid?</label>
                <div className="flex gap-2 overflow-x-auto p-2 scrollbar-none">
                    {members.map(member => {
                        const isPayer = member.user_id === payerId
                        return (
                             <button
                                key={member.user_id}
                                onClick={() => setPayerId(member.user_id)}
                                className={cn(
                                    "flex flex-col items-center gap-2 min-w-[4.5rem] p-2 rounded-xl transition-all border",
                                    isPayer 
                                        ? "bg-primary/10 border-primary shadow-sm scale-105" 
                                        : "bg-card border-border hover:border-primary/50 opacity-70 hover:opacity-100"
                                )}
                             >
                                <Avatar className={cn("h-10 w-10 border-2", isPayer ? "border-primary" : "border-transparent")}>
                                    <AvatarImage src={member.profiles?.avatar_url || undefined} />
                                    <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                </Avatar>
                                <span className={cn("text-xs font-medium truncate w-full text-center", isPayer ? "text-primary" : "text-muted-foreground")}>
                                    {member.user_id === currentUser?.id ? "You" : member.profiles?.display_name || "Member"}
                                </span>
                             </button>
                        )
                    })}
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-muted-foreground ml-1">Allocations</label>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                     {members.map(member => {
                        const isInvolved = involvedIds.includes(member.user_id)
                        return (
                            <div 
                                key={member.user_id}
                                className={cn(
                                    "flex items-center justify-between p-3 rounded-xl border transition-all",
                                    (splitMode === "EQUAL" && isInvolved) || (splitMode !== "EQUAL") ? "bg-card border-border shadow-sm" : "bg-muted/10 border-transparent opacity-60"
                                )}
                                onClick={() => splitMode === "EQUAL" && toggleInvolved(member.user_id)}
                            >
                                <div className="flex items-center gap-3">
                                    {splitMode === "EQUAL" && (
                                        <Checkbox checked={isInvolved} className="data-[state=checked]:bg-primary" />
                                    )}
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={member.profiles?.avatar_url || undefined} />
                                        <AvatarFallback>U</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium truncate max-w-[8rem]">
                                        {member.user_id === currentUser?.id ? "You" : member.profiles?.display_name || "Unknown"}
                                    </span>
                                </div>
                                
                                {splitMode === "EQUAL" && isInvolved && (
                                    <span className="text-sm font-semibold">{currency} {splitAmountEqual.toFixed(2)}</span>
                                )}

                                {splitMode === "EXACT" && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">{currency}</span>
                                        <Input 
                                            type="number" 
                                            className="w-24 h-9 text-right font-mono"
                                            placeholder="0.00"
                                            value={exactAmounts[member.user_id] || ""}
                                            onChange={(e) => handleAmountChange(member.user_id, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                )}

                                {splitMode === "PERCENT" && (
                                    <div className="flex items-center gap-2">
                                        <Input 
                                            type="number" 
                                            className="w-20 h-9 text-right font-mono"
                                            placeholder="0"
                                            value={percentAmounts[member.user_id] || ""}
                                            onChange={(e) => handlePercentChange(member.user_id, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <span className="text-xs text-muted-foreground">%</span>
                                    </div>
                                )}
                            </div>
                        )
                     })}
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}
