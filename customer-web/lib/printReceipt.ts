import { printReceiptUSB, type ReceiptData } from './serialPrinter';

export interface ReceiptOrder {
  id: string;
  order_number?: number | null;
  customer_name: string;
  customer_phone?: string | null;
  table_number?: string | null;
  delivery_address?: string | null;
  rider_name?: string | null;
  delivery_charge?: number | null;
  order_type?: string | null;
  payment_method: string;
  special_notes?: string | null;
  total: number;
  created_at: string;
  order_items: { item_name: string; item_price: number; quantity: number }[];
  cashier_name?: string | null;
}

export async function printOrderReceipt(order: ReceiptOrder): Promise<void> {
  const placedAt  = new Date(order.created_at);
  const dateStr   = placedAt.toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr   = placedAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const shortId   = order.order_number != null ? String(order.order_number) : '----';
  const orderType = order.order_type ?? 'dine-in';

  const typeLabel =
    orderType === 'delivery' ? 'DELIVERY' :
    orderType === 'takeaway' ? 'TAKEAWAY' :
    order.table_number       ? `DINE-IN · TABLE ${order.table_number}` : 'DINE-IN';

  const rows = order.order_items.map(i => `
    <tr>
      <td style="padding:4px 0 2px;font-size:12px;vertical-align:top;">${i.item_name}</td>
      <td style="padding:4px 0 2px;font-size:12px;text-align:center;white-space:nowrap;">×${i.quantity}</td>
      <td style="padding:4px 0 2px;font-size:12px;text-align:right;white-space:nowrap;">${i.item_price * i.quantity}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @page { size: 80mm auto portrait; margin: 4mm 3mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; width: 74mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; -webkit-font-smoothing: none; text-rendering: geometricPrecision; }
  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: bold; }
  .small  { font-size: 11px; }
  .divider { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; }
</style>
</head><body>
  <div class="center" style="margin-bottom:6px;">
    <img src="${window.location.origin}/logo-dark.png" alt="TNB" style="width:150px;height:auto;display:block;margin:0 auto 4px;" />
    <p class="bold" style="font-size:13px;letter-spacing:2px;">THE NOOK BITE</p>
    <p class="small" style="color:#000;">ORDER RECEIPT</p>
  </div>

  <hr class="divider" />

  <table>
    <tr><td class="small">Order</td><td class="small right bold">#${shortId}</td></tr>
    <tr><td class="small">Date</td><td class="small right">${dateStr}</td></tr>
    <tr><td class="small">Time</td><td class="small right">${timeStr}</td></tr>
    <tr><td class="small">Type</td><td class="small right">${typeLabel}</td></tr>
    ${order.delivery_address ? `<tr><td class="small">Address</td><td class="small right" style="max-width:120px;word-break:break-word;">${order.delivery_address}</td></tr>` : ''}
    ${order.rider_name ? `<tr><td class="small">Rider</td><td class="small right">${order.rider_name}</td></tr>` : ''}
    ${order.customer_name ? `<tr><td class="small">Customer</td><td class="small right">${order.customer_name}</td></tr>` : ''}
    ${order.customer_phone ? `<tr><td class="small">Phone</td><td class="small right">${order.customer_phone}</td></tr>` : ''}
    <tr><td class="small">Payment</td><td class="small right">${order.payment_method.toUpperCase()}</td></tr>
  </table>

  <hr class="divider" />

  <table>
    <thead>
      <tr>
        <th style="font-size:11px;text-align:left;padding-bottom:3px;">ITEM</th>
        <th style="font-size:11px;text-align:center;padding-bottom:3px;">QTY</th>
        <th style="font-size:11px;text-align:right;padding-bottom:3px;">PKR</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <hr class="divider" />

  <table>
    <tr>
      <td class="bold" style="font-size:14px;">TOTAL</td>
      <td class="bold right" style="font-size:14px;">Rs. ${order.total}</td>
    </tr>
  </table>

  ${order.special_notes ? `<hr class="divider" /><p class="small center" style="color:#000;">Note: ${order.special_notes}</p>` : ''}

  <hr class="divider" />
  <p class="center small" style="color:#000;margin-top:4px;">Thank you for your order!</p>
  <p class="center small" style="color:#000;">thenookbite.com</p>
  <br/><br/>
</body></html>`;

  // Direct ESC/POS to the paired thermal printer first — sharper and no dialog.
  // Falls back to the browser print dialog when no printer is paired.
  const usbData: ReceiptData = {
    orderNum: shortId,
    dateStr,
    timeStr,
    typeLabel,
    customerName: order.customer_name,
    phone: order.customer_phone,
    cashierName: order.cashier_name ?? 'Admin',
    items: order.order_items.map(i => ({ name: i.item_name, price: i.item_price, quantity: i.quantity })),
    subtotal: order.order_items.reduce((s, i) => s + i.item_price * i.quantity, 0),
    total: order.total,
    paymentMethod: order.payment_method,
    address: order.delivery_address,
    riderName: order.rider_name,
    deliveryCharge: order.delivery_charge ?? 0,
    isPaid: order.payment_method !== 'pay_later',
    notes: order.special_notes,
    openDrawer: order.payment_method === 'cash',
  };

  if (await printReceiptUSB(usbData)) return;

  const w = window.open('', '_blank', 'width=320,height=600');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 400);
}
