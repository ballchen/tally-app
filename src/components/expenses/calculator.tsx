"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, ArrowRightLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useExchangeRates } from "@/hooks/use-exchange-rates";
import { getExchangeRate, getCurrencySymbol } from "@/lib/currency";
import { useTranslations } from "next-intl";

interface CalculatorProps {
  onConfirm: (amount: number) => void;
  currency: string;
  baseCurrency?: string;
  onCurrencyChange?: (currency: string) => void;
  initialValue?: number;
}

const COMMON_CURRENCIES = [
  "TWD",
  "USD",
  "JPY",
  "EUR",
  "KRW",
  "CNY",
  "GBP",
  "AUD",
];

export function Calculator({
  onConfirm,
  currency,
  baseCurrency,
  onCurrencyChange,
  initialValue,
}: CalculatorProps) {
  const [display, setDisplay] = useState(() =>
    initialValue && initialValue > 0 ? initialValue.toString() : "0",
  );
  const { data: exchangeRates } = useExchangeRates();
  const t = useTranslations("Calculator");

  // Calculate exchange rate if currencies differ
  const showExchangeRate = baseCurrency && currency !== baseCurrency;
  const amount = parseFloat(display) || 0;
  const exchangeRate = showExchangeRate
    ? getExchangeRate(currency, baseCurrency, exchangeRates)
    : null;
  const convertedAmount =
    exchangeRate && amount > 0 ? amount * exchangeRate : null;

  const handleNumber = (num: string) => {
    setDisplay((prev) => {
      if (prev === "0") return num;
      if (prev.includes(".") && prev.split(".")[1].length >= 2) return prev;

      // Count digits (excluding decimal point)
      const digitCount = prev.replace(".", "").length;
      // Limit to 10 digits total
      if (digitCount >= 10) return prev;

      return prev + num;
    });
  };

  const handleDot = () => {
    setDisplay((prev) => {
      if (prev.includes(".")) return prev;
      return prev + ".";
    });
  };

  const handleBackspace = () => {
    setDisplay((prev) => {
      if (prev.length === 1) return "0";
      return prev.slice(0, -1);
    });
  };

  const handleClear = () => {
    setDisplay("0");
  };

  const handleConfirm = () => {
    const amount = parseFloat(display);
    if (amount > 0) {
      onConfirm(amount);
    }
  };

  // Dynamic font size based on display length
  const getFontSize = () => {
    const length = display.length;
    if (length <= 6) return "text-6xl";
    if (length <= 8) return "text-5xl";
    if (length <= 10) return "text-4xl";
    if (length <= 12) return "text-3xl";
    if (length <= 14) return "text-2xl";
    return "text-xl";
  };

  return (
    <div className="w-full bg-transparent p-4 pt-0">
      <div className="mb-6 px-6 py-8 bg-muted/20 backdrop-blur-md rounded-2xl border border-white/10 shadow-inner">
        <div className="flex items-center justify-between">
          <div className="min-w-[80px] shrink-0">
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
              <span className="text-3xl font-medium text-muted-foreground">
                {currency}
              </span>
            )}
          </div>
          <span
            className={`${getFontSize()} font-bold tracking-tight bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-transparent transition-all duration-200 flex-1 text-right break-all`}
          >
            {display}
          </span>
        </div>
        {showExchangeRate && exchangeRate && convertedAmount && (
          <div className="text-xs text-muted-foreground mt-2 text-right flex items-center justify-end gap-1">
            <ArrowRightLeft className="h-3 w-3" />
            <span>
              ≈ {getCurrencySymbol(baseCurrency!)} {convertedAmount.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {/* Row 1 */}
        <Button
          variant="outline"
          className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105"
          onClick={() => handleNumber("7")}
        >
          7
        </Button>
        <Button
          variant="outline"
          className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105"
          onClick={() => handleNumber("8")}
        >
          8
        </Button>
        <Button
          variant="outline"
          className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105"
          onClick={() => handleNumber("9")}
        >
          9
        </Button>
        <Button
          variant="destructive"
          className="h-16 rounded-2xl shadow-lg shadow-destructive/20 hover:scale-105 transition-all"
          onClick={handleClear}
        >
          C
        </Button>

        {/* Row 2 */}
        <Button
          variant="outline"
          className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105"
          onClick={() => handleNumber("4")}
        >
          4
        </Button>
        <Button
          variant="outline"
          className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105"
          onClick={() => handleNumber("5")}
        >
          5
        </Button>
        <Button
          variant="outline"
          className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105"
          onClick={() => handleNumber("6")}
        >
          6
        </Button>
        <Button
          variant="secondary"
          className="h-16 rounded-2xl hover:scale-105 transition-all"
          onClick={handleBackspace}
        >
          <Eraser className="h-6 w-6" />
        </Button>

        {/* Row 3 */}
        <Button
          variant="outline"
          className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105"
          onClick={() => handleNumber("1")}
        >
          1
        </Button>
        <Button
          variant="outline"
          className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105"
          onClick={() => handleNumber("2")}
        >
          2
        </Button>
        <Button
          variant="outline"
          className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105"
          onClick={() => handleNumber("3")}
        >
          3
        </Button>
        <Button
          className="h-36 row-span-2 text-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl shadow-xl shadow-primary/30 hover:scale-105 transition-all"
          onClick={handleConfirm}
        >
          {t("ok")}
        </Button>

        {/* Row 4 */}
        <Button
          variant="outline"
          className="h-16 text-2xl font-medium col-span-2 rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105"
          onClick={() => handleNumber("0")}
        >
          0
        </Button>
        <Button
          variant="outline"
          className="h-16 text-2xl font-medium rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-105"
          onClick={handleDot}
        >
          .
        </Button>
      </div>
    </div>
  );
}
