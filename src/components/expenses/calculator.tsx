"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Eraser } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface CalculatorProps {
  onConfirm: (amount: number) => void
  currency: string
  onCurrencyChange?: (currency: string) => void
}

const COMMON_CURRENCIES = ["TWD", "USD", "JPY", "EUR", "KRW", "CNY", "GBP", "AUD"]

export function Calculator({ onConfirm, currency, onCurrencyChange }: CalculatorProps) {
  const [display, setDisplay] = useState("0")
  
  const handleNumber = (num: string) => {
    setDisplay(prev => {
      if (prev === "0") return num
      if (prev.includes(".") && prev.split(".")[1].length >= 2) return prev
      return prev + num
    })
  }

  const handleDot = () => {
    setDisplay(prev => {
      if (prev.includes(".")) return prev
      return prev + "."
    })
  }

  const handleBackspace = () => {
    setDisplay(prev => {
      if (prev.length === 1) return "0"
      return prev.slice(0, -1)
    })
  }

  const handleClear = () => {
    setDisplay("0")
  }

  const handleConfirm = () => {
    const amount = parseFloat(display)
    if (amount > 0) {
      onConfirm(amount)
    }
  }

  return (
    <div className="w-full bg-transparent p-4 pt-0">
      <div className="flex items-center justify-between mb-6 px-6 py-8 bg-muted/20 backdrop-blur-md rounded-2xl border border-white/10 shadow-inner">
          <div className="min-w-[80px]">
            {onCurrencyChange ? (
               <Select value={currency} onValueChange={onCurrencyChange}>
                 <SelectTrigger className="h-10 border-none bg-transparent text-3xl font-medium text-muted-foreground shadow-none p-0 focus:ring-0">
                   <SelectValue>{currency}</SelectValue>
                 </SelectTrigger>
                 <SelectContent>
                   {COMMON_CURRENCIES.map((c) => (
                     <SelectItem key={c} value={c}>
                       {c}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
            ) : (
               <span className="text-3xl font-medium text-muted-foreground">{currency}</span>
            )}
          </div>
          <span className="text-6xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
            {display}
          </span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {/* Row 1 */}
        <Button variant="outline" className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105" onClick={() => handleNumber("7")}>7</Button>
        <Button variant="outline" className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105" onClick={() => handleNumber("8")}>8</Button>
        <Button variant="outline" className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105" onClick={() => handleNumber("9")}>9</Button>
        <Button variant="destructive" className="h-16 rounded-2xl shadow-lg shadow-destructive/20 hover:scale-105 transition-all" onClick={handleClear}>C</Button>

        {/* Row 2 */}
        <Button variant="outline" className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105" onClick={() => handleNumber("4")}>4</Button>
        <Button variant="outline" className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105" onClick={() => handleNumber("5")}>5</Button>
        <Button variant="outline" className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105" onClick={() => handleNumber("6")}>6</Button>
         <Button variant="secondary" className="h-16 rounded-2xl hover:scale-105 transition-all" onClick={handleBackspace}><Eraser className="h-6 w-6" /></Button>

        {/* Row 3 */}
        <Button variant="outline" className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105" onClick={() => handleNumber("1")}>1</Button>
        <Button variant="outline" className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105" onClick={() => handleNumber("2")}>2</Button>
        <Button variant="outline" className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105" onClick={() => handleNumber("3")}>3</Button>
        <Button className="h-[9rem] row-span-2 text-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl shadow-xl shadow-primary/30 hover:scale-105 transition-all" onClick={handleConfirm}>OK</Button>
        
        {/* Row 4 */}
        <Button variant="outline" className="h-16 text-2xl font-medium col-span-2 rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105" onClick={() => handleNumber("0")}>0</Button>
        <Button variant="outline" className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105" onClick={handleDot}>.</Button>
      </div>
    </div>
  )
}
