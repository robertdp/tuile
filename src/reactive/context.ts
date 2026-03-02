import type { TuileElement, TuileChild, ComponentFn } from "../element/types.js";
import type { RenderNode } from "../element/reconciler.js";
import { mount, markDirty, DYNAMIC } from "../element/reconciler.js";
import type { RenderInstance } from "../instance.js";
import { getActiveInstance } from "../instance.js";

// ---------------------------------------------------------------------------
// Context — dependency injection through the component tree
//
// Context values are captured at mount time via a push/pop stack during
// the synchronous mount() traversal. The Provider pushes a value before
// mounting children and pops it after, so useContext reads the top of the
// stack at the point the consumer component executes.
//
// Because values are captured once (at mount), passing a plain object
// gives consumers a static snapshot. For reactive context, pass a signal
// as the value and read .value in consumers — the signal reference is
// stable, and reading .value inside effects creates subscriptions.
//
// Each render instance has its own context stacks, providing full
// isolation between concurrent render() calls (e.g. in tests).
// ---------------------------------------------------------------------------

export interface Context<T> {
  readonly defaultValue: T;
  readonly Provider: ComponentFn<{ value: T; children: TuileChild | TuileChild[] }>;
}

/**
 * Per-instance context stacks. Each render instance gets its own
 * map of context → value stacks, providing full isolation.
 */
const instanceStacks = new WeakMap<RenderInstance, Map<Context<any>, any[]>>();

function getStacks(inst: RenderInstance): Map<Context<any>, any[]> {
  let stacks = instanceStacks.get(inst);
  if (!stacks) {
    stacks = new Map();
    instanceStacks.set(inst, stacks);
  }
  return stacks;
}

function getStack(ctx: Context<any>): any[] | undefined {
  const inst = getActiveInstance();
  if (!inst) return undefined;
  return getStacks(inst).get(ctx);
}

function getOrCreateStack(ctx: Context<any>): any[] {
  const inst = getActiveInstance();
  if (!inst) {
    throw new Error("Context Provider must be used during component mount, not in async callbacks or effects");
  }
  const stacks = getStacks(inst);
  let stack = stacks.get(ctx);
  if (!stack) {
    stack = [];
    stacks.set(ctx, stack);
  }
  return stack;
}

/**
 * Create a context for passing values through the component tree
 * without prop drilling.
 *
 * The Provider captures the value at mount time and passes it through
 * to consumers. To make context values reactive, pass a signal as the
 * value and read `.value` in consumers:
 *
 * ```ts
 * // Static context
 * const ThemeCtx = createContext("light");
 * h(ThemeCtx.Provider, { value: "dark" }, ...children)
 * const theme = useContext(ThemeCtx); // "dark"
 *
 * // Reactive context — pass the signal itself
 * const ThemeCtx = createContext<WriteSignal<string>>(signal("light"));
 * h(ThemeCtx.Provider, { value: themeSignal }, ...children)
 * const theme = useContext(ThemeCtx); // WriteSignal<string>
 * // theme.value is reactive and triggers effects
 * ```
 */
export function createContext<T>(defaultValue: T): Context<T> {
  const ctx: Context<T> = {
    defaultValue,
    Provider: null!,
  };

  const Provider: ComponentFn<{ value: T; children: TuileChild | TuileChild[] }> = (props) => {
    const children = Array.isArray(props.children) ? props.children : [props.children];

    // Use DYNAMIC to control the mounting of children manually,
    // so we can push/pop the context value around child mounting.
    return {
      type: DYNAMIC,
      props: {
        setup(node: RenderNode) {
          const stack = getOrCreateStack(ctx);
          stack.push(props.value);
          try {
            for (const child of children) {
              if (child != null) {
                node.children.push(mount(child, node));
              }
            }
          } finally {
            stack.pop();
          }
          markDirty(node);
        },
      },
      children: [],
    } as TuileElement;
  };

  (ctx as any).Provider = Provider;
  return ctx;
}

/**
 * Read the current value of a context. Must be called during component
 * execution (inside a component function body).
 *
 * Returns the nearest Provider's value, or the context's defaultValue
 * if no Provider is found above in the tree.
 *
 * The returned value is whatever was passed to the Provider. For
 * reactive context, pass a signal to the Provider and read `.value`
 * on the result:
 *
 * ```ts
 * const theme = useContext(ThemeCtx); // the signal itself
 * const current = theme.value;       // reactive read
 * ```
 */
export function useContext<T>(ctx: Context<T>): T {
  const stack = getStack(ctx);
  if (stack && stack.length > 0) {
    return stack[stack.length - 1];
  }
  return ctx.defaultValue;
}
