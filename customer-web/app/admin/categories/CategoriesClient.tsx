'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Category {
  id: string;
  name: string;
  display_label: string | null;
  image_url: string | null;
  sort_order: number;
  item_count: number;
}

const inputClass =
  'w-full bg-[#1a1a1a] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E4002B]/60 transition-colors rounded-sm';
const labelClass = 'font-heading text-[10px] tracking-widest text-white/50 block mb-1.5';

export function CategoriesClient({ initial }: { initial: Category[] }) {
  const router = useRouter();
  const [cats, setCats]       = useState<Category[]>(initial);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [toast, setToast]     = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newImage, setNewImage] = useState('');

  const [editId, setEditId]       = useState<string | null>(null);
  const [editName, setEditName]   = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editImage, setEditImage] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [reassignTo, setReassignTo]     = useState('');

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function refresh() {
    const res = await fetch('/api/admin/categories', { cache: 'no-store' });
    if (res.ok) setCats(await res.json());
    router.refresh();
  }

  async function addCategory() {
    if (!newName.trim()) { setError('Name is required'); return; }
    setBusy(true); setError(null);
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), display_label: newLabel, image_url: newImage }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.detail ?? 'Failed to add'); return; }
    setShowAdd(false); setNewName(''); setNewLabel(''); setNewImage('');
    flash(`"${data.name}" added`);
    refresh();
  }

  function openEdit(c: Category) {
    setEditId(c.id);
    setEditName(c.name);
    setEditLabel(c.display_label ?? '');
    setEditImage(c.image_url ?? '');
    setError(null);
  }

  async function saveEdit(c: Category) {
    if (!editName.trim()) { setError('Name cannot be empty'); return; }
    setBusy(true); setError(null);
    const res = await fetch(`/api/admin/categories/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), display_label: editLabel, image_url: editImage }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.detail ?? 'Failed to save'); return; }
    setEditId(null);
    flash(
      editName.trim() !== c.name
        ? `Renamed to "${editName.trim()}" — ${c.item_count} item${c.item_count === 1 ? '' : 's'} moved with it`
        : 'Saved',
    );
    refresh();
  }

  async function move(c: Category, dir: -1 | 1) {
    const ordered = [...cats].sort((a, b) => a.sort_order - b.sort_order);
    const idx = ordered.findIndex(x => x.id === c.id);
    const swap = ordered[idx + dir];
    if (!swap) return;

    setCats(prev => prev.map(x =>
      x.id === c.id    ? { ...x, sort_order: swap.sort_order } :
      x.id === swap.id ? { ...x, sort_order: c.sort_order } : x,
    ));

    await Promise.all([
      fetch(`/api/admin/categories/${c.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: swap.sort_order }),
      }),
      fetch(`/api/admin/categories/${swap.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: c.sort_order }),
      }),
    ]);
    refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true); setError(null);
    const qs = deleteTarget.item_count > 0 ? `?reassign_to=${encodeURIComponent(reassignTo)}` : '';
    const res = await fetch(`/api/admin/categories/${deleteTarget.id}${qs}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.detail ?? 'Failed to delete'); return; }
    flash(
      data.moved
        ? `"${deleteTarget.name}" deleted — ${data.moved} item${data.moved === 1 ? '' : 's'} moved to ${reassignTo}`
        : `"${deleteTarget.name}" deleted`,
    );
    setDeleteTarget(null); setReassignTo('');
    refresh();
  }

  const ordered = [...cats].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div>
      {toast && (
        <div className="mb-6 border border-green-500/30 bg-green-500/5 rounded-sm px-5 py-3 text-green-400 font-heading text-xs tracking-wider">
          ✓ {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="font-heading text-xs tracking-[0.4em] text-[#E4002B] mb-1">MENU</p>
          <h1 className="font-heading text-3xl text-white">CATEGORIES</h1>
        </div>
        <button
          onClick={() => { setShowAdd(v => !v); setError(null); }}
          className="font-heading text-xs tracking-widest px-5 py-2.5 bg-[#E4002B] text-white hover:bg-red-700 transition-colors rounded-sm"
        >
          + NEW CATEGORY
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-6 border border-white/10 bg-[#0d0d0d] rounded-sm p-5">
          <p className="font-heading text-[10px] tracking-[0.3em] text-[#E4002B] mb-4">NEW CATEGORY</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>NAME</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Shakes" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>DISPLAY LABEL <span className="text-white/25 normal-case">(optional)</span></label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="shown to customers" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>IMAGE URL <span className="text-white/25 normal-case">(optional)</span></label>
              <input value={newImage} onChange={e => setNewImage(e.target.value)} placeholder="https://…" className={inputClass} />
            </div>
          </div>
          {error && <p className="mt-3 text-[#E4002B] text-xs">⚠ {error}</p>}
          <div className="flex gap-3 mt-4">
            <button onClick={addCategory} disabled={busy}
              className="font-heading text-xs tracking-widest px-6 py-2.5 bg-[#E4002B] text-white hover:bg-red-700 disabled:opacity-50 transition-colors rounded-sm">
              {busy ? 'ADDING…' : 'ADD CATEGORY'}
            </button>
            <button onClick={() => { setShowAdd(false); setError(null); }}
              className="font-heading text-xs tracking-widest px-6 py-2.5 border border-white/10 text-white/60 hover:text-white transition-colors rounded-sm">
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="border border-white/10 rounded-sm divide-y divide-white/5">
        {ordered.map((c, i) => (
          <div key={c.id}>
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => move(c, -1)} disabled={i === 0}
                  className="text-white/30 hover:text-white disabled:opacity-20 disabled:hover:text-white/30 text-xs leading-none" title="Move up">▲</button>
                <button onClick={() => move(c, 1)} disabled={i === ordered.length - 1}
                  className="text-white/30 hover:text-white disabled:opacity-20 disabled:hover:text-white/30 text-xs leading-none" title="Move down">▼</button>
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-heading text-sm text-white truncate">{c.name}</p>
                <p className="text-white/40 text-xs mt-0.5">
                  {c.item_count} item{c.item_count === 1 ? '' : 's'}
                  {c.display_label && <> · shown as &ldquo;{c.display_label}&rdquo;</>}
                </p>
              </div>

              <button onClick={() => (editId === c.id ? setEditId(null) : openEdit(c))}
                className="font-heading text-[10px] tracking-widest px-3 py-1.5 border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-colors rounded-sm">
                {editId === c.id ? 'CLOSE' : 'EDIT'}
              </button>
              <button onClick={() => { setDeleteTarget(c); setReassignTo(''); setError(null); }}
                className="font-heading text-[10px] tracking-widest px-3 py-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors rounded-sm">
                DELETE
              </button>
            </div>

            {editId === c.id && (
              <div className="mx-5 mb-4 border border-white/10 bg-[#0d0d0d] rounded-sm p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>NAME</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)} className={inputClass} />
                    {editName.trim() !== c.name && c.item_count > 0 && (
                      <p className="mt-1.5 text-xs text-yellow-400/80">
                        {c.item_count} item{c.item_count === 1 ? '' : 's'} will move with it.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>DISPLAY LABEL</label>
                    <input value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="shown to customers" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>IMAGE URL</label>
                    <input value={editImage} onChange={e => setEditImage(e.target.value)} placeholder="https://…" className={inputClass} />
                  </div>
                </div>
                {error && <p className="mt-3 text-[#E4002B] text-xs">⚠ {error}</p>}
                <div className="flex gap-3 mt-4">
                  <button onClick={() => saveEdit(c)} disabled={busy}
                    className="font-heading text-xs tracking-widest px-6 py-2.5 bg-[#E4002B] text-white hover:bg-red-700 disabled:opacity-50 transition-colors rounded-sm">
                    {busy ? 'SAVING…' : 'SAVE'}
                  </button>
                  <button onClick={() => setEditId(null)}
                    className="font-heading text-xs tracking-widest px-6 py-2.5 border border-white/10 text-white/60 hover:text-white transition-colors rounded-sm">
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {ordered.length === 0 && (
          <p className="px-5 py-10 text-center text-white/40 text-sm">No categories yet.</p>
        )}
      </div>

      {/* Delete dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="w-full max-w-md border border-red-500/30 bg-[#111] rounded-sm p-6">
            <p className="font-heading text-[10px] tracking-[0.3em] text-red-400 mb-3">DELETE CATEGORY</p>
            <p className="text-white text-sm mb-4">
              Delete <span className="font-bold">{deleteTarget.name}</span>?
            </p>

            {deleteTarget.item_count > 0 ? (
              <>
                <p className="text-white/60 text-xs mb-3">
                  It still holds {deleteTarget.item_count} item{deleteTarget.item_count === 1 ? '' : 's'}.
                  Choose where they should go — they cannot be left without a category.
                </p>
                <select value={reassignTo} onChange={e => setReassignTo(e.target.value)} className={inputClass + ' cursor-pointer mb-4'}>
                  <option value="">— select a category —</option>
                  {ordered.filter(x => x.id !== deleteTarget.id).map(x => (
                    <option key={x.id} value={x.name}>{x.name}</option>
                  ))}
                </select>
              </>
            ) : (
              <p className="text-white/60 text-xs mb-4">It has no items, so nothing else changes.</p>
            )}

            {error && <p className="text-[#E4002B] text-xs mb-3">⚠ {error}</p>}

            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                disabled={busy || (deleteTarget.item_count > 0 && !reassignTo)}
                className="font-heading text-xs tracking-widest px-5 py-2.5 bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-sm"
              >
                {busy ? 'DELETING…' : 'DELETE'}
              </button>
              <button onClick={() => { setDeleteTarget(null); setError(null); }} disabled={busy}
                className="font-heading text-xs tracking-widest px-5 py-2.5 border border-white/10 text-white/60 hover:text-white transition-colors rounded-sm">
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
