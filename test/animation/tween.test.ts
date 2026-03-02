import { describe, it, expect, beforeEach } from "vitest";
import { animate, spring } from "../../src/animation/tween.js";
import { createScheduler, setScheduler } from "../../src/animation/scheduler.js";
import type { AnimationScheduler } from "../../src/animation/scheduler.js";

describe("animate", () => {
  let scheduler: AnimationScheduler;

  beforeEach(() => {
    // Use a manual scheduler so we control time precisely
    scheduler = createScheduler(60);
    scheduler.start();
    setScheduler(scheduler);
  });

  it("starts at 'from' value", () => {
    const tween = animate(0, 100, { duration: 1000, autoPlay: false });
    expect(tween.value.value).toBe(0);
  });

  it("interpolates linearly over duration", () => {
    const tween = animate(0, 100, { duration: 1000 });

    // Frame at t=0
    scheduler.tick(0);
    expect(tween.value.value).toBe(0);

    // Frame at t=500 (midpoint)
    scheduler.tick(500);
    expect(tween.value.value).toBeCloseTo(50, 0);

    // Frame at t=1000 (end)
    scheduler.tick(1000);
    expect(tween.value.value).toBe(100);
  });

  it("applies easing", () => {
    const tween = animate(0, 100, { duration: 1000, easing: "ease-in-quad" });

    scheduler.tick(0);
    scheduler.tick(500);

    // ease-in-quad at t=0.5 → 0.25, so value = 25
    expect(tween.value.value).toBeCloseTo(25, 0);
  });

  it("handles delay", () => {
    const tween = animate(0, 100, { duration: 1000, delay: 200 });

    scheduler.tick(0);
    expect(tween.value.value).toBe(0);

    // Still in delay period
    scheduler.tick(100);
    expect(tween.value.value).toBe(0);

    // Delay ends at 200, animation at 50%
    scheduler.tick(700);
    expect(tween.value.value).toBeCloseTo(50, 0);
  });

  it("repeats the animation", () => {
    const tween = animate(0, 100, { duration: 1000, repeat: 1 });

    // First cycle
    scheduler.tick(0);
    scheduler.tick(1000);
    expect(tween.value.value).toBe(100);
    expect(tween.finished.value).toBe(false);

    // Second cycle starts
    scheduler.tick(1500);
    expect(tween.value.value).toBeCloseTo(50, 0);

    // Second cycle ends → finished
    scheduler.tick(2000);
    expect(tween.value.value).toBe(100);
    expect(tween.finished.value).toBe(true);
  });

  it("yoyo reverses on repeat", () => {
    const tween = animate(0, 100, { duration: 1000, repeat: 1, yoyo: true });

    // First cycle forward
    scheduler.tick(0);
    scheduler.tick(500);
    expect(tween.value.value).toBeCloseTo(50, 0);

    // End of first cycle → starts reverse
    scheduler.tick(1000);

    // Second cycle (reversed): halfway back
    scheduler.tick(1500);
    expect(tween.value.value).toBeCloseTo(50, 0);

    // End of reverse → back to start
    scheduler.tick(2000);
    expect(tween.value.value).toBeCloseTo(0, 0);
  });

  it("pause and resume", () => {
    const tween = animate(0, 100, { duration: 1000 });

    scheduler.tick(0);
    scheduler.tick(300);
    expect(tween.value.value).toBeCloseTo(30, 0);

    tween.pause();

    // Ticking while paused shouldn't change value
    // (callback is unregistered on pause, so tick won't hit it)
    scheduler.tick(600);
    expect(tween.value.value).toBeCloseTo(30, 0);

    // Resume — should continue from where it left off
    tween.play();
    scheduler.tick(600); // new startTime
    scheduler.tick(1300); // 700ms more → total 1000
    expect(tween.value.value).toBe(100);
  });

  it("stop resets to start", () => {
    const tween = animate(0, 100, { duration: 1000 });

    scheduler.tick(0);
    scheduler.tick(500);
    expect(tween.value.value).toBeCloseTo(50, 0);

    tween.stop();
    expect(tween.value.value).toBe(0);
    expect(tween.finished.value).toBe(false);
  });

  it("finished signal and done promise", async () => {
    const tween = animate(0, 100, { duration: 100 });

    expect(tween.finished.value).toBe(false);

    scheduler.tick(0);
    scheduler.tick(100);

    expect(tween.finished.value).toBe(true);
    await tween.done; // should resolve without hanging
  });

  it("autoPlay: false does not start", () => {
    const tween = animate(0, 100, { duration: 1000, autoPlay: false });

    scheduler.tick(0);
    scheduler.tick(500);
    expect(tween.value.value).toBe(0);

    tween.play();
    scheduler.tick(500);
    scheduler.tick(1000);
    expect(tween.value.value).toBeCloseTo(50, 0);
  });

  it("zero duration completes immediately", () => {
    const tween = animate(0, 100, { duration: 0 });
    scheduler.tick(0);
    expect(tween.value.value).toBe(100);
    expect(tween.finished.value).toBe(true);
  });
});

describe("spring", () => {
  let scheduler: AnimationScheduler;

  beforeEach(() => {
    scheduler = createScheduler(60);
    scheduler.start();
    setScheduler(scheduler);
  });

  it("starts at initial value", () => {
    const s = spring(50);
    expect(s.value.value).toBe(50);
    expect(s.atRest.value).toBe(true);
  });

  it("animates toward target", () => {
    const s = spring(0, { stiffness: 200, damping: 20 });
    s.setTarget(100);

    expect(s.atRest.value).toBe(false);

    // Simulate several frames (16ms apart)
    let t = 0;
    for (let i = 0; i < 200; i++) {
      scheduler.tick(t);
      t += 16;
    }

    // Should have settled near target
    expect(s.value.value).toBeCloseTo(100, 0);
    expect(s.atRest.value).toBe(true);
  });

  it("stop freezes in place", () => {
    const s = spring(0, { stiffness: 200, damping: 20 });
    s.setTarget(100);

    scheduler.tick(0);
    scheduler.tick(16);
    scheduler.tick(32);

    const frozen = s.value.value;
    s.stop();

    scheduler.tick(48);
    scheduler.tick(64);

    expect(s.value.value).toBe(frozen);
    expect(s.atRest.value).toBe(true);
  });

  it("can change target mid-animation", () => {
    const s = spring(0, { stiffness: 200, damping: 20 });
    s.setTarget(100);

    let t = 0;
    for (let i = 0; i < 20; i++) {
      scheduler.tick(t);
      t += 16;
    }

    // Now retarget to -50
    s.setTarget(-50);

    for (let i = 0; i < 300; i++) {
      scheduler.tick(t);
      t += 16;
    }

    expect(s.value.value).toBeCloseTo(-50, 0);
    expect(s.atRest.value).toBe(true);
  });
});
