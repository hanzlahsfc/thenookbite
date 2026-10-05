'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cardKey, type MenuCard } from '@/lib/types';
import { formatPKR, isValidPakistaniPhone, normalizePhone } from '@/lib/format';
import { imageForItem } from '@/lib/itemImages';
import { createClient } from '@/lib/supabase/client';
import { useCashDrawer } from '@/lib/useCashDrawer';
import {
  QUICK_CASH_NOTES, CARD_SURCHARGE_RATE,
  type CartLine, type SessionOrder, type PastOrder, type OrderType, type PaymentMethod,
} from './types';
import { useOfflineQueue } from './hooks/useOfflineQueue';
import { useSessionOrders } from './hooks/useSessionOrders';
import { blurOnWheel } from '@/lib/noWheel';
import { printKitchenTicket } from '@/lib/printKitchenTicket';
import { printDensityTest } from '@/lib/serialPrinter';
import { EXPENSE_CATEGORIES } from '@/lib/expenseCategories';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function orderNum(n?: number | null): string {
  return n != null ? String(n) : '----';
}

function cardImage(card: MenuCard): string {
  const dbUrl = 'item' in card ? card.item.image_url : card.base.image_url;
  return imageForItem(card.name, card.category, dbUrl);
}

// ─── In-progress order draft ────────────────────────────────────────────────
// A page refresh used to wipe whatever order was half-built — cart, customer,
// table, everything — because none of it lived anywhere but React state. It's
// saved to localStorage keyed by session id, so a refresh restores exactly
// what was there. Scoping the key to sessionId means a new shift (new
// session id) naturally starts with a clean slate rather than needing an
// explicit reset — matching the "only clears on a real session change" rule.
interface OrderDraft {
  cart: CartLine[];
  orderType: OrderType;
  table: string;
  address: string;
  rider: string;
  deliveryFee: string;
  tipInput: string;
  customer: string;
  phone: string;
  notes: string;
  payment: PaymentMethod;
  discountType: 'pct' | 'flat';
  discountValue: string;
}

function draftKey(sessionId: string): string {
  return `pos-draft-${sessionId}`;
}

function loadDraft(sessionId: string): Partial<OrderDraft> {
  if (typeof window === 'undefined' || !sessionId) return {};
  try {
    const raw = localStorage.getItem(draftKey(sessionId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function POSTerminal({
  cards,
  staffId,
  staffName,
  staffRole,
  sessionId,
  sessionStartedAt,
  categories,
}: {
  cards: MenuCard[];
  categories: string[];
  staffId: string | null;
  staffName: string;
  staffRole: string;
  sessionId: string;
  sessionStartedAt: string | null;
}) {
  // Loaded once per mount — not on every render — since it only needs to seed
  // the initial state below.
  const draftRef = useRef<Partial<OrderDraft> | null>(null);
  if (draftRef.current === null) draftRef.current = loadDraft(sessionId);
  const draft = draftRef.current;

  const [search, setSearch]         = useState('');
  const [category, setCategory]     = useState<string>('All');
  const [cart, setCart]             = useState<CartLine[]>(draft.cart ?? []);
  const [orderType, setOrderType]   = useState<OrderType>(draft.orderType ?? 'dine-in');
  const [table, setTable]           = useState(draft.table ?? '');
  const [address, setAddress]       = useState(draft.address ?? '');
  const [rider, setRider]           = useState(draft.rider ?? '');
  const [deliveryFee, setDeliveryFee] = useState(draft.deliveryFee ?? '');
  const [tipInput, setTipInput]     = useState(draft.tipInput ?? '');
  // Adding to an existing unpaid order rather than starting a new bill
  const [editingOrder, setEditingOrder] = useState<SessionOrder | null>(null);
  // Snapshot of the order's items when editing started — diffed against the
  // live cart on save to work out what was added, removed or resized.
  const [editOriginalItems, setEditOriginalItems] = useState<CartLine[]>([]);
  const [addingItems, setAddingItems]   = useState(false);
  const [viewingBill, setViewingBill]   = useState<SessionOrder | null>(null);
  // Recording an expense (till cash spent mid-shift) without leaving the POS
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseCategory, setExpenseCategory]   = useState<string>(EXPENSE_CATEGORIES[0]);
  const [expenseAmount, setExpenseAmount]       = useState('');
  const [expenseNote, setExpenseNote]           = useState('');
  const [savingExpense, setSavingExpense]       = useState(false);
  // This shift's totals, without going to the admin panel to see them
  const [showSessionReport, setShowSessionReport] = useState(false);
  const [sessionExpenses, setSessionExpenses]     = useState<
    { id: string; category: string; amount: number; description: string | null; recorded_by: string | null }[]
  >([]);
  const [customer, setCustomer]     = useState(draft.customer ?? '');
  const [phone, setPhone]           = useState(draft.phone ?? '');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [pastOrders, setPastOrders] = useState<PastOrder[]>([]);
  const [lookingUp, setLookingUp]   = useState(false);
  const [notes, setNotes]           = useState(draft.notes ?? '');
  const [payment, setPayment]       = useState<PaymentMethod>(draft.payment ?? 'cash');
  const [cartOpen, setCartOpen]     = useState(false);
  const [placing, setPlacing]       = useState(false);
  const [lastOrder, setLastOrder]   = useState<SessionOrder | null>(null);
  const [sessionOpen, setSessionOpen]     = useState(false);
  const [sessionTab, setSessionTab]       = useState<'all' | 'unpaid'>('all');
  const [settleId, setSettleId]           = useState<string | null>(null);
  const [settling, setSettling]           = useState(false);
  const [cancelId, setCancelId]           = useState<string | null>(null);
  const [cancelling, setCancelling]       = useState(false);
  const [toast, setToast]           = useState<string | null>(null);
  const [paymentModal, setPaymentModal]   = useState(false);
  const [cashStep, setCashStep]           = useState(false);
  const [cashGiven, setCashGiven]         = useState('');
  const [discountType, setDiscountType]   = useState<'pct' | 'flat'>(draft.discountType ?? 'flat');
  const [discountValue, setDiscountValue] = useState(draft.discountValue ?? '');
  const { openDrawer: fireDrawer, pairPrinter, paired: drawerPaired, status: drawerStatus, printReceiptUSB } = useCashDrawer();
  // Which path the last receipt took — the drawer only responds to the USB one
  const [printPath, setPrintPath] = useState<'none' | 'usb' | 'browser'>('none');
  const searchRef    = useRef<HTMLInputElement>(null);
  const lookupTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToastRef = useRef<(msg: string) => void>(() => {});

  const { sessionOrders, setSessionOrders, refreshSessionOrders } = useSessionOrders(sessionId);
  const { isOnline, saveToQueue: saveToOfflineQueue } = useOfflineQueue(
    sessionId,
    (flushed) => {
      setSessionOrders(prev => [{ ...flushed, items: flushed.items as CartLine[] }, ...prev]);
      // Same reasoning as the online path — the order now exists on the server
      // with real item ids that the local queued copy never had.
      refreshSessionOrders();
    },
    useCallback((msg: string) => showToastRef.current(msg), []),
  );

  // Close the session when the tab goes away. pagehide is the reliable signal
  // (beforeunload is skipped on mobile), and sendBeacon is the only request that
  // survives teardown. Reopening the POS the same day resumes this session
  // rather than starting a new one, so a refresh does not fragment the day.
  useEffect(() => {
    const close = () => { navigator.sendBeacon?.('/api/pos/session/close'); };
    window.addEventListener('pagehide', close);
    return () => window.removeEventListener('pagehide', close);
  }, []);

  // Cart panel width — draggable via the divider between it and the menu, so
  // whoever's running the till can widen whichever side they're using more.
  // Persisted per browser so the split survives a refresh.
  const CART_WIDTH_KEY = 'pos-cart-width';
  const CART_WIDTH_MIN = 280;
  const CART_WIDTH_MAX = 640;
  const [cartWidth, setCartWidth] = useState(384);
  const [resizingCart, setResizingCart] = useState(false);
  const cartWidthRef = useRef(384);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(CART_WIDTH_KEY));
      if (saved >= CART_WIDTH_MIN && saved <= CART_WIDTH_MAX) {
        setCartWidth(saved);
        cartWidthRef.current = saved;
      }
    } catch {
      // Private browsing or storage disabled — just keep the default width
    }
  }, []);

  useEffect(() => {
    if (!resizingCart) return;
    const onMove = (e: PointerEvent) => {
      const next = Math.min(CART_WIDTH_MAX, Math.max(CART_WIDTH_MIN, window.innerWidth - e.clientX));
      cartWidthRef.current = next;
      setCartWidth(next);
    };
    const onUp = () => {
      setResizingCart(false);
      try { localStorage.setItem(CART_WIDTH_KEY, String(cartWidthRef.current)); } catch {}
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [resizingCart]);

  // ── Phone lookup ─────────────────────────────────────────────────────────────
  const lookupPhone = useCallback(async (raw: string) => {
    const normalized = normalizePhone(raw);
    if (!isValidPakistaniPhone(normalized)) {
      setPastOrders([]);
      return;
    }
    setLookingUp(true);
    const res = await fetch(`/api/customer-lookup?phone=${normalized}`);
    if (res.ok) {
      const data = await res.json();
      if (data.customer_name && !customer) setCustomer(data.customer_name);
      setPastOrders(data.orders ?? []);
    }
    setLookingUp(false);
  }, [customer]);

  function handlePhoneChange(raw: string) {
    setPhone(raw);
    setPhoneError(null);
    const normalized = normalizePhone(raw);
    if (normalized.length === 11) {
      if (!isValidPakistaniPhone(normalized)) {
        setPhoneError('Must start with 03 and be 11 digits');
        setPastOrders([]);
        return;
      }
    }
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    lookupTimer.current = setTimeout(() => lookupPhone(raw), 500);
  }

  // ── Filter cards ────────────────────────────────────────────────────────────
  const filtered = cards.filter(c => {
    const matchCat = category === 'All' || c.category === category;
    const matchQ   = !search || c.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchQ;
  });

  // ── Cart helpers ─────────────────────────────────────────────────────────────
  function addLine(line: Omit<CartLine, 'quantity'>) {
    setCart(prev => {
      const existing = prev.find(l => l.key === line.key);
      if (existing) return prev.map(l => l.key === line.key ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, { ...line, quantity: 1 }];
    });
    showToast(`+ ${line.name}`);
  }

  function adjustQty(key: string, delta: number) {
    setCart(prev => {
      const updated = prev.map(l => l.key === key ? { ...l, quantity: l.quantity + delta } : l);
      return updated.filter(l => l.quantity > 0);
    });
  }

  function clearCart() {
    setCart([]);
    setTable('');
    setAddress('');
    setRider('');
    setDeliveryFee('');
    setTipInput('');
    setCustomer('');
    setPhone('');
    setPhoneError(null);
    setPastOrders([]);
    setNotes('');
    setOrderType('dine-in');
    setPayment('cash');
    setDiscountValue('');
    setDiscountType('flat');
  }

  // Save the in-progress order to localStorage on every change, so a refresh
  // restores it instead of starting over. Once everything's back to blank
  // (clearCart just ran, or nothing was ever entered) the draft is removed
  // rather than persisted as an empty shell.
  //
  // Skipped entirely while editing an already-placed order: that cart holds
  // someone else's existing order, not a new one, and editingOrder itself
  // isn't part of the draft. Restoring it after a refresh with no memory of
  // which order it belonged to would risk placing it as a duplicate instead
  // of saving it back onto the original.
  useEffect(() => {
    if (!sessionId || editingOrder) return;
    const isEmpty = cart.length === 0 && !table && !address && !rider && !deliveryFee &&
      !tipInput && !customer && !phone && !notes && !discountValue;
    try {
      if (isEmpty) {
        localStorage.removeItem(draftKey(sessionId));
      } else {
        const draft: OrderDraft = {
          cart, orderType, table, address, rider, deliveryFee, tipInput,
          customer, phone, notes, payment, discountType, discountValue,
        };
        localStorage.setItem(draftKey(sessionId), JSON.stringify(draft));
      }
    } catch {
      // Storage unavailable (private browsing, quota) — draft just won't survive a refresh
    }
  }, [sessionId, editingOrder, cart, orderType, table, address, rider, deliveryFee, tipInput, customer, phone, notes, payment, discountType, discountValue]);

  const total = cart.reduce((s, l) => s + l.price * l.quantity, 0);
  const discountAmount = (() => {
    const v = parseFloat(discountValue) || 0;
    if (v <= 0) return 0;
    if (discountType === 'pct') return Math.min(Math.round(total * v / 100), total);
    return Math.min(Math.round(v), total);
  })();
  // Delivery charge applies to delivery orders only; the server enforces the
  // same rule, this is the display figure
  const deliveryCharge = orderType === 'delivery' ? Math.max(0, parseInt(deliveryFee) || 0) : 0;
  const tipAmount = Math.max(0, parseInt(tipInput) || 0);
  const afterDiscount = total - discountAmount + deliveryCharge + tipAmount;
  // Display-only: backend calculates this server-side from payment_method
  const cardTotal = Math.ceil(afterDiscount * (1 + CARD_SURCHARGE_RATE));

  // Kitchen docket from the POS — same ticket the kitchen screen prints on
  // Start Preparing: items only, no prices, no branding.
  function printKitchenDocket(order?: SessionOrder) {
    const target = order ?? lastOrder;
    if (!target) return;
    printKitchenTicket({
      order_number:  target.order_number ?? null,
      table_number:  target.table || null,
      order_type:    target.orderType,
      special_notes: target.notes || null,
      created_at:    target.placedAt.toISOString(),
      order_items:   target.items.map(i => ({ item_name: i.name, quantity: i.quantity })),
    });
  }

  // ── Expenses & session report ────────────────────────────────────────────────
  async function submitExpense() {
    const amount = parseInt(expenseAmount) || 0;
    if (amount <= 0) { showToast('Enter an amount'); return; }
    setSavingExpense(true);
    try {
      const res = await fetch('/api/pos/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: expenseCategory,
          amount,
          description: expenseNote || null,
          session_id: sessionId,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(body.detail ?? 'Could not save the expense'); return; }
      setShowExpenseModal(false);
      setExpenseAmount('');
      setExpenseNote('');
      setExpenseCategory(EXPENSE_CATEGORIES[0]);
      showToast(`Expense logged — ${formatPKR(amount)}`);
      // Keep the report's total in step if it's already open in the background
      setSessionExpenses(prev => [
        { id: body.id, category: body.category, amount: body.amount, description: body.description, recorded_by: body.recorded_by },
        ...prev,
      ]);
    } finally {
      setSavingExpense(false);
    }
  }

  async function openSessionReport() {
    setShowSessionReport(true);
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/pos/expenses?session_id=${sessionId}`);
      if (res.ok) setSessionExpenses(await res.json());
    } catch {
      // Report still shows order totals even if the expense fetch fails
    }
  }

  // ── Edit an existing unpaid order ────────────────────────────────────────────
  // Opens the exact same order-taking screen used to place a new order, with
  // the order's current items loaded straight into the cart. The cashier can
  // then add, remove or change quantities with the normal +/- controls, edit
  // customer/table/delivery/tip, and write a note — precisely as if taking the
  // order fresh — rather than a separate cut-down "add items only" editor.
  function startEditingOrder(order: SessionOrder) {
    setEditingOrder(order);
    // Snapshot of what the order looked like when editing started, so Save can
    // work out what changed (added, removed, or had its quantity changed).
    setEditOriginalItems(order.items);
    setSessionOpen(false);
    setOrderType(order.orderType);
    setTable(order.table);
    setCustomer(order.customerName);
    setPhone(order.phone);
    setPhoneError(null);
    setPastOrders([]);
    setAddress(order.address);
    setRider(order.rider);
    setDeliveryFee(order.deliveryCharge ? String(order.deliveryCharge) : '');
    setTipInput(order.tipAmount ? String(order.tipAmount) : '');
    setNotes(order.notes ?? '');
    // A new discount cannot be reconciled against the order's stored total (the
    // discount that produced it isn't kept on the order — see the items route),
    // so editing starts clean rather than implying one carried over.
    setDiscountValue('');
    setDiscountType('flat');
    setCart(order.items);
    // The editor lives in the cart panel. On anything narrower than desktop
    // that panel is a closed bottom sheet, so without this the button appeared
    // to do nothing at all.
    setCartOpen(true);
    showToast(`Editing order #${orderNum(order.order_number)}`);
  }

  function cancelEditingOrder() {
    setEditingOrder(null);
    setEditOriginalItems([]);
    clearCart();
  }

  async function saveOrderEdits() {
    if (!editingOrder) return;
    if (!cart.length) {
      showToast('An order needs at least one item — cancel it instead of emptying it');
      return;
    }
    if (orderType !== 'dine-in' && !isValidPakistaniPhone(normalizePhone(phone))) {
      setPhoneError('Enter a valid Pakistani mobile number (03XXXXXXXXX)');
      showToast('Phone number required');
      return;
    }

    setAddingItems(true);
    try {
      // Work out what changed since editing started: brand-new lines and lines
      // whose quantity moved are additions; original lines no longer present
      // (by their real order_item id) are removals. A changed quantity is
      // handled as remove-old + add-new rather than a partial update, since
      // that is what the existing endpoints support.
      const originalById = new Map(
        editOriginalItems.filter(i => i.orderItemId).map(i => [i.orderItemId as string, i]),
      );
      const toAdd: CartLine[] = [];
      const toDeleteIds = new Set<string>();

      for (const line of cart) {
        const original = line.orderItemId ? originalById.get(line.orderItemId) : undefined;
        if (original) {
          if (original.quantity !== line.quantity) {
            toDeleteIds.add(original.orderItemId as string);
            toAdd.push(line);
          }
          originalById.delete(line.orderItemId as string);
        } else {
          toAdd.push(line);
        }
      }
      // Anything left in the map was on the order but is no longer in the cart
      for (const id of originalById.keys()) toDeleteIds.add(id);

      let runningTotal = editingOrder.total;

      // Additions first, so the item count on the server never dips toward
      // zero while a quantity-change's matching removal is still pending.
      if (toAdd.length) {
        const res = await fetch(`/api/orders/${editingOrder.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: toAdd.map(l => ({
              menu_item_id: l.menu_item_id || null,
              item_name: l.name,
              item_price: l.price,
              quantity: l.quantity,
            })),
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) { showToast(body.detail ?? 'Could not save the added items'); return; }
        if (typeof body.order?.total === 'number') runningTotal = body.order.total;
      }

      for (const id of toDeleteIds) {
        const res = await fetch(`/api/orders/${editingOrder.id}/items?item_id=${id}`, { method: 'DELETE' });
        const body = await res.json().catch(() => ({}));
        if (res.ok && typeof body.order?.total === 'number') runningTotal = body.order.total;
      }

      // Order-level fields — same shape as placing a new order.
      const nameDefault =
        orderType === 'dine-in'  ? `Table ${table || '?'}` :
        orderType === 'delivery' ? 'Delivery'               : 'Counter';
      const normalizedPhone = orderType === 'dine-in' ? '' : normalizePhone(phone);
      const finalCustomerName = (orderType === 'dine-in' ? '' : customer) || nameDefault;

      const fieldsRes = await fetch(`/api/orders/${editingOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name:    finalCustomerName,
          customer_phone:   normalizedPhone || null,
          table_number:     orderType === 'dine-in' ? (table || null) : null,
          delivery_address: orderType === 'delivery' ? (address || null) : null,
          rider_name:       orderType === 'delivery' ? (rider || null) : null,
          order_type:       orderType,
          delivery_charge:  deliveryCharge,
          tip:              tipAmount,
          special_notes:    notes || null,
        }),
      });
      const fieldsBody = await fieldsRes.json().catch(() => ({}));
      if (!fieldsRes.ok) {
        showToast(fieldsBody.detail ?? 'Items saved, but the order details failed to update');
      } else if (typeof fieldsBody.order?.total === 'number') {
        runningTotal = fieldsBody.order.total;
      }

      const finalOrder: SessionOrder = {
        ...editingOrder,
        customerName: finalCustomerName,
        phone: normalizedPhone,
        table, address, rider, orderType,
        deliveryCharge, tipAmount,
        notes,
        items: cart,
        total: runningTotal,
      };

      setSessionOrders(prev => prev.map(o => (o.id === finalOrder.id ? finalOrder : o)));
      setLastOrder(finalOrder);
      setEditingOrder(null);
      setEditOriginalItems([]);
      clearCart();
      setCartOpen(false);
      showToast(`Order #${orderNum(finalOrder.order_number)} updated`);
      printReceipt(finalOrder);
      // Local reconstruction above is a best-effort mirror of the server state;
      // pull the authoritative copy back down (real ids for anything just added).
      refreshSessionOrders();
    } finally {
      setAddingItems(false);
    }
  }

  // ── Place order ───────────────────────────────────────────────────────────────
  async function placeOrder(selectedPayment?: PaymentMethod) {
    if (!cart.length) return;
    // Dine-in is served at the table, so there is nobody to call and nothing to
    // look up — name and phone are collected for takeaway and delivery only.
    const normalizedPhone = orderType === 'dine-in' ? '' : normalizePhone(phone);
    if (orderType !== 'dine-in' && !isValidPakistaniPhone(normalizedPhone)) {
      setPhoneError('Enter a valid Pakistani mobile number (03XXXXXXXXX)');
      showToast('Phone number required');
      return;
    }
    const method = selectedPayment ?? payment;
    setPayment(method);
    setPlacing(true);
    // Backend calculates final total server-side; use display value locally for session tracking
    const displayTotal = method === 'card' ? cardTotal : afterDiscount;
    const nameDefault =
      orderType === 'dine-in'  ? `Table ${table || '?'}` :
      orderType === 'delivery' ? 'Delivery'               : 'Counter';

    // What the customer handed over, so the bill can show their change
    const cashTendered = method === 'cash' ? (parseInt(cashGiven) || 0) : 0;

    const orderPayload = {
      customer_name:    (orderType === 'dine-in' ? '' : customer) || nameDefault,
      customer_phone:   normalizedPhone || null,
      table_number:     orderType === 'dine-in' ? (table || null) : null,
      delivery_address: orderType === 'delivery' ? (address || null) : null,
      rider_name:       orderType === 'delivery' ? (rider || null) : null,
      delivery_charge:  deliveryCharge,
      tip:              tipAmount,
      order_type:       orderType,
      special_notes:    notes || null,
      payment_method:   method,
      discount_type:    discountAmount > 0 ? discountType : undefined,
      discount_value:   discountAmount > 0 ? (parseFloat(discountValue) || 0) : undefined,
      idempotency_key:  crypto.randomUUID(),
      user_id:          null,
      staff_id:         staffId,
      session_id:       sessionId,
      items: cart.map(l => ({
        menu_item_id: l.menu_item_id,
        item_name: l.name,
        item_price: l.price,
        quantity: l.quantity,
      })),
    };

    const sessionOrderBase: Omit<SessionOrder, 'id'> = {
      total: displayTotal,
      customerName: customer || nameDefault,
      phone: normalizedPhone,
      table,
      address,
      rider,
      orderType,
      payment: method,
      paymentStatus: method === 'pay_later' ? 'pending' : 'paid',
      items: [...cart],
      notes,
      placedAt: new Date(),
      discountAmount,
      discountType,
      discountValue: parseFloat(discountValue) || 0,
      deliveryCharge,
      tipAmount,
      // Only meaningful when the cashier entered what the customer handed over
      cashGiven: cashTendered > 0 ? cashTendered : undefined,
      changeDue: cashTendered > 0 ? Math.max(0, cashTendered - displayTotal) : undefined,
    };

    try {
      if (!navigator.onLine) {
        saveToOfflineQueue(orderPayload);
        const offlineOrder: SessionOrder = { id: `offline-${Date.now()}`, ...sessionOrderBase };
        setLastOrder(offlineOrder);
        setSessionOrders(prev => [offlineOrder, ...prev]);
        clearCart();
        showToast('Offline — order saved, will sync when reconnected');
        // Bill for the customer and docket for the kitchen, both on placing
        printReceipt(offlineOrder);
        printKitchenDocket(offlineOrder);
        return;
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? 'Order failed');
      }
      const order = await res.json();
      const completedOrder: SessionOrder = {
        id: order.id,
        order_number: order.order_number ?? null,
        ...sessionOrderBase,
        total: order.total,
      };
      setLastOrder(completedOrder);
      setSessionOrders(prev => [completedOrder, ...prev]);
      clearCart();
      showToast('Order placed!');
      // Bill for the customer and docket for the kitchen, both on placing.
      // Serial writes are queued, so these print one after the other.
      printReceipt(completedOrder);
      printKitchenDocket(completedOrder);
      // The optimistic entry above has no real order_item ids — those only
      // exist once the row is on the server. Editing or removing a line from
      // this order needs those ids, so refresh now rather than waiting for the
      // cashier to reload the page.
      refreshSessionOrders();
    } catch (e) {
      // Network failure — queue it
      if (!navigator.onLine || (e instanceof TypeError && e.message.includes('fetch'))) {
        saveToOfflineQueue(orderPayload);
        const offlineOrder: SessionOrder = { id: `offline-${Date.now()}`, ...sessionOrderBase };
        setLastOrder(offlineOrder);
        setSessionOrders(prev => [offlineOrder, ...prev]);
        clearCart();
        showToast('Network lost — order queued, will sync when back online');
        printReceipt(offlineOrder);
        printKitchenDocket(offlineOrder);
      } else {
        showToast('Failed: ' + (e instanceof Error ? e.message : 'unknown error'));
      }
    } finally {
      setPlacing(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }
  showToastRef.current = showToast;

  async function cancelOrderPos(orderId: string) {
    setCancelling(true);
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    setCancelling(false);
    setCancelId(null);
    if (res.ok) {
      setSessionOrders(prev => prev.map(o => o.id === orderId ? { ...o, cancelled: true } : o));
      showToast('Order cancelled');
    } else {
      showToast('Cancel failed');
    }
  }

  function openCashDrawer() { fireDrawer(); }

  async function settleOrder(orderId: string, method: 'cash' | 'card') {
    setSettling(true);
    try {
      const res = await fetch('/api/orders/settle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, payment_method: method }),
      });
      if (!res.ok) throw new Error('Failed to settle');
      setSessionOrders(prev => prev.map(o =>
        o.id === orderId ? { ...o, payment: method, paymentStatus: 'paid' } : o
      ));
      setSettleId(null);
      showToast('Payment settled ✓');
      // Print paid receipt for the settled order
      const settled = sessionOrders.find(o => o.id === orderId);
      if (settled) printReceipt({ ...settled, payment: method, paymentStatus: 'paid' });
    } catch {
      showToast('Settle failed');
    } finally {
      setSettling(false);
    }
  }

  function printReceipt(order?: SessionOrder) {
    const target = order ?? lastOrder;
    if (!target) return;
    const { id, order_number, total, customerName, phone, table, address, rider, orderType, payment, paymentStatus, items, notes, placedAt, discountAmount: da, discountType: dt, discountValue: dv, deliveryCharge: dc, tipAmount: tp, cashGiven: cg, changeDue: cd } = target;
    const isPayLater = payment === 'pay_later' || paymentStatus === 'pending';
    const dateStr  = placedAt.toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr  = placedAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const subtotal = items.reduce((s, l) => s + l.price * l.quantity, 0);
    const itemCount = items.reduce((s, l) => s + l.quantity, 0);
    const rows = items.map(l => `
      <tr>
        <td style="padding:4px 0 2px;font-size:12px;vertical-align:top;">${l.name}</td>
        <td style="padding:4px 0 2px;font-size:12px;text-align:center;vertical-align:top;white-space:nowrap;">x${l.quantity}</td>
        <td style="padding:4px 0 2px;font-size:12px;text-align:right;vertical-align:top;white-space:nowrap;">Rs.${(l.price * l.quantity).toLocaleString()}</td>
      </tr>
      <tr>
        <td colspan="3" style="padding:0 0 4px;font-size:11px;color:#000;">@ Rs.${l.price.toLocaleString()} each</td>
      </tr>`
    ).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Receipt #${orderNum(order_number)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', Courier, monospace; width: 80mm; margin: 0 auto; padding: 6mm 4mm 10mm; font-size: 12px; color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; -webkit-font-smoothing: none; text-rendering: geometricPrecision; }
  .center  { text-align: center; }
  .right   { text-align: right; }
  .bold    { font-weight: bold; }
  .small   { font-size: 11px; }
  .dash    { border: none; border-top: 1px dashed #000; margin: 5px 0; }
  .solid   { border: none; border-top: 1px solid #000; margin: 5px 0; }
  table    { width: 100%; border-collapse: collapse; }
  @media print { @page { margin: 0; size: 80mm auto portrait; } body { padding: 4mm 3mm 12mm; } }
</style>
</head>
<body>

  <!-- LOGO BLOCK -->
  <div class="center" style="margin-bottom:6px;">
    <img src="${window.location.origin}/logo-dark.png" alt="TNB" style="width:150px;height:auto;display:block;margin:0 auto 4px;" />
    <div style="font-size:13px;font-weight:bold;letter-spacing:3px;margin-bottom:1px;">THE NOOK BITE</div>
    <div class="small" style="color:#000;">Mandi Bahauddin, Punjab, Pakistan</div>
    <div class="small" style="color:#000;">12 PM – 2 AM Daily</div>
    <div class="small" style="color:#000;">Tel: 0327-9627442</div>
  </div>

  <hr class="solid">

  <!-- ORDER META -->
  <div style="margin:4px 0;">
    <table class="bold">
      <tr>
        <td class="small">Order #</td>
        <td class="small right"><b>#${orderNum(order_number)}</b></td>
      </tr>
      <tr>
        <td class="small">Date</td>
        <td class="small right">${dateStr}</td>
      </tr>
      <tr>
        <td class="small">Time</td>
        <td class="small right">${timeStr}</td>
      </tr>
      <tr>
        <td class="small">Type</td>
        <td class="small right">${
          orderType === 'dine-in'  ? `DINE-IN${table ? ` · TABLE ${table}` : ''}` :
          orderType === 'delivery' ? 'DELIVERY' : 'TAKEAWAY'
        }</td>
      </tr>
      ${address ? `<tr><td class="small">Address</td><td class="small right" style="max-width:120px;word-break:break-word;">${address}</td></tr>` : ''}
      ${rider ? `<tr><td class="small">Rider</td><td class="small right">${rider}</td></tr>` : ''}
      ${customerName ? `<tr><td class="small">Customer</td><td class="small right">${customerName}</td></tr>` : ''}
      ${phone ? `<tr><td class="small">Phone</td><td class="small right">${phone}</td></tr>` : ''}
      <tr>
        <td class="small">Cashier</td>
        <td class="small right">${staffName}</td>
      </tr>
    </table>
  </div>

  <hr class="dash">

  <!-- ITEMS -->
  <div style="margin:2px 0 4px;">
    <table>
      <thead>
        <tr>
          <th style="text-align:left;font-size:11px;padding-bottom:4px;font-weight:bold;">ITEM</th>
          <th style="text-align:center;font-size:11px;padding-bottom:4px;font-weight:bold;">QTY</th>
          <th style="text-align:right;font-size:11px;padding-bottom:4px;font-weight:bold;">AMOUNT</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <hr class="dash">

  <!-- TOTALS -->
  <table style="margin:4px 0;">
    <tr>
      <td class="small">Subtotal (${itemCount} item${itemCount !== 1 ? 's' : ''})</td>
      <td class="small right">Rs.${subtotal.toLocaleString()}</td>
    </tr>
    ${(da && da > 0) ? `
    <tr>
      <td class="small" style="color:#000;">Discount (${dt === 'pct' ? `${dv}%` : `Rs.${dv}`})</td>
      <td class="small right" style="color:#000;">− Rs.${da.toLocaleString()}</td>
    </tr>` : ''}
    ${dc && dc > 0 ? `
    <tr>
      <td class="small" style="color:#000;">Delivery Charge</td>
      <td class="small right" style="color:#000;">Rs.${dc.toLocaleString()}</td>
    </tr>` : ''}
    ${tp && tp > 0 ? `
    <tr>
      <td class="small" style="color:#000;">Tip</td>
      <td class="small right" style="color:#000;">Rs.${tp.toLocaleString()}</td>
    </tr>` : ''}
    ${(() => { const beforeSurcharge = subtotal - (da ?? 0) + (dc ?? 0) + (tp ?? 0); return payment === 'card' && total > beforeSurcharge; })() ? `
    <tr>
      <td class="small" style="color:#000;">Card Service Charge (1.5%)</td>
      <td class="small right" style="color:#000;">Rs.${(total - (subtotal - (da ?? 0) + (dc ?? 0) + (tp ?? 0))).toLocaleString()}</td>
    </tr>` : `
    <tr>
      <td class="small" style="color:#000;">Tax / Service Charge</td>
      <td class="small right" style="color:#000;">Incl.</td>
    </tr>`}
  </table>

  <hr class="solid">

  <table style="margin:4px 0 6px;">
    <tr>
      <td style="font-size:15px;font-weight:900;letter-spacing:1px;">TOTAL</td>
      <td style="font-size:15px;font-weight:900;text-align:right;">Rs.${total.toLocaleString()}</td>
    </tr>
    <tr>
      <td class="small" style="padding-top:3px;">Payment</td>
      <td class="small right" style="padding-top:3px;font-weight:bold;">${
        isPayLater ? 'PAY LATER' : payment === 'cash' ? 'CASH' : 'CARD'
      }</td>
    </tr>
    ${cg ? `
    <tr>
      <td class="small" style="padding-top:3px;">Cash Received</td>
      <td class="small right" style="padding-top:3px;">Rs.${cg.toLocaleString()}</td>
    </tr>
    <tr>
      <td style="font-size:14px;font-weight:900;padding-top:3px;">CHANGE</td>
      <td style="font-size:14px;font-weight:900;text-align:right;padding-top:3px;">Rs.${(cd ?? 0).toLocaleString()}</td>
    </tr>` : ''}
  </table>

  ${!isPayLater ? `
  <div style="margin:8px 0;padding:6px;border:2px solid #000;text-align:center;">
    <div style="font-size:12px;font-weight:bold;letter-spacing:1px;color:#000;">✓ PAID — ${payment === 'cash' ? 'CASH' : 'CARD'}</div>
  </div>` : ''}

  ${notes ? `<hr class="dash"><div class="small" style="margin:3px 0;"><b>Note:</b> ${notes}</div>` : ''}

  <hr class="solid">

  <!-- FOOTER -->
  <div class="center" style="margin-top:8px;">
    <div style="font-size:11px;font-weight:bold;letter-spacing:1px;margin-bottom:3px;">THANK YOU FOR YOUR VISIT!</div>
    <div class="small" style="color:#000;margin-bottom:2px;">Please come again</div>
    <div class="small" style="color:#000;">Powered by TNB POS System</div>
  </div>

</body>
</html>`;

    // Try USB direct print first; fall back to browser dialog
    const typeLabel =
      orderType === 'dine-in'  ? `DINE-IN${table ? ` TABLE ${table}` : ''}` :
      orderType === 'delivery' ? 'DELIVERY' : 'TAKEAWAY';

    printReceiptUSB({
      orderNum: orderNum(order_number),
      dateStr, timeStr,
      typeLabel,
      customerName,
      phone,
      cashierName: staffName,
      items: items.map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
      subtotal,
      discountAmount: da ?? 0,
      deliveryCharge: orderType === 'delivery' ? (dc ?? 0) : 0,
      tipAmount: tp ?? 0,
      address: orderType === 'delivery' ? address : null,
      riderName: orderType === 'delivery' ? rider : null,
      total,
      cashGiven: cg,
      changeDue: cd,
      paymentMethod: isPayLater ? 'PAY LATER' : payment === 'cash' ? 'CASH' : 'CARD',
      isPaid: !isPayLater,
      notes,
      openDrawer: !isPayLater && payment === 'cash',
    }).then(printed => {
      setPrintPath(printed ? 'usb' : 'browser');
      if (!printed) {
        // No USB printer paired — use browser print dialog
        const w = window.open('', '_blank', 'width=380,height=700');
        if (!w) return;
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => { w.print(); }, 400);
      }
    });
  }

  // Cart panel JSX — shared between desktop sidebar and mobile bottom sheet
  const cartPanel = (
    <div className="flex flex-col h-full bg-[#111111]">
      {/* Editing an existing order — make it unmistakable this is not a new bill.
          Everything below (order type, customer, items, notes) is now the same
          live form used to take a fresh order, pre-filled from this order —
          the +/- steppers on the item list below handle adding, changing
          quantity and removing, exactly as they do when placing an order. */}
      {editingOrder && (
        <div className="px-4 py-2.5 bg-[#E4002B]/15 border-b border-[#E4002B]/40 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <p className="font-heading text-[10px] tracking-widest text-[#E4002B]">
              EDITING ORDER #{orderNum(editingOrder.order_number)}
            </p>
            <p className="font-heading text-[10px] tracking-wider text-white/60 truncate">
              Originally {formatPKR(editingOrder.total)} · add, remove or change anything below
            </p>
          </div>
          <button
            onClick={cancelEditingOrder}
            className="font-heading text-[10px] tracking-widest text-white/50 hover:text-white flex-shrink-0"
            title="Discard these changes"
          >
            ✕
          </button>
        </div>
      )}

      {/* Order type and customer details */}
      <div className="px-4 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex gap-1.5">
          {([
            { value: 'dine-in',  label: '🍽 DINE IN'  },
            { value: 'takeaway', label: '🥡 TAKEAWAY' },
            { value: 'delivery', label: '🛵 DELIVERY' },
          ] as const).map(t => (
            <button
              key={t.value}
              onClick={() => setOrderType(t.value)}
              className={`flex-1 font-heading text-[10px] tracking-widest py-2.5 rounded-sm border transition-colors duration-100 ${
                orderType === t.value
                  ? 'bg-[#E4002B] border-[#E4002B] text-white'
                  : 'border-white/10 text-white hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Phone number — takeaway and delivery only; dine-in is served at the table */}
        {orderType !== 'dine-in' && (
        <div className="mt-2">
          <div className="relative">
            <input
              value={phone}
              onChange={e => handlePhoneChange(e.target.value)}
              placeholder="03XX-XXXXXXX (required)"
              maxLength={12}
              className={`w-full bg-[#1a1a1a] border px-3 py-2.5 text-sm text-white placeholder:text-white focus:outline-none rounded-sm font-body pr-16 ${
                phoneError ? 'border-[#E4002B]/60' : 'border-white/10 focus:border-[#E4002B]/40'
              }`}
            />
            {lookingUp && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-heading text-[9px] tracking-widest text-white animate-pulse">
                LOOKING…
              </span>
            )}
            {!lookingUp && isValidPakistaniPhone(normalizePhone(phone)) && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 text-sm">✓</span>
            )}
          </div>
          {phoneError && (
            <p className="font-heading text-[9px] tracking-wider text-[#E4002B] mt-1">{phoneError}</p>
          )}
        </div>
        )}

        <div className="flex gap-2 mt-2">
          {orderType === 'dine-in' ? (
            <input
              value={table}
              onChange={e => setTable(e.target.value)}
              placeholder="Table #"
              className="w-full bg-[#1a1a1a] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white focus:outline-none focus:border-[#E4002B]/40 rounded-sm font-body"
            />
          ) : (
            <input
              value={customer}
              onChange={e => setCustomer(e.target.value)}
              placeholder="Customer name"
              className="flex-1 bg-[#1a1a1a] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white focus:outline-none focus:border-[#E4002B]/40 rounded-sm font-body"
            />
          )}
        </div>

        {orderType === 'delivery' && (
          <div className="flex gap-2 mt-2">
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Delivery address…"
              className="flex-1 bg-[#1a1a1a] border border-[#E4002B]/30 px-3 py-2.5 text-sm text-white placeholder:text-white focus:outline-none focus:border-[#E4002B]/60 rounded-sm font-body"
            />
            <input
              value={rider}
              onChange={e => setRider(e.target.value)}
              placeholder="Rider name…"
              className="w-36 bg-[#1a1a1a] border border-blue-500/30 px-3 py-2.5 text-sm text-white placeholder:text-white focus:outline-none focus:border-blue-400/60 rounded-sm font-body"
            />
          </div>
        )}

        {/* Delivery charge and tip — custom amount only, side by side */}
        <div className="mt-2 flex items-center gap-4 flex-wrap">
          {orderType === 'delivery' && (
            <div className="flex items-center gap-2">
              <span className="font-heading text-[10px] tracking-widest text-white/50">DELIVERY</span>
              <input
                type="number"
                onWheel={blurOnWheel}
                min={0}
                value={deliveryFee}
                onChange={e => setDeliveryFee(e.target.value)}
                placeholder="Custom"
                className="w-24 bg-[#1a1a1a] border border-white/10 px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E4002B]/40 rounded-sm font-body"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="font-heading text-[10px] tracking-widest text-white/50">
              TIP {orderType === 'dine-in' ? '(AT TABLE)' : orderType === 'delivery' ? '(FOR RIDER)' : '(AT COUNTER)'}
            </span>
            <input
              type="number"
              onWheel={blurOnWheel}
              min={0}
              value={tipInput}
              onChange={e => setTipInput(e.target.value)}
              placeholder="Custom"
              className="w-24 bg-[#1a1a1a] border border-white/10 px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E4002B]/40 rounded-sm font-body"
            />
          </div>
        </div>

        {/* Past orders */}
        {pastOrders.length > 0 && (
          <div className="mt-2 border border-white/5 rounded-sm bg-[#0d0d0d]">
            <div className="px-3 py-1.5 border-b border-white/5">
              <span className="font-heading text-[9px] tracking-widest text-white">
                RETURNING CUSTOMER · {pastOrders.length} PREV ORDER{pastOrders.length !== 1 ? 'S' : ''}
              </span>
            </div>
            <div className="max-h-36 overflow-y-auto divide-y divide-white/5">
              {pastOrders.map(o => (
                <div key={o.id} className="px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-heading text-[10px] text-white">
                      #{orderNum(o.order_number)} · {new Date(o.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="font-heading text-[10px] text-white">{formatPKR(o.total)}</span>
                  </div>
                  <p className="font-body text-[10px] text-white leading-tight truncate">
                    {o.order_items.map(i => `${i.quantity}× ${i.item_name}`).join(', ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white gap-2 py-10">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            <span className="font-heading text-xs tracking-widest">CART EMPTY</span>
            <span className="text-[10px] text-white">Tap items to add</span>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {cart.map(line => (
              <div key={line.key} className="flex items-center gap-2 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-heading text-sm text-white truncate">{line.name}</p>
                  <p className="font-heading text-xs text-white">{formatPKR(line.price)} each</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => adjustQty(line.key, -1)}
                    className="w-8 h-8 rounded-sm bg-white/5 text-white active:bg-[#E4002B] active:text-white hover:bg-[#E4002B] hover:text-white font-heading text-base leading-none transition-colors"
                  >
                    −
                  </button>
                  <span className="font-heading text-sm text-white w-6 text-center">{line.quantity}</span>
                  <button
                    onClick={() => adjustQty(line.key, +1)}
                    className="w-8 h-8 rounded-sm bg-white/5 text-white active:bg-green-600 active:text-white hover:bg-green-600 hover:text-white font-heading text-base leading-none transition-colors"
                  >
                    +
                  </button>
                </div>
                <span className="font-heading text-xs text-white w-16 text-right flex-shrink-0">
                  {formatPKR(line.price * line.quantity)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="px-4 pb-2 border-t border-white/5 pt-3 flex-shrink-0">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Special notes…"
          rows={2}
          className="w-full bg-[#1a1a1a] border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white focus:outline-none focus:border-[#E4002B]/40 rounded-sm font-body resize-none"
        />
      </div>

      {/* Discount — not available while editing an existing order: the discount
          that produced its stored total isn't recorded on the order, so there
          is nothing to reconcile a new one against without recomputing the
          total from scratch and silently losing whatever discount was already
          applied at checkout. */}
      {cart.length > 0 && !editingOrder && (
        <div className="px-4 pb-3 border-t border-white/5 pt-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Type toggle */}
            <div className="flex rounded-sm overflow-hidden border border-white/10 flex-shrink-0">
              <button
                onClick={() => { setDiscountType('flat'); setDiscountValue(''); }}
                className={`font-heading text-[10px] tracking-widest px-2.5 py-1.5 transition-colors ${
                  discountType === 'flat' ? 'bg-[#E4002B] text-white' : 'text-white/40 hover:text-white'
                }`}
              >Rs</button>
              <button
                onClick={() => { setDiscountType('pct'); setDiscountValue(''); }}
                className={`font-heading text-[10px] tracking-widest px-2.5 py-1.5 transition-colors ${
                  discountType === 'pct' ? 'bg-[#E4002B] text-white' : 'text-white/40 hover:text-white'
                }`}
              >%</button>
            </div>
            {/* Input */}
            <input
              type="number" onWheel={blurOnWheel}
              min={0}
              max={discountType === 'pct' ? 100 : total}
              value={discountValue}
              onChange={e => setDiscountValue(e.target.value)}
              placeholder={discountType === 'pct' ? '% off' : 'Amount off'}
              className="flex-1 min-w-0 bg-[#1a1a1a] border border-white/10 focus:border-[#E4002B]/40 px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none rounded-sm font-heading tabular-nums"
            />
            {/* Quick flat amounts */}
            {discountType === 'flat' && (
              <div className="flex gap-1 flex-shrink-0">
                {[100, 200, 300].map(v => (
                  <button
                    key={v}
                    onClick={() => setDiscountValue(String(v))}
                    className={`font-heading text-[10px] tracking-widest px-2 py-1.5 rounded-sm border transition-colors ${
                      discountValue === String(v)
                        ? 'bg-white/10 border-white/30 text-white'
                        : 'border-white/10 text-white/40 hover:text-white hover:border-white/20'
                    }`}
                  >{v}</button>
                ))}
              </div>
            )}
            {/* Clear discount */}
            {discountValue && (
              <button
                onClick={() => setDiscountValue('')}
                className="font-heading text-[10px] text-white/30 hover:text-white/60 flex-shrink-0 transition-colors"
              >✕</button>
            )}
          </div>
          {discountAmount > 0 && (
            <div className="flex items-center justify-between mt-1.5">
              <span className="font-heading text-[10px] tracking-widest text-green-400/70">DISCOUNT</span>
              <span className="font-heading text-[10px] text-green-400">− {formatPKR(discountAmount)}</span>
            </div>
          )}
        </div>
      )}

      {/* Total + place order */}
      <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="font-heading text-xs tracking-widest text-white">
            {editingOrder ? 'NEW BILL' : 'TOTAL'}
          </span>
          <div className="text-right">
            {editingOrder && (
              <p className="font-heading text-[10px] text-white/40">
                was {formatPKR(editingOrder.total)}
              </p>
            )}
            {!editingOrder && discountAmount > 0 && (
              <p className="font-heading text-xs text-white/30 line-through">{formatPKR(total)}</p>
            )}
            <span className="font-heading text-2xl text-white">{formatPKR(afterDiscount)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {cart.length > 0 && !editingOrder && (
            <button
              onClick={clearCart}
              className="font-heading text-xs tracking-widest px-4 py-3.5 border border-white/10 text-white hover:text-white hover:border-white/30 rounded-sm transition-colors"
            >
              CLEAR
            </button>
          )}
          {editingOrder ? (
            <>
              <button
                onClick={cancelEditingOrder}
                className="font-heading text-xs tracking-widest px-4 py-3.5 border border-white/10 text-white hover:border-white/30 rounded-sm transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={saveOrderEdits}
                disabled={addingItems || !cart.length}
                className="flex-1 font-heading text-sm tracking-widest py-3.5 bg-[#E4002B] text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-sm transition-colors"
              >
                {addingItems ? 'SAVING…' : 'SAVE CHANGES'}
              </button>
            </>
          ) : (
            <button
              onClick={() => { if (cart.length) { setCashStep(false); setCashGiven(''); setPaymentModal(true); } }}
              disabled={!cart.length || placing}
              className="flex-1 font-heading text-sm tracking-widest py-3.5 bg-[#E4002B] text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-sm transition-colors"
            >
              PLACE ORDER
            </button>
          )}
        </div>
      </div>

      {/* Payment method popup */}
      {paymentModal && (() => {
        const given  = parseInt(cashGiven) || 0;
        const change = given - afterDiscount;
        // Quick-amount buttons: round up to common PKR notes
        const notes  = QUICK_CASH_NOTES.filter(n => n >= afterDiscount);
        // Also add exact and the next note above afterDiscount
        const quickAmounts = Array.from(new Set([
          afterDiscount,
          ...notes,
        ])).sort((a, b) => a - b).slice(0, 4);

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={() => !placing && (setCashStep(false), setCashGiven(''), setPaymentModal(false))}
          >
            <div
              className="bg-[#111] border border-white/10 rounded-sm w-full max-w-xs p-6"
              onClick={e => e.stopPropagation()}
            >
              {!cashStep ? (
                /* ── Step 1: choose method ── */
                <>
                  <p className="font-heading text-xs tracking-[0.3em] text-[#E4002B] mb-1">SELECT</p>
                  <h2 className="font-heading text-2xl text-white mb-1">PAYMENT METHOD</h2>
                  <p className="font-heading text-2xl text-white mb-5">{formatPKR(afterDiscount)}</p>

                  <div className="flex flex-col gap-2">
                    {([
                      { value: 'cash',      label: '💵 CASH',      sub: 'Paid at counter / table'                             },
                      { value: 'card',      label: '💳 CARD',      sub: `+1.5% service charge → ${formatPKR(cardTotal)}`      },
                      { value: 'pay_later', label: '🕐 PAY LATER', sub: 'Collect payment later'                               },
                    ] as { value: 'cash' | 'card' | 'pay_later'; label: string; sub: string }[]).map(p => (
                      <button
                        key={p.value}
                        disabled={placing}
                        onClick={async () => {
                          if (p.value === 'cash') {
                            setCashStep(true);
                            setCashGiven('');
                          } else {
                            await placeOrder(p.value);
                            setPaymentModal(false);
                            setCartOpen(false);
                          }
                        }}
                        className={`flex items-center gap-4 px-4 py-4 rounded-sm border transition-colors duration-100 text-left disabled:opacity-40 ${
                          p.value === 'pay_later'
                            ? 'border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 text-orange-300'
                            : 'border-white/10 bg-white/3 hover:bg-white/8 text-white'
                        }`}
                      >
                        <span className="text-2xl">{p.label.split(' ')[0]}</span>
                        <div>
                          <p className="font-heading text-sm tracking-widest">{p.label.split(' ').slice(1).join(' ')}</p>
                          <p className={`font-heading text-[10px] tracking-wider mt-0.5 ${p.value === 'card' ? 'text-yellow-400/70' : 'opacity-50'}`}>{p.sub}</p>
                        </div>
                        {p.value === 'card' && (
                          <span className="ml-auto font-heading text-sm text-yellow-400 flex-shrink-0">{formatPKR(cardTotal)}</span>
                        )}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setPaymentModal(false)}
                    className="mt-4 w-full font-heading text-xs tracking-widest py-3 border border-white/10 text-white/40 hover:text-white/70 rounded-sm transition-colors"
                  >
                    CANCEL
                  </button>
                </>
              ) : (
                /* ── Step 2: cash tendered + change ── */
                <>
                  <button
                    onClick={() => { setCashStep(false); setCashGiven(''); }}
                    className="font-heading text-[10px] tracking-widest text-white/40 hover:text-white/70 mb-4 flex items-center gap-1 transition-colors"
                  >
                    ← BACK
                  </button>

                  <p className="font-heading text-xs tracking-[0.3em] text-[#E4002B] mb-1">💵 CASH</p>
                  <div className="flex items-baseline justify-between mb-4">
                    <span className="font-heading text-xs tracking-widest text-white/50">TOTAL DUE</span>
                    <span className="font-heading text-3xl text-white">{formatPKR(afterDiscount)}</span>
                  </div>

                  {/* Quick amounts */}
                  <div className="flex gap-2 mb-3">
                    {quickAmounts.map(amt => (
                      <button
                        key={amt}
                        onClick={() => setCashGiven(String(amt))}
                        className={`flex-1 font-heading text-xs tracking-widest py-2 rounded-sm border transition-colors ${
                          given === amt
                            ? 'bg-white/10 border-white/30 text-white'
                            : 'border-white/10 text-white/50 hover:text-white hover:border-white/20'
                        }`}
                      >
                        {amt === afterDiscount ? 'EXACT' : `${(amt/1000).toFixed(amt % 1000 === 0 ? 0 : 1)}K`}
                      </button>
                    ))}
                  </div>

                  {/* Cash input */}
                  <input
                    autoFocus
                    type="number" onWheel={blurOnWheel}
                    min={afterDiscount}
                    value={cashGiven}
                    onChange={e => setCashGiven(e.target.value)}
                    placeholder={`Enter amount (min ${afterDiscount})`}
                    className="w-full bg-black/40 border border-white/20 focus:border-white/50 px-4 py-3 text-xl text-white font-heading placeholder:text-white/20 focus:outline-none rounded-sm mb-4 tabular-nums"
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && given >= afterDiscount) {
                        await placeOrder('cash'); // receipt pulses the drawer
                        setCashStep(false); setCashGiven('');
                        setPaymentModal(false); setCartOpen(false);
                      }
                    }}
                  />

                  {/* Change display */}
                  <div className={`rounded-sm px-4 py-4 mb-4 border transition-colors ${
                    given === 0
                      ? 'border-white/5 bg-white/3'
                      : given >= afterDiscount
                        ? 'border-green-500/30 bg-green-500/8'
                        : 'border-red-500/30 bg-red-500/5'
                  }`}>
                    {given === 0 ? (
                      <p className="font-heading text-xs tracking-widest text-white/30 text-center">ENTER CASH AMOUNT</p>
                    ) : given < afterDiscount ? (
                      <>
                        <p className="font-heading text-[10px] tracking-widest text-red-400 mb-0.5">SHORT BY</p>
                        <p className="font-heading text-3xl text-red-400">{formatPKR(afterDiscount - given)}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-heading text-[10px] tracking-widest text-green-400 mb-0.5">CHANGE TO RETURN</p>
                        <p className="font-heading text-4xl text-green-400">{formatPKR(change)}</p>
                      </>
                    )}
                  </div>

                  <button
                    disabled={given < afterDiscount || placing}
                    onClick={async () => {
                      await placeOrder('cash'); // receipt pulses the drawer
                      setCashStep(false); setCashGiven('');
                      setPaymentModal(false); setCartOpen(false);
                    }}
                    className="w-full font-heading text-sm tracking-widest py-4 bg-[#E4002B] text-white hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-sm transition-colors"
                  >
                    {placing ? 'PLACING…' : given >= afterDiscount ? `CONFIRM — CHANGE ${formatPKR(change)}` : 'ENTER AMOUNT'}
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Last order confirmation */}
      {lastOrder && (
        <div className="mx-4 mb-4 border border-green-500/30 bg-green-500/5 rounded-sm px-4 py-3 flex-shrink-0">
          <p className="font-heading text-xs tracking-widest text-green-400 mb-0.5">ORDER PLACED ✓</p>
          <p className="font-heading text-xs text-white">#{orderNum(lastOrder.order_number)} — {formatPKR(lastOrder.total)}</p>
          <div className="flex items-center gap-4 mt-2">
            {/* Opens the POS's own session panel. It used to link to
                /admin/orders/{id}, which a POS operator has no access to. */}
            <button
              onClick={() => setSessionOpen(true)}
              className="font-heading text-[10px] tracking-widest text-green-400/60 hover:text-green-400 transition-colors"
            >
              VIEW ORDER →
            </button>
            <button
              onClick={() => printReceipt()}
              className="font-heading text-[10px] tracking-widest text-white hover:text-white border border-white/10 hover:border-white/30 px-2 py-1 rounded-sm transition-colors"
            >
              🖨 PRINT
            </button>
            <button
              onClick={() => printKitchenDocket()}
              className="font-heading text-[10px] tracking-widest text-white hover:text-white border border-white/10 hover:border-white/30 px-2 py-1 rounded-sm transition-colors"
            >
              🍳 KITCHEN
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={`flex h-screen bg-[#0d0d0d] overflow-hidden ${resizingCart ? 'select-none cursor-col-resize' : ''}`}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#E4002B] text-white font-heading text-xs tracking-widest px-5 py-2.5 rounded-sm shadow-xl pointer-events-none">
          {toast}
        </div>
      )}

      {/* Log an expense — till cash spent mid-shift, without a trip to admin */}
      {showExpenseModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
          onClick={() => setShowExpenseModal(false)}
        >
          <div
            className="w-full max-w-sm bg-[#161616] border border-white/10 rounded-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-white/5">
              <p className="font-heading text-sm tracking-widest text-white">💸 LOG EXPENSE</p>
              <p className="text-[11px] text-white/40 mt-0.5">Cash spent from the till during this shift</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="font-heading text-[10px] tracking-widest text-white/50 block mb-1.5">CATEGORY</label>
                <select
                  value={expenseCategory}
                  onChange={e => setExpenseCategory(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#E4002B]/40 rounded-sm font-body"
                >
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="font-heading text-[10px] tracking-widest text-white/50 block mb-1.5">AMOUNT (PKR)</label>
                <input
                  type="number"
                  onWheel={blurOnWheel}
                  min={0}
                  value={expenseAmount}
                  onChange={e => setExpenseAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full bg-[#1a1a1a] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E4002B]/40 rounded-sm font-body"
                />
              </div>
              <div>
                <label className="font-heading text-[10px] tracking-widest text-white/50 block mb-1.5">
                  NOTE <span className="text-white/25 normal-case">(optional)</span>
                </label>
                <input
                  value={expenseNote}
                  onChange={e => setExpenseNote(e.target.value)}
                  placeholder="e.g. ice for the drinks fridge"
                  className="w-full bg-[#1a1a1a] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E4002B]/40 rounded-sm font-body"
                />
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setShowExpenseModal(false)}
                className="font-heading text-xs tracking-widest px-5 py-2.5 border border-white/10 text-white/60 hover:text-white rounded-sm transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={submitExpense}
                disabled={savingExpense || !expenseAmount}
                className="flex-1 font-heading text-xs tracking-widest py-2.5 bg-[#E4002B] text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-sm transition-colors"
              >
                {savingExpense ? 'SAVING…' : 'SAVE EXPENSE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session report — this shift's totals, without leaving the POS */}
      {showSessionReport && (() => {
        const active   = sessionOrders.filter(o => !o.cancelled);
        const paid     = active.filter(o => o.paymentStatus === 'paid');
        const unpaid   = active.filter(o => o.paymentStatus === 'pending');
        const cashPaid = paid.filter(o => o.payment === 'cash').reduce((s, o) => s + o.total, 0);
        const cardPaid = paid.filter(o => o.payment === 'card').reduce((s, o) => s + o.total, 0);
        const grossRevenue = paid.reduce((s, o) => s + o.total, 0);
        const unpaidTotal  = unpaid.reduce((s, o) => s + o.total, 0);
        const tipsTotal    = active.reduce((s, o) => s + (o.tipAmount ?? 0), 0);
        const deliveryTotal = active.reduce((s, o) => s + (o.deliveryCharge ?? 0), 0);
        const cancelledCount = sessionOrders.length - active.length;
        const expenseTotal = sessionExpenses.reduce((s, e) => s + e.amount, 0);

        return (
          <div
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
            onClick={() => setShowSessionReport(false)}
          >
            <div
              className="w-full max-w-md bg-[#161616] border border-white/10 rounded-sm max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-white/5 flex items-start justify-between gap-3">
                <div>
                  <p className="font-heading text-sm tracking-widest text-white">📊 SESSION REPORT</p>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    {staffName}
                    {sessionStartedAt && (
                      <> · since {new Date(sessionStartedAt).toLocaleString('en-PK', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</>
                    )}
                  </p>
                </div>
                <button onClick={() => setShowSessionReport(false)} className="text-white/40 hover:text-white text-sm flex-shrink-0">✕</button>
              </div>

              <div className="p-5 space-y-5">
                {/* Headline */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-white/10 rounded-sm px-4 py-3">
                    <p className="font-heading text-[10px] tracking-widest text-white/40">ORDERS</p>
                    <p className="font-heading text-2xl text-white">{active.length}</p>
                    {cancelledCount > 0 && <p className="text-[10px] text-white/30">{cancelledCount} cancelled</p>}
                  </div>
                  <div className="border border-green-500/20 bg-green-500/5 rounded-sm px-4 py-3">
                    <p className="font-heading text-[10px] tracking-widest text-green-400/70">REVENUE</p>
                    <p className="font-heading text-2xl text-green-400">{formatPKR(grossRevenue)}</p>
                    {unpaid.length > 0 && <p className="text-[10px] text-orange-400/80">+ {formatPKR(unpaidTotal)} pay later</p>}
                  </div>
                </div>

                {/* Payment breakdown */}
                <div>
                  <p className="font-heading text-[10px] tracking-widest text-white/40 mb-2">PAYMENT METHOD</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-white/60">Cash</span><span className="text-white">{formatPKR(cashPaid)}</span></div>
                    <div className="flex justify-between"><span className="text-white/60">Card</span><span className="text-white">{formatPKR(cardPaid)}</span></div>
                    <div className="flex justify-between"><span className="text-orange-400/80">Pay later (unpaid)</span><span className="text-orange-400">{formatPKR(unpaidTotal)}</span></div>
                    {tipsTotal > 0 && <div className="flex justify-between"><span className="text-white/60">Tips collected</span><span className="text-white">{formatPKR(tipsTotal)}</span></div>}
                    {deliveryTotal > 0 && <div className="flex justify-between"><span className="text-white/60">Delivery charges</span><span className="text-white">{formatPKR(deliveryTotal)}</span></div>}
                  </div>
                </div>

                {/* Expenses logged this shift */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-heading text-[10px] tracking-widest text-white/40">EXPENSES THIS SHIFT</p>
                    <span className="font-heading text-xs text-orange-400">− {formatPKR(expenseTotal)}</span>
                  </div>
                  {sessionExpenses.length === 0 ? (
                    <p className="text-[11px] text-white/30">None logged yet</p>
                  ) : (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {sessionExpenses.map(e => (
                        <div key={e.id} className="flex justify-between gap-2 text-[11px]">
                          <span className="text-white/60 truncate">{e.category}{e.description ? ` — ${e.description}` : ''}</span>
                          <span className="text-white flex-shrink-0">{formatPKR(e.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-5 pb-5">
                <button
                  onClick={() => { setShowSessionReport(false); setShowExpenseModal(true); }}
                  className="w-full font-heading text-xs tracking-widest py-2.5 border border-white/10 text-white/60 hover:text-white hover:border-white/30 rounded-sm transition-colors"
                >
                  + LOG AN EXPENSE
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bill preview — the printed receipt on screen, for checking an order
          without spending paper */}
      {viewingBill && (() => {
        const b        = viewingBill;
        const subtotal = b.items.reduce((s, l) => s + l.price * l.quantity, 0);
        const isUnpaid = b.paymentStatus === 'pending';
        return (
          <div
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
            onClick={() => setViewingBill(null)}
          >
            <div
              className="w-full max-w-sm bg-white text-black rounded-sm max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 py-5 font-mono text-[13px] leading-snug">
                <div className="text-center mb-3">
                  <p className="text-xl font-bold tracking-[0.3em]">TNB</p>
                  <p className="text-sm font-bold tracking-widest">THE NOOK BITE</p>
                  <p className="text-[11px]">Mandi Bahauddin, Punjab</p>
                  <p className="text-[11px]">12 PM – 2 AM Daily · Tel: 0327-9627442</p>
                </div>

                <div className="border-t border-dashed border-black/40 my-2" />

                {([
                  ['Order #', `#${orderNum(b.order_number)}`],
                  ['Date', b.placedAt.toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })],
                  ['Time', b.placedAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })],
                  ['Type', b.orderType === 'dine-in' ? `DINE-IN${b.table ? ` · TABLE ${b.table}` : ''}` : b.orderType.toUpperCase()],
                  ...(b.address ? [['Address', b.address]] : []),
                  ...(b.rider ? [['Rider', b.rider]] : []),
                  ['Customer', b.customerName],
                  ...(b.phone ? [['Phone', b.phone]] : []),
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 text-[11px]">
                    <span>{k}</span>
                    <span className="text-right break-words">{v}</span>
                  </div>
                ))}

                <div className="border-t border-dashed border-black/40 my-2" />

                <div className="flex justify-between text-[11px] font-bold mb-1">
                  <span>ITEM</span><span>QTY  AMOUNT</span>
                </div>
                {b.items.map((l, i) => (
                  <div key={l.orderItemId ?? i} className="flex justify-between gap-3 text-[12px]">
                    <span className="flex-1">{l.name}</span>
                    <span className="whitespace-nowrap">×{l.quantity}  Rs.{(l.price * l.quantity).toLocaleString()}</span>
                  </div>
                ))}

                <div className="border-t border-dashed border-black/40 my-2" />

                <div className="flex justify-between text-[11px]">
                  <span>Subtotal ({b.items.reduce((n, l) => n + l.quantity, 0)} items)</span>
                  <span>Rs.{subtotal.toLocaleString()}</span>
                </div>
                {!!b.discountAmount && b.discountAmount > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span>Discount</span><span>− Rs.{b.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                {!!b.deliveryCharge && b.deliveryCharge > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span>Delivery Charge</span><span>Rs.{b.deliveryCharge.toLocaleString()}</span>
                  </div>
                )}
                {!!b.tipAmount && b.tipAmount > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span>Tip</span><span>Rs.{b.tipAmount.toLocaleString()}</span>
                  </div>
                )}

                <div className="border-t border-black my-2" />

                <div className="flex justify-between text-base font-bold">
                  <span>TOTAL</span><span>Rs.{b.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Payment</span>
                  <span className="font-bold">{isUnpaid ? 'PAY LATER' : b.payment.toUpperCase()}</span>
                </div>
                {!!b.cashGiven && (
                  <>
                    <div className="flex justify-between text-[11px]">
                      <span>Cash Received</span><span>Rs.{b.cashGiven.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span>CHANGE</span><span>Rs.{(b.changeDue ?? 0).toLocaleString()}</span>
                    </div>
                  </>
                )}

                <div className={`mt-3 border-2 text-center py-1.5 text-[12px] font-bold tracking-widest ${
                  b.cancelled ? 'border-red-600 text-red-600' : isUnpaid ? 'border-orange-600 text-orange-600' : 'border-black'
                }`}>
                  {b.cancelled ? 'CANCELLED' : isUnpaid ? 'UNPAID — PAY LATER' : `✓ PAID — ${b.payment.toUpperCase()}`}
                </div>

                {b.notes && <p className="text-[11px] mt-2">Note: {b.notes}</p>}
              </div>

              <div className="flex gap-2 px-5 pb-5">
                <button
                  onClick={() => { printReceipt(b); setViewingBill(null); }}
                  className="flex-1 font-heading text-xs tracking-widest py-2.5 bg-[#E4002B] text-white hover:bg-red-700 rounded-sm transition-colors"
                >
                  🖨 PRINT
                </button>
                <button
                  onClick={() => setViewingBill(null)}
                  className="font-heading text-xs tracking-widest px-5 py-2.5 border border-black/20 text-black/60 hover:text-black rounded-sm transition-colors"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Cash drawer notification */}
      {drawerStatus === 'opened' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-700 text-white font-heading text-xs tracking-widest px-5 py-2.5 rounded-sm shadow-xl pointer-events-none flex items-center gap-2">
          <span className="text-base">🗄️</span> CASH DRAWER OPENED
        </div>
      )}
      {drawerStatus === 'not-paired' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-orange-600 text-white font-heading text-xs tracking-widest px-5 py-2.5 rounded-sm shadow-xl flex items-center gap-2">
          <span className="text-base">🔗</span> NO PRINTER PAIRED — CLICK PAIR PRINTER FIRST
        </div>
      )}
      {drawerStatus === 'no-serial' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-orange-600 text-white font-heading text-xs tracking-widest px-5 py-2.5 rounded-sm shadow-xl flex items-center gap-2">
          <span className="text-base">⚠</span> THIS BROWSER CAN&apos;T REACH THE DRAWER — USE CHROME OR EDGE
        </div>
      )}
      {drawerStatus === 'error' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-orange-600 text-white font-heading text-xs tracking-widest px-5 py-2.5 rounded-sm shadow-xl pointer-events-none flex items-center gap-2">
          <span className="text-base">⚠</span> DRAWER ERROR — CHECK PRINTER
        </div>
      )}

      {/* Offline banner */}
      {!isOnline && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-orange-600 text-white font-heading text-xs tracking-widest px-4 py-2.5 text-center flex items-center justify-center gap-2">
          <span>⚡</span> NO INTERNET — ORDERS WILL BE SAVED AND SYNCED WHEN RECONNECTED
        </div>
      )}

      {/* ── LEFT: Menu panel ─────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 border-r border-white/5">

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#111] border-b border-white/5 flex-shrink-0">
          <div className="bg-[#E4002B] text-white font-heading text-xs px-2.5 py-1 tracking-wider">TNB</div>
          <span className="font-heading text-white text-xs tracking-[0.3em] hidden sm:inline">POS TERMINAL</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="font-heading text-[10px] tracking-widest text-white hidden sm:inline">
              {new Date().toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-heading text-[10px] tracking-widest text-white uppercase">{staffName}</span>
              <span className="font-heading text-[9px] px-1.5 py-0.5 border border-white/10 text-white rounded-sm uppercase hidden sm:inline">{staffRole}</span>
            </div>
            {!drawerPaired && (
              <button
                onClick={pairPrinter}
                className="font-heading text-[9px] tracking-widest text-white/30 hover:text-white/60 transition-colors border border-white/5 hover:border-white/15 px-2 py-1 rounded-sm hidden sm:inline-flex items-center gap-1"
                title="Pair printer for cash drawer (one-time setup)"
              >
                🔗 PAIR PRINTER
              </button>
            )}
            {drawerPaired && (
              <button
                onClick={() => printDensityTest()}
                className="font-heading text-[9px] tracking-widest text-white/30 hover:text-white/60 transition-colors border border-white/5 hover:border-white/15 px-2 py-1 rounded-sm hidden sm:inline-flex items-center gap-1"
                title="Print a strip comparing darkness commands, to find which one this printer honours"
              >
                🌡 DENSITY TEST
              </button>
            )}
            {printPath !== 'none' && (
              <span
                className={`font-heading text-[9px] tracking-widest px-2 py-1 rounded-sm border hidden sm:inline-flex items-center gap-1 ${
                  printPath === 'usb'
                    ? 'border-green-500/30 text-green-400'
                    : 'border-orange-500/40 text-orange-400'
                }`}
                title={printPath === 'usb'
                  ? 'Last receipt went straight to the printer over USB'
                  : 'Last receipt went through the Windows print dialog — the drawer button cannot work on this path'}
              >
                {printPath === 'usb' ? '✓ USB PRINT' : '⚠ WINDOWS PRINT'}
              </span>
            )}
            <button
              onClick={openCashDrawer}
              className="font-heading text-[10px] tracking-widest text-white/60 hover:text-green-400 transition-colors border border-white/10 hover:border-green-500/40 px-2.5 py-1 rounded-sm hidden sm:inline-flex items-center gap-1"
              title="Open cash drawer"
            >
              🗄️ DRAWER
            </button>
            <button
              onClick={() => setShowExpenseModal(true)}
              className="font-heading text-[10px] tracking-widest text-white/60 hover:text-orange-400 transition-colors border border-white/10 hover:border-orange-500/40 px-2.5 py-1 rounded-sm hidden sm:inline-flex items-center gap-1"
              title="Record cash spent during this shift"
            >
              💸 EXPENSE
            </button>
            <button
              onClick={openSessionReport}
              className="font-heading text-[10px] tracking-widest text-white/60 hover:text-white transition-colors border border-white/10 hover:border-white/30 px-2.5 py-1 rounded-sm hidden sm:inline-flex items-center gap-1"
              title="This shift's totals, without leaving the POS"
            >
              📊 REPORT
            </button>
            <button
              onClick={() => setSessionOpen(true)}
              className="relative font-heading text-[10px] tracking-widest text-white hover:text-white transition-colors border border-white/10 hover:border-white/30 px-2.5 py-1 rounded-sm"
            >
              SESSION
              {sessionOrders.filter(o => o.paymentStatus === 'pending').length > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[9px] font-heading w-4 h-4 rounded-full flex items-center justify-center leading-none">
                  {sessionOrders.filter(o => o.paymentStatus === 'pending').length}
                </span>
              ) : sessionOrders.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#E4002B] text-white text-[9px] font-heading w-4 h-4 rounded-full flex items-center justify-center leading-none">
                  {sessionOrders.length}
                </span>
              )}
            </button>
            <button
              onClick={async () => {
                // Close every open session for this operator, not just the id
                // this tab happens to hold
                await fetch('/api/pos/session/close', { method: 'POST' }).catch(() => {});
                await createClient().auth.signOut();
                window.location.href = '/pos/login';
              }}
              className="font-heading text-[10px] tracking-widest text-white hover:text-white transition-colors"
            >
              SIGN OUT
            </button>
            {/* Mobile: cart button in header */}
            <button
              onClick={() => setCartOpen(true)}
              className="md:hidden relative font-heading text-[10px] tracking-widest px-3 py-1.5 bg-[#E4002B] text-white rounded-sm"
            >
              🛒
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-white text-[#E4002B] text-[9px] font-heading w-4 h-4 rounded-full flex items-center justify-center leading-none">
                  {cart.reduce((s, l) => s + l.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search + category bar */}
        <div className="px-4 py-3 bg-[#111] border-b border-white/5 flex-shrink-0 space-y-2">
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items…"
            className="w-full bg-[#1a1a1a] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white focus:outline-none focus:border-[#E4002B]/40 rounded-sm font-body"
          />
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            {['All', ...categories].map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`flex-shrink-0 font-heading text-[10px] tracking-widest px-3 py-2 rounded-sm border transition-colors duration-100 ${
                  category === cat
                    ? 'bg-[#E4002B] border-[#E4002B] text-white'
                    : 'border-white/10 text-white hover:text-white hover:border-white/30'
                }`}
              >
                {cat === 'Pizza Regular v1' ? 'PIZZA REG' : cat.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Item grid */}
        <div className="flex-1 overflow-y-auto p-3 pb-24 md:pb-3">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-white font-heading text-xs tracking-widest">
              NO ITEMS FOUND
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {filtered.map(card => (
                <POSCard key={cardKey(card)} card={card} onAdd={addLine} />
              ))}
            </div>
          )}
        </div>

        {/* Mobile sticky cart bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#111] border-t border-white/10 px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="font-heading text-xs text-white tracking-widest">
              {cart.length === 0 ? 'CART EMPTY' : `${cart.reduce((s, l) => s + l.quantity, 0)} ITEM${cart.reduce((s, l) => s + l.quantity, 0) !== 1 ? 'S' : ''}`}
            </p>
            {cart.length > 0 && <p className="font-heading text-lg text-white">{formatPKR(total)}</p>}
          </div>
          <button
            onClick={() => setCartOpen(true)}
            className={`font-heading text-sm tracking-widest px-6 py-3 rounded-sm transition-colors ${
              cart.length > 0
                ? 'bg-[#E4002B] text-white hover:bg-red-700'
                : 'bg-white/5 text-white cursor-default'
            }`}
            disabled={cart.length === 0}
          >
            VIEW CART →
          </button>
        </div>
      </div>

      {/* ── Divider: drag to resize the cart panel ───────────────────── */}
      <div
        onPointerDown={(e) => { e.preventDefault(); setResizingCart(true); }}
        className="hidden md:block w-1.5 flex-shrink-0 cursor-col-resize bg-white/5 hover:bg-[#E4002B]/50 active:bg-[#E4002B]/70 transition-colors"
        title="Drag to resize"
      />

      {/* ── Desktop: cart sidebar ─────────────────────────────────────── */}
      <div className="hidden md:flex flex-col flex-shrink-0" style={{ width: cartWidth }}>
        {cartPanel}
      </div>

      {/* ── Mobile: cart bottom sheet ─────────────────────────────────── */}
      {cartOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/70"
            onClick={() => setCartOpen(false)}
          />
          {/* Sheet */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#111] rounded-t-xl overflow-hidden flex flex-col"
            style={{ maxHeight: '92dvh' }}>
            {/* Sheet handle + close */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-heading text-sm tracking-widest text-white">CART</span>
                {cart.length > 0 && (
                  <span className="font-heading text-[10px] px-2 py-0.5 bg-[#E4002B] text-white rounded-sm">
                    {cart.reduce((s, l) => s + l.quantity, 0)}
                  </span>
                )}
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="font-heading text-xs text-white hover:text-white px-3 py-1.5 border border-white/10 rounded-sm transition-colors"
              >
                CLOSE ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {cartPanel}
            </div>
          </div>
        </>
      )}

      {/* ── Session orders slide-over ──────────────────────────────────── */}
      {sessionOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70"
            onClick={() => setSessionOpen(false)}
          />
          <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm bg-[#111] border-l border-white/10 flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
              <div>
                <p className="font-heading text-xs tracking-[0.3em] text-[#E4002B] mb-0.5">CASHIER HISTORY</p>
                <p className="font-heading text-lg text-white">SESSION ORDERS</p>
              </div>
              <button
                onClick={() => setSessionOpen(false)}
                className="font-heading text-xs text-white hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded-sm transition-colors"
              >
                CLOSE ✕
              </button>
            </div>

            {/* Summary bar */}
            {sessionOrders.length > 0 && (() => {
              const unpaidOrders = sessionOrders.filter(o => !o.cancelled && o.paymentStatus === 'pending');
              const cashTotal = sessionOrders
                .filter(o => !o.cancelled && o.paymentStatus === 'paid' && o.payment === 'cash')
                .reduce((s, o) => s + o.total, 0);
              return (
                <div className="border-b border-white/5 flex-shrink-0">
                  <div className="px-5 py-3 flex items-center justify-between bg-white/[0.02]">
                    <div>
                      <p className="font-heading text-[10px] tracking-widest text-white">{sessionOrders.filter(o => !o.cancelled).length} ORDER{sessionOrders.filter(o => !o.cancelled).length !== 1 ? 'S' : ''} THIS SESSION</p>
                      <p className="font-heading text-xl text-white mt-0.5">
                        {formatPKR(sessionOrders.filter(o => !o.cancelled).reduce((s, o) => s + o.total, 0))}
                      </p>
                    </div>
                    <div className="text-right">
                      {unpaidOrders.length > 0 && (
                        <p className="font-heading text-[10px] tracking-widest text-orange-400 mb-1">
                          {unpaidOrders.length} UNPAID
                        </p>
                      )}
                      <p className="font-heading text-[10px] tracking-widest text-white">{staffName}</p>
                    </div>
                  </div>
                  {/* Cash in drawer */}
                  <div className="px-5 py-2.5 flex items-center justify-between bg-green-500/5 border-t border-green-500/10">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🗄️</span>
                      <p className="font-heading text-[10px] tracking-widest text-green-400">CASH IN DRAWER</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-heading text-base text-green-400">{formatPKR(cashTotal)}</p>
                      <button
                        onClick={openCashDrawer}
                        className="font-heading text-[9px] tracking-widest px-2 py-1 border border-green-500/30 text-green-400/70 hover:text-green-400 hover:border-green-500/60 rounded-sm transition-colors"
                      >
                        OPEN
                      </button>
                    </div>
                  </div>
                  {/* Tabs */}
                  <div className="flex border-t border-white/5">
                    {(['all', 'unpaid'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setSessionTab(tab)}
                        className={`flex-1 font-heading text-[10px] tracking-widest py-2 transition-colors ${
                          sessionTab === tab
                            ? tab === 'unpaid' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-white border-b-2 border-white'
                            : 'text-white'
                        }`}
                      >
                        {tab === 'all' ? `ALL (${sessionOrders.length})` : `UNPAID (${unpaidOrders.length})`}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Order list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {sessionOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-white gap-2">
                  <span className="font-heading text-3xl">◎</span>
                  <span className="font-heading text-xs tracking-widest">NO ORDERS YET THIS SESSION</span>
                </div>
              ) : (() => {
                const visible = sessionTab === 'unpaid'
                  ? sessionOrders.filter(o => o.paymentStatus === 'pending')
                  : sessionOrders;
                if (visible.length === 0) return (
                  <div className="flex flex-col items-center justify-center h-full text-white gap-2">
                    <span className="font-heading text-3xl text-green-400">✓</span>
                    <span className="font-heading text-xs tracking-widest text-green-400">ALL ORDERS PAID</span>
                  </div>
                );
                return (
                  <div className="divide-y divide-white/5">
                    {visible.map((o, idx) => (
                      <div key={o.id} className={`px-5 py-4 ${o.cancelled ? 'bg-red-500/5 opacity-60' : o.paymentStatus === 'pending' ? 'bg-orange-500/5' : ''}`}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-heading text-sm text-white">#{orderNum(o.order_number)}</span>
                              <span className="font-heading text-[10px] px-1.5 py-0.5 border border-white/10 text-white rounded-sm">
                                {o.orderType === 'dine-in' ? (o.table ? `TABLE ${o.table}` : 'DINE-IN') : o.orderType === 'delivery' ? 'DELIVERY' : 'TAKEAWAY'}
                              </span>
                              {o.cancelled ? (
                                <span className="font-heading text-[9px] px-1.5 py-0.5 bg-red-500/20 border border-red-500/40 text-red-400 rounded-sm">CANCELLED</span>
                              ) : o.paymentStatus === 'pending' ? (
                                <span className="font-heading text-[9px] px-1.5 py-0.5 bg-orange-500/20 border border-orange-500/40 text-orange-400 rounded-sm">UNPAID</span>
                              ) : (
                                idx === 0 && sessionTab === 'all' && (
                                  <span className="font-heading text-[9px] px-1.5 py-0.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-sm">LATEST</span>
                                )
                              )}
                            </div>
                            <p className="font-heading text-xs text-white tracking-wider">
                              {o.customerName} · {o.placedAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-heading text-sm text-white">{formatPKR(o.total)}</p>
                            <p className={`font-heading text-[10px] ${o.paymentStatus === 'pending' ? 'text-orange-400' : 'text-white'}`}>
                              {o.paymentStatus === 'pending' ? 'PAY LATER' : o.payment.toUpperCase()}
                            </p>
                          </div>
                        </div>
                        {/* Items */}
                        <div className="mb-3 space-y-0.5">
                          {o.items.map((item, i) => (
                            <p key={item.orderItemId ?? i} className="font-body text-xs text-white">
                              {item.quantity}× {item.name} <span className="text-white">— {formatPKR(item.price * item.quantity)}</span>
                            </p>
                          ))}
                        </div>
                        {/* Actions */}
                        <div className="flex gap-2 flex-wrap">
                          {!o.cancelled && o.paymentStatus === 'pending' && settleId !== o.id && (
                            <button
                              onClick={() => setSettleId(o.id)}
                              className="font-heading text-[10px] tracking-widest text-orange-400 border border-orange-500/40 hover:bg-orange-500/10 px-3 py-1.5 rounded-sm transition-colors"
                            >
                              💰 SETTLE PAYMENT
                            </button>
                          )}
                          {!o.cancelled && o.paymentStatus === 'pending' && settleId !== o.id && (
                            <button
                              onClick={() => startEditingOrder(o)}
                              className="font-heading text-[10px] tracking-widest text-white border border-white/20 hover:bg-white/5 hover:border-white/40 px-3 py-1.5 rounded-sm transition-colors"
                            >
                              ✎ EDIT ORDER
                            </button>
                          )}
                          {!o.cancelled && settleId === o.id && (
                            <div className="flex gap-1.5 items-center flex-wrap">
                              <span className="font-heading text-[9px] text-white tracking-widest">PAID BY:</span>
                              <button
                                onClick={() => settleOrder(o.id, 'cash')}
                                disabled={settling}
                                className="font-heading text-[10px] tracking-widest px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-sm disabled:opacity-50 transition-colors"
                              >
                                {settling ? '…' : '💵 CASH'}
                              </button>
                              <button
                                onClick={() => settleOrder(o.id, 'card')}
                                disabled={settling}
                                className="font-heading text-[10px] tracking-widest px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-sm disabled:opacity-50 transition-colors"
                              >
                                {settling ? '…' : '💳 CARD'}
                              </button>
                              <button
                                onClick={() => setSettleId(null)}
                                className="font-heading text-[10px] text-white px-2 py-1.5 border border-white/10 rounded-sm"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                          <button
                            onClick={() => printReceipt(o)}
                            className="font-heading text-[10px] tracking-widest text-white hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded-sm transition-colors"
                          >
                            🖨 {o.paymentStatus === 'pending' ? 'PRINT SLIP' : 'REPRINT'}
                          </button>
                          <button
                            onClick={() => setViewingBill(o)}
                            className="font-heading text-[10px] tracking-widest text-white hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded-sm transition-colors"
                          >
                            🧾 VIEW BILL
                          </button>
                          <button
                            onClick={() => printKitchenDocket(o)}
                            className="font-heading text-[10px] tracking-widest text-white hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded-sm transition-colors"
                          >
                            🍳 KITCHEN
                          </button>
                          {!o.cancelled && cancelId !== o.id ? (
                            <button
                              onClick={() => { setCancelId(o.id); setSettleId(null); }}
                              className="font-heading text-[10px] tracking-widest text-red-400/60 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 px-3 py-1.5 rounded-sm transition-colors"
                            >
                              ✕ CANCEL
                            </button>
                          ) : (
                            <div className="flex gap-1.5 items-center flex-wrap">
                              <span className="font-heading text-[9px] text-red-400 tracking-widest">CANCEL ORDER?</span>
                              <button
                                onClick={() => cancelOrderPos(o.id)}
                                disabled={cancelling}
                                className="font-heading text-[10px] tracking-widest px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-sm disabled:opacity-50 transition-colors"
                              >
                                {cancelling ? '…' : 'YES'}
                              </button>
                              <button
                                onClick={() => setCancelId(null)}
                                className="font-heading text-[10px] text-white px-2 py-1.5 border border-white/10 rounded-sm"
                              >
                                NO
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── POS Card ─────────────────────────────────────────────────────────────────
function POSCard({ card, onAdd }: {
  card: MenuCard;
  onAdd: (line: Omit<CartLine, 'quantity'>) => void;
}) {
  const [sizeIdx, setSizeIdx]   = useState(0);
  const [variantIdx, setVariantIdx] = useState(0);

  function getLine(): Omit<CartLine, 'quantity'> {
    if (card.kind === 'pizza') {
      const s = card.sizes[sizeIdx];
      return { key: s.sku, name: `${card.name} (${s.label})`, price: s.price, menu_item_id: card.base.id };
    }
    if (card.kind === 'burger') {
      const v = card.variants[variantIdx];
      return { key: v.sku, name: `${card.name} (${v.label})`, price: v.price, menu_item_id: card.base.id };
    }
    return { key: card.item.sku, name: card.name, price: card.item.price, menu_item_id: card.item.id };
  }

  const currentPrice = card.kind === 'pizza'
    ? card.sizes[sizeIdx]?.price
    : card.kind === 'burger'
    ? card.variants[variantIdx]?.price
    : card.item.price;

  const img = cardImage(card);

  return (
    <div className="bg-[#1a1a1a] border border-white/5 rounded-sm overflow-hidden hover:border-[#E4002B]/40 transition-colors group flex flex-col">
      {/* Image */}
      <div
        className="relative aspect-[4/3] overflow-hidden cursor-pointer"
        onClick={() => onAdd(getLine())}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={card.name}
          className="w-full h-full object-cover brightness-75 group-hover:brightness-90 transition-all duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span className="bg-[#E4002B] text-white font-heading text-xs tracking-widest px-3 py-1.5">
            + ADD
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-2 flex flex-col gap-1.5 flex-1">
        <p className="font-heading text-xs text-white leading-tight truncate">{card.name}</p>

        {/* Size picker for pizzas */}
        {card.kind === 'pizza' && (
          <div className="flex gap-1 flex-wrap">
            {card.sizes.map((s, i) => (
              <button
                key={s.sku}
                onClick={() => setSizeIdx(i)}
                className={`font-heading text-[9px] tracking-wider px-2 py-1 rounded-sm border transition-colors ${
                  i === sizeIdx
                    ? 'bg-[#E4002B] border-[#E4002B] text-white'
                    : 'border-white/10 text-white hover:border-white/30 hover:text-white'
                }`}
              >
                {s.size}
              </button>
            ))}
          </div>
        )}

        {/* Variant for burgers */}
        {card.kind === 'burger' && (
          <div className="flex gap-1">
            {card.variants.map((v, i) => (
              <button
                key={v.sku}
                onClick={() => setVariantIdx(i)}
                className={`font-heading text-[9px] tracking-wider px-2 py-1 rounded-sm border transition-colors ${
                  i === variantIdx
                    ? 'bg-[#E4002B] border-[#E4002B] text-white'
                    : 'border-white/10 text-white hover:border-white/30 hover:text-white'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-1">
          <span className="font-heading text-xs text-white">{formatPKR(currentPrice)}</span>
          <button
            onClick={() => onAdd(getLine())}
            className="bg-[#E4002B] text-white font-heading text-[10px] tracking-widest px-3 py-1.5 rounded-sm active:bg-red-700 hover:bg-red-700 transition-colors"
          >
            ADD
          </button>
        </div>
      </div>
    </div>
  );
}
