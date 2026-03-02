// ---------------------------------------------------------------------------
// Animation Scheduler
// ---------------------------------------------------------------------------

export type FrameCallback = (timestamp: number) => void;

export interface AnimationScheduler {
  /** Register a callback to run each animation frame. Returns an unregister function. */
  onFrame(cb: FrameCallback): () => void;
  /** Start the animation loop */
  start(): void;
  /** Stop the animation loop */
  stop(): void;
  /** Whether the scheduler is currently running */
  readonly running: boolean;
  /** Manually advance by one frame (for testing) */
  tick(timestamp: number): void;
}

/**
 * Create a global animation scheduler.
 *
 * When at least one callback is registered and the scheduler is started,
 * it ticks at approximately the target FPS. When all callbacks are removed,
 * it automatically pauses to avoid idle CPU usage.
 */
export function createScheduler(targetFps: number = 60): AnimationScheduler {
  const callbacks = new Set<FrameCallback>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let _running = false;
  const interval = Math.round(1000 / targetFps);

  function tick(timestamp: number): void {
    // Snapshot to allow removal during iteration
    const cbs = [...callbacks];
    for (const cb of cbs) {
      cb(timestamp);
    }
  }

  function loop(): void {
    const frameStart = Date.now();
    tick(frameStart);
    if (_running && callbacks.size > 0) {
      const elapsed = Date.now() - frameStart;
      timer = setTimeout(loop, Math.max(0, interval - elapsed));
    } else {
      timer = null;
    }
  }

  function startLoop(): void {
    if (timer !== null) return;
    timer = setTimeout(loop, interval);
  }

  function stopLoop(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function maybeStart(): void {
    if (_running && callbacks.size > 0) {
      startLoop();
    }
  }

  function maybeStop(): void {
    if (callbacks.size === 0) {
      stopLoop();
    }
  }

  return {
    onFrame(cb: FrameCallback): () => void {
      callbacks.add(cb);
      maybeStart();
      return () => {
        callbacks.delete(cb);
        maybeStop();
      };
    },

    start(): void {
      _running = true;
      maybeStart();
    },

    stop(): void {
      _running = false;
      stopLoop();
    },

    get running(): boolean {
      return _running;
    },

    tick,
  };
}

// Default global scheduler instance
let _globalScheduler: AnimationScheduler | null = null;

/**
 * Get or create the global animation scheduler.
 */
export function getScheduler(): AnimationScheduler {
  if (!_globalScheduler) {
    _globalScheduler = createScheduler(60);
    _globalScheduler.start();
  }
  return _globalScheduler;
}

/**
 * Replace the global scheduler (useful for testing).
 */
export function setScheduler(scheduler: AnimationScheduler): void {
  if (_globalScheduler) {
    _globalScheduler.stop();
  }
  _globalScheduler = scheduler;
}
