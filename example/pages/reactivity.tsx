/** @jsxImportSource tuile */
// ---------------------------------------------------------------------------
// Page 6 — Reactivity
// ---------------------------------------------------------------------------

import {
  Box,
  Text,
  signal,
  computed,
  effect,
  batch,
  onMount,
  onCleanup,
  Show,
  For,
  createContext,
  useContext,
} from "../../src/index.js";
import type { KeyEvent, ReadSignal } from "../../src/index.js";
import { theme } from "../theme.js";
import { Section, pageKeyHandler } from "../shared.js";

// ---------------------------------------------------------------------------
// Context demo
// ---------------------------------------------------------------------------

const ThemeCtx = createContext({ label: "default", color: theme.primary });

function ContextBadge() {
  const ctx = useContext(ThemeCtx);
  return (
    <Box direction="horizontal" gap={1}>
      <Text color={ctx.color} bold>●</Text>
      <Text color={theme.dim}>{ctx.label}</Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReactivityPage() {
  const counter = signal(0);
  const doubled = computed(() => counter.value * 2);
  const parity = computed(() => (counter.value % 2 === 0 ? "even" : "odd"));
  const clock = signal(new Date().toLocaleTimeString());

  const effectLog = signal<string[]>([]);
  const renderCount = signal(0);

  const disposeEffect = effect(() => {
    const val = counter.value;
    renderCount.value = renderCount.peek() + 1;
    effectLog.value = [
      ...effectLog.peek().slice(-3),
      `[${renderCount.peek()}] counter → ${val}  (×2 = ${val * 2})`,
    ];
  });

  const items = signal(["Apple", "Banana", "Cherry"]);
  const showList = signal(true);

  const handleKey = (e: KeyEvent) => {
    if (e.key === "up") counter.value++;
    if (e.key === "down") counter.value = Math.max(0, counter.value - 1);
    if (e.key === "t") showList.value = !showList.peek();
    if (e.key === "+")
      items.value = [...items.peek(), `Item ${items.peek().length + 1}`];
    if (e.key === "-" && items.peek().length > 0)
      items.value = items.peek().slice(0, -1);
    if (e.key === "b") {
      batch(() => {
        counter.value = counter.peek() + 10;
        items.value = [...items.peek(), "Batched!"];
      });
    }
  };

  onMount(() => {
    pageKeyHandler.value = handleKey;
    const timer = setInterval(() => {
      clock.value = new Date().toLocaleTimeString();
    }, 1000);
    onCleanup(() => {
      clearInterval(timer);
      if (pageKeyHandler.peek() === handleKey) {
        pageKeyHandler.value = null;
      }
    });
  });

  onCleanup(() => disposeEffect());

  return (
    <Box direction="vertical" gap={1}>
      {/* Row 1: Signal + Effect */}
      <Box direction="horizontal" gap={1} paddingX={4}>
        <Box border="round" padding={1} flexGrow={1} direction="vertical">
          <Text color={theme.accent} bold>⚡ signal + computed</Text>
          <Box height={1} />
          <Text color={theme.text} bold>
            {computed(() => `  value  = ${counter.value}`)}
          </Text>
          <Text color={theme.success}>
            {computed(() => `  × 2   = ${doubled.value}`)}
          </Text>
          <Text color={theme.pink}>
            {computed(() => `  parity = ${parity.value}`)}
          </Text>
          <Box height={1} />
          <Text color={theme.muted}>↑↓ change · b batch(+10)</Text>
        </Box>
        <Box border="round" padding={1} flexGrow={1} direction="vertical">
          <Text color={theme.warning} bold>⊙  effect() — live log</Text>
          <Box height={1} />
          <Text color={theme.dim}>
            {computed(() => {
              const logs = effectLog.value;
              return logs.length > 0
                ? logs.map((l) => `  ${l}`).join("\n")
                : "  (press ↑↓ to trigger)";
            })}
          </Text>
          <Box height={1} />
          <Text color={theme.muted}>
            {computed(() => `  effect runs: ${renderCount.value}`)}
          </Text>
        </Box>
      </Box>

      {/* Row 2: Clock + Context + Control Flow */}
      <Box direction="horizontal" gap={1} paddingX={4}>
        <Box border="round" padding={1} flexGrow={1} direction="vertical" gap={1}>
          <Box direction="vertical">
            <Text color={theme.teal} bold>⏱  Live Clock</Text>
            <Text color={theme.dim}>signal + setInterval</Text>
            <Box height={1} />
            <Text color={theme.text} bold>
              {computed(() => `  ${clock.value}`)}
            </Text>
          </Box>
          <Box direction="vertical">
            <Section title="Context" color={theme.lavender} />
            <Box paddingLeft={2} direction="vertical">
              <ContextBadge />
              <ThemeCtx.Provider value={{ label: "custom", color: theme.pink }}>
                <ContextBadge />
              </ThemeCtx.Provider>
            </Box>
          </Box>
        </Box>
        <Box border="round" padding={1} flexGrow={1} direction="vertical">
          <Text color={theme.lavender} bold>◇  Control Flow</Text>
          <Text color={theme.dim}>{"<Show> · <For> · <Switch>"}</Text>
          <Box height={1} />
          <Show
            when={showList}
            fallback={
              <Text color={theme.error} dim>
                {"  list hidden (t to show)"}
              </Text>
            }
          >
            <For each={items}>
              {(item: string, i: ReadSignal<number>) => (
                <Box direction="horizontal" gap={1}>
                  <Text color={theme.primary}>{`  ${i.peek() + 1}.`}</Text>
                  <Text color={theme.text}>{item}</Text>
                </Box>
              )}
            </For>
          </Show>
          <Box height={1} />
          <Text color={theme.muted}>t toggle · +/- list</Text>
        </Box>
      </Box>
    </Box>
  );
}
