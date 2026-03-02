// ---------------------------------------------------------------------------
// Shared signal utilities — branded type check and value unwrapping
// ---------------------------------------------------------------------------

import type { ReadSignal, WriteSignal } from "./signal.js";

/** Brand symbol for reliable signal identification */
export const SIGNAL_BRAND: unique symbol = Symbol.for("tuile:signal");

/** Type-safe signal check using brand symbol (no duck-typing false positives) */
export function isSignal(value: any): value is ReadSignal<any> | WriteSignal<any> {
  return value !== null && typeof value === "object" && SIGNAL_BRAND in value;
}

/** Unwrap a MaybeSignal to its underlying value */
export function readValue<T>(v: T | ReadSignal<T> | WriteSignal<T>): T {
  if (isSignal(v)) return v.value;
  return v as T;
}

/** Unwrap a MaybeSignal without creating a reactive subscription */
export function peekValue<T>(v: T | ReadSignal<T> | WriteSignal<T>): T {
  if (isSignal(v)) return v.peek();
  return v as T;
}
