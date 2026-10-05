'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  hasSerialSupport, isPaired, onPairedChange, restorePort,
  pairPrinter as pairPrinterCore, openDrawer as openDrawerCore,
  printReceiptUSB, type ReceiptData,
} from './serialPrinter';

export type DrawerStatus = 'idle' | 'opened' | 'error' | 'no-serial' | 'connecting' | 'not-paired';
export type { ReceiptData };

/**
 * React wrapper over the shared serialPrinter singleton. The port itself lives at
 * module scope, so a printer paired here is also used by Verify, Admin Orders,
 * Order Detail and POS Sessions.
 */
export function useCashDrawer() {
  const [status, setStatus] = useState<DrawerStatus>('idle');
  const [paired, setPaired] = useState(false);

  useEffect(() => {
    restorePort().then(() => setPaired(isPaired()));
    return onPairedChange(setPaired);
  }, []);

  const flash = (s: DrawerStatus) => {
    setStatus(s);
    setTimeout(() => setStatus('idle'), 2500);
  };

  const pairPrinter = useCallback(async () => {
    if (!hasSerialSupport()) { flash('no-serial'); return false; }
    return pairPrinterCore();
  }, []);

  const openDrawer = useCallback(async () => {
    if (!hasSerialSupport()) { flash('no-serial'); return; }
    await restorePort();
    // Never claim the drawer opened when nothing was sent — the old code
    // flashed "OPENED" even with no printer paired, so a dead button looked fine
    if (!isPaired()) { flash('not-paired'); return; }
    flash(await openDrawerCore() ? 'opened' : 'error');
  }, []);

  return { openDrawer, pairPrinter, paired, status, printReceiptUSB };
}
