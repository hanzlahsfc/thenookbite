export type OrderType    = 'dine-in' | 'takeaway' | 'delivery';
export type PaymentMethod = 'cash' | 'card' | 'pay_later';

export interface CartLine {
  key: string;
  name: string;
  price: number;
  quantity: number;
  menu_item_id: string;
  /** Set only for lines read back from a placed order, so they can be removed. */
  orderItemId?: string;
}

export interface SessionOrder {
  id: string;
  order_number?: number | null;
  total: number;
  customerName: string;
  phone: string;
  table: string;
  address: string;
  rider: string;
  orderType: OrderType;
  payment: PaymentMethod;
  paymentStatus: 'paid' | 'pending';
  cancelled?: boolean;
  items: CartLine[];
  notes: string;
  placedAt: Date;
  discountAmount?: number;
  discountType?: 'pct' | 'flat';
  discountValue?: number;
  deliveryCharge?: number;
  tipAmount?: number;
  /** Cash handed over and change returned — printed on the bill for cash sales. */
  cashGiven?: number;
  changeDue?: number;
}

export interface PastOrder {
  id: string;
  order_number?: number | null;
  customer_name: string;
  total: number;
  status: string;
  created_at: string;
  order_items: { item_name: string; quantity: number; item_price: number }[];
}

export const QUICK_CASH_NOTES = [500, 1000, 2000, 5000]; // PKR denominations
export const CARD_SURCHARGE_RATE = 0.015;                 // 1.5% per bank agreement
