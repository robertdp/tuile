import type {
  TuileElement,
  TuileChild,
  ComponentFn,
} from "./types.js";
import { effect } from "../reactive/signal.js";
import { isSignal } from "../reactive/utils.js";
import {
  type RenderInstance,
  createRenderInstance,
  getActiveInstance,
  setActiveInstance,
} from "../instance.js";

/**
 * Element type symbols.
 * DYNAMIC is used by control-flow components (Show/For/Switch) — its
 * `setup` prop receives the RenderNode and manages children imperatively
 * via mount/unmount, sidestepping the normal declarative child mounting.
 */
export const BOX = Symbol.for("tuile.box");
export const TEXT = Symbol.for("tuile.text");
export const PORTAL = Symbol.for("tuile.portal");
export const FRAGMENT = Symbol.for("tuile.fragment");
export const TEXT_NODE = Symbol.for("tuile.node.text");
export const DYNAMIC = Symbol.for("tuile.dynamic");

// ---------------------------------------------------------------------------
// Lifecycle — ownership tracking for onMount/onCleanup
// ---------------------------------------------------------------------------

let currentOwner: RenderNode | null = null;

/** Per-instance mount state (postMountQueue + depth counter) */
interface MountState {
  queue: { fn: () => void; owner: RenderNode | null }[];
  depth: number;
}

const mountStates = new WeakMap<RenderInstance, MountState>();

function getMountState(inst: RenderInstance): MountState {
  let state = mountStates.get(inst);
  if (!state) {
    state = { queue: [], depth: 0 };
    mountStates.set(inst, state);
  }
  return state;
}

/** Map from RenderNode → owning RenderInstance */
const nodeInstances = new WeakMap<RenderNode, RenderInstance>();

/** Look up the render instance that owns a node */
export function getNodeInstance(node: RenderNode): RenderInstance | null {
  return nodeInstances.get(node) ?? null;
}

/**
 * Register a cleanup function scoped to the current component's lifetime.
 * Called during component execution. The cleanup runs when the component is unmounted.
 */
export function onCleanup(fn: () => void): void {
  if (currentOwner) {
    currentOwner.disposers.push(fn);
  } else if (process.env.NODE_ENV !== "production") {
    console.warn(
      "onCleanup() called outside a component body (currentOwner is null). " +
      "Cleanup will not run. If called inside onMount, this is a known pattern — " +
      "ensure onMount captures the owner correctly.",
    );
  }
}

/**
 * Register a callback to run after the component tree has mounted.
 * Called during component execution. The callback runs after the top-level mount() completes.
 */
export function onMount(fn: () => void): void {
  const inst = getActiveInstance();
  if (inst) {
    getMountState(inst).queue.push({ fn, owner: currentOwner });
  }
}

// ---------------------------------------------------------------------------
// Refs — stable references to mounted RenderNodes
// ---------------------------------------------------------------------------

export interface Ref<T = RenderNode> {
  current: T | null;
}

export function createRef<T = RenderNode>(): Ref<T> {
  return { current: null };
}

// ---------------------------------------------------------------------------
// Render Tree — the live tree that the renderer works with
// ---------------------------------------------------------------------------

/** A node in the render tree (the "live" counterpart of an TuileElement) */
export interface RenderNode {
  type: symbol;
  props: Record<string, any>;
  children: RenderNode[];
  parent: RenderNode | null;
  /** Cached reference to the tree root (set at mount time for O(1) dirty notification) */
  root: RenderNode;
  /** Text content for __text leaf nodes */
  text?: string;
  /** Dispose functions for reactive effects on this node */
  disposers: (() => void)[];
  /** Ref attached to this node (cleared on unmount) */
  ref?: Ref;
}

// ---------------------------------------------------------------------------
// Mount — convert an TuileElement tree into a live RenderNode tree
// ---------------------------------------------------------------------------

/**
 * Mount an element tree, creating a live RenderNode tree with
 * reactive bindings. Components are called once (Solid-style).
 */
export function mount(element: TuileElement | TuileChild, parent: RenderNode | null = null): RenderNode {
  // Resolve instance: inherit from parent node, fall back to active instance,
  // or create a temporary one for standalone mounts (e.g. tests).
  let instance = (parent && nodeInstances.get(parent)) ?? getActiveInstance();
  if (!instance) {
    instance = createRenderInstance();
  }

  setActiveInstance(instance);

  const state = getMountState(instance);
  const isTopLevel = state.depth === 0;
  state.depth++;

  try {
    const result = mountInner(element, parent);
    return result;
  } finally {
    state.depth--;
    // Flush post-mount callbacks when the outermost mount() completes.
    // depth tracking ensures nested mount() calls (e.g. from control-flow
    // components) don't flush prematurely — only the top-level caller flushes.
    if (isTopLevel && state.queue.length > 0) {
      const queue = state.queue;
      state.queue = [];
      for (const entry of queue) {
        const prevOwner = currentOwner;
        currentOwner = entry.owner;
        try {
          entry.fn();
        } finally {
          currentOwner = prevOwner;
        }
      }
    }
    setActiveInstance(null);
  }
}

function mountInner(element: TuileElement | TuileChild, parent: RenderNode | null): RenderNode {
  // Handle primitive children
  if (element === null || element === undefined || typeof element === "boolean") {
    return createTextNode("", parent);
  }
  if (typeof element === "string" || typeof element === "number") {
    return createTextNode(String(element), parent);
  }

  // Handle signals as children
  if (isSignal(element)) {
    const node = createTextNode("", parent);
    const dispose = effect(() => {
      node.text = String((element as any).value);
      markDirty(node);
    });
    node.disposers.push(dispose);
    return node;
  }

  const el = element as TuileElement;

  // Component function — call once (Solid-style)
  if (typeof el.type === "function") {
    const component = el.type as ComponentFn;
    const propsWithChildren = {
      ...el.props,
      ...(el.children.length > 0 ? { children: el.children.length === 1 ? el.children[0] : el.children } : {}),
    };

    // Create a wrapper FRAGMENT node to serve as the ownership scope
    // for onCleanup/onMount registrations. The component function runs
    // with currentOwner set to this node. After the component returns,
    // any disposers registered via onCleanup are transferred to the
    // actual child node that the component produced.
    const ownerNode: RenderNode = {
      type: FRAGMENT,
      props: {},
      children: [],
      parent,
      root: null!,
      disposers: [],
    };
    ownerNode.root = parent ? parent.root : ownerNode;
    storeNodeInstance(ownerNode);

    const prevOwner = currentOwner;
    currentOwner = ownerNode;
    try {
      const result = component(propsWithChildren);
      const childNode = mountInner(result, parent);
      // Transfer any disposers registered via onCleanup to the child node
      if (ownerNode.disposers.length > 0) {
        childNode.disposers.push(...ownerNode.disposers);
      }
      return childNode;
    } finally {
      currentOwner = prevOwner;
    }
  }

  // Dynamic element — used by control flow components (Show/For/Switch)
  if (el.type === DYNAMIC) {
    const node: RenderNode = {
      type: FRAGMENT,
      props: {},
      children: [],
      parent,
      root: null!,
      disposers: [],
    };
    node.root = parent ? parent.root : node;
    storeNodeInstance(node);
    const setup = el.props.setup;
    if (typeof setup === "function") {
      const dispose = setup(node);
      if (typeof dispose === "function") {
        node.disposers.push(dispose);
      }
    }
    return node;
  }

  // Intrinsic element or fragment
  const node: RenderNode = {
    type: el.type as symbol,
    props: {},
    children: [],
    parent,
    root: null!,
    disposers: [],
  };
  node.root = parent ? parent.root : node;
  storeNodeInstance(node);

  // Set up props — signal-valued props are bound via effects so
  // that changes to the signal automatically update the render node
  // and trigger a dirty notification (re-layout + re-paint).
  for (const [key, value] of Object.entries(el.props)) {
    if (key === "children" || key === "ref") continue;
    if (isSignal(value)) {
      const dispose = effect(() => {
        node.props[key] = (value as any).value;
        markDirty(node);
      });
      node.disposers.push(dispose);
    } else {
      node.props[key] = value;
    }
  }

  // Mount children
  for (const child of el.children) {
    if (Array.isArray(child)) {
      for (const c of child) {
        node.children.push(mountInner(c, node));
      }
    } else {
      node.children.push(mountInner(child, node));
    }
  }

  // Wire up ref
  const ref = el.props.ref;
  if (ref && typeof ref === "object" && "current" in ref) {
    ref.current = node;
    node.ref = ref;
  }

  return node;
}

/**
 * Unmount a render node tree, disposing all reactive effects.
 */
export function unmount(node: RenderNode): void {
  // Remove from parent's children array
  if (node.parent) {
    const siblings = node.parent.children;
    const idx = siblings.indexOf(node);
    if (idx !== -1) siblings.splice(idx, 1);
  }

  // Clear ref
  if (node.ref) {
    node.ref.current = null;
    node.ref = undefined;
  }

  for (const dispose of node.disposers) {
    dispose();
  }
  node.disposers.length = 0;

  // Iterate a copy since child unmount now splices from parent
  const children = [...node.children];
  for (const child of children) {
    unmount(child);
  }
  node.children.length = 0;
  node.parent = null;
}

// ---------------------------------------------------------------------------
// Dirty tracking — per-root callbacks via WeakMap
// ---------------------------------------------------------------------------

type DirtyCallback = (node: RenderNode) => void;
const rootCallbacks = new WeakMap<RenderNode, DirtyCallback>();

/** Mark a node as dirty, notifying the render root's callback */
export function markDirty(node: RenderNode): void {
  const callback = rootCallbacks.get(node.root);
  if (callback) {
    callback(node);
  }
}

/** Register a dirty callback for a render root */
export function registerRoot(rootNode: RenderNode, callback: DirtyCallback): void {
  rootCallbacks.set(rootNode, callback);
}

/** Unregister a render root's dirty callback */
export function unregisterRoot(rootNode: RenderNode): void {
  rootCallbacks.delete(rootNode);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTextNode(text: string, parent: RenderNode | null): RenderNode {
  const node: RenderNode = {
    type: TEXT_NODE,
    props: {},
    children: [],
    parent,
    root: null!,
    text,
    disposers: [],
  };
  node.root = parent ? parent.root : node;
  storeNodeInstance(node);
  return node;
}

/** Associate a node with the currently active render instance */
function storeNodeInstance(node: RenderNode): void {
  const inst = getActiveInstance();
  if (inst) nodeInstances.set(node, inst);
}

