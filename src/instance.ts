// ---------------------------------------------------------------------------
// Render Instance — per-render() isolated state
// ---------------------------------------------------------------------------

/**
 * Opaque identity token for a render() session.
 *
 * Each call to render() creates one instance. Per-module state
 * (global key handlers, context stacks, mount queues) is stored
 * in WeakMaps keyed by this object, providing full isolation
 * between concurrent or sequential render sessions.
 */
export class RenderInstance {}

const _activeStack: RenderInstance[] = [];

export function createRenderInstance(): RenderInstance {
  return new RenderInstance();
}

export function setActiveInstance(instance: RenderInstance | null): void {
  if (instance) {
    _activeStack.push(instance);
  } else {
    _activeStack.pop();
  }
}

export function getActiveInstance(): RenderInstance | null {
  return _activeStack.length > 0 ? _activeStack[_activeStack.length - 1] : null;
}
