'use client';

import { useState, useCallback, useEffect } from 'react';
import { formatPKR } from '@/lib/format';
import { blurOnWheel } from '@/lib/noWheel';

interface Reset {
  id: string;
  amount_at_reset: number;
  opening_balance: number;
  reset_at: string;
  reset_by: string;
}

interface Movement {
  id: string;
  amount: number;
  direction: 'in' | 'out';
  reason: string | null;
  created_at: string;
  created_by: string;
}

interface CashData {
  openingBalance: number;
  cashSinceReset: number;
  paidIn: number;
  paidOut: number;
  expectedInDrawer: number;
  cashTotal: number;
  resets: Reset[];
  movements: Movement[];
}

export function CashClient({ initial }: { initial: CashData }) {
  const [data, setData]       = useState<CashData>(initial);
  const [resetting, setResetting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [openingInput, setOpeningInput] = useState('');
  const [moveAmount, setMoveAmount] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [moving, setMoving]         = useState(false);
  const [moveError, setMoveError]   = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/admin/cash', { cache: 'no-store' });
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function handleReset() {
    setResetting(true);
    await fetch('/api/admin/cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opening_balance: parseInt(openingInput) || 0 }),
    });
    setResetting(false);
    setConfirm(false);
    setOpeningInput('');
    refresh();
  }

  async function recordMovement(direction: 'in' | 'out') {
    const amount = parseInt(moveAmount) || 0;
    if (amount <= 0) { setMoveError('Enter an amount'); return; }
    setMoving(true); setMoveError(null);
    const res = await fetch('/api/admin/cash/movement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, direction, reason: moveReason }),
    });
    const body = await res.json().catch(() => ({}));
    setMoving(false);
    if (!res.ok) { setMoveError(body.detail ?? 'Failed'); return; }
    setMoveAmount(''); setMoveReason('');
    setData(body.snapshot);
  }

  async function undoMovement(id: string) {
    const res = await fetch(`/api/admin/cash/movement?id=${id}`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) setData(body.snapshot);
  }

  const { openingBalance, cashSinceReset, paidIn, paidOut, expectedInDrawer, cashTotal, resets, movements } = data;
  const nextOpening = parseInt(openingInput) || 0;

  return (
    <div className="px-4 sm:px-8 py-8">
      <div className="mb-6">
        <p className="font-heading text-xs tracking-[0.4em] text-[#E4002B] mb-1">FINANCES</p>
        <h1 className="font-heading text-3xl text-white">CASH DRAWER</h1>
        <p className="text-white text-xs mt-1">Cash collected from orders + settled pay-later</p>
      </div>

      {/* Main totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="sm:col-span-2 border border-green-500/20 bg-green-500/5 rounded-sm px-6 py-6">
          <p className="font-heading text-xs tracking-widest text-green-400/60 mb-1">EXPECTED IN DRAWER</p>
          <p className="font-heading text-5xl text-green-400">{formatPKR(expectedInDrawer)}</p>
          <p className="font-heading text-[10px] tracking-widest text-green-400/40 mt-2">
            OPENING {formatPKR(openingBalance)} + SALES {formatPKR(cashSinceReset)}
            {paidIn  > 0 && <> + ADDED {formatPKR(paidIn)}</>}
            {paidOut > 0 && <> − REMOVED {formatPKR(paidOut)}</>}
          </p>
        </div>
        <div className="grid grid-rows-2 gap-3">
          <div className="border border-white/10 rounded-sm px-5 py-3">
            <p className="font-heading text-[10px] tracking-widest text-white/50 mb-0.5">OPENING BALANCE</p>
            <p className="font-heading text-xl text-white">{formatPKR(openingBalance)}</p>
          </div>
          <div className="border border-white/10 rounded-sm px-5 py-3">
            <p className="font-heading text-[10px] tracking-widest text-white/50 mb-0.5">CASH SALES SINCE RESET</p>
            <p className="font-heading text-xl text-white">{formatPKR(cashSinceReset)}</p>
          </div>
        </div>
      </div>

      <p className="font-heading text-[10px] tracking-widest text-white/40 mb-8">
        TODAY&apos;S CASH SINCE MIDNIGHT: {formatPKR(cashTotal)} · REFERENCE ONLY, NOT AFFECTED BY RESETS
        {resets.length > 0 && (
          <> · LAST RESET {new Date(resets[0].reset_at).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</>
        )}
      </p>

      {/* Add / remove cash */}
      <div className="mb-4 border border-white/5 rounded-sm p-5">
        <p className="font-heading text-xs tracking-widest text-white mb-0.5">ADD OR REMOVE CASH</p>
        <p className="text-white/50 text-xs mb-4">
          For money moved by hand — taking cash to the bank, paying a supplier, topping up the float.
          The sales count keeps running.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label className="font-heading text-[10px] tracking-widest text-white/50 block mb-1.5">AMOUNT (PKR)</label>
            <input
              type="number"
              onWheel={blurOnWheel}
              min={1}
              value={moveAmount}
              onChange={e => setMoveAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-[#1a1a1a] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E4002B]/60 rounded-sm"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="font-heading text-[10px] tracking-widest text-white/50 block mb-1.5">
              REASON <span className="text-white/25 normal-case">(optional)</span>
            </label>
            <input
              value={moveReason}
              onChange={e => setMoveReason(e.target.value)}
              placeholder="e.g. to bank, supplier payment"
              className="w-full bg-[#1a1a1a] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E4002B]/60 rounded-sm"
            />
          </div>
          <button
            onClick={() => recordMovement('in')}
            disabled={moving}
            className="font-heading text-xs tracking-widest px-5 py-2.5 border border-green-500/40 text-green-400 hover:bg-green-500/10 disabled:opacity-50 rounded-sm transition-colors"
          >
            + ADD TO DRAWER
          </button>
          <button
            onClick={() => recordMovement('out')}
            disabled={moving}
            className="font-heading text-xs tracking-widest px-5 py-2.5 border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 disabled:opacity-50 rounded-sm transition-colors"
          >
            − REMOVE FROM DRAWER
          </button>
        </div>

        {moveError && <p className="mt-3 text-[#E4002B] text-xs">⚠ {moveError}</p>}

        {movements.length > 0 && (
          <div className="mt-5 border-t border-white/5 pt-4">
            <p className="font-heading text-[10px] tracking-widest text-white/40 mb-2">
              THIS COUNTING PERIOD
            </p>
            <div className="space-y-1.5">
              {movements.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-white/50">
                    {new Date(m.created_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                    {m.reason && <span className="text-white/35"> · {m.reason}</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={`font-heading ${m.direction === 'in' ? 'text-green-400' : 'text-orange-400'}`}>
                      {m.direction === 'in' ? '+' : '−'} {formatPKR(m.amount)}
                    </span>
                    <button
                      onClick={() => undoMovement(m.id)}
                      className="text-white/25 hover:text-[#E4002B] transition-colors"
                      title="Undo this entry"
                    >
                      ✕
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reset section */}
      <div className="mb-8 border border-white/5 rounded-sm p-5">
        <p className="font-heading text-xs tracking-widest text-white mb-0.5">CLOSE DRAWER &amp; START NEW COUNT</p>
        <p className="text-white/50 text-xs mb-4">
          Records {formatPKR(expectedInDrawer)} as taken out, then starts counting again from the float you leave in.
        </p>

        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <label className="font-heading text-[10px] tracking-widest text-white/50 block mb-1.5">
              OPENING BALANCE (PKR)
            </label>
            <input
              type="number"
              onWheel={blurOnWheel}
              min={0}
              value={openingInput}
              onChange={e => setOpeningInput(e.target.value)}
              placeholder="0"
              className="w-full bg-[#1a1a1a] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E4002B]/60 rounded-sm"
            />
            <p className="text-white/40 text-[11px] mt-1.5">
              Cash you are leaving in the drawer. The count starts from here.
            </p>
          </div>

          {!confirm ? (
            <button
              onClick={() => setConfirm(true)}
              className="font-heading text-xs tracking-widest px-5 py-2.5 border border-[#E4002B]/30 text-[#E4002B] hover:bg-[#E4002B]/10 rounded-sm transition-colors"
            >
              RESET DRAWER
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-heading text-[10px] tracking-widest text-yellow-400">
                TAKE OUT {formatPKR(expectedInDrawer - nextOpening)}, LEAVE {formatPKR(nextOpening)}?
              </span>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="font-heading text-xs tracking-widest px-4 py-2 bg-[#E4002B] text-white hover:bg-red-700 rounded-sm transition-colors disabled:opacity-50"
              >
                {resetting ? 'RESETTING…' : 'CONFIRM'}
              </button>
              <button
                onClick={() => setConfirm(false)}
                className="font-heading text-xs tracking-widest px-4 py-2 border border-white/10 text-white hover:border-white/30 rounded-sm transition-colors"
              >
                CANCEL
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reset history */}
      <div className="border border-white/5 rounded-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5">
          <p className="font-heading text-xs tracking-widest text-white">RESET HISTORY</p>
        </div>
        {resets.length === 0 ? (
          <div className="px-5 py-10 text-center font-heading text-xs tracking-widest text-white">
            NO RESETS YET
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {resets.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-heading text-xs text-white">
                    {new Date(r.reset_at).toLocaleString('en-PK', {
                      weekday: 'short', day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                  <p className="font-heading text-[10px] tracking-widest text-white mt-0.5">
                    RESET BY {r.reset_by.toUpperCase()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-heading text-sm text-white">{formatPKR(r.amount_at_reset)}</p>
                  <p className="font-heading text-[9px] tracking-widest text-white/40 mt-0.5">
                    TAKEN OUT · LEFT {formatPKR(r.opening_balance ?? 0)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
