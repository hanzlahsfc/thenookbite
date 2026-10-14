import { formatPKR } from '@/lib/format';
import type { CartLine } from '@/lib/types';

// The Nook Bite's WhatsApp — orders land here as a prefilled message.
export const WHATSAPP_NUMBER = '923279627442';

/** Build a wa.me deep link carrying the cart contents as an order message. */
export function whatsappOrderUrl(lines: CartLine[]): string {
  const total = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const items = lines
    .map(l => `${l.quantity}x ${l.name} — ${formatPKR(l.price * l.quantity)}`)
    .join('\n');
  const message = `*New Order — The Nook Bite*\n\n${items}\n\n*Total: ${formatPKR(total)}*`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
