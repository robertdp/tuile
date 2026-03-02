import type { TuileElement, TuileChild, ComponentFn } from "../element/types.js";
import type { ReadSignal, WriteSignal } from "./signal.js";
import type { RenderNode } from "../element/reconciler.js";
import { mount, unmount, markDirty, DYNAMIC, BOX } from "../element/reconciler.js";
import { signal, computed, effect, runUnscoped } from "./signal.js";
import { readValue } from "./utils.js";

// ---------------------------------------------------------------------------
// Control Flow Components (Solid-style)
//
// These components manage subtree mounting/unmounting imperatively via
// DYNAMIC elements, keeping the rest of the framework declarative.
//
// Key design decisions:
//   - Show: children are unmounted and re-mounted on each toggle, not
//     hidden. This resets component state but avoids retaining disposed
//     subtrees in memory.
//   - For: uses identity-based reconciliation (item reference or key
//     function) to reuse mounted nodes across list updates. Child
//     render functions run via runUnscoped() so their effects survive
//     the parent For effect's re-runs.
//   - Switch: Match elements are inspected as data descriptors, not
//     mounted as components. Only the winning branch's children are
//     actually mounted.
//   - ErrorBoundary: catches errors thrown during mount() only — runtime
//     errors in effects or event handlers are not caught.
// ---------------------------------------------------------------------------

type MaybeSignal<T> = T | ReadSignal<T> | WriteSignal<T>;

function dynamicElement(setup: (node: RenderNode) => (() => void) | void): TuileElement {
  return {
    type: DYNAMIC,
    props: { setup },
    children: [],
  };
}

function unmountChildren(node: RenderNode): void {
  const children = [...node.children];
  for (const child of children) {
    unmount(child);
  }
  node.children.length = 0;
}

// ---------------------------------------------------------------------------
// Show — conditional rendering
// ---------------------------------------------------------------------------

export interface ShowProps {
  when: MaybeSignal<any>;
  fallback?: TuileChild;
  children: TuileChild | TuileChild[];
}

/**
 * Conditionally render children when `when` is truthy.
 *
 * ```tsx
 * <Show when={isLoggedIn} fallback={<Text>Please log in</Text>}>
 *   <Text>Welcome!</Text>
 * </Show>
 * ```
 */
export const Show: ComponentFn<ShowProps> = (props) => {
  const children = Array.isArray(props.children) ? props.children : [props.children];

  return dynamicElement((node) => {
    let prevValue: boolean | undefined;
    return effect(() => {
      const value = !!readValue(props.when);
      if (value === prevValue) return;
      prevValue = value;

      unmountChildren(node);

      if (value) {
        for (const child of children) {
          if (child != null) {
            node.children.push(mount(child, node));
          }
        }
      } else if (props.fallback != null) {
        node.children.push(mount(props.fallback, node));
      }

      markDirty(node);
    });
  });
};

// ---------------------------------------------------------------------------
// For — list rendering
// ---------------------------------------------------------------------------

export interface ForProps<T> {
  each: MaybeSignal<T[]>;
  key?: (item: T) => any;
  children: (item: T, index: ReadSignal<number>) => TuileElement;
}

/**
 * Render a list of items reactively. Uses identity-based reconciliation
 * to reuse mounted nodes when items persist across updates, preserving
 * component state (focus, scroll position, effects).
 *
 * ```tsx
 * <For each={items}>
 *   {(item, i) => <Text>{item.name}</Text>}
 * </For>
 * ```
 */
export function For<T>(props: ForProps<T>): TuileElement {
  const renderFn = props.children;

  const keyFn = props.key;

  return dynamicElement((node) => {
    let entries: { item: T; key: any; node: RenderNode; index: WriteSignal<number> }[] = [];

    return effect(() => {
      const items = readValue(props.each);
      const newEntries: { item: T; key: any; node: RenderNode; index: WriteSignal<number> }[] = [];

      // Build a pool of reusable entries keyed by item identity or key function
      const pool = new Map<any, { node: RenderNode; index: WriteSignal<number> }[]>();
      for (const entry of entries) {
        const k = entry.key;
        let list = pool.get(k);
        if (!list) {
          list = [];
          pool.set(k, list);
        }
        list.push({ node: entry.node, index: entry.index });
      }

      // For each new item, reuse an existing node or mount a new one
      const seenKeys = process.env.NODE_ENV !== "production" ? new Set<any>() : null;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const k = keyFn ? keyFn(item) : item;
        if (seenKeys) {
          if (seenKeys.has(k)) {
            console.warn(`tuile: <For> duplicate key detected:`, k, `at index ${i}. Items with duplicate keys may render incorrectly.`);
          }
          seenKeys.add(k);
        }
        const available = pool.get(k);
        let child: RenderNode;
        let indexSignal: WriteSignal<number>;

        if (available && available.length > 0) {
          const reused = available.shift()!;
          child = reused.node;
          indexSignal = reused.index;
          indexSignal.value = i;
        } else {
          indexSignal = signal(i);
          // Run outside the For effect's ownership scope so that
          // computeds/effects created by renderFn survive the parent
          // effect's re-execution (which disposes owned children).
          // Without this, adding a new item would dispose all existing
          // item components.
          child = runUnscoped(() => {
            const el = renderFn(item, indexSignal!);
            return mount(el, node);
          });
        }

        newEntries.push({ item, key: k, node: child, index: indexSignal });
      }

      // Unmount nodes for removed items
      for (const list of pool.values()) {
        for (const entry of list) {
          unmount(entry.node);
        }
      }

      node.children = newEntries.map(e => e.node);
      entries = newEntries;

      markDirty(node);
    });
  });
}

// ---------------------------------------------------------------------------
// Switch / Match — multi-branch conditional
// ---------------------------------------------------------------------------

export interface SwitchProps {
  fallback?: TuileChild;
  children: TuileChild | TuileChild[];
}

export interface MatchProps {
  when: MaybeSignal<any>;
  children: TuileChild | TuileChild[];
}

/**
 * Render the first matching `<Match>` branch, or the fallback.
 *
 * ```tsx
 * <Switch fallback={<Text>Unknown</Text>}>
 *   <Match when={isAdmin}><Text>Admin</Text></Match>
 *   <Match when={isUser}><Text>User</Text></Match>
 * </Switch>
 * ```
 */
export const Switch: ComponentFn<SwitchProps> = (props) => {
  const children = Array.isArray(props.children) ? props.children : [props.children];

  // Collect Match element descriptors (not mounted — just inspected as data)
  const matchElements: TuileElement[] = [];
  for (const child of children) {
    if (child && typeof child === "object" && "type" in child && (child as TuileElement).type === Match) {
      matchElements.push(child as TuileElement);
    }
  }

  return dynamicElement((node) => {
    // Memoise the winning branch index so the effect only re-runs when
    // the actual winner changes, not on every signal value change.
    const winnerIndex = computed(() => {
      for (let i = 0; i < matchElements.length; i++) {
        if (readValue(matchElements[i].props.when)) return i;
      }
      return -1;
    });

    const disposeEffect = effect(() => {
      const newIndex = winnerIndex.value;

      unmountChildren(node);

      if (newIndex >= 0) {
        const match = matchElements[newIndex];
        for (const child of match.children) {
          if (child != null) {
            node.children.push(mount(child as TuileChild, node));
          }
        }
      } else if (props.fallback != null) {
        node.children.push(mount(props.fallback, node));
      }

      markDirty(node);
    });

    return () => {
      disposeEffect();
      winnerIndex.dispose();
    };
  });
};

/**
 * A branch within a `<Switch>`. Not meant to be used standalone.
 */
export const Match: ComponentFn<MatchProps> = (props) => {
  // Match is only used as a child of Switch.
  // If rendered standalone, renders its children in a box.
  const children = Array.isArray(props.children) ? props.children : [props.children];
  return { type: BOX, props: {}, children: children.filter((c) => c != null) };
};

// ---------------------------------------------------------------------------
// ErrorBoundary — catch component errors and render fallback UI
// ---------------------------------------------------------------------------

export interface ErrorBoundaryProps {
  /** Fallback UI to render when a child throws. If a function, receives the error. */
  fallback: TuileChild | ((error: Error) => TuileChild);
  /** Called when an error is caught */
  onError?: (error: Error) => void;
  children: TuileChild | TuileChild[];
}

/**
 * Catch errors thrown during child component mounting and render
 * a fallback UI instead of crashing the subtree.
 *
 * ```tsx
 * <ErrorBoundary
 *   fallback={(err) => <Text color="red">Error: {err.message}</Text>}
 *   onError={(err) => reportToMonitoring(err)}
 * >
 *   <RiskyComponent />
 * </ErrorBoundary>
 * ```
 */
export const ErrorBoundary: ComponentFn<ErrorBoundaryProps> = (props) => {
  const children = Array.isArray(props.children) ? props.children : [props.children];

  return dynamicElement((node) => {
    try {
      for (const child of children) {
        if (child != null) {
          node.children.push(mount(child, node));
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      // Clean up any partially mounted children
      unmountChildren(node);

      if (props.onError) props.onError(error);

      const fallback = typeof props.fallback === "function"
        ? (props.fallback as (error: Error) => TuileChild)(error)
        : props.fallback;
      if (fallback != null) {
        node.children.push(mount(fallback, node));
      }
    }

    markDirty(node);
  });
};
