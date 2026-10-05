'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SessionOrder, OrderType, PaymentMethod } from '../types';

type StaffOrderRow = {
  id: string; order_number?: number | null; total: number; customer_name: string; customer_phone: string;
  table_number: string | null; delivery_address: string | null; rider_name: string | null;
  order_type: string; payment_method: string; payment_status: string; status?: string | null;
  special_notes: string | null; created_at: string; delivery_charge?: number | null; tip?: number | null;
  order_items: { id: string; item_name: string; item_price: number; quantity: number }[];
};

function toSessionOrder(o: StaffOrderRow): SessionOrder {
  return {
    id: o.id,
    order_number: o.order_number ?? null,
    total: o.total,
    customerName: o.customer_name,
    phone: o.customer_phone ?? '',
    table: o.table_number ?? '',
    address: o.delivery_address ?? '',
    rider: o.rider_name ?? '',
    orderType: (o.order_type as OrderType) ?? 'dine-in',
    payment: (o.payment_method as PaymentMethod) ?? 'cash',
    paymentStatus: o.payment_status === 'paid' ? 'paid' : 'pending',
    cancelled: o.status === 'cancelled',
    notes: o.special_notes ?? '',
    deliveryCharge: o.delivery_charge ?? 0,
    tipAmount: o.tip ?? 0,
    placedAt: new Date(o.created_at),
    items: o.order_items.map(i => ({
      key: i.id, name: i.item_name,
      price: i.item_price, quantity: i.quantity, menu_item_id: '',
      orderItemId: i.id,
    })),
  };
}

export function useSessionOrders(sessionId: string) {
  const [sessionOrders, setSessionOrders] = useState<SessionOrder[]>([]);

  // Fetches the authoritative list from the server, replacing local state.
  // Exposed so the caller can re-run it right after placing an order — a
  // freshly placed order only has its real order_item ids on the server, and
  // the local optimistic copy has none. Without this, removing or editing a
  // line on that order silently did nothing until the page was reloaded,
  // because the ✕/edit controls need those ids to address a specific line.
  //
  // Keyed by session_id, not staffId — the admin/owner account has no row in
  // the `staff` table, so its orders carry staff_id: null and a staff_id
  // filter always came back empty when the owner ran the till themselves.
  const refresh = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/pos/staff-orders?session_id=${sessionId}`);
      const orders: StaffOrderRow[] = res.ok ? await res.json() : [];
      setSessionOrders(orders.map(toSessionOrder));
    } catch {
      // Keep whatever local state exists rather than wiping it on a network blip
    }
  }, [sessionId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { sessionOrders, setSessionOrders, refreshSessionOrders: refresh };
}
