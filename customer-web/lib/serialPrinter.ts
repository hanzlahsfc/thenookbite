'use client';

// Shared ESC/POS thermal printer over Web Serial.
//
// Deliberately NOT a React hook: the granted port is a module-level singleton so
// every screen (POS, Verify, Admin Orders, Order Detail, POS Sessions) prints to
// the same printer. Web Serial permission is per-origin, so pairing once on any
// screen makes getPorts() resolve it everywhere, across reloads.

interface SerialPort {
  readable: ReadableStream | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}
interface SerialAPI {
  requestPort(): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

// ESC/POS commands
const DRAWER_PULSE  = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]); // ESC p 0 — pin 2
const DRAWER_PULSE2 = new Uint8Array([0x1b, 0x70, 0x01, 0x19, 0xfa]); // ESC p 1 — pin 5
const INIT          = new Uint8Array([0x1b, 0x40]);
// Double-strike. Kept because it is harmless, but on this printer it made no
// visible difference on its own — emphasis below is what actually darkens the
// output. Note CSS is irrelevant on this path: it only affects the
// browser-dialog fallback, not the printer's built-in font.
const DOUBLE_STRIKE = new Uint8Array([0x1b, 0x47, 0x01]);

/**
 * Print density.
 *
 * The printer's own self-test reports "Print Density: Level-2" on a scale that
 * goes to 3 — which is why the self-test page (printed by the firmware at full
 * strength) is dark while our text is not. Emphasis narrowed the gap; this
 * closes it.
 *
 * DC2 # n (0x12 0x23) is the density command these EPSON-compatible controllers
 * implement. If a printer does not support it, DC2 is a control character and is
 * discarded rather than printed, so this is safe to send unconditionally.
 *
 * Deliberately NOT touching ESC 7 (max heating dots / heating time / interval):
 * that drives the head's thermal timing directly and pushing it too far risks
 * overheating the print head. Density is the setting intended for this.
 */
const PRINT_DENSITY = new Uint8Array([0x12, 0x23, 0x03]); // DC2 # 3 — highest

/**
 * Select Font-A (ESC M 0).
 *
 * The self-test reports "Current Font: Font-A", the 12x24 face, and the
 * self-test page is the clearest thing this printer produces. Font-B is 9x17 —
 * fewer dots per character, so it always looks lighter and thinner. INIT should
 * restore Font-A anyway, but stating it means the receipt cannot inherit Font-B
 * from whatever printed last.
 */
const FONT_A = new Uint8Array([0x1b, 0x4d, 0x00]);
const CUT           = new Uint8Array([0x1d, 0x56, 0x42, 0x00]);
const ALIGN_CENTER  = new Uint8Array([0x1b, 0x61, 0x01]);
const ALIGN_LEFT    = new Uint8Array([0x1b, 0x61, 0x00]);
// Emphasis (ESC E). On this printer emphasised text comes out dark and clean
// while plain text is too faint to read comfortably — a printed receipt shows
// exactly that split, every bold line crisp and every plain line washed out.
// Double-strike alone made no difference, so the whole receipt runs emphasised
// and headings are distinguished by size (DOUBLE_HEIGHT) rather than weight.
// BOLD_OFF therefore keeps emphasis on; it only exists to mark where the
// original design stopped bolding.
const BOLD_ON       = new Uint8Array([0x1b, 0x45, 0x01]);
const BOLD_OFF      = new Uint8Array([0x1b, 0x45, 0x01]);
const DOUBLE_HEIGHT = new Uint8Array([0x1b, 0x21, 0x10]);
const NORMAL_SIZE   = new Uint8Array([0x1b, 0x21, 0x00]);
const FEED          = new Uint8Array([0x0a]);

/**
 * Receipt logo, converted to an ESC/POS raster image (GS v 0) and cached —
 * the PNG never changes between receipts, so it's decoded to a 1-bit bitmap
 * once per page load rather than on every print.
 *
 * Width is fixed at 280 dots (a multiple of 8, as GS v 0 requires) — most of
 * the ~384-dot printable width this printer uses (see the 32-char line width
 * elsewhere in this file), while still leaving a small margin on both sides.
 */
const LOGO_URL = '/logo-dark.png';
const LOGO_WIDTH_DOTS = 280;
let logoRasterPromise: Promise<Uint8Array | null> | null = null;

function rasterFromCanvas(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  const widthBytes = width / 8;
  const bitmap = new Uint8Array(widthBytes * height);

  // Threshold to 1-bit: the printer only knows black or white per dot.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (luminance < 140) bitmap[y * widthBytes + (x >> 3)] |= 0x80 >> (x % 8);
    }
  }

  const header = new Uint8Array([
    0x1d, 0x76, 0x30, 0x00,
    widthBytes & 0xff, (widthBytes >> 8) & 0xff,
    height & 0xff, (height >> 8) & 0xff,
  ]);
  const out = new Uint8Array(header.length + bitmap.length);
  out.set(header);
  out.set(bitmap, header.length);
  return out;
}

async function loadLogoRaster(): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') return null;
  try {
    const img = new Image();
    const ready = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('logo failed to load'));
    });
    img.src = LOGO_URL;
    await ready;

    const width = LOGO_WIDTH_DOTS;
    const height = Math.round((img.naturalHeight / img.naturalWidth) * width);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    // Flatten transparency onto white first — the logo has a transparent
    // background, and an unset canvas pixel would otherwise read as black
    // once thresholded, printing as a solid rectangle behind the badge.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    return rasterFromCanvas(canvas);
  } catch {
    return null; // offline or blocked — receipt still prints, just without the logo
  }
}

/** Cached ESC/POS logo bitmap; resolves null (skip it) if it can't be loaded. */
function getLogoRaster(): Promise<Uint8Array | null> {
  if (!logoRasterPromise) logoRasterPromise = loadLogoRaster();
  return logoRasterPromise;
}

const enc      = (t: string) => new TextEncoder().encode(t);
const line     = (t: string) => enc(t + '\n');
const dashes   = (w = 32) => enc('-'.repeat(w) + '\n');
const padLine  = (l: string, r: string, w = 32) =>
  enc(l + ' '.repeat(Math.max(1, w - l.length - r.length)) + r + '\n');

/**
 * A labelled block that wraps onto further lines — for delivery addresses,
 * which routinely run past the 32-character paper width and would otherwise be
 * cut off by padLine.
 */
function wrappedLines(label: string, text: string, w = 32): Uint8Array[] {
  const out: Uint8Array[] = [enc(`${label}:\n`)];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (current && (current + ' ' + word).length > w - 2) {
      out.push(enc(`  ${current}\n`));
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) out.push(enc(`  ${current}\n`));
  return out;
}

export interface ReceiptData {
  orderNum: string;
  dateStr: string;
  timeStr: string;
  typeLabel: string;
  customerName: string;
  phone?: string | null;
  cashierName: string;
  items: { name: string; price: number; quantity: number }[];
  subtotal: number;
  discountAmount?: number;
  deliveryCharge?: number;
  tipAmount?: number;
  /** Where the order is going — printed for delivery so the rider has it. */
  address?: string | null;
  riderName?: string | null;
  total: number;
  /** Cash handed over and change returned, for cash sales. */
  cashGiven?: number;
  changeDue?: number;
  paymentMethod: string;
  isPaid: boolean;
  notes?: string | null;
  /** Pulse the cash drawer as part of this receipt (cash payments). */
  openDrawer?: boolean;
}

export interface KitchenTicket {
  orderNum: string;
  typeLabel: string;
  timeStr: string;
  items: { name: string; quantity: number }[];
  notes?: string | null;
}

let port: SerialPort | null = null;
let restored = false;
const listeners = new Set<(paired: boolean) => void>();

function serialAPI(): SerialAPI | null {
  if (typeof navigator === 'undefined' || !('serial' in navigator)) return null;
  return (navigator as Navigator & { serial: SerialAPI }).serial;
}

export function hasSerialSupport(): boolean {
  return serialAPI() !== null;
}

export function isPaired(): boolean {
  return port !== null;
}

/** Subscribe to pairing changes (for UI badges). Returns an unsubscribe fn. */
export function onPairedChange(fn: (paired: boolean) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function setPort(p: SerialPort | null) {
  port = p;
  listeners.forEach(fn => fn(p !== null));
}

/** Re-attach to a previously granted port. Safe to call repeatedly. */
export async function restorePort(): Promise<boolean> {
  const serial = serialAPI();
  if (!serial) return false;
  if (port) return true;
  if (restored) return port !== null;
  restored = true;
  try {
    const ports = await serial.getPorts();
    if (ports.length > 0) { setPort(ports[0]); return true; }
  } catch { /* permission revoked or unavailable */ }
  return false;
}

/** Prompt the user to choose a printer. Requires a user gesture. */
export async function pairPrinter(): Promise<boolean> {
  const serial = serialAPI();
  if (!serial) return false;
  try {
    setPort(await serial.requestPort());
    return true;
  } catch {
    return false; // user dismissed the chooser
  }
}

// Serial ops run one at a time — the port exposes a single writer, so
// overlapping calls (drawer pulse + receipt) would otherwise clobber each other.
let chain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

async function withWriter<T>(fn: (w: WritableStreamDefaultWriter<Uint8Array>) => Promise<T>): Promise<T | null> {
  return serialize(() => withWriterUnsafe(fn));
}

async function withWriterUnsafe<T>(fn: (w: WritableStreamDefaultWriter<Uint8Array>) => Promise<T>): Promise<T | null> {
  await restorePort();
  if (!port) return null;
  let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  try {
    if (port.readable === null) await port.open({ baudRate: 9600 });
    writer = port.writable?.getWriter() ?? null;
    if (!writer) return null;
    return await fn(writer);
  } catch {
    return null;
  } finally {
    try { writer?.releaseLock(); } catch { /* already released */ }
  }
}

/**
 * Pop the drawer on its own.
 *
 * The same pulse at the head of a receipt fires the drawer, so bytes, baud, pin
 * and wiring are all proven good. Standalone it does not, which leaves two
 * suspects from the earlier attempts:
 *
 *  - closing the port right after writing can abort bytes still in flight, so
 *    the "flush" may have been destroying the pulse. No close here.
 *  - NUL padding may simply be stripped by the driver, in which case it never
 *    added the volume it was meant to. Use a real ESC/POS no-op instead:
 *    ESC d 0 ("print and feed 0 lines") is a genuine command the printer must
 *    consume, and feeds no paper.
 */
const FEED_ZERO = new Uint8Array([0x1b, 0x64, 0x00]); // ESC d 0 — no paper moves
const NOOP_PAD = (() => {
  const n = 170; // ~510 bytes, comparable to a short receipt
  const out = new Uint8Array(n * FEED_ZERO.length);
  for (let i = 0; i < n; i++) out.set(FEED_ZERO, i * FEED_ZERO.length);
  return out;
})();

export async function openDrawer(): Promise<boolean> {
  const wrote = await withWriter(async w => {
    await w.write(INIT);
    await w.write(DRAWER_PULSE);
    await w.write(DRAWER_PULSE2);
    await w.write(NOOP_PAD);
    await w.ready;
    return true;
  });
  // Deliberately NOT closing the port — that is what a receipt does, and a
  // receipt works.
  return wrote === true;
}

/** Print via ESC/POS. Returns false if no printer is paired, so callers can fall back. */
export async function printReceiptUSB(data: ReceiptData): Promise<boolean> {
  const itemCount = data.items.reduce((s, i) => s + i.quantity, 0);
  const logo = await getLogoRaster();

  const chunks: Uint8Array[] = [
    INIT,
    FONT_A,
    PRINT_DENSITY,
    DOUBLE_STRIKE,
    BOLD_ON,
    ...(data.openDrawer ? [DRAWER_PULSE, DRAWER_PULSE2] : []),
    FEED,
    ALIGN_CENTER,
    ...(logo ? [logo, FEED] : []),
    BOLD_ON, enc('THE NOOK BITE\n'), BOLD_OFF,
    line('Mandi Bahauddin, Punjab, Pakistan'),
    line('12 PM - 2 AM Daily'),
    line('Tel: 0327-9627442'),
    FEED,
    dashes(),
    ALIGN_LEFT,

    // The order-details block, bold throughout. Emphasis is stated explicitly
    // here rather than relying on the receipt-wide BOLD_ON: a printed bill shows
    // this block coming out lighter than the lines that set emphasis themselves,
    // so the global alone evidently does not reach it.
    //
    // The identity lines are double height as well, since this is the part staff
    // look an order up by. Double height halves the line to 16 characters, which
    // is why those labels are short and the rest sit below at normal size.
    DOUBLE_HEIGHT,
    BOLD_ON,
    padLine('Order#', `#${data.orderNum}`, 16),
    padLine('Time', data.timeStr.replace(/:\d\d /, ' '), 16),
    padLine('Type', data.typeLabel.split(' · ')[0], 16),
    ...(data.customerName ? [enc(`${data.customerName}\n`)] : []),
    ...(data.phone ? [enc(`${data.phone}\n`)] : []),
    // The address is what the rider works from, so it stays double height too
    ...(data.address ? wrappedLines('Address', data.address, 16) : []),
    NORMAL_SIZE,
    BOLD_ON,

    // Still bold, just not double height — reference detail rather than lookup
    BOLD_ON,
    padLine('Date', data.dateStr),
    ...(data.typeLabel.includes(' · ') ? [padLine('Table', data.typeLabel.split(' · ')[1])] : []),
    ...(data.riderName ? [padLine('Rider', data.riderName)] : []),
    padLine('Cashier', data.cashierName),
    dashes(),
    BOLD_ON, padLine('ITEM', 'QTY   AMOUNT'), BOLD_OFF,
    dashes(),
    ...data.items.flatMap(i => [
      enc(`${i.name}\n`),
      padLine(`  @ Rs.${i.price} each`, `x${i.quantity}  Rs.${i.price * i.quantity}`),
    ]),
    dashes(),
    padLine(`Subtotal (${itemCount} item${itemCount !== 1 ? 's' : ''})`, `Rs.${data.subtotal}`),
    ...(data.discountAmount ? [padLine('Discount', `-Rs.${data.discountAmount}`)] : []),
    ...(data.deliveryCharge ? [padLine('Delivery Charge', `Rs.${data.deliveryCharge}`)] : []),
    ...(data.tipAmount ? [padLine('Tip', `Rs.${data.tipAmount}`)] : []),
    padLine('Tax / Service Charge', 'Incl.'),
    dashes(),
    BOLD_ON, DOUBLE_HEIGHT,
    padLine('TOTAL', `Rs.${data.total}`, 28),
    NORMAL_SIZE, BOLD_OFF,
    padLine('Payment', data.paymentMethod.toUpperCase()),
    // Cash sales show what was handed over and what came back, so the customer
    // can check their change against the bill
    ...(data.cashGiven
      ? [
          padLine('Cash Received', `Rs.${data.cashGiven}`),
          BOLD_ON, DOUBLE_HEIGHT,
          padLine('CHANGE', `Rs.${data.changeDue ?? 0}`, 28),
          NORMAL_SIZE, BOLD_OFF,
        ]
      : []),
    FEED,
    ALIGN_CENTER,
    BOLD_ON,
    enc(data.isPaid ? `  PAID - ${data.paymentMethod.toUpperCase()}  \n` : '  UNPAID - PAY LATER  \n'),
    BOLD_OFF,
    ...(data.notes ? [FEED, ALIGN_LEFT, enc(`Note: ${data.notes}\n`), ALIGN_CENTER] : []),
    FEED,
    dashes(),
    BOLD_ON, line('THANK YOU FOR YOUR VISIT!'), BOLD_OFF,
    line('Please come again'),
    line('Powered by TNB POS System'),
    FEED, FEED, FEED,
    CUT,
  ];

  const r = await withWriter(async w => {
    for (const c of chunks) await w.write(c);
    return true;
  });
  return r === true;
}

/**
 * Kitchen docket: what to cook, nothing else. No branding, no prices, no totals.
 * Items are double-height so they read from across the kitchen.
 */
export async function printKitchenTicketUSB(t: KitchenTicket): Promise<boolean> {
  const chunks: Uint8Array[] = [
    INIT,
    FONT_A,
    PRINT_DENSITY,
    DOUBLE_STRIKE,
    BOLD_ON,
    ALIGN_CENTER,
    DOUBLE_HEIGHT, BOLD_ON, enc(`ORDER #${t.orderNum}\n`), BOLD_OFF, NORMAL_SIZE,
    BOLD_ON, line(t.typeLabel), BOLD_OFF,
    line(t.timeStr),
    dashes(),
    ALIGN_LEFT,
    // qty first — the kitchen reads count before dish
    ...t.items.flatMap(i => [
      DOUBLE_HEIGHT, BOLD_ON, enc(`${i.quantity} x ${i.name}\n`), BOLD_OFF, NORMAL_SIZE,
    ]),
    dashes(),
    ...(t.notes ? [BOLD_ON, enc(`NOTE: ${t.notes}\n`), BOLD_OFF, dashes()] : []),
    FEED, FEED, FEED,
    CUT,
  ];

  const r = await withWriter(async w => {
    for (const c of chunks) await w.write(c);
    return true;
  });
  return r === true;
}

/**
 * Density diagnostic strip.
 *
 * Three different commands are used across ESC/POS controllers to set darkness,
 * and this printer's documentation does not say which it implements. Rather than
 * keep guessing, print one strip that applies each in turn and compare the
 * blocks by eye: whichever band goes darker identifies the command that works.
 *
 *   DC2 # n   0x12 0x23 n   — density level, used by many EPSON-compatible clones
 *   ESC 7     0x1b 0x37 ... — max heating dots / heating time / heating interval
 *   GS ( E    0x1d 0x28 45  — Epson user setting mode, density parameter
 *
 * ESC 7 is included here at a moderate heating time (adjusting thermal timing is
 * what actually risks the head, so this stays well below the maximum) and is
 * reset to the default immediately after the sample.
 */
export async function printDensityTest(): Promise<boolean> {
  const sample = (label: string) => [
    enc(`${label}\n`),
    enc('  ABCDEFGH 0123456789 abcdefgh\n'),
    enc('  the quick brown fox jumps ov\n'),
  ];

  const chunks: Uint8Array[] = [
    INIT,
    ALIGN_LEFT,
    BOLD_ON, enc('DENSITY TEST\n'), BOLD_OFF,
    enc('Compare the blocks. Tell Claude\n'),
    enc('which one is darkest.\n'),
    dashes(),

    ...sample('1. BASELINE (no command)'),
    dashes(),

    new Uint8Array([0x12, 0x23, 0x03]),           // DC2 # 3
    ...sample('2. DC2 # 3'),
    dashes(),

    new Uint8Array([0x12, 0x23, 0x08]),           // DC2 # 8 — higher scale
    ...sample('3. DC2 # 8'),
    dashes(),

    new Uint8Array([0x1b, 0x37, 0x07, 0xa0, 0x02]), // ESC 7, heating time 160
    ...sample('4. ESC 7 (heat 160)'),
    new Uint8Array([0x1b, 0x37, 0x07, 0x50, 0x02]), // back to default 80
    dashes(),

    // GS ( E: enter user setting mode, set density, exit
    new Uint8Array([0x1d, 0x28, 0x45, 0x03, 0x00, 0x01, 0x49, 0x4e]), // enter
    new Uint8Array([0x1d, 0x28, 0x45, 0x04, 0x00, 0x05, 0x05, 0x02, 0x00]),
    new Uint8Array([0x1d, 0x28, 0x45, 0x02, 0x00, 0x04, 0x00]),       // exit
    ...sample('5. GS ( E user setting'),
    dashes(),

    INIT,
    enc('End of test.\n'),
    FEED, FEED, FEED,
    CUT,
  ];

  const r = await withWriter(async w => {
    for (const c of chunks) await w.write(c);
    return true;
  });
  return r === true;
}
