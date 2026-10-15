'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCart } from '@/store/cart';
import { formatPKR } from '@/lib/format';
import { whatsappOrderUrl, type CustomerDetails } from '@/lib/whatsapp';

const inputClass =
  'w-full bg-surface border border-theme rounded-sm px-4 py-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-brand-red transition-colors';

export default function CheckoutPage() {
  const { lines, totalPrice } = useCart();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-16">
        <div className="h-10 w-48 bg-white/5 rounded-sm animate-pulse mb-8" />
        <div className="bg-card border border-theme rounded-sm p-6 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-11 bg-white/5 rounded-sm animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="text-5xl mb-6">🛒</div>
        <h1 className="font-heading text-3xl sm:text-4xl text-primary">YOUR CART IS EMPTY</h1>
        <p className="mt-4 text-muted text-sm">Add something delicious to get started.</p>
        <Link
          href="/menu"
          className="mt-8 inline-flex items-center gap-2 bg-brand-red text-white font-heading text-sm px-8 py-4 tracking-widest hover:bg-primary hover:text-surface transition-colors duration-200"
        >
          BROWSE MENU →
        </Link>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const customer: CustomerDetails = {
      name: name.trim(),
      phone: phone.trim(),
      orderType,
      address: address.trim(),
      notes: notes.trim(),
    };
    window.open(whatsappOrderUrl(lines, customer), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-surface min-h-screen">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-16">
        <h1 className="font-heading text-3xl sm:text-5xl text-primary mb-8">CHECKOUT</h1>

        <div className="grid gap-6 sm:grid-cols-5">
          {/* Customer details form */}
          <form onSubmit={handleSubmit} className="sm:col-span-3 bg-card border border-theme rounded-sm p-5 sm:p-6 space-y-4">
            <h2 className="font-heading text-lg text-primary tracking-wide">YOUR DETAILS</h2>

            <div>
              <label htmlFor="name" className="block text-xs text-muted mb-1.5 tracking-wide">NAME *</label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-xs text-muted mb-1.5 tracking-wide">PHONE *</label>
              <input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="03XX-XXXXXXX"
                className={inputClass}
              />
            </div>

            <div>
              <span className="block text-xs text-muted mb-1.5 tracking-wide">ORDER TYPE</span>
              <div className="grid grid-cols-2 gap-2">
                {(['delivery', 'pickup'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setOrderType(t)}
                    className={`font-heading text-sm tracking-widest py-3 border rounded-sm transition-colors duration-200 ${
                      orderType === t
                        ? 'bg-brand-red border-brand-red text-white'
                        : 'border-theme text-muted hover:text-primary hover:border-primary'
                    }`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {orderType === 'delivery' && (
              <div>
                <label htmlFor="address" className="block text-xs text-muted mb-1.5 tracking-wide">DELIVERY ADDRESS *</label>
                <textarea
                  id="address"
                  required
                  rows={2}
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Street, area, landmark"
                  className={`${inputClass} resize-none`}
                />
              </div>
            )}

            <div>
              <label htmlFor="notes" className="block text-xs text-muted mb-1.5 tracking-wide">SPECIAL NOTES</label>
              <textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Extra spicy, no onions, etc. (optional)"
                className={`${inputClass} resize-none`}
              />
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 bg-brand-red text-white font-heading text-sm px-8 py-4 tracking-widest hover:bg-primary hover:text-surface transition-colors duration-200"
            >
              PLACE ORDER VIA WHATSAPP →
            </button>
            <p className="text-xs text-muted text-center">You'll be redirected to WhatsApp to confirm your order.</p>
          </form>

          {/* Order summary */}
          <div className="sm:col-span-2">
            <div className="bg-card border border-theme rounded-sm p-5 sm:p-6">
              <h2 className="font-heading text-lg text-primary tracking-wide mb-4">ORDER SUMMARY</h2>
              <div className="space-y-2.5">
                {lines.map(l => (
                  <div key={l.key} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-muted flex-1 min-w-0">
                      <span className="text-primary">{l.quantity}x</span> {l.name}
                    </span>
                    <span className="text-primary font-heading whitespace-nowrap">{formatPKR(l.price * l.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t-2 border-brand-red flex items-center justify-between">
                <span className="font-heading text-base text-primary">TOTAL</span>
                <span className="font-heading text-xl text-primary">{formatPKR(totalPrice())}</span>
              </div>
              <Link
                href="/cart"
                className="mt-4 inline-block font-heading text-xs tracking-widest text-muted hover:text-primary transition-colors"
              >
                ← EDIT CART
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
