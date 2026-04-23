import { useState, useRef, useCallback } from 'react';

export function usePullToRefresh(onRefresh) {
  const [refreshing, setRefreshing] = useState(false);
  const startY     = useRef(null);
  const containerRef = useRef(null);

  const onTouchStart = useCallback((e) => {
    if ((containerRef.current?.scrollTop ?? 0) === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const onTouchEnd = useCallback(async (e) => {
    if (startY.current === null) return;
    const delta = e.changedTouches[0].clientY - startY.current;
    startY.current = null;
    if (delta > 65) {
      setRefreshing(true);
      try { await onRefresh(); } finally { setRefreshing(false); }
    }
  }, [onRefresh]);

  return { containerRef, onTouchStart, onTouchEnd, refreshing };
}
