'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MenuItem } from '@/lib/types';
import type { MenuCategory } from '@/lib/menuCategories';
import { getSupabase } from '@/lib/supabase';
import { uploadMenuImage } from '@/lib/storage';
import { formatPKR } from '@/lib/format';

interface ItemForm {
  sku: string;
  name: string;
  category: string;
  price: string;
  sort_order: string;
  description: string;
  image_url: string;
  available: boolean;
}

const emptyForm: ItemForm = {
  sku: '',
  name: '',
  category: '',
  price: '',
  sort_order: '0',
  description: '',
  image_url: '',
  available: true,
};

const inputClass =
  'w-full bg-surface border border-theme rounded-sm px-3 py-2.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-brand-red transition-colors';

export function MenuManager() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const sb = getSupabase();

  async function load() {
    if (!sb) return;
    setLoading(true);
    const [{ data: itemData, error: e1 }, { data: catData, error: e2 }] = await Promise.all([
      sb.from('menu_items').select('*').order('category').order('sort_order'),
      sb.from('menu_categories').select('*').order('sort_order'),
    ]);
    if (e1 || e2) setError(e1?.message ?? e2?.message ?? 'Failed to load');
    setItems((itemData ?? []) as MenuItem[]);
    setCategories((catData ?? []) as MenuCategory[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const catNames = useMemo(
    () => [...new Set([...categories.map(c => c.name), ...items.map(i => i.category)])],
    [categories, items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i =>
      (catFilter === 'All' || i.category === catFilter) &&
      (q === '' || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)),
    );
  }, [items, catFilter, search]);

  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    setForm({
      sku: item.sku,
      name: item.name,
      category: item.category,
      price: String(item.price),
      sort_order: String(item.sort_order),
      description: item.description ?? '',
      image_url: item.image_url ?? '',
      available: item.available,
    });
    setImageFile(null);
    setError('');
  }

  async function save() {
    if (!sb) return;
    const price = parseInt(form.price, 10);
    if (!form.name.trim() || !form.sku.trim() || !form.category || isNaN(price)) {
      setError('Name, SKU, category and a numeric price are required.');
      return;
    }
    setSaving(true);
    setError('');
    let imageUrl = form.image_url || null;
    if (imageFile) {
      try {
        imageUrl = await uploadMenuImage(imageFile);
      } catch (err) {
        setError(`Image upload failed: ${err instanceof Error ? err.message : 'unknown error'}`);
        setSaving(false);
        return;
      }
    }
    const row = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      category: form.category,
      price,
      sort_order: parseInt(form.sort_order, 10) || 0,
      description: form.description.trim() || null,
      image_url: imageUrl,
      available: form.available,
    };
    const { error: e } =
      editingId === 'new'
        ? await sb.from('menu_items').insert(row)
        : await sb.from('menu_items').update(row).eq('id', editingId);
    if (e) setError(e.message);
    else setEditingId(null);
    setSaving(false);
    await load();
  }

  async function toggleAvailable(item: MenuItem) {
    if (!sb) return;
    const { error: e } = await sb
      .from('menu_items')
      .update({ available: !item.available })
      .eq('id', item.id);
    if (e) setError(e.message);
    else setItems(prev => prev.map(i => (i.id === item.id ? { ...i, available: !i.available } : i)));
  }

  async function remove(item: MenuItem) {
    if (!sb || !window.confirm(`Delete "${item.name}"? This can't be undone.`)) return;
    const { error: e } = await sb.from('menu_items').delete().eq('id', item.id);
    if (e) setError(e.message);
    else setItems(prev => prev.filter(i => i.id !== item.id));
  }

  if (loading) {
    return (
      <div className="bg-card border border-theme rounded-sm p-6 space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-10 bg-white/5 rounded-sm animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p className="mb-4 text-sm text-brand-red bg-brand-red/10 border border-brand-red/30 rounded-sm px-4 py-3">{error}</p>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name or SKU…"
          className={`${inputClass} flex-1`}
        />
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className={`${inputClass} sm:w-48`}
        >
          <option value="All">All categories</option>
          {catNames.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => {
            setEditingId('new');
            setForm({ ...emptyForm, category: catFilter !== 'All' ? catFilter : catNames[0] ?? '' });
            setImageFile(null);
            setError('');
          }}
          className="bg-brand-red text-white font-heading text-sm px-6 py-2.5 tracking-widest rounded-sm hover:bg-primary hover:text-surface transition-colors whitespace-nowrap"
        >
          + ADD ITEM
        </button>
      </div>

      {/* Edit / add form */}
      {editingId !== null && (
        <div className="bg-card border border-brand-red/40 rounded-sm p-5 mb-5">
          <h3 className="font-heading text-base text-primary tracking-wide mb-4">
            {editingId === 'new' ? 'ADD ITEM' : 'EDIT ITEM'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1 tracking-wide">SKU *</label>
              <input
                value={form.sku}
                onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                disabled={editingId !== 'new'}
                placeholder="e.g. burzinger-NC or PZ-tikka-L"
                className={`${inputClass} disabled:opacity-50`}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1 tracking-wide">NAME *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1 tracking-wide">CATEGORY *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputClass}>
                <option value="">Select…</option>
                {catNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1 tracking-wide">PRICE (PKR) *</label>
                <input type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1 tracking-wide">SORT ORDER</label>
                <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} className={inputClass} />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted mb-1 tracking-wide">DESCRIPTION</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted mb-1 tracking-wide">IMAGE</label>
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setImageFile(e.target.files?.[0] ?? null)}
                  className="text-sm text-muted file:mr-4 file:border file:border-theme file:rounded-sm file:bg-surface file:px-4 file:py-2 file:font-heading file:text-xs file:tracking-widest file:text-primary hover:file:border-brand-red file:cursor-pointer"
                />
                {(imageFile || form.image_url) && (
                  <img
                    src={imageFile ? URL.createObjectURL(imageFile) : form.image_url}
                    alt="Preview"
                    className="h-14 w-14 object-cover rounded-sm border border-theme"
                  />
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={form.available}
                onChange={e => setForm(f => ({ ...f, available: e.target.checked }))}
                className="accent-brand-red w-4 h-4"
              />
              Available on menu
            </label>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={save}
              disabled={saving}
              className="bg-brand-red text-white font-heading text-sm px-8 py-3 tracking-widest rounded-sm hover:bg-primary hover:text-surface transition-colors disabled:opacity-50"
            >
              {saving ? 'SAVING…' : 'SAVE'}
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="font-heading text-sm tracking-widest text-muted hover:text-primary border border-theme px-6 py-3 rounded-sm transition-colors"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Items table */}
      <div className="bg-card border border-theme rounded-sm overflow-hidden">
        <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 border-b border-theme text-xs font-heading tracking-widest text-muted">
          <span className="col-span-4">ITEM</span>
          <span className="col-span-3">CATEGORY</span>
          <span className="col-span-2 text-right">PRICE</span>
          <span className="col-span-1 text-center">LIVE</span>
          <span className="col-span-2 text-right">ACTIONS</span>
        </div>
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-sm text-muted text-center">No items match.</p>
        ) : (
          filtered.map(item => (
            <div
              key={item.id}
              className={`grid grid-cols-2 sm:grid-cols-12 gap-2 sm:gap-3 items-center px-5 py-3.5 border-b border-theme last:border-0 ${!item.available ? 'opacity-50' : ''}`}
            >
              <div className="sm:col-span-4 min-w-0">
                <p className="font-heading text-sm text-primary truncate">{item.name}</p>
                <p className="text-xs text-muted truncate">{item.sku}</p>
              </div>
              <p className="text-xs text-muted truncate sm:col-span-3">{item.category}</p>
              <p className="font-heading text-sm text-primary sm:col-span-2 sm:text-right">{formatPKR(item.price)}</p>
              <div className="sm:col-span-1 flex sm:justify-center">
                <button
                  onClick={() => toggleAvailable(item)}
                  title={item.available ? 'Mark unavailable' : 'Mark available'}
                  className={`w-9 h-5 rounded-full relative transition-colors ${item.available ? 'bg-brand-red' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${item.available ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="sm:col-span-2 flex gap-2 justify-end">
                <button
                  onClick={() => startEdit(item)}
                  className="font-heading text-xs tracking-widest text-muted hover:text-primary border border-theme px-3 py-1.5 rounded-sm transition-colors"
                >
                  EDIT
                </button>
                <button
                  onClick={() => remove(item)}
                  className="font-heading text-xs tracking-widest text-muted hover:text-brand-red border border-theme hover:border-brand-red px-3 py-1.5 rounded-sm transition-colors"
                >
                  DEL
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        {filtered.length} of {items.length} items · Sizes/cheese variants are separate SKUs — edit each SKU (e.g. -S/-M/-L/-XL, -NC/-CH).
      </p>
    </div>
  );
}
