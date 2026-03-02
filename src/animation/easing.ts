// ---------------------------------------------------------------------------
// Easing Functions
// ---------------------------------------------------------------------------

export type EasingFn = (t: number) => number;

/** Named easing presets */
export type EasingName =
  | "linear"
  | "ease-in-quad"
  | "ease-out-quad"
  | "ease-in-out-quad"
  | "ease-in-cubic"
  | "ease-out-cubic"
  | "ease-in-out-cubic"
  | "ease-in-quart"
  | "ease-out-quart"
  | "ease-in-out-quart"
  | "ease-in-sine"
  | "ease-out-sine"
  | "ease-in-out-sine"
  | "ease-in-expo"
  | "ease-out-expo"
  | "ease-in-out-expo"
  | "ease-in-elastic"
  | "ease-out-elastic"
  | "ease-in-out-elastic"
  | "ease-in-bounce"
  | "ease-out-bounce"
  | "ease-in-out-bounce"
  | "ease-in-back"
  | "ease-out-back"
  | "ease-in-out-back";

// --- Individual easing functions ---

export const linear: EasingFn = (t) => t;

export const easeInQuad: EasingFn = (t) => t * t;
export const easeOutQuad: EasingFn = (t) => t * (2 - t);
export const easeInOutQuad: EasingFn = (t) =>
  t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

export const easeInCubic: EasingFn = (t) => t * t * t;
export const easeOutCubic: EasingFn = (t) => --t * t * t + 1;
export const easeInOutCubic: EasingFn = (t) =>
  t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

export const easeInQuart: EasingFn = (t) => t * t * t * t;
export const easeOutQuart: EasingFn = (t) => 1 - --t * t * t * t;
export const easeInOutQuart: EasingFn = (t) =>
  t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t;

export const easeInSine: EasingFn = (t) => 1 - Math.cos((t * Math.PI) / 2);
export const easeOutSine: EasingFn = (t) => Math.sin((t * Math.PI) / 2);
export const easeInOutSine: EasingFn = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

export const easeInExpo: EasingFn = (t) =>
  t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
export const easeOutExpo: EasingFn = (t) =>
  t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
export const easeInOutExpo: EasingFn = (t) => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2;
};

export const easeInElastic: EasingFn = (t) => {
  if (t === 0 || t === 1) return t;
  return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3));
};
export const easeOutElastic: EasingFn = (t) => {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};
export const easeInOutElastic: EasingFn = (t) => {
  if (t === 0 || t === 1) return t;
  const c = (2 * Math.PI) / 4.5;
  return t < 0.5
    ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c)) / 2
    : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c)) / 2 + 1;
};

export const easeOutBounce: EasingFn = (t) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};
export const easeInBounce: EasingFn = (t) => 1 - easeOutBounce(1 - t);
export const easeInOutBounce: EasingFn = (t) =>
  t < 0.5
    ? (1 - easeOutBounce(1 - 2 * t)) / 2
    : (1 + easeOutBounce(2 * t - 1)) / 2;

const BACK_C1 = 1.70158;
const BACK_C2 = BACK_C1 * 1.525;
const BACK_C3 = BACK_C1 + 1;

export const easeInBack: EasingFn = (t) => BACK_C3 * t * t * t - BACK_C1 * t * t;
export const easeOutBack: EasingFn = (t) =>
  1 + BACK_C3 * Math.pow(t - 1, 3) + BACK_C1 * Math.pow(t - 1, 2);
export const easeInOutBack: EasingFn = (t) =>
  t < 0.5
    ? (Math.pow(2 * t, 2) * ((BACK_C2 + 1) * 2 * t - BACK_C2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((BACK_C2 + 1) * (t * 2 - 2) + BACK_C2) + 2) / 2;

// --- Lookup ---

const easingMap: Record<EasingName, EasingFn> = {
  "linear": linear,
  "ease-in-quad": easeInQuad,
  "ease-out-quad": easeOutQuad,
  "ease-in-out-quad": easeInOutQuad,
  "ease-in-cubic": easeInCubic,
  "ease-out-cubic": easeOutCubic,
  "ease-in-out-cubic": easeInOutCubic,
  "ease-in-quart": easeInQuart,
  "ease-out-quart": easeOutQuart,
  "ease-in-out-quart": easeInOutQuart,
  "ease-in-sine": easeInSine,
  "ease-out-sine": easeOutSine,
  "ease-in-out-sine": easeInOutSine,
  "ease-in-expo": easeInExpo,
  "ease-out-expo": easeOutExpo,
  "ease-in-out-expo": easeInOutExpo,
  "ease-in-elastic": easeInElastic,
  "ease-out-elastic": easeOutElastic,
  "ease-in-out-elastic": easeInOutElastic,
  "ease-in-bounce": easeInBounce,
  "ease-out-bounce": easeOutBounce,
  "ease-in-out-bounce": easeInOutBounce,
  "ease-in-back": easeInBack,
  "ease-out-back": easeOutBack,
  "ease-in-out-back": easeInOutBack,
};

/**
 * Resolve an easing by name or return the function directly.
 */
export function resolveEasing(easing: EasingName | EasingFn): EasingFn {
  if (typeof easing === "function") return easing;
  const fn = easingMap[easing];
  if (!fn) throw new Error(`Unknown easing: ${easing}`);
  return fn;
}

/**
 * Create a cubic-bezier easing function.
 * Control points: (0,0) → (x1,y1) → (x2,y2) → (1,1)
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  // Newton-Raphson iteration to find t for a given x
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    let t = x; // Initial guess
    for (let i = 0; i < 8; i++) {
      const cx = sampleCurveX(t, x1, x2) - x;
      if (Math.abs(cx) < 1e-6) break;
      const dx = sampleCurveDerivativeX(t, x1, x2);
      if (Math.abs(dx) < 1e-6) break;
      t -= cx / dx;
    }

    return sampleCurveY(t, y1, y2);
  };
}

function sampleCurveX(t: number, x1: number, x2: number): number {
  return (((1 - 3 * x2 + 3 * x1) * t + (3 * x2 - 6 * x1)) * t + 3 * x1) * t;
}

function sampleCurveY(t: number, y1: number, y2: number): number {
  return (((1 - 3 * y2 + 3 * y1) * t + (3 * y2 - 6 * y1)) * t + 3 * y1) * t;
}

function sampleCurveDerivativeX(t: number, x1: number, x2: number): number {
  return (3 * (1 - 3 * x2 + 3 * x1)) * t * t + (2 * (3 * x2 - 6 * x1)) * t + 3 * x1;
}
