import { useState, useRef, useCallback, useEffect } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPullDistance?: number;
  resistance?: number;
}

interface UsePullToRefreshReturn {
  pullDistance: number;
  isRefreshing: boolean;
  isPulling: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
}

const DEFAULT_THRESHOLD = 80;
const DEFAULT_MAX_PULL_DISTANCE = 120;
const DEFAULT_RESISTANCE = 0.5; // How much the pull distance is reduced (0.5 = 50% resistance)

export function usePullToRefresh({
  onRefresh,
  threshold = DEFAULT_THRESHOLD,
  maxPullDistance = DEFAULT_MAX_PULL_DISTANCE,
  resistance = DEFAULT_RESISTANCE,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container || isRefreshing) return;

    // Only enable pull-to-refresh when scrolled to the top
    if (container.scrollTop > 0) return;

    startYRef.current = e.touches[0].clientY;
    currentYRef.current = startYRef.current;
    isDraggingRef.current = true;
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDraggingRef.current || isRefreshing) return;

    const container = containerRef.current;
    if (!container) return;

    currentYRef.current = e.touches[0].clientY;
    const deltaY = currentYRef.current - startYRef.current;

    // Only pull down (positive deltaY) and when at top
    if (deltaY > 0 && container.scrollTop === 0) {
      // Apply resistance to make pulling feel more natural
      const distance = Math.min(
        deltaY * resistance,
        maxPullDistance
      );

      setPullDistance(distance);
      setIsPulling(true);

      // Prevent default scroll behavior when pulling
      if (distance > 10) {
        e.preventDefault();
      }
    }
  }, [isRefreshing, resistance, maxPullDistance]);

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return;

    isDraggingRef.current = false;
    setIsPulling(false);

    if (pullDistance >= threshold && !isRefreshing) {
      // Trigger refresh
      setIsRefreshing(true);
      onRefresh().finally(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      });
    } else {
      // Reset pull distance with animation
      setPullDistance(0);
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Add touch event listeners
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    pullDistance,
    isRefreshing,
    isPulling,
    containerRef,
  };
}
