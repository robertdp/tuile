import { describe, it, expect, vi } from "vitest";
import { signal, computed, effect, batch, _getSubscriberCount } from "../../src/reactive/signal.js";
import { isSignal, readValue, SIGNAL_BRAND } from "../../src/reactive/utils.js";

describe("signal", () => {
  it("stores and retrieves a value", () => {
    const s = signal(42);
    expect(s.value).toBe(42);
  });

  it("updates value", () => {
    const s = signal(1);
    s.value = 2;
    expect(s.value).toBe(2);
  });

  it("peek reads without subscribing", () => {
    const s = signal(10);
    const fn = vi.fn();
    effect(() => {
      fn(s.peek());
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(10);
    s.value = 20;
    // Effect should NOT re-run because we used peek
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not notify when value is the same (Object.is)", () => {
    const s = signal(1);
    const fn = vi.fn();
    effect(() => {
      fn(s.value);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    s.value = 1; // same value
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("distinguishes 0 and -0", () => {
    const s = signal(0);
    const fn = vi.fn();
    effect(() => {
      fn(s.value);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    s.value = -0;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("treats NaN as equal to NaN", () => {
    const s = signal(NaN);
    const fn = vi.fn();
    effect(() => {
      fn(s.value);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    s.value = NaN;
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("computed", () => {
  it("derives a value from signals", () => {
    const a = signal(2);
    const b = signal(3);
    const sum = computed(() => a.value + b.value);
    expect(sum.value).toBe(5);
  });

  it("updates when dependencies change", () => {
    const count = signal(1);
    const doubled = computed(() => count.value * 2);
    expect(doubled.value).toBe(2);
    count.value = 5;
    expect(doubled.value).toBe(10);
  });

  it("is lazy — does not evaluate until read", () => {
    const s = signal(0);
    const fn = vi.fn(() => s.value * 2);
    const c = computed(fn);
    expect(fn).not.toHaveBeenCalled();
    c.value; // triggers evaluation
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("caches result when dependencies have not changed", () => {
    const s = signal(1);
    const fn = vi.fn(() => s.value * 2);
    const c = computed(fn);
    c.value;
    c.value;
    c.value;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("re-evaluates after dependency changes", () => {
    const s = signal(1);
    const fn = vi.fn(() => s.value * 2);
    const c = computed(fn);
    expect(c.value).toBe(2);
    expect(fn).toHaveBeenCalledTimes(1);
    s.value = 5;
    expect(c.value).toBe(10);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("works in chains (computed depending on computed)", () => {
    const a = signal(1);
    const b = computed(() => a.value + 1);
    const c = computed(() => b.value * 2);
    expect(c.value).toBe(4);
    a.value = 10;
    expect(b.value).toBe(11);
    expect(c.value).toBe(22);
  });

  it("peek reads without subscribing", () => {
    const s = signal(1);
    const fn = vi.fn();
    const c = computed(() => s.value * 2);
    effect(() => {
      fn(c.peek());
    });
    expect(fn).toHaveBeenCalledTimes(1);
    s.value = 5;
    // Effect should not re-run — it only peeked at c
    expect(fn).toHaveBeenCalledTimes(1);
    // But the computed itself updates
    expect(c.value).toBe(10);
  });

  it("updates dependency tracking on re-evaluation", () => {
    const toggle = signal(true);
    const a = signal(1);
    const b = signal(2);
    const fn = vi.fn();

    const c = computed(() => (toggle.value ? a.value : b.value));
    effect(() => {
      fn(c.value);
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(1);

    // Changing b should NOT trigger since toggle is true (reading a)
    b.value = 20;
    expect(fn).toHaveBeenCalledTimes(1);

    // Switch to reading b
    toggle.value = false;
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(20);

    // Now changing a should NOT trigger
    a.value = 100;
    expect(fn).toHaveBeenCalledTimes(2);

    // But changing b should
    b.value = 30;
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenLastCalledWith(30);
  });
});

describe("effect", () => {
  it("runs immediately", () => {
    const fn = vi.fn();
    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("re-runs when a tracked signal changes", () => {
    const s = signal(0);
    const fn = vi.fn();
    effect(() => {
      fn(s.value);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    s.value = 1;
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(1);
  });

  it("tracks multiple signals", () => {
    const a = signal(1);
    const b = signal(2);
    const fn = vi.fn();
    effect(() => {
      fn(a.value + b.value);
    });
    expect(fn).toHaveBeenLastCalledWith(3);
    a.value = 10;
    expect(fn).toHaveBeenLastCalledWith(12);
    b.value = 20;
    expect(fn).toHaveBeenLastCalledWith(30);
  });

  it("dispose stops the effect", () => {
    const s = signal(0);
    const fn = vi.fn();
    const dispose = effect(() => {
      fn(s.value);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    dispose();
    s.value = 1;
    expect(fn).toHaveBeenCalledTimes(1); // no re-run
  });

  it("runs cleanup before re-execution", () => {
    const s = signal(0);
    const order: string[] = [];
    effect(() => {
      const val = s.value;
      order.push(`run:${val}`);
      return () => {
        order.push(`cleanup:${val}`);
      };
    });
    expect(order).toEqual(["run:0"]);
    s.value = 1;
    expect(order).toEqual(["run:0", "cleanup:0", "run:1"]);
    s.value = 2;
    expect(order).toEqual(["run:0", "cleanup:0", "run:1", "cleanup:1", "run:2"]);
  });

  it("runs cleanup on dispose", () => {
    const cleanupFn = vi.fn();
    const dispose = effect(() => {
      return cleanupFn;
    });
    expect(cleanupFn).not.toHaveBeenCalled();
    dispose();
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it("dispose is idempotent", () => {
    const cleanupFn = vi.fn();
    const dispose = effect(() => cleanupFn);
    dispose();
    dispose();
    dispose();
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it("updates dependency tracking on re-execution", () => {
    const toggle = signal(true);
    const a = signal(1);
    const b = signal(2);
    const fn = vi.fn();

    effect(() => {
      if (toggle.value) {
        fn("a", a.value);
      } else {
        fn("b", b.value);
      }
    });

    expect(fn).toHaveBeenCalledTimes(1);

    // Changing b should NOT re-run (toggle is true, only a is tracked)
    b.value = 20;
    expect(fn).toHaveBeenCalledTimes(1);

    // Switch branch
    toggle.value = false;
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("b", 20);

    // Now changing a should NOT re-run
    a.value = 100;
    expect(fn).toHaveBeenCalledTimes(2);

    // But b should
    b.value = 30;
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenLastCalledWith("b", 30);
  });

  it("works with computed signals", () => {
    const count = signal(0);
    const doubled = computed(() => count.value * 2);
    const fn = vi.fn();
    effect(() => {
      fn(doubled.value);
    });
    expect(fn).toHaveBeenLastCalledWith(0);
    count.value = 5;
    expect(fn).toHaveBeenLastCalledWith(10);
  });

  it("handles nested effects independently", () => {
    const a = signal(1);
    const b = signal(2);
    const outerFn = vi.fn();
    const innerFn = vi.fn();

    effect(() => {
      outerFn(a.value);
      effect(() => {
        innerFn(b.value);
      });
    });

    expect(outerFn).toHaveBeenCalledTimes(1);
    expect(innerFn).toHaveBeenCalledTimes(1);

    b.value = 20;
    expect(outerFn).toHaveBeenCalledTimes(1);
    expect(innerFn).toHaveBeenCalledTimes(2);
  });
});

describe("batch", () => {
  it("defers effect execution until batch ends", () => {
    const a = signal(0);
    const b = signal(0);
    const fn = vi.fn();

    effect(() => {
      fn(a.value + b.value);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    batch(() => {
      a.value = 1;
      b.value = 2;
    });

    // Should run only once after batch, not twice
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(3);
  });

  it("nested batches defer until outermost batch ends", () => {
    const s = signal(0);
    const fn = vi.fn();

    effect(() => {
      fn(s.value);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    batch(() => {
      s.value = 1;
      batch(() => {
        s.value = 2;
      });
      // inner batch end should not flush yet
      expect(fn).toHaveBeenCalledTimes(1);
      s.value = 3;
    });

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(3);
  });

  it("works with computed signals in batch", () => {
    const a = signal(1);
    const b = signal(2);
    const sum = computed(() => a.value + b.value);
    const fn = vi.fn();

    effect(() => {
      fn(sum.value);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(3);

    batch(() => {
      a.value = 10;
      b.value = 20;
    });

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(30);
  });
});

describe("integration", () => {
  it("diamond dependency does not cause double execution", () => {
    const s = signal(1);
    const a = computed(() => s.value + 1);
    const b = computed(() => s.value * 2);
    const fn = vi.fn();

    // Effect depends on both a and b, which both depend on s
    // Changing s should only run the effect once (via batch)
    batch(() => {
      effect(() => {
        fn(a.value + b.value);
      });
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(4); // (1+1) + (1*2)

    batch(() => {
      s.value = 5;
    });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(16); // (5+1) + (5*2)
  });

  it("diamond dependency without batch — effect runs only once", () => {
    const s = signal(1);
    const a = computed(() => s.value + 1);
    const b = computed(() => s.value * 2);
    const fn = vi.fn();

    effect(() => {
      fn(a.value + b.value);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(4); // (1+1) + (1*2)

    s.value = 5;
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(16); // (5+1) + (5*2)
  });

  it("computed does not notify when value is unchanged", () => {
    const s = signal(5);
    const clamped = computed(() => Math.min(s.value, 10));
    const fn = vi.fn();

    effect(() => {
      fn(clamped.value);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(5);

    // Change s but clamped stays the same (both < 10)
    s.value = 7;
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(7);

    // Both > 10, so clamped stays at 10
    s.value = 15;
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenLastCalledWith(10);

    // Still > 10, clamped unchanged — effect should NOT run
    s.value = 20;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("circular effect throws with depth error", () => {
    const s = signal(0);
    expect(() => {
      effect(() => {
        // Read and write the same signal — creates an infinite loop
        s.value = s.value + 1;
      });
    }).toThrow("Circular effect detected");
  });

  it("signal with object value", () => {
    const user = signal({ name: "Alice", age: 30 });
    const fn = vi.fn();
    effect(() => {
      fn(user.value.name);
    });
    expect(fn).toHaveBeenLastCalledWith("Alice");

    // Must assign a new object (not mutate) to trigger update
    user.value = { name: "Bob", age: 25 };
    expect(fn).toHaveBeenLastCalledWith("Bob");
  });

  it("signal with array value", () => {
    const items = signal([1, 2, 3]);
    const fn = vi.fn();
    effect(() => {
      fn(items.value.length);
    });
    expect(fn).toHaveBeenLastCalledWith(3);
    items.value = [...items.value, 4];
    expect(fn).toHaveBeenLastCalledWith(4);
  });

  it("many signals and effects", () => {
    const signals = Array.from({ length: 100 }, (_, i) => signal(i));
    const sum = computed(() => signals.reduce((acc, s) => acc + s.value, 0));
    const fn = vi.fn();
    effect(() => fn(sum.value));

    const expectedInitial = (99 * 100) / 2; // sum 0..99
    expect(fn).toHaveBeenLastCalledWith(expectedInitial);

    batch(() => {
      for (const s of signals) {
        s.value = s.peek() + 1;
      }
    });

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(expectedInitial + 100);
  });
});

describe("isSignal", () => {
  it("returns true for signal()", () => {
    const s = signal(42);
    expect(isSignal(s)).toBe(true);
  });

  it("returns true for computed()", () => {
    const s = signal(1);
    const c = computed(() => s.value * 2);
    expect(isSignal(c)).toBe(true);
  });

  it("returns false for plain objects with value and peek", () => {
    const fake = { value: 42, peek() { return 42; } };
    expect(isSignal(fake)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isSignal(null)).toBe(false);
  });

  it("returns false for primitives", () => {
    expect(isSignal(0)).toBe(false);
    expect(isSignal("hello")).toBe(false);
    expect(isSignal(undefined)).toBe(false);
  });

  it("signals have the brand symbol", () => {
    const s = signal("test");
    expect((s as any)[SIGNAL_BRAND]).toBe(true);
  });
});

describe("readValue", () => {
  it("unwraps a signal", () => {
    const s = signal(99);
    expect(readValue(s)).toBe(99);
  });

  it("unwraps a computed", () => {
    const s = signal(5);
    const c = computed(() => s.value + 10);
    expect(readValue(c)).toBe(15);
  });

  it("passes through plain values", () => {
    expect(readValue(42)).toBe(42);
    expect(readValue("hello")).toBe("hello");
    expect(readValue(null)).toBe(null);
    expect(readValue(undefined)).toBe(undefined);
  });

  it("does NOT unwrap fake signal-like objects", () => {
    const fake = { value: 99, peek() { return 99; } };
    expect(readValue(fake)).toBe(fake);
  });
});

describe("effect ownership", () => {
  it("disposes inner effects when outer effect re-runs", () => {
    const outer = signal(0);
    const inner = signal(0);
    const innerFn = vi.fn();

    effect(() => {
      outer.value;
      effect(() => {
        innerFn(inner.value);
      });
    });

    expect(innerFn).toHaveBeenCalledTimes(1);

    // Trigger outer re-run — old inner should be disposed, new inner created
    outer.value = 1;
    expect(innerFn).toHaveBeenCalledTimes(2);

    // Trigger inner signal — only the new (current) inner should fire
    inner.value = 1;
    expect(innerFn).toHaveBeenCalledTimes(3); // exactly 3, not 4
  });

  it("inner effect count stays bounded across many outer re-runs", () => {
    const trigger = signal(0);
    const inner = signal(0);
    const innerFn = vi.fn();

    effect(() => {
      trigger.value;
      effect(() => {
        innerFn(inner.value);
      });
    });

    // Re-run outer 100 times
    for (let i = 1; i <= 100; i++) {
      trigger.value = i;
    }

    innerFn.mockClear();
    inner.value = 999;
    // Only the single current inner effect should fire
    expect(innerFn).toHaveBeenCalledTimes(1);
  });

  it("independently disposing a child effect is safe", () => {
    const outer = signal(0);
    const inner = signal(0);
    const innerFn = vi.fn();
    let innerDispose: (() => void) | undefined;

    effect(() => {
      outer.value;
      innerDispose = effect(() => {
        innerFn(inner.value);
      });
    });

    expect(innerFn).toHaveBeenCalledTimes(1);

    // Independently dispose the inner effect
    innerDispose!();

    // Inner should no longer fire
    inner.value = 1;
    expect(innerFn).toHaveBeenCalledTimes(1);

    // Re-run outer — should not throw (double-disposal of already-disposed inner is safe)
    outer.value = 1;
    // A new inner is created
    expect(innerFn).toHaveBeenCalledTimes(2);
  });

  it("disposing outer effect also disposes all children", () => {
    const inner = signal(0);
    const innerFn = vi.fn();

    const dispose = effect(() => {
      effect(() => {
        innerFn(inner.value);
      });
    });

    expect(innerFn).toHaveBeenCalledTimes(1);

    dispose();

    inner.value = 1;
    expect(innerFn).toHaveBeenCalledTimes(1);
  });

  it("deeply nested effects are all disposed on outer re-run", () => {
    const trigger = signal(0);
    const leaf = signal(0);
    const leafFn = vi.fn();

    effect(() => {
      trigger.value;
      effect(() => {
        effect(() => {
          leafFn(leaf.value);
        });
      });
    });

    expect(leafFn).toHaveBeenCalledTimes(1);

    trigger.value = 1;
    expect(leafFn).toHaveBeenCalledTimes(2); // one fresh leaf

    leafFn.mockClear();
    leaf.value = 1;
    expect(leafFn).toHaveBeenCalledTimes(1); // only one leaf alive
  });

  it("subscriber count on inner signal stays bounded", () => {
    const trigger = signal(0);
    const inner = signal(0);

    effect(() => {
      trigger.value;
      effect(() => {
        inner.value;
      });
    });

    // Re-run outer 50 times
    for (let i = 1; i <= 50; i++) {
      trigger.value = i;
    }

    expect(_getSubscriberCount(inner)).toBe(1);
  });
});

describe("computed disposal", () => {
  it("dispose stops re-evaluation", () => {
    const s = signal(1);
    const fn = vi.fn(() => s.value * 2);
    const c = computed(fn);

    expect(c.value).toBe(2);
    expect(fn).toHaveBeenCalledTimes(1);

    c.dispose();

    s.value = 5;
    expect(c.value).toBe(2); // returns last cached value
    expect(fn).toHaveBeenCalledTimes(1); // not re-evaluated
  });

  it("dispose unsubscribes from dependencies", () => {
    const s = signal(1);
    const c = computed(() => s.value * 2);
    c.value; // force initial evaluation to subscribe

    expect(_getSubscriberCount(s)).toBeGreaterThan(0);

    c.dispose();
    expect(_getSubscriberCount(s)).toBe(0);
  });

  it("dispose is idempotent", () => {
    const s = signal(1);
    const c = computed(() => s.value * 2);
    c.value;

    c.dispose();
    c.dispose();
    c.dispose();

    expect(c.value).toBe(2);
  });

  it("computed inside effect is auto-disposed on re-run", () => {
    const trigger = signal(0);
    const source = signal(10);
    const fn = vi.fn();

    effect(() => {
      trigger.value;
      const derived = computed(() => source.value * 2);
      fn(derived.value);
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(20);

    const countBefore = _getSubscriberCount(source);

    // Re-run outer effect many times — old computeds should be disposed
    for (let i = 1; i <= 20; i++) {
      trigger.value = i;
    }

    expect(_getSubscriberCount(source)).toBeLessThanOrEqual(countBefore);
  });

  it("effects watching a disposed computed do not re-run", () => {
    const s = signal(1);
    const c = computed(() => s.value * 2);
    const fn = vi.fn();

    effect(() => {
      fn(c.value);
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(2);

    c.dispose();

    s.value = 5;
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
