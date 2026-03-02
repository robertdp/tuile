// ---------------------------------------------------------------------------
// Tween Animation
// ---------------------------------------------------------------------------

import { signal } from "../reactive/signal.js";
import type { WriteSignal, ReadSignal } from "../reactive/signal.js";
import { resolveEasing } from "./easing.js";
import type { EasingName, EasingFn } from "./easing.js";
import { getScheduler } from "./scheduler.js";

// --- Types ---

export interface TweenOptions {
  /** Duration in milliseconds */
  duration: number;
  /** Easing function or name */
  easing?: EasingName | EasingFn;
  /** Delay before starting (ms) */
  delay?: number;
  /** Number of times to repeat (0 = play once, Infinity = loop forever) */
  repeat?: number;
  /** Reverse direction on each repeat */
  yoyo?: boolean;
  /** Auto-play on creation (default: true) */
  autoPlay?: boolean;
}

export interface TweenControl {
  /** The animated value as a readable signal */
  value: ReadSignal<number>;
  /** Start or resume the animation */
  play(): void;
  /** Pause the animation */
  pause(): void;
  /** Stop and reset to the start value */
  stop(): void;
  /** Reset to start without changing play state */
  reset(): void;
  /** Whether the animation has completed */
  readonly finished: ReadSignal<boolean>;
  /** Promise that resolves when the animation finishes */
  readonly done: Promise<void>;
}

/**
 * Create an animated value that tweens from `from` to `to` over time.
 *
 * ```ts
 * const x = animate(0, 100, { duration: 500, easing: "ease-out-cubic" });
 * // x.value is a signal that updates each frame
 * // Use in JSX: <Box marginLeft={x.value}>
 * ```
 */
export function animate(from: number, to: number, options: TweenOptions): TweenControl {
  const {
    duration,
    easing: easingOpt = "linear",
    delay = 0,
    repeat = 0,
    yoyo = false,
    autoPlay = true,
  } = options;

  const easingFn = resolveEasing(easingOpt);
  const val: WriteSignal<number> = signal(from);
  const finished: WriteSignal<boolean> = signal(false);

  let startTime = -1;
  let lastFrameTime = -1; // last scheduler timestamp (for pause elapsed calculation)
  let elapsed = 0;       // accumulated elapsed time (persists across pause/resume)
  let playing = false;
  let repeatCount = 0;
  let forward = true;    // current direction (for yoyo)
  let unregister: (() => void) | null = null;

  let resolveDone: (() => void) | null = null;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  function onFrame(timestamp: number): void {
    if (!playing) return;

    if (startTime < 0) {
      startTime = timestamp;
    }
    lastFrameTime = timestamp;

    const frameElapsed = elapsed + (timestamp - startTime);

    // Handle delay
    if (frameElapsed < delay) return;

    const animElapsed = frameElapsed - delay;
    let progress = duration > 0 ? Math.min(animElapsed / duration, 1) : 1;

    // Apply direction
    const t = forward ? progress : 1 - progress;
    const eased = easingFn(t);
    val.value = from + (to - from) * eased;

    // Animation complete for this cycle
    if (progress >= 1) {
      if (repeatCount < repeat) {
        repeatCount++;
        if (yoyo) forward = !forward;
        // Reset for next cycle
        elapsed = 0;
        startTime = timestamp;
      } else {
        // Fully done
        val.value = forward ? to : from;
        playing = false;
        finished.value = true;
        if (unregister) {
          unregister();
          unregister = null;
        }
        if (resolveDone) {
          resolveDone();
          resolveDone = null;
        }
      }
    }
  }

  function play(): void {
    if (playing) return;
    if (finished.peek()) return;

    playing = true;
    startTime = -1;

    const scheduler = getScheduler();
    unregister = scheduler.onFrame(onFrame);
  }

  function pause(): void {
    if (!playing) return;
    playing = false;

    // Accumulate elapsed time using the scheduler's timestamp, not Date.now()
    if (startTime >= 0 && lastFrameTime >= 0) {
      elapsed += lastFrameTime - startTime;
      startTime = -1;
    }

    if (unregister) {
      unregister();
      unregister = null;
    }
  }

  function stop(): void {
    playing = false;
    elapsed = 0;
    startTime = -1;
    repeatCount = 0;
    forward = true;
    val.value = from;
    finished.value = false;

    if (unregister) {
      unregister();
      unregister = null;
    }
  }

  function reset(): void {
    const wasPlaying = playing;
    stop();
    if (wasPlaying) play();
  }

  if (autoPlay) {
    play();
  }

  return {
    value: val as ReadSignal<number>,
    play,
    pause,
    stop,
    reset,
    get finished() { return finished as ReadSignal<boolean>; },
    get done() { return done; },
  };
}

// --- Spring Animation ---

export interface SpringOptions {
  /** Stiffness coefficient (default: 170) */
  stiffness?: number;
  /** Damping coefficient (default: 26) */
  damping?: number;
  /** Mass (default: 1) */
  mass?: number;
  /** Velocity threshold to consider "at rest" (default: 0.01) */
  restThreshold?: number;
  /** Auto-play (default: true) */
  autoPlay?: boolean;
}

export interface SpringControl {
  /** The animated value */
  value: ReadSignal<number>;
  /** Set a new target value */
  setTarget(target: number): void;
  /** Whether the spring is at rest */
  readonly atRest: ReadSignal<boolean>;
  /** Stop the spring */
  stop(): void;
}

/**
 * Create a spring-animated value.
 *
 * ```ts
 * const x = spring(0, { stiffness: 200, damping: 20 });
 * x.setTarget(100); // animates to 100 with spring physics
 * ```
 */
export function spring(initialValue: number, options: SpringOptions = {}): SpringControl {
  const {
    stiffness = 170,
    damping = 26,
    mass = 1,
    restThreshold = 0.01,
    autoPlay = true,
  } = options;

  const val: WriteSignal<number> = signal(initialValue);
  const atRest: WriteSignal<boolean> = signal(true);

  let target = initialValue;
  let velocity = 0;
  let lastTimestamp = -1;
  let unregister: (() => void) | null = null;

  function onFrame(timestamp: number): void {
    if (lastTimestamp < 0) {
      lastTimestamp = timestamp;
      return;
    }

    // Cap dt to avoid explosion after long pauses
    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.064);
    lastTimestamp = timestamp;

    const current = val.peek();
    const displacement = current - target;

    // Spring force: F = -kx - cv
    const springForce = -stiffness * displacement;
    const dampingForce = -damping * velocity;
    const acceleration = (springForce + dampingForce) / mass;

    velocity += acceleration * dt;
    const newValue = current + velocity * dt;

    val.value = newValue;

    // Check if at rest
    if (Math.abs(velocity) < restThreshold && Math.abs(newValue - target) < restThreshold) {
      val.value = target;
      velocity = 0;
      atRest.value = true;
      if (unregister) {
        unregister();
        unregister = null;
      }
    }
  }

  function startAnimation(): void {
    if (unregister) return;
    atRest.value = false;
    lastTimestamp = -1;
    const scheduler = getScheduler();
    unregister = scheduler.onFrame(onFrame);
  }

  function setTarget(newTarget: number): void {
    target = newTarget;
    if (val.peek() !== target || Math.abs(velocity) > restThreshold) {
      startAnimation();
    }
  }

  function stop(): void {
    velocity = 0;
    atRest.value = true;
    if (unregister) {
      unregister();
      unregister = null;
    }
  }

  if (autoPlay && initialValue !== target) {
    startAnimation();
  }

  return {
    value: val as ReadSignal<number>,
    setTarget,
    get atRest() { return atRest as ReadSignal<boolean>; },
    stop,
  };
}
