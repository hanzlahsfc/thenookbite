'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatPKR } from '@/lib/format';
import { blurOnWheel } from '@/lib/noWheel';

type MenuItem = { id: string; sku: string; name: string; category: string; price: number; available: boolean };


const inputClass = 'w-full bg-[#111] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#E4002B]/50 rounded-sm';

export function AdminMenuClient(
  { initialItems, categories }: { initialItems: MenuItem[]; categories: string[] },
) {
  const CATEGORIES = ['All', ...categories];
  const router = useRouter();
  const [items, setItems]     = useState<MenuItem[]>(initialItems);
  const [filter, setFilter]   = useState('All');
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast]     = useState<string | null>(null);

  // New item modal state
  const [showAdd, setShowAdd]         = useState(false);
  const [newName, setNewName]         = useState('');
  const [newCategory, setNewCategory] = useState<string>(categories[0] ?? '');
  const [newPrice, setNewPrice]       = useState('');
  const [newDesc, setNewDesc]         = useState('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [adding, setAdding]           = useState(false);
  const addFileRef = useRef<HTMLInputElement>(null);

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewImageFile(file);
    setNewImagePreview(URL.createObjectURL(file));
  }

  function resetModal() {
    setNewName(''); setNewPrice(''); setNewDesc('');
    setNewImageFile(null); setNewImagePreview(null);
    setNewCategory(categories[0] ?? '');
    if (addFileRef.current) addFileRef.current.value = '';
  }

  async function handleAddItem() {
    if (!newName.trim() || !newPrice) return;
    setAdding(true);

    // 1. Create the item
    const res = await fetch('/api/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), category: newCategory, price: parseInt(newPrice), description: newDesc.trim() || null }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast('Failed: ' + (err.detail ?? 'unknown error'));
      setAdding(false);
      return;
    }

    const created = await res.json();

    // 2. Upload image if one was picked
    if (newImageFile) {
      const fd = new FormData();
      fd.append('file', newImageFile);
      await fetch(`/api/menu/${created.id}/image`, { method: 'POST', body: fd });
    }

    setItems(prev => [...prev, created]);
    showToast(`"${created.name}" added`);
    setShowAdd(false);
    resetModal();
    setAdding(false);
    router.refresh();
  }

  async function toggleAvailability(item: MenuItem) {
    setLoading(item.id);
    const res = await fetch(`/api/menu/${item.id}/availability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: !item.available }),
    });
    setLoading(null);
    if (res.ok) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, available: !i.available } : i));
      showToast(`${item.name} marked as ${!item.available ? 'available' : 'unavailable'}`);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const filtered = items.filter(i => {
    const matchCat    = filter === 'All' || i.category === filter;
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const byCategory = filtered.reduce<Record<string, MenuItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="px-4 sm:px-8 py-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white font-heading text-xs tracking-widest px-4 py-2 rounded-sm shadow-lg">
          {toast}
        </div>
      )}

      {/* Add Item Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="bg-[#111] border border-white/10 rounded-sm p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading text-xl text-white tracking-wider">ADD NEW ITEM</h2>
              <button onClick={() => { setShowAdd(false); resetModal(); }} className="text-white/40 hover:text-white transition-colors font-heading text-lg">✕</button>
            </div>
            <div className="space-y-4">
              {/* Image picker */}
              <div>
                <label className="font-heading text-xs tracking-widest text-white block mb-2">ITEM IMAGE</label>
                <input ref={addFileRef} type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
                {newImagePreview ? (
                  <div className="relative mb-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={newImagePreview} alt="preview" className="w-full aspect-video object-cover rounded-sm border border-white/10" />
                    <button
                      onClick={() => { setNewImageFile(null); setNewImagePreview(null); if (addFileRef.current) addFileRef.current.value = ''; }}
                      className="absolute top-2 right-2 bg-black/70 text-white font-heading text-[10px] tracking-widest px-2 py-1 rounded-sm hover:bg-[#E4002B] transition-colors"
                    >✕ REMOVE</button>
                  </div>
                ) : (
                  <button
                    onClick={() => addFileRef.current?.click()}
                    className="w-full aspect-video border border-dashed border-white/20 rounded-sm flex flex-col items-center justify-center gap-2 hover:border-white/40 transition-colors"
                  >
                    <span className="text-white/30 text-2xl">📷</span>
                    <span className="font-heading text-xs tracking-widest text-white/40">CLICK TO UPLOAD IMAGE</span>
                  </button>
                )}
                {!newImagePreview && (
                  <button onClick={() => addFileRef.current?.click()} className="mt-2 font-heading text-xs tracking-widest text-white/40 hover:text-white transition-colors">
                    + CHOOSE FILE
                  </button>
                )}
              </div>
              <div>
                <label className="font-heading text-xs tracking-widest text-white block mb-2">ITEM NAME *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Spicy Zinger Burger" className={inputClass} />
              </div>
              <div>
                <label className="font-heading text-xs tracking-widest text-white block mb-2">CATEGORY *</label>
                <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                  className="w-full bg-[#111] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#E4002B]/50 rounded-sm">
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="font-heading text-xs tracking-widest text-white block mb-2">PRICE (PKR) *</label>
                <input type="number" onWheel={blurOnWheel} value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="e.g. 650" className={inputClass} min={0} />
              </div>
              <div>
                <label className="font-heading text-xs tracking-widest text-white block mb-2">DESCRIPTION</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} placeholder="Optional…" className={`${inputClass} resize-none`} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowAdd(false); resetModal(); }} className="flex-1 font-heading text-xs tracking-widest px-4 py-3 border border-white/10 text-white hover:border-white/30 rounded-sm transition-colors">
                CANCEL
              </button>
              <button
                onClick={handleAddItem}
                disabled={adding || !newName.trim() || !newPrice}
                className="flex-1 font-heading text-xs tracking-widest px-4 py-3 bg-[#E4002B] text-white hover:bg-white hover:text-[#0d0d0d] rounded-sm transition-colors disabled:opacity-40"
              >
                {adding ? (newImageFile ? 'UPLOADING…' : 'ADDING…') : 'ADD ITEM →'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="font-heading text-xs tracking-[0.4em] text-[#E4002B] mb-1">MANAGE</p>
          <h1 className="font-heading text-3xl text-white">MENU</h1>
          <p className="text-white text-xs mt-1">{items.length} items total</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="font-heading text-xs tracking-widest px-4 py-2.5 bg-[#E4002B] text-white hover:bg-white hover:text-[#0d0d0d] rounded-sm transition-colors duration-150"
        >
          + ADD ITEM
        </button>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search items…"
        className="w-full mb-4 bg-[#1a1a1a] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white focus:outline-none focus:border-[#E4002B]/40 rounded-sm"
      />

      {/* Category tabs */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`flex-shrink-0 font-heading text-xs tracking-widest px-3 py-1.5 rounded-sm border transition-colors duration-150 ${
              filter === cat
                ? 'bg-[#E4002B] border-[#E4002B] text-white'
                : 'border-white/10 text-white hover:text-white hover:border-white/30'
            }`}
          >
            {cat.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Items grouped by category */}
      <div className="space-y-6">
        {Object.keys(byCategory).length === 0 && (
          <div className="py-16 text-center text-white font-heading text-sm tracking-wider">
            NO ITEMS MATCH YOUR SEARCH
          </div>
        )}
        {Object.entries(byCategory).map(([category, catItems]) => (
          <div key={category}>
            <h2 className="font-heading text-xs tracking-widest text-[#E4002B] mb-2 px-1">{category.toUpperCase()}</h2>
            <div className="border border-white/5 rounded-sm bg-[#111111] divide-y divide-white/5">
              {catItems.map(item => (
                <div key={item.id} className="flex items-center justify-between px-4 sm:px-5 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={`font-heading text-sm truncate ${item.available ? 'text-white' : 'text-white line-through'}`}>
                      {item.name}
                    </p>
                    <p className="font-heading text-xs text-white mt-0.5">{formatPKR(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={`/admin/menu/${item.id}`}
                      className="font-heading text-[10px] sm:text-xs tracking-widest px-2 sm:px-3 py-1.5 rounded-sm border border-white/10 text-white hover:text-white hover:border-white/30 transition-colors duration-150"
                    >
                      EDIT
                    </Link>
                    <button
                      onClick={() => toggleAvailability(item)}
                      disabled={loading === item.id}
                      className={`font-heading text-[10px] sm:text-xs tracking-widest px-2 sm:px-3 py-1.5 rounded-sm border transition-colors duration-150 disabled:opacity-40 ${
                        item.available
                          ? 'border-green-500/30 bg-green-500/10 text-green-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
                          : 'border-white/10 text-white hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-400'
                      }`}
                    >
                      {loading === item.id ? '…' : item.available ? 'AVAIL' : 'SOLD OUT'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
