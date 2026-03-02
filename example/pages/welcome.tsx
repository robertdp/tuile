/** @jsxImportSource tuile */
// ---------------------------------------------------------------------------
// Page 1 — Welcome
// ---------------------------------------------------------------------------

import {
  Box,
  Text,
  signal,
  computed,
  onMount,
  onCleanup,
  Grid,
  GridItem,
  Spinner,
} from "../../src/index.js";
import { theme } from "../theme.js";
import { cols, rows } from "../shared.js";

const BANNER_COLORS = [
  theme.primary,
  theme.accent,
  theme.teal,
  theme.success,
  theme.lavender,
  theme.pink,
];

export function WelcomePage() {
  const colorIdx = signal(0);
  const clock = signal(new Date().toLocaleTimeString());
  const uptime = signal(0);

  const TAGLINE = "A reactive TUI framework for Node.js & Bun";
  const typedLen = signal(0);
  const showCursor = signal(true);

  onMount(() => {
    const t1 = setInterval(() => {
      colorIdx.value = (colorIdx.peek() + 1) % BANNER_COLORS.length;
    }, 1200);
    const t2 = setInterval(() => {
      clock.value = new Date().toLocaleTimeString();
    }, 1000);
    const t3 = setInterval(() => {
      uptime.value = uptime.peek() + 1;
    }, 1000);
    const t4 = setInterval(() => {
      if (typedLen.peek() < TAGLINE.length)
        typedLen.value = typedLen.peek() + 1;
    }, 40);
    const t5 = setInterval(() => {
      showCursor.value = !showCursor.peek();
    }, 530);
    onCleanup(() => {
      clearInterval(t1);
      clearInterval(t2);
      clearInterval(t3);
      clearInterval(t4);
      clearInterval(t5);
    });
  });

  const bannerColor = computed(() => BANNER_COLORS[colorIdx.value]);

  return (
    <Box direction="vertical" gap={1}>
      <Box paddingLeft={4} paddingTop={1}>
        <Text bold color={bannerColor}>
          {[
            "████████╗██╗   ██╗██╗██╗     ███████╗",
            "╚══██╔══╝██║   ██║██║██║     ██╔════╝",
            "   ██║   ██║   ██║██║██║     █████╗  ",
            "   ██║   ██║   ██║██║██║     ██╔══╝  ",
            "   ██║   ╚██████╔╝██║███████╗███████╗",
            "   ╚═╝    ╚═════╝ ╚═╝╚══════╝╚══════╝",
          ].join("\n")}
        </Text>
      </Box>

      <Box paddingLeft={4}>
        <Text color={theme.accent} bold>
          {computed(() => {
            const text = TAGLINE.slice(0, typedLen.value);
            return typedLen.value < TAGLINE.length
              ? text + (showCursor.value ? "▌" : " ")
              : text;
          })}
        </Text>
      </Box>
      <Box paddingLeft={4}>
        <Text color={theme.dim}>
          Fine-grained reactivity · Flex layout · Zero dependencies
        </Text>
      </Box>

      {/* Feature cards */}
      <Box paddingX={4} align="start">
        <Grid columns={["1fr", "1fr", "1fr"]} border="round" spacing={1}>
          <GridItem col={1} row={1}>
            <Box paddingX={1} direction="vertical">
              <Text color={theme.accent} bold>
                ⚡ Reactive Signals
              </Text>
              <Text color={theme.dim}>Fine-grained signal/computed/effect</Text>
            </Box>
          </GridItem>
          <GridItem col={2} row={1}>
            <Box paddingX={1} direction="vertical">
              <Text color={theme.success} bold>
                ◫  Flex Layout
              </Text>
              <Text color={theme.dim}>Constraint-based box model engine</Text>
            </Box>
          </GridItem>
          <GridItem col={3} row={1}>
            <Box paddingX={1} direction="vertical">
              <Text color={theme.warning} bold>
                ✦  Rich Widgets
              </Text>
              <Text color={theme.dim}>Table, Select, Spinner, Progress...</Text>
            </Box>
          </GridItem>
          <GridItem col={1} row={2}>
            <Box paddingX={1} direction="vertical">
              <Text color={theme.pink} bold>
                ◎  Animation
              </Text>
              <Text color={theme.dim}>25 easings, spring physics, bezier</Text>
            </Box>
          </GridItem>
          <GridItem col={2} row={2}>
            <Box paddingX={1} direction="vertical">
              <Text color={theme.lavender} bold>
                ☰ ScrollBox
              </Text>
              <Text color={theme.dim}>Scrollable containers with state</Text>
            </Box>
          </GridItem>
          <GridItem col={3} row={2}>
            <Box paddingX={1} direction="vertical">
              <Text color={theme.teal} bold>
                ⊘  Zero Deps
              </Text>
              <Text color={theme.dim}>~6k LoC, no runtime dependencies</Text>
            </Box>
          </GridItem>
        </Grid>
      </Box>

      {/* Live status bar */}
      <Box direction="horizontal" gap={3} paddingX={5}>
        <Box direction="horizontal" gap={1}>
          <Spinner type="dots" style={{ color: theme.success }} />
          <Text color={theme.dim}> running</Text>
        </Box>
        <Box direction="horizontal" gap={1}>
          <Text color={theme.accent}>⏱</Text>
          <Text color={theme.dim}>{clock}</Text>
        </Box>
        <Box direction="horizontal" gap={1}>
          <Text color={theme.warning}>▲</Text>
          <Text color={theme.dim}>{computed(() => `${uptime.value}s`)}</Text>
        </Box>
        <Box direction="horizontal" gap={1}>
          <Text color={theme.pink}>◈</Text>
          <Text color={theme.dim}>
            {computed(() => `${cols.value}×${rows.value}`)}
          </Text>
        </Box>
      </Box>

      <Box paddingLeft={4}>
        <Text color={theme.muted}>
          → to explore  ·  1-8 jump  ·  q quit
        </Text>
      </Box>
    </Box>
  );
}
