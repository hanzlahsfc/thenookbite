'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { formatPKR } from '@/lib/format';
import { blurOnWheel } from '@/lib/noWheel';

type MenuItem = {
  id: string; sku: string; name: string; category: string;
  price: number; description: string | null; image_url: string | null;
  available: boolean; deal_price: number | null; deal_label: string | null;
};

type Sibling = { id: string; name: string } | null;

const inputClass = 'w-full bg-[#1a1a1a] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white focus:outline-none focus:border-[#E4002B]/50 transition-colors rounded-sm';
const labelClass = 'font-heading text-xs tracking-widest text-white block mb-2';

export function MenuItemEditor(
  { item, prevItem, nextItem, categories }:
  { item: MenuItem; prevItem: Sibling; nextItem: Sibling; categories: string[] },
) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName]           = useState(item.name);
  const [category, setCategory]   = useState<string>(item.category);
  const [price, setPrice]         = useState(String(item.price));
  const [description, setDesc]    = useState(item.description ?? '');
  const [imageUrl, setImageUrl]   = useState(item.image_url ?? '');
  const [isDeal, setIsDeal]       = useState(!!item.deal_price);
  const [dealPrice, setDealPrice] = useState(String(item.deal_price ?? ''));
  const [dealLabel, setDealLabel] = useState(item.deal_label ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [toast, setToast]         = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/menu/${item.id}/image`, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast('Upload failed: ' + (err.detail ?? res.statusText), 'error');
      setUploading(false);
      return;
    }
    const { url } = await res.json();
    setImageUrl(url);
    // Auto-save image_url to DB so it persists without needing to click Save
    await fetch(`/api/menu/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: url }),
    });
    setUploading(false);
    showToast('Image uploaded and saved');
  }

  async function handleDelete() {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/menu/${item.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/admin/menu');
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast('Delete failed: ' + (err.detail ?? res.statusText), 'error');
      setDeleting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/menu/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        category,
        price: parseInt(price) || item.price,
        description: description.trim() || null,
        image_url: imageUrl || null,
        deal_price: isDeal && dealPrice ? parseInt(dealPrice) : null,
        deal_label: isDeal && dealLabel.trim() ? dealLabel.trim() : null,
      }),
    });
    setSaving(false);
    if (res.ok) { showToast('Saved successfully'); router.refresh(); }
    else {
      const err = await res.json().catch(() => ({}));
      showToast('Save failed: ' + (err.detail ?? res.status), 'error');
    }
  }

  return (
    <div className="px-4 sm:px-8 py-8 max-w-2xl">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 font-heading text-xs tracking-widest px-4 py-2 rounded-sm shadow-lg ${
          toastType === 'success' ? 'bg-green-600 text-white' : 'bg-[#E4002B] text-white'
        }`}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push('/admin/menu')}
            className="font-heading text-xs tracking-widest text-white/50 hover:text-white transition-colors"
          >
            ← MENU
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => prevItem && router.push(`/admin/menu/${prevItem.id}`)}
              disabled={!prevItem}
              title={prevItem ? `← ${prevItem.name}` : undefined}
              className="font-heading text-xs tracking-widest px-3 py-1.5 border border-white/10 text-white hover:border-white/30 rounded-sm transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
            >
              ← PREV
            </button>
            <button
              onClick={() => nextItem && router.push(`/admin/menu/${nextItem.id}`)}
              disabled={!nextItem}
              title={nextItem ? `${nextItem.name} →` : undefined}
              className="font-heading text-xs tracking-widest px-3 py-1.5 border border-white/10 text-white hover:border-white/30 rounded-sm transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
            >
              NEXT →
            </button>
          </div>
        </div>
        <p className="font-heading text-xs tracking-[0.4em] text-[#E4002B] mb-1">{category.toUpperCase()}</p>
        <h1 className="font-heading text-3xl text-white">{item.name}</h1>
        <p className="text-white text-xs mt-1 font-heading tracking-wider">SKU: {item.sku}</p>
      </div>

      {/* Image */}
      <div className="mb-6">
        <p className={labelClass}>ITEM IMAGE</p>
        <div className="relative aspect-video bg-[#1a1a1a] border border-white/10 rounded-sm overflow-hidden mb-3">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white font-heading text-xs tracking-wider">
              NO IMAGE
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="font-heading text-xs tracking-widest px-4 py-2.5 border border-white/10 text-white hover:text-white hover:border-white/30 transition-colors rounded-sm disabled:opacity-40"
        >
          {uploading ? 'UPLOADING…' : 'UPLOAD IMAGE'}
        </button>
        {imageUrl && (
          <button
            onClick={() => setImageUrl('')}
            className="ml-3 font-heading text-xs tracking-widest text-white hover:text-red-400 transition-colors"
          >
            REMOVE
          </button>
        )}
      </div>

      {/* Name */}
      <div className="mb-4">
        <label className={labelClass}>ITEM NAME</label>
        <input value={name} onChange={e => setName(e.target.value)} className={inputClass} />
      </div>

      {/* Category */}
      <div className="mb-4">
        <label className={labelClass}>CATEGORY</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className={inputClass + ' cursor-pointer'}
        >
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {category !== item.category && (
          <p className="mt-1.5 text-xs text-yellow-400/80">
            Moves from {item.category} to {category} when you save.
          </p>
        )}
      </div>

      {/* Price */}
      <div className="mb-4">
        <label className={labelClass}>PRICE (PKR)</label>
        <input type="number" onWheel={blurOnWheel} value={price} onChange={e => setPrice(e.target.value)} className={inputClass} min={0} />
      </div>

      {/* Description */}
      <div className="mb-6">
        <label className={labelClass}>DESCRIPTION</label>
        <textarea
          value={description}
          onChange={e => setDesc(e.target.value)}
          rows={3}
          placeholder="Optional description…"
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Deal toggle */}
      <div className="mb-6 border border-white/5 rounded-sm bg-[#111111] px-5 py-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="font-heading text-sm text-white tracking-wider">MARK AS DEAL</p>
            <p className="text-white text-xs mt-0.5">Show this item with a special deal price on the homepage.</p>
          </div>
          <button
            onClick={() => setIsDeal(!isDeal)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${isDeal ? 'bg-[#E4002B]' : 'bg-white/10'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${isDeal ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {isDeal && (
          <div className="mt-4 space-y-3 pt-4 border-t border-white/5">
            <div>
              <label className={labelClass}>DEAL PRICE (PKR)</label>
              <input
                type="number" onWheel={blurOnWheel}
                value={dealPrice}
                onChange={e => setDealPrice(e.target.value)}
                placeholder={`Less than ${formatPKR(parseInt(price) || item.price)}`}
                className={inputClass}
                min={0}
              />
            </div>
            <div>
              <label className={labelClass}>DEAL LABEL</label>
              <input
                value={dealLabel}
                onChange={e => setDealLabel(e.target.value)}
                placeholder="e.g. 30% OFF, DEAL OF THE DAY"
                className={inputClass}
              />
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-[#E4002B] text-white font-heading text-sm py-4 tracking-widest hover:bg-white hover:text-[#0d0d0d] transition-colors duration-200 disabled:opacity-50 rounded-sm"
      >
        {saving ? 'SAVING…' : 'SAVE CHANGES →'}
      </button>

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="w-full mt-3 border border-red-500/30 text-red-400 font-heading text-sm py-4 tracking-widest hover:bg-red-500/10 transition-colors duration-200 disabled:opacity-50 rounded-sm"
      >
        {deleting ? 'DELETING…' : 'DELETE ITEM'}
      </button>
    </div>
  );
}
