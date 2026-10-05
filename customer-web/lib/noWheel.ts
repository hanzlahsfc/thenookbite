import type { WheelEvent } from 'react';

/**
 * Stops the mouse wheel from changing a number input's value.
 *
 * A focused <input type="number"> increments/decrements on scroll, so rolling
 * the wheel over a price field silently edits it. Blurring on wheel leaves the
 * value alone and lets the page scroll normally; typing and the up/down spinner
 * buttons are unaffected.
 *
 * (preventDefault is not an option here — React attaches wheel listeners as
 * passive, and suppressing the event would also block page scrolling.)
 */
export function blurOnWheel(e: WheelEvent<HTMLInputElement>) {
  e.currentTarget.blur();
}
