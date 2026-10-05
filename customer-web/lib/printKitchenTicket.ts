'use client';

import { printKitchenTicketUSB, type KitchenTicket } from './serialPrinter';

export interface KitchenOrder {
  order_number?: number | null;
  table_number: string | null;
  order_type: string | null;
  special_notes: string | null;
  created_at: string;
  order_items: { item_name: string; quantity: number }[];
}

function typeLabel(o: KitchenOrder): string {
  if (o.order_type === 'delivery') return 'DELIVERY';
  if (o.order_type === 'takeaway') return 'TAKEAWAY';
  return o.table_number ? `DINE-IN - TABLE ${o.table_number}` : 'DINE-IN';
}

/**
 * Kitchen docket — what to cook and nothing else: no branding, no prices, no
 * totals. Goes to the paired thermal printer; falls back to the browser dialog.
 */
export async function printKitchenTicket(order: KitchenOrder): Promise<void> {
  const timeStr = new Date(order.created_at).toLocaleTimeString('en-PK', {
    hour: '2-digit', minute: '2-digit',
  });
  const orderNum = order.order_number != null ? String(order.order_number) : '----';
  const label = typeLabel(order);

  const ticket: KitchenTicket = {
    orderNum,
    typeLabel: label,
    timeStr,
    items: order.order_items.map(i => ({ name: i.item_name, quantity: i.quantity })),
    notes: order.special_notes,
  };

  if (await printKitchenTicketUSB(ticket)) return;

  const rows = order.order_items.map(i => `
    <tr>
      <td style="font-size:20px;font-weight:bold;padding:6px 8px 6px 0;white-space:nowrap;vertical-align:top;">${i.quantity} x</td>
      <td style="font-size:20px;font-weight:bold;padding:6px 0;">${i.item_name}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Kitchen #${orderNum}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',Courier,monospace; width:80mm; padding:6mm 4mm 12mm;
         color:#000; background:#fff;
         -webkit-print-color-adjust:exact; print-color-adjust:exact;
         -webkit-font-smoothing:none; text-rendering:geometricPrecision; }
  .center { text-align:center; }
  .rule { border:none; border-top:2px solid #000; margin:8px 0; }
  table { width:100%; border-collapse:collapse; }
  @media print { @page { margin:0; size:80mm auto portrait; } }
</style>
</head><body>
  <div class="center">
    <div style="font-size:26px;font-weight:bold;letter-spacing:2px;">ORDER #${orderNum}</div>
    <div style="font-size:15px;font-weight:bold;margin-top:2px;">${label}</div>
    <div style="font-size:13px;margin-top:2px;">${timeStr}</div>
  </div>
  <hr class="rule" />
  <table>${rows}</table>
  <hr class="rule" />
  ${order.special_notes ? `<div style="font-size:15px;font-weight:bold;">NOTE: ${order.special_notes}</div><hr class="rule" />` : ''}
  <br/><br/>
</body></html>`;

  const w = window.open('', '_blank', 'width=340,height=600');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 400);
}
