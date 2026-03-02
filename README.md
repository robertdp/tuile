# tuile

A lightweight TUI framework with fine-grained reactivity.

Build terminal user interfaces with declarative JSX and a reactivity model inspired by [SolidJS](https://www.solidjs.com/) — components run once, and only the parts that depend on changing data are updated.

## Features

- **Declarative JSX** — compose UIs with familiar syntax
- **Fine-grained reactivity** — signals, computed values, and effects with automatic dependency tracking
- **Flexbox layout** — direction, padding, gap, grow/shrink, percentage sizing, min/max constraints
- **Animation** — tweens with easing, spring physics
- **Focus management** — tab ordering, focus groups, focus traps
- **Keyboard and mouse input** — full keyboard parsing, SGR mouse protocol
- **Scrollable containers** — overflow scrolling with keyboard and mouse support
- **Portals** — render outside the parent tree (modals, overlays)
- **Built-in widgets** — text input, select, checkbox, progress bar, spinner, table, grid

## Quick start

Configure your `tsconfig.json` for JSX:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "tuile"
  }
}
```

A minimal app:

```tsx
import { render, signal, Box, Text } from "tuile";

const count = signal(0);
setInterval(() => count.value++, 1000);

render(
  <Box padding={1}>
    <Text bold color="#7C6FFF">Count: {count}</Text>
  </Box>
);
```

## Core concepts

### Signals and reactivity

Signals are reactive values. Reading a signal inside an `effect` or `computed` automatically subscribes to changes.

```tsx
import { signal, computed, effect } from "tuile";

const name = signal("world");
const greeting = computed(() => `Hello, ${name.value}!`);

effect(() => {
  console.log(greeting.value); // logs "Hello, world!", then "Hello, tuile!"
});

name.value = "tuile";
```

Use `batch` to group multiple writes into a single update:

```tsx
import { signal, batch } from "tuile";

const a = signal(1);
const b = signal(2);

batch(() => {
  a.value = 10;
  b.value = 20;
}); // subscribers notified once
```

### Components

Components are plain functions that run **once**. Reactivity comes from signals and effects inside the component body — there is no re-rendering.

```tsx
function Counter() {
  const count = signal(0);
  setInterval(() => count.value++, 1000);

  return (
    <Box padding={1}>
      <Text>Count: {count}</Text>
    </Box>
  );
}
```

Pass signals directly as JSX children — the framework tracks dependencies automatically. For derived values, use `computed`.

### Layout

`Box` is the layout primitive. It uses a flexbox model with `direction`, `padding`, `gap`, `flexGrow`, `flexShrink`, and more.

```tsx
<Box direction="horizontal" gap={1} padding={1}>
  <Box flexGrow={1}>
    <Text>Left</Text>
  </Box>
  <Box width={20}>
    <Text>Right (fixed)</Text>
  </Box>
</Box>
```

Sizes can be numbers (columns/rows), percentages (`"50%"`), or `"auto"`.

### Text and styling

`Text` renders styled text. Style props: `color`, `bgColor`, `bold`, `dim`, `italic`, `underline`, `strikethrough`, `inverse`.

```tsx
<Text color="#00D4FF" bold>Styled text</Text>
```

Colors accept named colors (`"red"`, `"cyan"`), hex strings (`"#FF5252"`), 256-palette numbers (`196`), or RGB objects (`{ r: 255, g: 82, b: 82 }`).

### Control flow

Conditional and list rendering with reactive primitives:

```tsx
import { Show, For, Switch, Match, signal, computed } from "tuile";

const visible = signal(true);
const items = signal(["one", "two", "three"]);
const mode = signal<"a" | "b">("a");

// Conditional
<Show when={visible}>
  <Text>Visible</Text>
</Show>

// Lists (identity-based reconciliation preserves component state)
<For each={items}>
  {(item) => <Text>{item}</Text>}
</For>

// Multi-branch (when takes a signal or computed)
const isA = computed(() => mode.value === "a");
const isB = computed(() => mode.value === "b");

<Switch>
  <Match when={isA}>
    <Text>Mode A</Text>
  </Match>
  <Match when={isB}>
    <Text>Mode B</Text>
  </Match>
</Switch>
```

### Context

Pass values down the component tree without prop drilling:

```tsx
import { createContext, useContext, signal } from "tuile";

const ThemeContext = createContext({ primary: "#7C6FFF" });

function App() {
  return (
    <ThemeContext.Provider value={{ primary: "#00D4FF" }}>
      <Child />
    </ThemeContext.Provider>
  );
}

function Child() {
  const theme = useContext(ThemeContext);
  return <Text color={theme.primary}>Themed text</Text>;
}
```

For reactive context values, pass a signal — context captures the value at mount time.

### Input handling

Handle keyboard and mouse events on any `Box`:

```tsx
<Box
  tabIndex={0}
  onKeyPress={(event) => {
    if (event.key === "q") process.exit(0);
    return false; // false = propagate, true = handled
  }}
  onClick={(event) => {
    console.log(`Clicked at ${event.x}, ${event.y}`);
    return true;
  }}
>
  <Text>Press q to quit</Text>
</Box>
```

### Focus management

`tabIndex` makes elements focusable. Focus groups provide arrow-key navigation among children. Focus traps prevent Tab from leaving.

```tsx
// Tab-focusable element
<Box tabIndex={0} onFocus={() => { /* ... */ }}>
  <Text>Focusable</Text>
</Box>

// Arrow-key navigation group
<Box focusGroup={{ navigationKeys: "vertical" }}>
  <Box tabIndex={0}><Text>Item 1</Text></Box>
  <Box tabIndex={0}><Text>Item 2</Text></Box>
  <Box tabIndex={0}><Text>Item 3</Text></Box>
</Box>

// Focus trap (Tab cycles within, focus cannot leave)
<Box focusTrap>
  <Box tabIndex={0}><Text>Trapped 1</Text></Box>
  <Box tabIndex={0}><Text>Trapped 2</Text></Box>
</Box>
```

### Scroll containers

`ScrollBox` handles overflow with keyboard and mouse scrolling:

```tsx
import { ScrollBox } from "tuile";

<ScrollBox height={10} direction="vertical" tabIndex={0}>
  {/* Content taller than 10 rows scrolls */}
  <For each={items}>
    {(item) => <Text>{item}</Text>}
  </For>
</ScrollBox>
```

### Animation

Tween values over time or use spring physics:

```tsx
import { animate, spring } from "tuile";

// Tween with easing — returns a control object with a .value signal
const tween = animate(0, 100, {
  duration: 1000,
  easing: "ease-out-cubic",
});
// tween.value is a ReadSignal<number> that updates each frame

// Spring physics
const sp = spring(0, { stiffness: 170, damping: 26 });
sp.setTarget(100); // animates toward target
// sp.value is a ReadSignal<number>
```

### Portals

Render content outside the parent's layout tree — useful for modals and overlays:

```tsx
import { Portal } from "tuile";

<Portal zIndex={10}>
  <Box width="100%" height="100%">
    <Text>This renders above everything</Text>
  </Box>
</Portal>
```

### Lifecycle

```tsx
import { onMount, onCleanup } from "tuile";

function Timer() {
  onMount(() => {
    const id = setInterval(() => { /* ... */ }, 1000);
    onCleanup(() => clearInterval(id));
  });

  return <Text>Timer running</Text>;
}
```

## Widgets

| Widget | Description |
|---|---|
| `TextInput` | Single-line text input with cursor, selection, paste |
| `Select` | Keyboard-navigable list with scroll |
| `Checkbox` | Toggle with label |
| `ProgressBar` | Visual progress indicator |
| `Spinner` | Animated spinner with built-in frame sets |
| `Table` | Tabular data with optional borders and column alignment |
| `Grid` | CSS Grid-like layout with spans and merged borders |

All widgets accept reactive props (signals) and follow the same composition model.

## API reference

Full API types are available via TypeScript. See [`src/index.ts`](src/index.ts) for all exports.

## License

[MIT](LICENSE)
