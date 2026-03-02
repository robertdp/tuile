import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import { h } from "../../src/element/h.js";
import { mount, BOX } from "../../src/element/reconciler.js";
import { computeLayout } from "../../src/layout/engine.js";
import { createFocusManager } from "../../src/focus/manager.js";
import { render } from "../../src/renderer/screen.js";
import { Box } from "../../src/primitives/Box.js";
import { Handled } from "../../src/input/events.js";

function createMockStdout() {
  const em = new EventEmitter() as any;
  em.columns = 80;
  em.rows = 24;
  em.write = vi.fn(() => true);
  return em as NodeJS.WriteStream;
}

function createMockStdin() {
  const em = new EventEmitter() as any;
  em.isTTY = true;
  em.setRawMode = vi.fn();
  em.resume = vi.fn();
  em.pause = vi.fn();
  em.setEncoding = vi.fn();
  return em as NodeJS.ReadStream;
}

/** Helper: build layout tree and focus manager from an element */
function setup(el: ReturnType<typeof h>) {
  const root = mount(el);
  const layout = computeLayout(root, 80, 24);
  const fm = createFocusManager();
  fm.updateFocusableList(layout);
  return { root, layout, fm };
}

function key(name: string, overrides?: Partial<{ ctrl: boolean; alt: boolean; shift: boolean; raw: string }>) {
  return { key: name, raw: overrides?.raw ?? name, ctrl: overrides?.ctrl ?? false, alt: overrides?.alt ?? false, shift: overrides?.shift ?? false };
}

// =========================================================================
// Tab between groups
// =========================================================================

describe("Tab between focus groups", () => {
  it("Tab enters group then exits to next sibling", () => {
    const onFocusA = vi.fn();
    const onFocusB = vi.fn();
    const onFocusC = vi.fn();

    // standalone A, group (B1 B2), standalone C
    const el = h(BOX, {},
      h(Box, { tabIndex: 0, onFocus: onFocusA }),
      h(Box, { focusGroup: true },
        h(Box, { tabIndex: 0, onFocus: onFocusB }),
        h(Box, { tabIndex: 0 }),
      ),
      h(Box, { tabIndex: 0, onFocus: onFocusC }),
    );

    const { fm } = setup(el);

    // Tab 1 → standalone A
    fm.focusNext();
    expect(onFocusA).toHaveBeenCalledTimes(1);

    // Tab 2 → enters group, focuses first child (B)
    fm.focusNext();
    expect(onFocusB).toHaveBeenCalledTimes(1);

    // Tab 3 → exits group, moves to standalone C
    fm.focusNext();
    expect(onFocusC).toHaveBeenCalledTimes(1);
  });

  it("Shift+Tab enters group from end then exits backwards", () => {
    const onFocusA = vi.fn();
    const onFocusB2 = vi.fn();
    const onFocusC = vi.fn();

    const el = h(BOX, {},
      h(Box, { tabIndex: 0, onFocus: onFocusA }),
      h(Box, { focusGroup: true },
        h(Box, { tabIndex: 0 }),
        h(Box, { tabIndex: 0, onFocus: onFocusB2 }),
      ),
      h(Box, { tabIndex: 0, onFocus: onFocusC }),
    );

    const { fm } = setup(el);

    // Shift+Tab → wraps to last: standalone C
    fm.focusPrev();
    expect(onFocusC).toHaveBeenCalledTimes(1);

    // Shift+Tab → enters group from end (last child = B2)
    fm.focusPrev();
    expect(onFocusB2).toHaveBeenCalledTimes(1);

    // Shift+Tab → exits group backwards → standalone A
    fm.focusPrev();
    expect(onFocusA).toHaveBeenCalledTimes(1);
  });
});

// =========================================================================
// Arrow navigation within groups
// =========================================================================

describe("arrow navigation within groups", () => {
  it("up/down navigates within a vertical group", () => {
    const onFocusB1 = vi.fn();
    const onFocusB2 = vi.fn();
    const onFocusB3 = vi.fn();

    const el = h(BOX, {},
      h(Box, { focusGroup: true },
        h(Box, { tabIndex: 0, onFocus: onFocusB1 }),
        h(Box, { tabIndex: 0, onFocus: onFocusB2 }),
        h(Box, { tabIndex: 0, onFocus: onFocusB3 }),
      ),
    );

    const { fm } = setup(el);

    // Tab into group
    fm.focusNext();
    expect(onFocusB1).toHaveBeenCalledTimes(1);

    // Down → B2
    const downHandled = fm.handleGroupKey(key("down"));
    expect(downHandled).toBe(true);
    expect(onFocusB2).toHaveBeenCalledTimes(1);

    // Down → B3
    fm.handleGroupKey(key("down"));
    expect(onFocusB3).toHaveBeenCalledTimes(1);

    // Up → B2
    fm.handleGroupKey(key("up"));
    expect(onFocusB2).toHaveBeenCalledTimes(2);
  });

  it("left/right navigates within a horizontal group", () => {
    const onFocus1 = vi.fn();
    const onFocus2 = vi.fn();

    const el = h(BOX, {},
      h(Box, { focusGroup: { navigationKeys: "horizontal" } },
        h(Box, { tabIndex: 0, onFocus: onFocus1 }),
        h(Box, { tabIndex: 0, onFocus: onFocus2 }),
      ),
    );

    const { fm } = setup(el);

    fm.focusNext();
    expect(onFocus1).toHaveBeenCalledTimes(1);

    fm.handleGroupKey(key("right"));
    expect(onFocus2).toHaveBeenCalledTimes(1);

    fm.handleGroupKey(key("left"));
    expect(onFocus1).toHaveBeenCalledTimes(2);
  });

  it("up/down does not affect navigation outside of a group", () => {
    const el = h(BOX, {},
      h(Box, { tabIndex: 0 }),
      h(Box, { tabIndex: 0 }),
    );

    const { fm } = setup(el);

    fm.focusNext();

    const handled = fm.handleGroupKey(key("down"));
    expect(handled).toBe(false);
  });
});

// =========================================================================
// Escape exits group
// =========================================================================

describe("Escape exits group", () => {
  it("Escape exits group", () => {
    const onFocusA = vi.fn();
    const onFocusB1 = vi.fn();

    const el = h(BOX, {},
      h(Box, { tabIndex: 0, onFocus: onFocusA }),
      h(Box, { focusGroup: true },
        h(Box, { tabIndex: 0, onFocus: onFocusB1 }),
        h(Box, { tabIndex: 0 }),
      ),
    );

    const { fm } = setup(el);

    // Tab to A, then into group
    fm.focusNext();
    fm.focusNext();
    expect(onFocusB1).toHaveBeenCalledTimes(1);
    expect(fm.activeGroup.peek()).not.toBeNull();

    // Escape → exit group
    fm.handleGroupKey(key("escape", { raw: "\x1b" }));
    expect(fm.activeGroup.peek()).toBeNull();
  });

  it("custom exitKey works", () => {
    const el = h(BOX, {},
      h(Box, { focusGroup: { exitKey: "q" } },
        h(Box, { tabIndex: 0 }),
        h(Box, { tabIndex: 0 }),
      ),
    );

    const { fm } = setup(el);

    fm.focusNext();
    expect(fm.activeGroup.peek()).not.toBeNull();

    // Escape should NOT work
    const handled1 = fm.handleGroupKey(key("escape", { raw: "\x1b" }));
    expect(handled1).toBe(false);
    expect(fm.activeGroup.peek()).not.toBeNull();

    // "q" should work
    const handled2 = fm.handleGroupKey(key("q"));
    expect(handled2).toBe(true);
    expect(fm.activeGroup.peek()).toBeNull();
  });
});

// =========================================================================
// Nested groups
// =========================================================================

describe("nested groups", () => {
  it("arrow keys navigate into nested groups", () => {
    const onFocusOuter1 = vi.fn();
    const onFocusInner = vi.fn();

    const el = h(BOX, {},
      h(Box, { focusGroup: true },
        h(Box, { tabIndex: 0, onFocus: onFocusOuter1 }),
        h(Box, { focusGroup: true },
          h(Box, { tabIndex: 0, onFocus: onFocusInner }),
        ),
      ),
    );

    const { fm } = setup(el);

    // Tab → enter outer group → first child
    fm.focusNext();
    expect(onFocusOuter1).toHaveBeenCalledTimes(1);

    // Down → inner group (auto-enter) → its first child
    fm.handleGroupKey(key("down"));
    expect(onFocusInner).toHaveBeenCalledTimes(1);
  });

  it("Escape exits inner group then outer group", () => {
    const el = h(BOX, {},
      h(Box, { tabIndex: 0 }),
      h(Box, { focusGroup: true },
        h(Box, { tabIndex: 0 }),
        h(Box, { focusGroup: true },
          h(Box, { tabIndex: 0 }),
        ),
      ),
    );

    const { fm } = setup(el);

    // Enter outer group via Tab
    fm.focusNext(); // standalone
    fm.focusNext(); // enter outer → first child

    // Arrow down → enter inner group
    fm.handleGroupKey(key("down"));

    // Now in inner group — activeGroup should be inner
    expect(fm.activeGroup.peek()).not.toBeNull();

    // Escape → back to outer group
    fm.handleGroupKey(key("escape", { raw: "\x1b" }));
    expect(fm.activeGroup.peek()).not.toBeNull(); // still in outer

    // Escape again → back to root
    fm.handleGroupKey(key("escape", { raw: "\x1b" }));
    expect(fm.activeGroup.peek()).toBeNull();
  });
});

// =========================================================================
// Focus restoration
// =========================================================================

describe("focus restoration", () => {
  it("re-entering a group restores last focused child", () => {
    const onFocus1 = vi.fn();
    const onFocus2 = vi.fn();

    const el = h(BOX, {},
      h(Box, { tabIndex: 0 }),
      h(Box, { focusGroup: true },
        h(Box, { tabIndex: 0, onFocus: onFocus1 }),
        h(Box, { tabIndex: 0, onFocus: onFocus2 }),
      ),
    );

    const { fm } = setup(el);

    // Enter group
    fm.focusNext(); // standalone
    fm.focusNext(); // enter group → first child
    expect(onFocus1).toHaveBeenCalledTimes(1);

    // Navigate to second child via arrow
    fm.handleGroupKey(key("down"));
    expect(onFocus2).toHaveBeenCalledTimes(1);

    // Exit group via Escape
    fm.handleGroupKey(key("escape", { raw: "\x1b" }));

    // Tab advances past group → wraps to standalone
    fm.focusNext();

    // Tab again → re-enters group → should restore to second child
    onFocus2.mockClear();
    fm.focusNext();
    expect(onFocus2).toHaveBeenCalledTimes(1);
  });
});

// =========================================================================
// tabCycles: true
// =========================================================================

describe("tabCycles: true", () => {
  it("Tab cycles within group when tabCycles is true", () => {
    const onFocus1 = vi.fn();
    const onFocus2 = vi.fn();
    const onFocusOutside = vi.fn();

    const el = h(BOX, {},
      h(Box, { tabIndex: 0, onFocus: onFocusOutside }),
      h(Box, { focusGroup: { tabCycles: true } },
        h(Box, { tabIndex: 0, onFocus: onFocus1 }),
        h(Box, { tabIndex: 0, onFocus: onFocus2 }),
      ),
    );

    const { fm } = setup(el);

    // Tab past standalone into group
    fm.focusNext(); // standalone
    fm.focusNext(); // enter group → first
    expect(onFocus1).toHaveBeenCalledTimes(1);

    // Tab within group → second
    fm.focusNext();
    expect(onFocus2).toHaveBeenCalledTimes(1);

    // Tab within group → wraps to first (doesn't exit)
    onFocus1.mockClear();
    fm.focusNext();
    expect(onFocus1).toHaveBeenCalledTimes(1);

    // Outside should never be re-focused after entering group
    expect(onFocusOutside).toHaveBeenCalledTimes(1); // only from initial Tab
  });

  it("Shift+Tab cycles backwards within tabCycles group", () => {
    const onFocus1 = vi.fn();
    const onFocus2 = vi.fn();

    const el = h(BOX, {},
      h(Box, { tabIndex: 0 }),
      h(Box, { focusGroup: { tabCycles: true } },
        h(Box, { tabIndex: 0, onFocus: onFocus1 }),
        h(Box, { tabIndex: 0, onFocus: onFocus2 }),
      ),
    );

    const { fm } = setup(el);

    // Enter group
    fm.focusNext(); // standalone
    fm.focusNext(); // enter group → first
    expect(onFocus1).toHaveBeenCalledTimes(1);

    // Shift+Tab → wraps to last in group
    fm.focusPrev();
    expect(onFocus2).toHaveBeenCalledTimes(1);

    // Shift+Tab → wraps to first
    onFocus1.mockClear();
    fm.focusPrev();
    expect(onFocus1).toHaveBeenCalledTimes(1);
  });
});

// =========================================================================
// autoActivate: false
// =========================================================================

describe("autoActivate: false", () => {
  it("Tab focuses group node instead of entering when autoActivate is false", () => {
    const onGroupFocus = vi.fn();
    const onChildFocus = vi.fn();

    const el = h(BOX, {},
      h(Box, { tabIndex: 0 }),
      h(Box, { focusGroup: { autoActivate: false }, tabIndex: 0, onFocus: onGroupFocus },
        h(Box, { tabIndex: 0, onFocus: onChildFocus }),
      ),
    );

    const { fm } = setup(el);

    fm.focusNext(); // standalone
    fm.focusNext(); // group node (not entered)

    expect(onGroupFocus).toHaveBeenCalledTimes(1);
    expect(onChildFocus).not.toHaveBeenCalled();
  });
});

// =========================================================================
// exitKey: false (trap)
// =========================================================================

describe("exitKey: false (focus trap via focusGroup)", () => {
  it("Escape does not exit when exitKey is false", () => {
    const el = h(BOX, {},
      h(Box, { tabIndex: 0 }),
      h(Box, { focusGroup: { exitKey: false } },
        h(Box, { tabIndex: 0 }),
        h(Box, { tabIndex: 0 }),
      ),
    );

    const { fm } = setup(el);

    // Enter group
    fm.focusNext(); // standalone
    fm.focusNext(); // enter group
    expect(fm.activeGroup.peek()).not.toBeNull();

    // Escape should be ignored (trapped)
    fm.handleGroupKey(key("escape", { raw: "\x1b" }));
    expect(fm.activeGroup.peek()).not.toBeNull();
  });
});

// =========================================================================
// tabIndex priority within groups
// =========================================================================

describe("tabIndex priority within groups", () => {
  it("positive tabIndex elements are focused before tabIndex 0 within a group", () => {
    const onFocus0 = vi.fn();
    const onFocusHigh = vi.fn();

    const el = h(BOX, {},
      h(Box, { focusGroup: { tabCycles: true } },
        h(Box, { tabIndex: 0, onFocus: onFocus0 }),
        h(Box, { tabIndex: 1, onFocus: onFocusHigh }),
      ),
    );

    const { fm } = setup(el);

    // Tab into group → tabIndex 1 (positive, sorted first)
    fm.focusNext();
    expect(onFocusHigh).toHaveBeenCalledTimes(1);
    expect(onFocus0).not.toHaveBeenCalled();

    // Tab → tabIndex 0
    fm.focusNext();
    expect(onFocus0).toHaveBeenCalledTimes(1);
  });

  it("tabIndex order is NOT applied at root level (backward compat)", () => {
    const onFocus0 = vi.fn();
    const onFocusHigh = vi.fn();

    const el = h(BOX, {},
      h(Box, { tabIndex: 0, onFocus: onFocus0 }),
      h(Box, { tabIndex: 1, onFocus: onFocusHigh }),
    );

    const { fm } = setup(el);

    // First Tab → tree-order first element (tabIndex 0)
    fm.focusNext();
    expect(onFocus0).toHaveBeenCalledTimes(1);
    expect(onFocusHigh).not.toHaveBeenCalled();
  });
});

// =========================================================================
// Component key handling prevents group nav
// =========================================================================

describe("component key handling prevents group navigation", () => {
  it("component handling a key prevents group navigation", () => {
    const stdout = createMockStdout();
    const stdin = createMockStdin();

    const onFocus1 = vi.fn();
    const onFocus2 = vi.fn();

    const el = h(BOX, {},
      h(Box, { focusGroup: true },
        h(Box, { tabIndex: 0, onFocus: onFocus1, onKeyPress: () => Handled }),
        h(Box, { tabIndex: 0, onFocus: onFocus2 }),
      ),
    );

    const handle = render(el, { stdout, stdin, altScreen: false });

    // Tab into group
    stdin.emit("data", "\t");
    expect(onFocus1).toHaveBeenCalled();

    // Down arrow — component handles it, so group nav should NOT happen
    onFocus2.mockClear();
    stdin.emit("data", "\x1b[B"); // down arrow
    expect(onFocus2).not.toHaveBeenCalled();

    handle.unmount();
  });
});

// =========================================================================
// Empty groups
// =========================================================================

describe("empty groups", () => {
  it("Tab skips groups with no focusable children", () => {
    const onFocusA = vi.fn();
    const onFocusC = vi.fn();

    const el = h(BOX, {},
      h(Box, { tabIndex: 0, onFocus: onFocusA }),
      h(Box, { focusGroup: true },
        h(Box, {}), // no tabIndex
      ),
      h(Box, { tabIndex: 0, onFocus: onFocusC }),
    );

    const { fm } = setup(el);

    fm.focusNext(); // A
    expect(onFocusA).toHaveBeenCalledTimes(1);

    fm.focusNext(); // skips empty group → C
    expect(onFocusC).toHaveBeenCalledTimes(1);
  });
});

// =========================================================================
// Wrapping
// =========================================================================

describe("wrap: false", () => {
  it("arrow navigation does not wrap at boundaries when wrap is false", () => {
    const onFocus1 = vi.fn();
    const onFocus2 = vi.fn();

    const el = h(BOX, {},
      h(Box, { focusGroup: { wrap: false } },
        h(Box, { tabIndex: 0, onFocus: onFocus1 }),
        h(Box, { tabIndex: 0, onFocus: onFocus2 }),
      ),
    );

    const { fm } = setup(el);

    fm.focusNext(); // enter group → first
    expect(onFocus1).toHaveBeenCalledTimes(1);

    // Navigate to second
    fm.handleGroupKey(key("down"));
    expect(onFocus2).toHaveBeenCalledTimes(1);

    // Navigate past end — should stay on second (no wrap)
    onFocus1.mockClear();
    fm.handleGroupKey(key("down"));
    expect(onFocus1).not.toHaveBeenCalled();
    expect(fm.focused.peek()).not.toBeNull();
  });
});

// =========================================================================
// focusTrap backward compatibility
// =========================================================================

describe("focusTrap backward compatibility", () => {
  it("focusTrap constrains Tab navigation", () => {
    const el = h(BOX, { width: 80, height: 24 },
      h(Box, { tabIndex: 0 }),
      h(Box, { focusTrap: true },
        h(Box, { tabIndex: 0 }),
        h(Box, { tabIndex: 0 }),
      ),
    );

    const root = mount(el);
    const layout = computeLayout(root, 80, 24);
    const fm = createFocusManager();
    fm.updateFocusableList(layout);

    // focusTrap should auto-capture focus
    expect(fm.focused.peek()).not.toBeNull();
    const trapChildren = root.children[1].children;
    expect(fm.focused.peek()).toBe(trapChildren[0]);

    // Tab cycles within trap (tabCycles: true)
    fm.focusNext();
    expect(fm.focused.peek()).toBe(trapChildren[1]);

    fm.focusNext();
    expect(fm.focused.peek()).toBe(trapChildren[0]); // wraps
  });
});

// =========================================================================
// Integration with render()
// =========================================================================

describe("focus groups through render()", () => {
  let stdout: NodeJS.WriteStream;
  let stdin: ReturnType<typeof createMockStdin>;

  beforeEach(() => {
    stdout = createMockStdout();
    stdin = createMockStdin();
  });

  it("Tab and arrow keys navigate groups through render()", () => {
    const onFocusA = vi.fn();
    const onFocusB1 = vi.fn();
    const onFocusB2 = vi.fn();
    const onFocusC = vi.fn();

    const el = h(BOX, {},
      h(Box, { tabIndex: 0, onFocus: onFocusA }),
      h(Box, { focusGroup: true },
        h(Box, { tabIndex: 0, onFocus: onFocusB1 }),
        h(Box, { tabIndex: 0, onFocus: onFocusB2 }),
      ),
      h(Box, { tabIndex: 0, onFocus: onFocusC }),
    );

    const handle = render(el, { stdout, stdin, altScreen: false });

    // Tab → A
    stdin.emit("data", "\t");
    expect(onFocusA).toHaveBeenCalledTimes(1);

    // Tab → enter group → B1
    stdin.emit("data", "\t");
    expect(onFocusB1).toHaveBeenCalledTimes(1);

    // Down → B2
    stdin.emit("data", "\x1b[B"); // down arrow
    expect(onFocusB2).toHaveBeenCalledTimes(1);

    // Tab → exit group → C
    stdin.emit("data", "\t");
    expect(onFocusC).toHaveBeenCalledTimes(1);

    handle.unmount();
  });

  it("Shift+Tab navigates backwards through render()", () => {
    const onFocusA = vi.fn();
    const onFocusB2 = vi.fn();
    const onFocusC = vi.fn();

    const el = h(BOX, {},
      h(Box, { tabIndex: 0, onFocus: onFocusA }),
      h(Box, { focusGroup: true },
        h(Box, { tabIndex: 0 }),
        h(Box, { tabIndex: 0, onFocus: onFocusB2 }),
      ),
      h(Box, { tabIndex: 0, onFocus: onFocusC }),
    );

    const handle = render(el, { stdout, stdin, altScreen: false });

    // Shift+Tab → wraps to C
    stdin.emit("data", "\x1b[Z"); // Shift+Tab
    expect(onFocusC).toHaveBeenCalledTimes(1);

    // Shift+Tab → enters group from end → B2
    stdin.emit("data", "\x1b[Z");
    expect(onFocusB2).toHaveBeenCalledTimes(1);

    // Shift+Tab → exits group → A
    stdin.emit("data", "\x1b[Z");
    expect(onFocusA).toHaveBeenCalledTimes(1);

    handle.unmount();
  });

  it("Escape exits group through render()", () => {
    const onFocusB1 = vi.fn();

    const el = h(BOX, {},
      h(Box, { tabIndex: 0 }),
      h(Box, { focusGroup: true },
        h(Box, { tabIndex: 0, onFocus: onFocusB1 }),
        h(Box, { tabIndex: 0 }),
      ),
    );

    const handle = render(el, { stdout, stdin, altScreen: false });

    // Tab → standalone, Tab → enter group
    stdin.emit("data", "\t");
    stdin.emit("data", "\t");
    expect(onFocusB1).toHaveBeenCalled();
    expect(handle.focus.activeGroup.peek()).not.toBeNull();

    // Escape → exit group
    stdin.emit("data", "\x1b");
    expect(handle.focus.activeGroup.peek()).toBeNull();

    handle.unmount();
  });
});

// =========================================================================
// Custom navigation keys
// =========================================================================

describe("custom navigation keys", () => {
  it("custom key array navigates within group", () => {
    const onFocus1 = vi.fn();
    const onFocus2 = vi.fn();

    const el = h(BOX, {},
      h(Box, { focusGroup: { navigationKeys: ["k", "j"] } },
        h(Box, { tabIndex: 0, onFocus: onFocus1 }),
        h(Box, { tabIndex: 0, onFocus: onFocus2 }),
      ),
    );

    const { fm } = setup(el);

    fm.focusNext(); // enter group → first
    expect(onFocus1).toHaveBeenCalledTimes(1);

    // "j" (index 1, odd = forward)
    fm.handleGroupKey(key("j"));
    expect(onFocus2).toHaveBeenCalledTimes(1);

    // "k" (index 0, even = backward)
    fm.handleGroupKey(key("k"));
    expect(onFocus1).toHaveBeenCalledTimes(2);
  });
});
