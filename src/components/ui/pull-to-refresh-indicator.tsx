"use client";

import { ArrowDown, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

const DEFAULT_THRESHOLD = 80;
const INDICATOR_SHOW_THRESHOLD = 20;

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = DEFAULT_THRESHOLD,
}: PullToRefreshIndicatorProps) {
  // Calculate progress (0 to 1)
  const progress = Math.min(pullDistance / threshold, 1);

  // Only show indicator after pulling a bit
  const shouldShow = pullDistance > INDICATOR_SHOW_THRESHOLD || isRefreshing;
  const isReady = progress >= 1;

  if (!shouldShow) return null;

  return (
    <div
      className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-50"
      style={{
        transform: `translateY(${isRefreshing ? 16 : pullDistance * 0.4}px)`,
        opacity: isRefreshing ? 1 : Math.min(progress * 1.5, 1),
        transition: isRefreshing || pullDistance === 0
          ? "all 0.3s ease-out"
          : "none",
      }}
    >
      <div className="flex items-center gap-2 px-4 py-2 bg-background/80 backdrop-blur-sm rounded-full shadow-lg border border-border">
        {isRefreshing ? (
          <>
            <RefreshCw className="h-4 w-4 text-primary animate-spin" />
            <span className="text-sm font-medium text-primary">
              Refreshing...
            </span>
          </>
        ) : isReady ? (
          <>
            <RefreshCw
              className={cn(
                "h-4 w-4 text-primary transition-transform duration-200",
                isReady && "rotate-180"
              )}
            />
            <span className="text-sm font-medium text-primary">
              Release to refresh
            </span>
          </>
        ) : (
          <>
            <ArrowDown
              className="h-4 w-4 text-muted-foreground transition-all duration-200"
              style={{
                transform: `translateY(${progress * 4}px)`,
              }}
            />
            <span className="text-sm font-medium text-muted-foreground">
              Pull to refresh
            </span>
          </>
        )}
      </div>
    </div>
  );
}
