'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { MenuManager } from '@/components/admin/MenuManager';
import { CategoryManager } from '@/components/admin/CategoryManager';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [tab, setTab] = useState<'menu' | 'categories'>('menu');

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setReady(true);
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      const s = data.session;
      const ok = s && (!ADMIN_EMAIL || s.user.email === ADMIN_EMAIL);
      if (!ok) {
        router.replace('/admin/login');
        return;
      }
      setEmail(s.user.email ?? null);
      setReady(true);
    });
  }, [router]);

  async function signOut() {
    await getSupabase()?.auth.signOut();
    router.replace('/admin/login');
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-heading text-3xl text-primary">TNB ADMIN</h1>
        <p className="mt-4 text-sm text-muted">
          Supabase isn't configured. Set NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_ANON_KEY, then run db/admin_menu_write.sql.
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-16">
        <div className="h-10 w-48 bg-white/5 rounded-sm animate-pulse mb-8" />
        <div className="bg-card border border-theme rounded-sm p-6 space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 bg-white/5 rounded-sm animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl sm:text-5xl text-primary">TNB ADMIN</h1>
            <p className="text-xs text-muted mt-1">{email}</p>
          </div>
          <button
            onClick={signOut}
            className="font-heading text-xs tracking-widest text-muted hover:text-brand-red border border-theme hover:border-brand-red px-4 py-2.5 rounded-sm transition-colors"
          >
            SIGN OUT
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {([
            { id: 'menu',       label: 'MENU ITEMS' },
            { id: 'categories', label: 'CATEGORIES' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`font-heading text-sm tracking-widest px-5 py-3 border rounded-sm transition-colors duration-150 ${
                tab === t.id
                  ? 'bg-brand-red border-brand-red text-white'
                  : 'border-theme text-muted hover:text-primary hover:border-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'menu' ? <MenuManager /> : <CategoryManager />}
      </div>
    </div>
  );
}
