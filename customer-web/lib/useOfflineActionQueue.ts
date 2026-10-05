'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface QueuedAction {
  url: string;
  method: string;
  body: unknown;
  queuedAt: string;
}

/**
 * Queues a write (a status change, an approve/reject) when it fails to reach
 * the server, and keeps retrying until it lands.
 *
 * Retries on the browser's `online` event AND on a steady interval — `online`/
 * `offline` only reflect link-layer connectivity (still joined to the shop's
 * WiFi router), not whether the WAN itself is reachable. A broadband outage
 * that leaves the local router up never fires those events at all, so without
 * the interval a queued action would sit forever until someone reloads the
 * page — which is exactly the gap that made the POS's own offline queue miss
 * this same case.
 */
export function useOfflineActionQueue(queueKey: string) {
  const flushingRef = useRef(false);
  const [pendingCount, setPendingCount] = useState(0);

  const readQueue = useCallback((): QueuedAction[] => {
    try {
      return JSON.parse(localStorage.getItem(queueKey) ?? '[]');
    } catch {
      return [];
    }
  }, [queueKey]);

  const writeQueue = useCallback((q: QueuedAction[]) => {
    try {
      if (q.length) localStorage.setItem(queueKey, JSON.stringify(q));
      else localStorage.removeItem(queueKey);
    } catch {
      // Storage unavailable (private browsing, quota) — the queue just won't survive a refresh
    }
    setPendingCount(q.length);
  }, [queueKey]);

  const enqueue = useCallback((action: Omit<QueuedAction, 'queuedAt'>) => {
    const q = readQueue();
    q.push({ ...action, queuedAt: new Date().toISOString() });
    writeQueue(q);
  }, [readQueue, writeQueue]);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    const q = readQueue();
    if (!q.length) return;
    flushingRef.current = true;
    const remaining: QueuedAction[] = [];
    for (const action of q) {
      try {
        const res = await fetch(action.url, {
          method: action.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.body),
        });
        if (!res.ok) remaining.push(action);
      } catch {
        remaining.push(action);
      }
    }
    writeQueue(remaining);
    flushingRef.current = false;
  }, [readQueue, writeQueue]);

  useEffect(() => {
    setPendingCount(readQueue().length);
    flush();
    const onOnline = () => flush();
    window.addEventListener('online', onOnline);
    const interval = setInterval(flush, 15000);
    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(interval);
    };
  }, [flush, readQueue]);

  return { enqueue, pendingCount };
}
