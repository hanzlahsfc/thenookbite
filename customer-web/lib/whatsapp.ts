import { formatPKR } from '@/lib/format';
import type { CartLine } from '@/lib/types';

// The Nook Bite's WhatsApp — orders land here as a prefilled message.
export const WHATSAPP_NUMBER = '923279627442';

export interface CustomerDetails {
  name: string;
  phone: string;
  orderType: 'delivery' | 'pickup';
  address?: string;
  notes?: string;
}

/** Build a wa.me deep link carrying the cart contents as an order message. */
export function whatsappOrderUrl(lines: CartLine[], customer?: CustomerDetails): string {
  const total = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const items = lines
    .map(l => `${l.quantity}x ${l.name} — ${formatPKR(l.price * l.quantity)}`)
    .join('\n');

  let message = `*New Order — The Nook Bite*\n\n${items}\n\n*Total: ${formatPKR(total)}*`;

  if (customer) {
    const details = [
      `*Name:* ${customer.name}`,
      `*Phone:* ${customer.phone}`,
      `*Type:* ${customer.orderType === 'delivery' ? 'Delivery' : 'Pickup'}`,
    ];
    if (customer.orderType === 'delivery' && customer.address) {
      details.push(`*Address:* ${customer.address}`);
    }
    if (customer.notes) {
      details.push(`*Notes:* ${customer.notes}`);
    }
    message += `\n\n${details.join('\n')}`;
  }

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
