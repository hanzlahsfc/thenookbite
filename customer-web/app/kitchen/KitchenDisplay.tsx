'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { elapsed, elapsedColor, useStopwatchTick } from '@/lib/useStopwatch';
import { printKitchenTicket } from '@/lib/printKitchenTicket';
import { hasSerialSupport, isPaired, onPairedChange, restorePort, pairPrinter } from '@/lib/serialPrinter';
import { useOfflineActionQueue } from '@/lib/useOfflineActionQueue';

type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed';

interface OrderItem {
  id: string;
  item_name: string;
  item_price: number;
  quantity: number;
}

interface Order {
  id: string;
  order_number?: number | null;
  customer_name: string;
  table_number: string | null;
  order_type: string | null;
  status: OrderStatus;
  payment_method: string;
  total: number;
  special_notes: string | null;
  created_at: string;
  order_items: OrderItem[];
}


// Single shared AudioContext — browsers require this to be resumed after a user gesture
let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return _audioCtx;
  } catch {
    return null;
  }
}

// Must be called from a user gesture (tap/click) to unlock audio on mobile/Chrome
async function unlockAudio() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') await ctx.resume();
  // Play a silent buffer so iOS/Chrome marks this context as user-activated
  const buf = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
}

function playOrderAlert() {
  const ctx = getAudioCtx();
  if (!ctx || ctx.state !== 'running') return;
  try {
    const tones = [880, 1100, 880, 1100];
    let t = ctx.currentTime;
    tones.forEach((freq) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t);
      osc.stop(t + 0.18);
      t += 0.22;
    });
  } catch {
    // ignore
  }
}

export default function KitchenDisplay() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reconnectBanner, setReconnectBanner] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(new Date());
  const [audioReady, setAudioReady] = useState(false);
  // Track pending order IDs that haven't been accepted yet — alert repeats for these
  const [alertingIds, setAlertingIds] = useState<Set<string>>(new Set());
  const alertIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabaseRef = useRef(createClient());
  const channelRef  = useRef<ReturnType<typeof supabaseRef.current.channel> | null>(null);
  const isFirstConnect = useRef(true);
  const { enqueue: enqueueStatusUpdate, pendingCount: pendingSyncCount } = useOfflineActionQueue('tnb_kitchen_queue');

  useStopwatchTick();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  async function handleEnableSound() {
    await unlockAudio();
    setAudioReady(true);
    playOrderAlert(); // test beep confirms it's working
  }

  // Keep repeating the alert every 4s while there are unaccepted pending orders
  useEffect(() => {
    if (alertIntervalRef.current) clearInterval(alertIntervalRef.current);
    if (alertingIds.size === 0) return;

    playOrderAlert();
    alertIntervalRef.current = setInterval(() => {
      if (alertingIds.size > 0) playOrderAlert();
    }, 4000);

    return () => { if (alertIntervalRef.current) clearInterval(alertIntervalRef.current); };
  }, [alertingIds]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/kitchen', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrders(data as Order[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  // Thermal printer pairing is per-machine, so the kitchen PC pairs separately
  const [printerPaired, setPrinterPaired] = useState(false);
  useEffect(() => {
    if (!hasSerialSupport()) return;
    restorePort().then(() => setPrinterPaired(isPaired()));
    return onPairedChange(setPrinterPaired);
  }, []);

  const advanceStatus = useCallback((id: string, next: OrderStatus) => {
    // Applied immediately, before the network round-trip: the kitchen can't
    // wait to know an order moved to preparing/ready, and the docket print
    // below goes straight to a USB/Bluetooth printer, which needs no network
    // at all. If the server sync below fails, it's queued and retried rather
    // than lost — Realtime will also correct this locally if the eventual
    // sync disagrees with what's shown here.
    setAlertingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: next } : o));
    if (next === 'preparing') {
      const order = orders.find(o => o.id === id);
      if (order) printKitchenTicket(order);
    }

    setUpdatingIds(prev => new Set(prev).add(id));
    (async () => {
      try {
        const res = await fetch(`/api/orders/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setError(null);
      } catch {
        // Offline or unreachable — queue it, the retry loop will pick it up.
        // Not surfaced as an error: this is the expected path while offline.
        enqueueStatusUpdate({ url: `/api/orders/${id}/status`, method: 'PATCH', body: { status: next } });
      } finally {
        setUpdatingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      }
    })();
  }, [orders, enqueueStatusUpdate]);

  // When tab becomes visible again: resume AudioContext + re-fetch in case orders arrived
  useEffect(() => {
    async function onVisible() {
      if (document.visibilityState !== 'visible') return;
      const ctx = getAudioCtx();
      if (ctx && ctx.state === 'suspended') await ctx.resume();
      fetchOrders();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchOrders]);

  useEffect(() => {
    fetchOrders();
    // Polling fallback alongside Realtime — matches the verify and
    // order-status displays. Realtime's own reconnect logic tracks the
    // WebSocket, but this keeps the screen self-healing even in the rarer
    // case where that reconnect stalls during a long outage.
    const poll = setInterval(fetchOrders, 5000);

    const channel = supabaseRef.current
      .channel('kitchen-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as Order;
          if (['pending', 'preparing'].includes(row.status)) {
            // Re-fetch from server to get full order with items (anon key can't read via RLS)
            const res = await fetch(`/api/kitchen`, { cache: 'no-store' });
            if (res.ok) {
              const data = await res.json();
              setOrders(data as Order[]);
            }
            // Start alerting for this new pending order
            if (row.status === 'pending') {
              setAlertingIds(prev => new Set(prev).add(row.id));
            }
          }
        }

        if (payload.eventType === 'UPDATE') {
          const row = payload.new as Order & { verified: boolean };
          if (['pending', 'preparing', 'ready'].includes(row.status) && row.verified) {
            setOrders(prev => prev.map(o => o.id === row.id ? { ...o, status: row.status } : o));
          } else {
            // Remove if completed/cancelled, or if unverified
            setOrders(prev => prev.filter(o => o.id !== row.id));
          }
        }

        if (payload.eventType === 'DELETE') {
          setOrders(prev => prev.filter(o => o.id !== (payload.old as Order).id));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (!isFirstConnect.current) {
            setReconnectBanner(true);
            fetchOrders().then(() => setTimeout(() => setReconnectBanner(false), 5000));
          }
          isFirstConnect.current = false;
          channelRef.current = channel;
        }
      });

    channelRef.current = channel;
    return () => { clearInterval(poll); supabaseRef.current.removeChannel(channel); };
  }, [fetchOrders]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-2xl font-mono tracking-widest animate-pulse">LOADING ORDERS…</p>
      </div>
    );
  }

  const pending   = orders.filter(o => o.status === 'pending');
  const preparing = orders.filter(o => o.status === 'preparing');
  const ready     = orders.filter(o => o.status === 'ready');

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-mono select-none flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold tracking-widest text-[#E4002B]">TNB</span>
          <span className="text-white text-sm tracking-widest">KITCHEN DISPLAY</span>
          {alertingIds.size > 0 && (
            <span className="flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/40 px-3 py-1 rounded-sm animate-pulse">
              <span className="text-yellow-400 text-xs tracking-widest font-bold">🔔 NEW ORDER</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          {hasSerialSupport() && !printerPaired && (
            <button
              onClick={() => pairPrinter().then(ok => setPrinterPaired(ok))}
              className="font-mono text-xs tracking-widest px-3 py-1.5 border border-white/15 text-white/50 hover:text-white hover:border-white/40 rounded-sm transition-colors"
              title="Pair the receipt printer (one-time setup on this machine)"
            >
              🔗 PAIR PRINTER
            </button>
          )}
          {!audioReady && (
            <button
              onClick={handleEnableSound}
              className="font-mono text-xs tracking-widest px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/60 text-yellow-300 hover:bg-yellow-500/30 rounded-sm transition-colors animate-pulse"
            >
              🔔 ENABLE SOUND
            </button>
          )}
          {alertingIds.size > 0 && (
            <button
              onClick={() => setAlertingIds(new Set())}
              className="font-mono text-xs tracking-widest px-3 py-1.5 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 rounded-sm transition-colors"
            >
              🔕 MUTE
            </button>
          )}
          <span className="text-white tabular-nums">
            {now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-white text-xs tracking-widest">LIVE</span>
          </span>
        </div>
      </div>

      {/* Reconnect banner */}
      {reconnectBanner && (
        <div className="bg-yellow-500/20 border-b border-yellow-500/40 px-6 py-3 text-yellow-400 text-sm tracking-widest text-center flex-shrink-0">
          RECONNECTED — SYNCING ORDERS…
        </div>
      )}

      {/* Pending sync banner — a status change couldn't reach the server yet */}
      {pendingSyncCount > 0 && (
        <div className="bg-orange-500/20 border-b border-orange-500/40 px-6 py-3 text-orange-400 text-sm tracking-widest text-center flex-shrink-0">
          ⚠ {pendingSyncCount} UPDATE{pendingSyncCount !== 1 ? 'S' : ''} WAITING TO SYNC — WILL RETRY AUTOMATICALLY
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/20 border-b border-red-500/40 px-6 py-3 text-red-400 text-sm tracking-widest flex items-center justify-between flex-shrink-0">
          <span>⚠ {error}</span>
          <button onClick={fetchOrders} className="underline text-xs tracking-widest hover:text-white">RETRY</button>
        </div>
      )}

      {/* Main columns — PENDING + PREPARING */}
      <div className="grid grid-cols-2 flex-1 min-h-0">

        {/* PENDING column */}
        <div className="border-r border-white/10 flex flex-col">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/40 flex-shrink-0">
            <span className="text-yellow-400 text-sm tracking-[0.3em] font-bold">PENDING</span>
            <span className="bg-yellow-400/20 text-yellow-400 text-sm font-bold px-3 py-1 rounded-sm">
              {pending.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {pending.length === 0 && (
              <div className="text-white text-center text-sm tracking-widest py-16">NO PENDING ORDERS</div>
            )}
            {pending.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onAction={() => advanceStatus(order.id, 'preparing')}
                actionLabel="START PREPARING →"
                actionColor="bg-yellow-500 hover:bg-yellow-400 text-black"
                updating={updatingIds.has(order.id)}
              />
            ))}
          </div>
        </div>

        {/* PREPARING column */}
        <div className="flex flex-col">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/40 flex-shrink-0">
            <span className="text-blue-400 text-sm tracking-[0.3em] font-bold">PREPARING</span>
            <span className="bg-blue-400/20 text-blue-400 text-sm font-bold px-3 py-1 rounded-sm">
              {preparing.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {preparing.length === 0 && (
              <div className="text-white text-center text-sm tracking-widest py-16">NOTHING IN PROGRESS</div>
            )}
            {preparing.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onAction={() => advanceStatus(order.id, 'ready')}
                actionLabel="MARK READY ✓"
                actionColor="bg-green-600 hover:bg-green-500 text-white"
                updating={updatingIds.has(order.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* READY tray — visible when there are ready orders waiting for pickup */}
      {ready.length > 0 && (
        <div className="border-t-2 border-green-500/50 bg-green-500/5 flex-shrink-0">
          <div className="px-6 py-3 flex items-center gap-4 border-b border-green-500/20">
            <span className="text-green-400 text-sm tracking-[0.3em] font-bold">READY FOR PICKUP</span>
            <span className="bg-green-400/20 text-green-400 text-sm font-bold px-3 py-1 rounded-sm">
              {ready.length}
            </span>
          </div>
          <div className="flex gap-4 p-4 overflow-x-auto">
            {ready.map((order) => {
              const shortId = String(order.order_number ?? 0);
              return (
                <div key={order.id} className="flex-shrink-0 border border-green-500/40 bg-green-500/10 rounded-sm px-5 py-4 min-w-[200px]">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-white text-2xl font-bold">#{shortId}</span>
                    {order.order_type && (
                      <span className="text-[10px] tracking-widest text-green-400 border border-green-500/30 px-2 py-0.5 rounded-sm">
                        {order.order_type.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-white text-sm">{order.customer_name}</p>
                  {order.table_number && (
                    <p className="text-white/50 text-xs tracking-widest mt-1">TABLE {order.table_number}</p>
                  )}
                  <button
                    onClick={() => advanceStatus(order.id, 'completed')}
                    disabled={updatingIds.has(order.id)}
                    className="mt-3 w-full py-2 text-xs font-bold tracking-widest bg-green-600 hover:bg-green-500 text-white rounded-sm disabled:opacity-50 transition-colors"
                  >
                    {updatingIds.has(order.id) ? '…' : 'COLLECTED ✓'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  onAction,
  actionLabel,
  actionColor,
  updating,
}: {
  order: Order;
  onAction: () => void;
  actionLabel: string;
  actionColor: string;
  updating: boolean;
}) {
  return (
    <div className={`border rounded-sm overflow-hidden ${
      order.status === 'pending' ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-blue-500/40 bg-blue-500/5'
    }`}>
      {/* Card header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-white text-4xl font-bold tracking-widest tabular-nums">
            #{String(order.order_number ?? 0)}
          </span>
          {order.table_number && (
            <span className="bg-white/10 text-white text-xs px-2 py-0.5 tracking-widest rounded-sm">
              TABLE {order.table_number}
            </span>
          )}
          {order.order_type && order.order_type !== 'dine-in' && (
            <span className={`text-xs px-2 py-0.5 tracking-widest rounded-sm ${
              order.order_type === 'delivery'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
            }`}>
              {order.order_type.toUpperCase()}
            </span>
          )}
        </div>
        <div className="text-right">
          <p className={`text-2xl tracking-widest font-bold tabular-nums ${elapsedColor(order.created_at)}`}>⏱ {elapsed(order.created_at)}</p>
          <p className="text-white text-sm mt-0.5">{order.customer_name}</p>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-3 space-y-2">
        {order.order_items.map(item => (
          <div key={item.id} className="flex items-start gap-3">
            <span className="text-white text-2xl font-bold leading-none min-w-[2rem]">
              {item.quantity}×
            </span>
            <span className="text-white text-lg leading-snug">{item.item_name}</span>
          </div>
        ))}
      </div>

      {/* Special notes */}
      {order.special_notes && (
        <div className="px-4 pb-3">
          <p className="text-yellow-300/80 text-sm border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 rounded-sm">
            ⚠ {order.special_notes}
          </p>
        </div>
      )}

      {/* Action button */}
      <div className="px-4 pb-4">
        <button
          onClick={onAction}
          disabled={updating}
          className={`w-full py-4 text-sm font-bold tracking-[0.2em] transition-colors rounded-sm disabled:opacity-50 disabled:cursor-not-allowed ${actionColor}`}
        >
          {updating ? 'UPDATING…' : actionLabel}
        </button>
      </div>
    </div>
  );
}
