'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MenuItem } from '@/lib/types';
import type { MenuCategory } from '@/lib/menuCategories';
import { getSupabase } from '@/lib/supabase';

interface CatForm {
  name: string;
  display_label: string;
  image_url: string;
  sort_order: string;
}

const emptyForm: CatForm = { name: '', display_label: '', image_url: '', sort_order: '0' };

const inputClass =
  'w-full bg-surface border border-theme rounded-sm px-3 py-2.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-brand-red transition-colors';

export function CategoryManager() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [originalName, setOriginalName] = useState('');
  const [form, setForm] = useState<CatForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const sb = getSupabase();

  async function load() {
    if (!sb) return;
    setLoading(true);
    const [{ data: cats, error: e1 }, { data: its, error: e2 }] = await Promise.all([
      sb.from('menu_categories').select('*').order('sort_order'),
      sb.from('menu_items').select('id, category'),
    ]);
    if (e1 || e2) setError(e1?.message ?? e2?.message ?? 'Failed to load');
    setCategories((cats ?? []) as MenuCategory[]);
    setItems((its ?? []) as MenuItem[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.category, (m.get(i.category) ?? 0) + 1);
    return m;
  }, [items]);

  function startEdit(c: MenuCategory) {
    setEditingId(c.id);
    setOriginalName(c.name);
    setForm({
      name: c.name,
      display_label: c.display_label ?? '',
      image_url: c.image_url ?? '',
      sort_order: String(c.sort_order),
    });
    setError('');
  }

  async function save() {
    if (!sb) return;
    const name = form.name.trim();
    if (!name) {
      setError('Category name is required.');
      return;
    }
    setSaving(true);
    setError('');
    const fields = {
      display_label: form.display_label.trim() || null,
      image_url: form.image_url.trim() || null,
      sort_order: parseInt(form.sort_order, 10) || 0,
    };

    let e = null;
    if (editingId === 'new') {
      ({ error: e } = await sb.from('menu_categories').insert({ name, ...fields }));
    } else if (name !== originalName) {
      // Renaming must also move every item under it — the RPC does both in one
      // transaction.
      ({ error: e } = await sb.rpc('rename_menu_category', { p_old: originalName, p_new: name }));
      if (!e) {
        ({ error: e } = await sb.from('menu_categories').update(fields).eq('id', editingId));
      }
    } else {
      ({ error: e } = await sb.from('menu_categories').update(fields).eq('id', editingId));
    }

    if (e) setError(e.message);
    else setEditingId(null);
    setSaving(false);
    await load();
  }

  async function remove(c: MenuCategory) {
    const count = counts.get(c.name) ?? 0;
    if (count > 0) {
      setError(`"${c.name}" still has ${count} item${count === 1 ? '' : 's'} — reassign or delete them first.`);
      return;
    }
    if (!sb || !window.confirm(`Delete category "${c.name}"?`)) return;
    const { error: e } = await sb.from('menu_categories').delete().eq('id', c.id);
    if (e) setError(e.message);
    else setCategories(prev => prev.filter(x => x.id !== c.id));
  }

  if (loading) {
    return (
      <div className="bg-card border border-theme rounded-sm p-6 space-y-3">
        {[1, 2, 3].map(i => (
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

      <div className="flex justify-end mb-5">
        <button
          onClick={() => { setEditingId('new'); setForm({ ...emptyForm, sort_order: String(categories.length + 1) }); setError(''); }}
          className="bg-brand-red text-white font-heading text-sm px-6 py-2.5 tracking-widest rounded-sm hover:bg-primary hover:text-surface transition-colors"
        >
          + ADD CATEGORY
        </button>
      </div>

      {editingId !== null && (
        <div className="bg-card border border-brand-red/40 rounded-sm p-5 mb-5">
          <h3 className="font-heading text-base text-primary tracking-wide mb-4">
            {editingId === 'new' ? 'ADD CATEGORY' : 'EDIT CATEGORY'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1 tracking-wide">NAME * (matches items' category)</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1 tracking-wide">DISPLAY LABEL (customer-facing)</label>
              <input value={form.display_label} onChange={e => setForm(f => ({ ...f, display_label: e.target.value }))} placeholder="e.g. Pizza Classic" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1 tracking-wide">IMAGE URL</label>
              <input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://…" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1 tracking-wide">SORT ORDER</label>
              <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} className={inputClass} />
            </div>
          </div>
          {editingId !== 'new' && form.name !== originalName && (
            <p className="mt-3 text-xs text-muted">
              Renaming will also update the category on all {counts.get(originalName) ?? 0} items under it.
            </p>
          )}
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

      <div className="bg-card border border-theme rounded-sm overflow-hidden">
        <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 border-b border-theme text-xs font-heading tracking-widest text-muted">
          <span className="col-span-1">#</span>
          <span className="col-span-4">NAME</span>
          <span className="col-span-3">DISPLAY LABEL</span>
          <span className="col-span-2 text-center">ITEMS</span>
          <span className="col-span-2 text-right">ACTIONS</span>
        </div>
        {categories.map(c => (
          <div
            key={c.id}
            className="grid grid-cols-2 sm:grid-cols-12 gap-2 sm:gap-3 items-center px-5 py-3.5 border-b border-theme last:border-0"
          >
            <span className="text-xs text-muted sm:col-span-1">{c.sort_order}</span>
            <div className="sm:col-span-4 min-w-0">
              <p className="font-heading text-sm text-primary truncate">{c.name}</p>
            </div>
            <p className="text-xs text-muted truncate sm:col-span-3">{c.display_label ?? '—'}</p>
            <p className="text-xs text-muted sm:col-span-2 sm:text-center">{counts.get(c.name) ?? 0}</p>
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <button
                onClick={() => startEdit(c)}
                className="font-heading text-xs tracking-widest text-muted hover:text-primary border border-theme px-3 py-1.5 rounded-sm transition-colors"
              >
                EDIT
              </button>
              <button
                onClick={() => remove(c)}
                className="font-heading text-xs tracking-widest text-muted hover:text-brand-red border border-theme hover:border-brand-red px-3 py-1.5 rounded-sm transition-colors"
              >
                DEL
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
