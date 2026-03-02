import { describe, it, expect } from "vitest";
import { createScheduler } from "../../src/animation/scheduler.js";

describe("createScheduler", () => {
  it("calls registered callbacks on tick", () => {
    const scheduler = createScheduler(60);
    const calls: number[] = [];

    scheduler.onFrame((ts) => calls.push(ts));
    scheduler.tick(1000);

    expect(calls).toEqual([1000]);
  });

  it("supports multiple callbacks", () => {
    const scheduler = createScheduler(60);
    const a: number[] = [];
    const b: number[] = [];

    scheduler.onFrame((ts) => a.push(ts));
    scheduler.onFrame((ts) => b.push(ts));
    scheduler.tick(100);

    expect(a).toEqual([100]);
    expect(b).toEqual([100]);
  });

  it("unregister removes a callback", () => {
    const scheduler = createScheduler(60);
    const calls: number[] = [];

    const unsub = scheduler.onFrame((ts) => calls.push(ts));
    scheduler.tick(1);
    unsub();
    scheduler.tick(2);

    expect(calls).toEqual([1]);
  });

  it("safe to unregister during tick", () => {
    const scheduler = createScheduler(60);
    const calls: string[] = [];
    let unsub: () => void;

    unsub = scheduler.onFrame(() => {
      calls.push("a");
      unsub();
    });
    scheduler.onFrame(() => calls.push("b"));

    scheduler.tick(1);
    expect(calls).toEqual(["a", "b"]);

    // Second tick — 'a' should be gone
    calls.length = 0;
    scheduler.tick(2);
    expect(calls).toEqual(["b"]);
  });

  it("start/stop control running state", () => {
    const scheduler = createScheduler(60);
    expect(scheduler.running).toBe(false);
    scheduler.start();
    expect(scheduler.running).toBe(true);
    scheduler.stop();
    expect(scheduler.running).toBe(false);
  });
});
