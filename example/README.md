# Showcase

Interactive demo of tuile's features — signals, layout, widgets, animation, and more.

## Running

```sh
npm run showcase
```

Use `←` `→` to navigate between pages, `1`–`8` to jump directly, `q` to quit.

## Pages

| # | Page | Description |
|---|------|-------------|
| 1 | **Welcome** | ASCII banner with typewriter effect, feature cards, live clock |
| 2 | **Dashboard** | Simulated system monitor with sparkline charts, live log stream, service status |
| 3 | **Widgets** | Gallery of built-in widgets: Spinner, ProgressBar, Checkbox, Select, TextInput, Table |
| 4 | **Grid** | Grid layout with merged borders, column spans, border styles, spacing modes |
| 5 | **Animation** | Tween animations (bounce, sine, elastic, cubic), spring physics, custom cubic bezier |
| 6 | **Reactivity** | Interactive signals, computed values, effects, batch updates, context, control flow |
| 7 | **Layout** | Border styles, flex distribution, alignment, text styling, color spectrum |
| 8 | **Scroll** | ScrollBox with 40-line log, scroll indicator, Unicode width support demo |

## Structure

```
example/
  showcase.tsx          App shell, navigation, render
  theme.ts              Shared color palette
  shared.tsx            Terminal size signals, Section component, helpers
  pages/
    welcome.tsx         Page 1
    dashboard.tsx       Page 2
    widgets.tsx         Page 3
    grid.tsx            Page 4
    animation.tsx       Page 5
    reactivity.tsx      Page 6
    layout.tsx          Page 7
    scroll.tsx          Page 8
```

The showcase imports directly from source (`../src/index.js`), not the published package.
