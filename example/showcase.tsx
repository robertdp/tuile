/** @jsxImportSource tuile */
// ---------------------------------------------------------------------------
// Tuile — Interactive Showcase
//
// Run: npm run showcase
// ---------------------------------------------------------------------------

import {
  render,
  Box,
  Text,
  signal,
  computed,
  Switch,
  Match,
} from "../src/index.js";
import type { KeyEvent } from "../src/index.js";
import { theme } from "./theme.js";
import { cols, rows, pageKeyHandler } from "./shared.js";
import { WelcomePage } from "./pages/welcome.js";
import { DashboardPage } from "./pages/dashboard.js";
import { WidgetsPage } from "./pages/widgets.js";
import { GridPage } from "./pages/grid.js";
import { AnimationPage } from "./pages/animation.js";
import { ReactivityPage } from "./pages/reactivity.js";
import { LayoutPage } from "./pages/layout.js";
import { ScrollPage } from "./pages/scroll.js";

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

const PAGES = [
  { icon: "◈", name: "Welcome" },
  { icon: "◧", name: "Dashboard" },
  { icon: "⊞", name: "Widgets" },
  { icon: "▦", name: "Grid" },
  { icon: "◎", name: "Animation" },
  { icon: "⟐", name: "Reactivity" },
  { icon: "◫", name: "Layout" },
  { icon: "☰", name: "Scroll" },
];

const PAGE_COUNT = PAGES.length;
const currentPage = signal(0);

// ---------------------------------------------------------------------------
// NavBar
// ---------------------------------------------------------------------------

function NavBar() {
  return (
    <Box paddingLeft={1} direction="horizontal">
      <Text bold color={theme.primary}>
        {computed(() => {
          return PAGES.map((page, i) => {
            if (i === currentPage.value) {
              return ` ${page.icon} ${page.name} `;
            }
            return `  ${i + 1} `;
          }).join("│");
        })}
      </Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
  const hrText = computed(() => " " + "─".repeat(Math.max(0, cols.value - 2)));

  const handleKey = (e: KeyEvent): boolean => {
    if ((e.ctrl && e.key === "c") || e.key === "q") {
      handle.unmount();
      process.exit(0);
    }
    if (e.key === "right") {
      currentPage.value = (currentPage.value + 1) % PAGE_COUNT;
      return true;
    }
    if (e.key === "left") {
      currentPage.value = (currentPage.value - 1 + PAGE_COUNT) % PAGE_COUNT;
      return true;
    }
    const num = parseInt(e.key);
    if (num >= 1 && num <= PAGE_COUNT) {
      currentPage.value = num - 1;
      return true;
    }
    const handler = pageKeyHandler.peek();
    if (handler) {
      handler(e);
      return true;
    }
    return false;
  };

  return (
    <Box
      direction="vertical"
      tabIndex={0}
      autoFocus
      onKeyPress={handleKey}
      height="100%"
    >
      {/* Header */}
      <Box direction="horizontal" paddingX={1}>
        <Text color={theme.primary} bold>◈ TUILE</Text>
        <Text color={theme.muted}> │ </Text>
        <Text color={theme.dim}>
          {computed(
            () => `${PAGES[currentPage.value].icon} ${PAGES[currentPage.value].name}`,
          )}
        </Text>
      </Box>

      {/* Nav */}
      <NavBar />

      {/* Separator */}
      <Text color={theme.muted}>{hrText}</Text>

      {/* Content */}
      <Box direction="vertical" flexGrow={1} paddingTop={1}>
        <Switch>
          <Match when={computed(() => currentPage.value === 0)}>
            <WelcomePage />
          </Match>
          <Match when={computed(() => currentPage.value === 1)}>
            <DashboardPage />
          </Match>
          <Match when={computed(() => currentPage.value === 2)}>
            <WidgetsPage />
          </Match>
          <Match when={computed(() => currentPage.value === 3)}>
            <GridPage />
          </Match>
          <Match when={computed(() => currentPage.value === 4)}>
            <AnimationPage />
          </Match>
          <Match when={computed(() => currentPage.value === 5)}>
            <ReactivityPage />
          </Match>
          <Match when={computed(() => currentPage.value === 6)}>
            <LayoutPage />
          </Match>
          <Match when={computed(() => currentPage.value === 7)}>
            <ScrollPage />
          </Match>
        </Switch>
      </Box>

      {/* Footer */}
      <Box direction="horizontal" paddingX={1} justify="space-between">
        <Text color={theme.muted}>← → navigate · 1-8 jump · q quit</Text>
        <Text color={theme.muted}>
          {computed(() => `${cols.value}×${rows.value}`)}
        </Text>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

const handle = render(<App />, { altScreen: true });
