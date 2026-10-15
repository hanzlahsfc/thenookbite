'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-heading text-3xl text-primary">ADMIN</h1>
        <p className="mt-4 text-sm text-muted">
          Supabase isn't configured. Set NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_ANON_KEY to use the admin panel.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const sb = getSupabase()!;
    const { data, error: authError } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError || !data.session) {
      setError(authError?.message ?? 'Login failed');
      setBusy(false);
      return;
    }
    if (ADMIN_EMAIL && data.session.user.email !== ADMIN_EMAIL) {
      await sb.auth.signOut();
      setError('This account is not authorized for admin access.');
      setBusy(false);
      return;
    }
    router.replace('/admin');
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:py-24">
      <h1 className="font-heading text-3xl sm:text-4xl text-primary mb-8">TNB ADMIN</h1>
      <form onSubmit={handleSubmit} className="bg-card border border-theme rounded-sm p-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs text-muted mb-1.5 tracking-wide">EMAIL</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-surface border border-theme rounded-sm px-4 py-3 text-sm text-primary focus:outline-none focus:border-brand-red transition-colors"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-xs text-muted mb-1.5 tracking-wide">PASSWORD</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-surface border border-theme rounded-sm px-4 py-3 text-sm text-primary focus:outline-none focus:border-brand-red transition-colors"
          />
        </div>
        {error && <p className="text-sm text-brand-red">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-brand-red text-white font-heading text-sm px-8 py-4 tracking-widest hover:bg-primary hover:text-surface transition-colors duration-200 disabled:opacity-50"
        >
          {busy ? 'SIGNING IN…' : 'SIGN IN →'}
        </button>
      </form>
    </div>
  );
}
