// ---------------------------------------------------------------------------
// Tuile Reactive System
// Fine-grained signals inspired by Solid.js / @preact/signals-core
//
// Push-dirty / pull-evaluate model:
//   Signal writes push dirty flags through the reactive graph.
//   Computed values evaluate lazily only when read.
// ---------------------------------------------------------------------------

// --- Internal types ---

/** Computed node states */
const CLEAN: number = 0;
const CHECK: number = 1;
const DIRTY: number = 2;

interface Subscriber {
  /** Mark this subscriber when a dependency changes or might have changed */
  stale(status: number): void;
  /** Re-execute this subscriber */
  execute(): void;
  /** Signals this subscriber depends on (for cleanup) */
  dependencies: Set<SignalState<any>>;
}

interface SignalState<T> {
  value: T;
  /** Monotonically increasing; incremented on actual value change */
  version: number;
  subscribers: Set<Subscriber>;
  /** For computed states: ensure this state is up-to-date */
  update?: () => void;
}

// --- Global tracking state ---

/** Stack of currently executing subscribers (for nested effects/computeds) */
const subscriberStack: Subscriber[] = [];

/** Current batch depth. When > 0, effect execution is deferred. */
let batchDepth = 0;

/** Effects queued during notification, executed when batch ends */
const batchQueue = new Set<Subscriber>();

/** Maximum flush iterations before declaring a cycle */
const MAX_FLUSH_ITERATIONS = 100;

/** WeakMap from public signal/computed objects to their internal state (test introspection) */
const signalStateMap = new WeakMap<object, SignalState<any>>();

type CleanupFn = () => void;
type DisposeFn = () => void;

/** Currently executing effect's child registration function */
let currentEffectScope: ((dispose: DisposeFn) => void) | null = null;

// --- Helpers ---

function getCurrentSubscriber(): Subscriber | undefined {
  return subscriberStack[subscriberStack.length - 1];
}

function trackRead<T>(state: SignalState<T>): void {
  const current = getCurrentSubscriber();
  if (current) {
    state.subscribers.add(current);
    current.dependencies.add(state);
  }
}

function notifySubscribers<T>(state: SignalState<T>): void {
  // Snapshot before iterating — stale() may modify the subscriber set
  const subs = [...state.subscribers];
  for (const sub of subs) {
    sub.stale(DIRTY);
  }
  if (batchDepth === 0) {
    flushBatchQueue();
  }
}

function flushBatchQueue(): void {
  let iterations = 0;
  while (batchQueue.size > 0) {
    iterations++;
    if (iterations > MAX_FLUSH_ITERATIONS) {
      batchQueue.clear();
      throw new Error("Circular effect detected: maximum depth exceeded");
    }
    const queued = [...batchQueue];
    batchQueue.clear();
    batchDepth++;
    const errors: unknown[] = [];
    for (const sub of queued) {
      try {
        sub.execute();
      } catch (err) {
        errors.push(err);
      }
    }
    batchDepth--;
    if (errors.length === 1) {
      throw errors[0];
    } else if (errors.length > 1) {
      throw new AggregateError(errors, `${errors.length} effects failed during flush`);
    }
  }
}

function cleanupSubscriber(sub: Subscriber): void {
  for (const dep of sub.dependencies) {
    dep.subscribers.delete(sub);
  }
  sub.dependencies.clear();
}

// --- Public API ---

import { SIGNAL_BRAND } from "./utils.js";

/** Readable signal interface */
export interface ReadSignal<T> {
  readonly [SIGNAL_BRAND]: true;
  readonly value: T;
  /** Read without subscribing */
  peek(): T;
}

/** Writable signal interface */
export interface WriteSignal<T> {
  readonly [SIGNAL_BRAND]: true;
  value: T;
  peek(): T;
}

/** Computed signal with disposal capability */
export interface ComputedSignal<T> extends ReadSignal<T> {
  /** Dispose the computed, unsubscribing from all dependencies.
   *  After disposal, reading .value returns the last cached value. */
  dispose(): void;
}

/**
 * Create a reactive signal.
 *
 * ```ts
 * const count = signal(0);
 * count.value; // 0 (reads & subscribes)
 * count.value = 1; // notifies subscribers
 * count.peek(); // 1 (reads without subscribing)
 * ```
 */
export function signal<T>(initialValue: T): WriteSignal<T> {
  const state: SignalState<T> = {
    value: initialValue,
    version: 0,
    subscribers: new Set(),
  };

  const sig: WriteSignal<T> = {
    [SIGNAL_BRAND]: true as const,
    get value(): T {
      trackRead(state);
      return state.value;
    },
    set value(newValue: T) {
      if (Object.is(state.value, newValue)) return;
      state.value = newValue;
      state.version++;
      notifySubscribers(state);
    },
    peek(): T {
      return state.value;
    },
  };

  signalStateMap.set(sig, state);
  return sig;
}

/**
 * Create a derived (computed) signal. Evaluates lazily: the compute
 * function runs only when `.value` is read and a dependency has changed.
 * Caches its result and skips re-evaluation when dependencies are unchanged.
 *
 * ```ts
 * const count = signal(1);
 * const doubled = computed(() => count.value * 2);
 * doubled.value; // 2
 * count.value = 5;
 * doubled.value; // 10
 * ```
 */
export function computed<T>(fn: () => T): ComputedSignal<T> {
  const state: SignalState<T> = {
    value: undefined as T,
    version: 0,
    subscribers: new Set(),
  };

  let status = DIRTY;
  let disposed = false;
  let depVersions = new Map<SignalState<any>, number>();

  function evaluate(): void {
    cleanupSubscriber(sub);
    subscriberStack.push(sub);
    try {
      const newValue = fn();
      if (!Object.is(state.value, newValue)) {
        state.value = newValue;
        state.version++;
      }
      status = CLEAN;
    } finally {
      subscriberStack.pop();
    }
    // Record dependency versions for CHECK resolution
    depVersions = new Map();
    for (const dep of sub.dependencies) {
      depVersions.set(dep, dep.version);
    }
  }

  function ensureUpToDate(): void {
    if (status === CLEAN || disposed) return;

    if (status === CHECK) {
      // Ensure upstream computeds are fresh
      for (const dep of sub.dependencies) {
        if (dep.update) dep.update();
        // Recursive stale() during update could escalate to DIRTY
        if (status === DIRTY) break;
      }
      if (status !== DIRTY) {
        // Check if any dependency version changed since last evaluation
        let anyChanged = false;
        for (const dep of sub.dependencies) {
          const lastVersion = depVersions.get(dep);
          if (lastVersion === undefined || lastVersion !== dep.version) {
            anyChanged = true;
            break;
          }
        }
        if (!anyChanged) {
          status = CLEAN;
          return;
        }
      }
    }

    // DIRTY — re-evaluate
    evaluate();
  }

  const sub: Subscriber = {
    dependencies: new Set(),
    stale(incoming: number) {
      if (disposed) return;
      if (status >= incoming) return;
      status = incoming;
      // Propagate CHECK to downstream subscribers
      const subs = [...state.subscribers];
      for (const s of subs) {
        s.stale(CHECK);
      }
    },
    execute() {
      // Unused in push-dirty / pull-evaluate model
    },
  };

  state.update = () => ensureUpToDate();

  const obj: ComputedSignal<T> = {
    [SIGNAL_BRAND]: true as const,
    get value(): T {
      trackRead(state);
      ensureUpToDate();
      return state.value;
    },
    peek(): T {
      ensureUpToDate();
      return state.value;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      cleanupSubscriber(sub);
    },
  };

  signalStateMap.set(obj, state);

  // Register with parent effect scope for automatic disposal
  if (currentEffectScope) {
    currentEffectScope(obj.dispose);
  }

  return obj;
}

/**
 * Create a reactive effect. Runs immediately and re-runs when any
 * signal read during execution changes.
 *
 * The effect function may optionally return a cleanup function,
 * which runs before each re-execution and on disposal.
 *
 * Effects created inside another effect are "owned" by the parent.
 * When the parent re-runs or is disposed, all child effects are
 * automatically disposed.
 *
 * ```ts
 * const count = signal(0);
 * const dispose = effect(() => {
 *   console.log("count is", count.value);
 *   return () => console.log("cleaning up");
 * });
 * count.value = 1; // logs "cleaning up", then "count is 1"
 * dispose(); // logs "cleaning up", stops tracking
 * ```
 */
export function effect(fn: () => void | CleanupFn): DisposeFn {
  let cleanup: CleanupFn | void;
  let disposed = false;
  let childDisposers: DisposeFn[] = [];
  let pending = CLEAN;
  let depVersions = new Map<SignalState<any>, number>();

  const sub: Subscriber = {
    dependencies: new Set(),
    stale(status: number) {
      if (disposed) return;
      if (status > pending) pending = status;
      batchQueue.add(sub);
    },
    execute() {
      if (disposed) return;

      const wasDirty = pending >= DIRTY;
      pending = CLEAN;

      if (!wasDirty) {
        // Only CHECK notifications — ensure computeds are fresh, then verify versions
        for (const dep of sub.dependencies) {
          if (dep.update) dep.update();
        }
        let anyChanged = false;
        for (const dep of sub.dependencies) {
          const lastVersion = depVersions.get(dep);
          if (lastVersion === undefined || lastVersion !== dep.version) {
            anyChanged = true;
            break;
          }
        }
        if (!anyChanged) return;
      }

      run();
    },
  };

  function run(): void {
    // Dispose child effects from previous run
    const children = childDisposers;
    childDisposers = [];
    for (const childDispose of children) {
      childDispose();
    }

    // Run previous cleanup
    if (cleanup) {
      cleanup();
      cleanup = undefined;
    }

    // Clean up old dependency tracking
    cleanupSubscriber(sub);

    // Set this effect as the current scope for child registration
    const prevScope = currentEffectScope;
    currentEffectScope = (childDispose: DisposeFn) => {
      childDisposers.push(childDispose);
    };

    // Execute and track new dependencies
    subscriberStack.push(sub);
    try {
      cleanup = fn() || undefined;
    } finally {
      subscriberStack.pop();
      currentEffectScope = prevScope;
    }

    // Record dependency versions for change detection
    depVersions = new Map();
    for (const dep of sub.dependencies) {
      depVersions.set(dep, dep.version);
    }
  }

  // Run immediately
  run();

  // Create dispose function
  const dispose: DisposeFn = () => {
    if (disposed) return;
    disposed = true;

    // Dispose children
    const children = childDisposers;
    childDisposers = [];
    for (const childDispose of children) {
      childDispose();
    }

    if (cleanup) {
      cleanup();
      cleanup = undefined;
    }
    cleanupSubscriber(sub);
  };

  // Register with parent scope if there is one
  if (currentEffectScope) {
    currentEffectScope(dispose);
  }

  return dispose;
}

/**
 * Run a callback with the effect ownership scope detached.
 * Computeds and effects created inside the callback will NOT
 * be registered as children of the current parent effect.
 * @internal Used by control-flow components (For) to keep
 * child-mounted reactive nodes alive across re-renders.
 */
export function runUnscoped<T>(fn: () => T): T {
  const prev = currentEffectScope;
  currentEffectScope = null;
  try {
    return fn();
  } finally {
    currentEffectScope = prev;
  }
}

/**
 * Batch multiple signal writes so that subscribers are only
 * notified once at the end.
 *
 * ```ts
 * const a = signal(0);
 * const b = signal(0);
 * batch(() => {
 *   a.value = 1;
 *   b.value = 2;
 * });
 * // Effects depending on a or b run once, not twice
 * ```
 */
export function batch(fn: () => void): void {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      flushBatchQueue();
    }
  }
}

/**
 * Return the number of active subscribers on a signal or computed.
 * Intended for tests only.
 */
export function _getSubscriberCount(sig: ReadSignal<any>): number {
  const state = signalStateMap.get(sig as any);
  return state ? state.subscribers.size : 0;
}
