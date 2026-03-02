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
  effect,
  batch,
  animate,
  spring,
  cubicBezier,
  Show,
  For,
  Switch,
  Match,
  ScrollBox,
  createScrollState,
  onMount,
  onCleanup,
  createContext,
  useContext,
  Spinner,
  ProgressBar,
  Checkbox,
  Select,
  Table,
  TextInput,
  Grid,
  GridItem,
  Measure,
} from "../src/index.js";
import type { KeyEvent, ReadSignal } from "../src/index.js";

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

const t = {
  primary: "#7C6FFF",
  accent: "#00D4FF",
  success: "#00E676",
  warning: "#FFD740",
  error: "#FF5252",
  pink: "#FF6B9D",
  orange: "#FF9100",
  lavender: "#B388FF",
  teal: "#1DE9B6",
  text: "#E8E8E8",
  dim: "#707070",
  muted: "#484848",
};

// ---------------------------------------------------------------------------
// Terminal size (reactive)
// ---------------------------------------------------------------------------

const cols = signal(process.stdout.columns ?? 80);
const rows = signal(process.stdout.rows ?? 24);

process.stdout.on("resize", () => {
  cols.value = process.stdout.columns ?? 80;
  rows.value = process.stdout.rows ?? 24;
});

// ---------------------------------------------------------------------------
// State
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

/** Page-level key handler — set by interactive pages, cleared on unmount */
const pageKeyHandler = signal<((e: KeyEvent) => void) | null>(null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Section(props: { title: string; color?: string }) {
  return (
    <Box direction="horizontal" gap={1} paddingLeft={2}>
      <Text color={props.color ?? t.primary} bold>
        ▎
      </Text>
      <Text color={t.text} bold>
        {props.title}
      </Text>
    </Box>
  );
}

const hrText = computed(() => " " + "─".repeat(Math.max(0, cols.value - 2)));

const SPARK = "▁▂▃▄▅▆▇█";
function sparkline(values: number[]): string {
  return values
    .map((v) => SPARK[Math.round(Math.max(0, Math.min(1, v)) * 7)])
    .join("");
}

// ---------------------------------------------------------------------------
// 1. Welcome
// ---------------------------------------------------------------------------

const BANNER_COLORS = [
  t.primary,
  t.accent,
  t.teal,
  t.success,
  t.lavender,
  t.pink,
];

function WelcomePage() {
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
    <Box direction="vertical">
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

      <Box paddingLeft={4} paddingTop={1}>
        <Text color={t.accent} bold>
          {computed(() => {
            const text = TAGLINE.slice(0, typedLen.value);
            return typedLen.value < TAGLINE.length
              ? text + (showCursor.value ? "▌" : " ")
              : text;
          })}
        </Text>
      </Box>
      <Text color={t.dim}>
        {"    Fine-grained reactivity · Flex layout · Zero dependencies"}
      </Text>
      <Text>{""}</Text>

      {/* 3×2 feature cards */}
      <Box paddingX={4} align="start">
        <Grid columns={["1fr", "1fr", "1fr"]} border="round" spacing={1}>
          <GridItem col={1} row={1}>
            <Box paddingX={1} direction="vertical">
              <Text color={t.accent} bold>
                {"⚡ Reactive Signals"}
              </Text>
              <Text color={t.dim}>Fine-grained signal/computed/effect</Text>
            </Box>
          </GridItem>
          <GridItem col={2} row={1}>
            <Box paddingX={1} direction="vertical">
              <Text color={t.success} bold>
                {"◫  Flex Layout"}
              </Text>
              <Text color={t.dim}>Constraint-based box model engine</Text>
            </Box>
          </GridItem>
          <GridItem col={3} row={1}>
            <Box paddingX={1} direction="vertical">
              <Text color={t.warning} bold>
                {"✦  Rich Widgets"}
              </Text>
              <Text color={t.dim}>Table, Select, Spinner, Progress...</Text>
            </Box>
          </GridItem>
          <GridItem col={1} row={2}>
            <Box paddingX={1} direction="vertical">
              <Text color={t.pink} bold>
                {"◎  Animation"}
              </Text>
              <Text color={t.dim}>25 easings, spring physics, bezier</Text>
            </Box>
          </GridItem>
          <GridItem col={2} row={2}>
            <Box paddingX={1} direction="vertical">
              <Text color={t.lavender} bold>
                {"☰ ScrollBox"}
              </Text>
              <Text color={t.dim}>Scrollable containers with state</Text>
            </Box>
          </GridItem>
          <GridItem col={3} row={2}>
            <Box paddingX={1} direction="vertical">
              <Text color={t.teal} bold>
                {"⊘  Zero Deps"}
              </Text>
              <Text color={t.dim}>~6k LoC, no runtime dependencies</Text>
            </Box>
          </GridItem>
        </Grid>
      </Box>

      <Text>{""}</Text>

      {/* Live status bar */}
      <Box direction="horizontal" gap={3} paddingX={5}>
        <Box direction="horizontal" gap={1}>
          <Spinner type="dots" style={{ color: t.success }} />
          <Text color={t.dim}> running</Text>
        </Box>
        <Box direction="horizontal" gap={1}>
          <Text color={t.accent}>{"⏱"}</Text>
          <Text color={t.dim}>{clock}</Text>
        </Box>
        <Box direction="horizontal" gap={1}>
          <Text color={t.warning}>{"▲"}</Text>
          <Text color={t.dim}>{computed(() => `${uptime.value}s`)}</Text>
        </Box>
        <Box direction="horizontal" gap={1}>
          <Text color={t.pink}>{"◈"}</Text>
          <Text color={t.dim}>
            {computed(() => `${cols.value}×${rows.value}`)}
          </Text>
        </Box>
      </Box>

      <Text>{""}</Text>
      <Text color={t.muted}>{"    → to explore  ·  1-8 jump  ·  q quit"}</Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// 2. Dashboard — live system monitor
// ---------------------------------------------------------------------------

interface LogEntry {
  time: string;
  level: string;
  text: string;
}

const LOG_POOL: { text: string; level: string }[] = [
  { text: "GET /api/users 200 12ms", level: "INF" },
  { text: "POST /api/auth/login 201 45ms", level: "INF" },
  { text: "GET /api/dashboard 200 8ms", level: "INF" },
  { text: "WebSocket client connected (ws-847)", level: "INF" },
  { text: "Cache hit ratio: 94.2%", level: "INF" },
  { text: "GET /api/metrics 200 3ms", level: "INF" },
  { text: "PUT /api/settings 200 23ms", level: "INF" },
  { text: "SSL cert renewed (342d remaining)", level: "INF" },
  { text: "GET /healthz 200 <1ms", level: "INF" },
  { text: "Batch processor: 1,247 records synced", level: "INF" },
  { text: "SSE stream opened: /api/events", level: "INF" },
  { text: "DB pool: 15/20 connections active", level: "INF" },
  { text: "Worker pool scaled to 8/12", level: "WRN" },
  { text: "Rate limit: 2,341/10k quota used", level: "WRN" },
  { text: "GC pause: 3.2ms (minor)", level: "WRN" },
  { text: "Memory compaction triggered", level: "WRN" },
  { text: "ECONNREFUSED redis:6379 — retry #3", level: "ERR" },
  { text: "Timeout: POST /api/reports (>30s)", level: "ERR" },
];

function DashboardPage() {
  const cpu = signal(42);
  const mem = signal(61);
  const rps = signal(1247);
  const lat = signal(12);

  const cpuHist = signal(
    Array.from({ length: 24 }, () => 0.3 + Math.random() * 0.3),
  );
  const memHist = signal(
    Array.from({ length: 24 }, () => 0.5 + Math.random() * 0.15),
  );
  const rpsHist = signal(
    Array.from({ length: 24 }, () => 0.3 + Math.random() * 0.4),
  );
  const latHist = signal(
    Array.from({ length: 24 }, () => 0.08 + Math.random() * 0.15),
  );

  const diskUsage = signal(0.62);
  const logLines = signal<LogEntry[]>([]);
  let logPoolIdx = 0;

  onMount(() => {
    // Metrics update
    const mt = setInterval(() => {
      cpu.value = Math.max(
        5,
        Math.min(95, cpu.peek() + (Math.random() - 0.48) * 8),
      );
      cpuHist.value = [...cpuHist.peek().slice(1), cpu.peek() / 100];

      const md = Math.random() < 0.1 ? -8 : (Math.random() - 0.3) * 3;
      mem.value = Math.max(30, Math.min(88, mem.peek() + md));
      memHist.value = [...memHist.peek().slice(1), mem.peek() / 100];

      rps.value = Math.max(
        200,
        Math.min(3000, rps.peek() + (Math.random() - 0.5) * 200),
      );
      rpsHist.value = [...rpsHist.peek().slice(1), rps.peek() / 3000];

      const spike = Math.random() < 0.08;
      lat.value = spike
        ? 40 + Math.floor(Math.random() * 60)
        : 5 + Math.floor(Math.random() * 15);
      latHist.value = [...latHist.peek().slice(1), lat.peek() / 100];

      if (diskUsage.peek() < 0.84) diskUsage.value = diskUsage.peek() + 0.001;
    }, 800);

    // Log stream
    const lt = setInterval(() => {
      const entry = LOG_POOL[logPoolIdx % LOG_POOL.length];
      logPoolIdx++;
      const now = new Date();
      const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
        .map((n) => String(n).padStart(2, "0"))
        .join(":");
      logLines.value = [
        ...logLines.peek().slice(-8),
        { time, level: entry.level, text: entry.text },
      ];
    }, 700);

    onCleanup(() => {
      clearInterval(mt);
      clearInterval(lt);
    });
  });

  return (
    <Box direction="vertical">
      <Section title="System Monitor" color={t.accent} />

      {/* Metric cards */}
      <Box direction="horizontal" gap={1} paddingX={4} paddingTop={1}>
        {[
          {
            label: "CPU Usage",
            sig: cpu,
            unit: "%",
            color: t.accent,
            hist: cpuHist,
          },
          {
            label: "Memory",
            sig: mem,
            unit: "%",
            color: t.success,
            hist: memHist,
          },
          {
            label: "Requests",
            sig: rps,
            unit: "/s",
            color: t.warning,
            hist: rpsHist,
          },
          {
            label: "Latency",
            sig: lat,
            unit: "ms",
            color: t.pink,
            hist: latHist,
          },
        ].map((m) => (
          <Box border="round" flexGrow={1} paddingX={1} direction="vertical">
            <Text color={t.dim}>{m.label}</Text>
            <Box direction="horizontal" gap={1}>
              <Text color={m.color} bold>
                {computed(() => String(Math.round(m.sig.value)))}
              </Text>
              <Text color={t.dim}>{m.unit}</Text>
            </Box>
            <Box height={1} overflow="hidden">
              <Text color={m.color}>
                {computed(() => sparkline(m.hist.value))}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      <Text>{""}</Text>

      {/* Log stream + Services panel */}
      <Box direction="horizontal" gap={1} paddingX={4}>
        {/* Live log */}
        <Box border="round" flexGrow={2} paddingX={1} direction="vertical">
          <Box direction="horizontal" gap={1}>
            <Spinner type="dots" style={{ color: t.success }} />
            <Text color={t.text} bold>
              Live Log
            </Text>
          </Box>
          <Text>{""}</Text>
          <For each={logLines}>
            {(line: LogEntry, _i) => (
              <Box direction="horizontal">
                <Text color={t.dim}>{` ${line.time} `}</Text>
                <Text
                  color={
                    line.level === "ERR"
                      ? t.error
                      : line.level === "WRN"
                        ? t.warning
                        : t.success
                  }
                  bold={line.level !== "INF"}
                >
                  {line.level}
                </Text>
                <Text color={t.dim}>{" │ "}</Text>
                <Text color={t.text}>{line.text}</Text>
              </Box>
            )}
          </For>
        </Box>

        {/* Services */}
        <Box border="round" paddingX={1} direction="vertical">
          <Text color={t.text} bold>
            Services
          </Text>
          <Text>{""}</Text>
          <Box direction="horizontal" gap={1}>
            <Text color={t.success}>●</Text>
            <Text color={t.dim}>API Server 14d</Text>
          </Box>
          <Box direction="horizontal" gap={1}>
            <Text color={t.success}>●</Text>
            <Text color={t.dim}>Database 14d</Text>
          </Box>
          <Box direction="horizontal" gap={1}>
            <Text color={t.success}>●</Text>
            <Text color={t.dim}>Redis Cache 3d</Text>
          </Box>
          <Box direction="horizontal" gap={1}>
            <Text color={t.warning}>●</Text>
            <Text color={t.dim}>Worker Pool 4h</Text>
          </Box>
          <Text>{""}</Text>
          <Text color={t.dim} bold>
            Storage
          </Text>
          <Box direction="horizontal" gap={1}>
            <Text color={t.dim}>/data</Text>
            <ProgressBar
              value={diskUsage}
              width={8}
              filledColor={t.accent}
              emptyColor={t.muted}
              showLabel={false}
            />
          </Box>
          <Box direction="horizontal" gap={1}>
            <Text color={t.dim}>/logs</Text>
            <ProgressBar
              value={0.41}
              width={8}
              filledColor={t.success}
              emptyColor={t.muted}
              showLabel={false}
            />
          </Box>
          <Box direction="horizontal" gap={1}>
            <Text color={t.dim}>{"/tmp "}</Text>
            <ProgressBar
              value={0.18}
              width={8}
              filledColor={t.teal}
              emptyColor={t.muted}
              showLabel={false}
            />
          </Box>
        </Box>
      </Box>

      <Text>{""}</Text>
      <Box paddingX={5}>
        <Text color={t.dim}>
          {computed(
            () =>
              `Uptime 14d 7h  ·  Node ${process.version}  ·  PID ${process.pid}  ·  ${cols.value}×${rows.value}`,
          )}
        </Text>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// 3. Widgets
// ---------------------------------------------------------------------------

function WidgetsPage() {
  const progress = signal(0);
  let progressDir = 1;

  const checkNotify = signal(true);
  const checkDark = signal(false);
  const checkAuto = signal(true);

  const selectValue = signal("banana");
  const inputValue = signal("");

  onMount(() => {
    const timer = setInterval(() => {
      const v = progress.peek();
      if (v >= 1) progressDir = -1;
      if (v <= 0) progressDir = 1;
      progress.value = Math.max(0, Math.min(1, v + progressDir * 0.012));
    }, 50);
    onCleanup(() => clearInterval(timer));
  });

  return (
    <Box direction="vertical">
      <Box paddingX={4}>
        <Measure>
          {({ width: containerWidth }) => {
            const barWidth = computed(() =>
              Math.max(10, Math.floor((containerWidth.value - 3) / 2) - 7),
            );
            return (
              <Grid columns={["1fr", "1fr"]} border="round" width="100%">
                <GridItem col={1} row={1}>
                  <Box padding={1} direction="vertical" gap={1}>
                    <Text color={t.accent} bold>
                      Spinners
                    </Text>
                    <Box direction="horizontal" gap={3}>
                      <Box direction="vertical">
                        <Spinner
                          type="dots"
                          label="dots"
                          style={{ color: t.accent }}
                        />
                        <Spinner
                          type="arc"
                          label="arc"
                          style={{ color: t.success }}
                        />
                        <Spinner
                          type="arrow"
                          label="arrow"
                          style={{ color: t.warning }}
                        />
                        <Spinner
                          type="line"
                          label="line"
                          style={{ color: t.pink }}
                        />
                      </Box>
                      <Box direction="vertical">
                        <Spinner
                          type="circle"
                          label="circle"
                          style={{ color: t.lavender }}
                        />
                        <Spinner
                          type="square"
                          label="square"
                          style={{ color: t.teal }}
                        />
                        <Spinner
                          type="toggle"
                          label="toggle"
                          style={{ color: t.orange }}
                        />
                        <Spinner
                          type="bouncingBar"
                          label=""
                          style={{ color: t.error }}
                        />
                      </Box>
                    </Box>
                  </Box>
                </GridItem>
                <GridItem col={2} row={1}>
                  <Box padding={1} direction="vertical" gap={1}>
                    <Text color={t.success} bold>
                      ProgressBar
                    </Text>
                    <ProgressBar
                      value={progress}
                      width={barWidth}
                      filledColor={t.accent}
                      emptyColor={t.muted}
                    />
                    <ProgressBar
                      value={0.7}
                      width={barWidth}
                      filledColor={t.success}
                      emptyColor={t.muted}
                      filled="▓"
                      empty="░"
                    />
                    <ProgressBar
                      value={0.45}
                      width={barWidth}
                      filledColor={t.warning}
                      emptyColor={t.muted}
                    />
                    <ProgressBar
                      value={0.9}
                      width={barWidth}
                      filledColor={t.pink}
                      emptyColor={t.muted}
                      filled="●"
                      empty="○"
                    />
                  </Box>
                </GridItem>
                <GridItem col={1} row={2}>
                  <Box padding={1} direction="vertical" gap={1}>
                    <Text color={t.warning} bold>
                      Checkbox
                    </Text>
                    <Checkbox label="Notifications" checked={checkNotify} />
                    <Checkbox label="Dark mode" checked={checkDark} />
                    <Checkbox label="Auto-save" checked={checkAuto} />
                  </Box>
                </GridItem>
                <GridItem col={2} row={2}>
                  <Box padding={1} direction="vertical" gap={1}>
                    <Text color={t.pink} bold>
                      Select
                    </Text>
                    <Select
                      options={[
                        { label: "Apple", value: "apple" },
                        { label: "Banana", value: "banana" },
                        { label: "Cherry", value: "cherry" },
                        { label: "Dragonfruit", value: "dragonfruit" },
                      ]}
                      value={selectValue}
                      selectedColor={t.accent}
                      visibleRows={4}
                    />
                  </Box>
                </GridItem>
                <GridItem col={1} row={3}>
                  <Box padding={1} direction="vertical" gap={1}>
                    <Text color={t.lavender} bold>
                      TextInput
                    </Text>
                    <Box border="single" paddingX={1}>
                      <TextInput
                        value={inputValue}
                        placeholder="Type here..."
                        width={24}
                        placeholderColor={t.muted}
                      />
                    </Box>
                  </Box>
                </GridItem>
                <GridItem col={2} row={3}>
                  <Box padding={1} direction="vertical" gap={1}>
                    <Text color={t.teal} bold>
                      Table
                    </Text>
                    <Table
                      columns={[
                        { header: "Name", key: "name", width: 7 },
                        { header: "Role", key: "role", width: 8 },
                        { header: "Status", key: "st", width: 6 },
                      ]}
                      data={[
                        { name: "Alice", role: "Engineer", st: "✓" },
                        { name: "Bob", role: "Designer", st: "○" },
                        { name: "Carol", role: "PM", st: "✓" },
                      ]}
                      headerColor={t.accent}
                    />
                  </Box>
                </GridItem>
              </Grid>
            );
          }}
        </Measure>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// 4. Grid Showcase
// ---------------------------------------------------------------------------

function GridPage() {
  return (
    <Box direction="vertical">
      {/* Top row: Merged borders + Column spans side by side */}
      <Box direction="horizontal" gap={2} paddingX={4}>
        <Box direction="vertical" flexGrow={1}>
          <Section title="Merged Borders" />
          <Box paddingTop={1}>
            <Grid columns={["1fr", "1fr", "1fr"]} border="single" width="100%">
              <GridItem col={1} row={1}>
                <Box paddingX={1}>
                  <Text color={t.accent} bold>
                    Name
                  </Text>
                </Box>
              </GridItem>
              <GridItem col={2} row={1}>
                <Box paddingX={1}>
                  <Text color={t.success} bold>
                    Status
                  </Text>
                </Box>
              </GridItem>
              <GridItem col={3} row={1}>
                <Box paddingX={1}>
                  <Text color={t.warning} bold>
                    Uptime
                  </Text>
                </Box>
              </GridItem>
              <GridItem col={1} row={2}>
                <Box paddingX={1}>
                  <Text color={t.dim}>API Server</Text>
                </Box>
              </GridItem>
              <GridItem col={2} row={2}>
                <Box paddingX={1}>
                  <Text color={t.success}>● online</Text>
                </Box>
              </GridItem>
              <GridItem col={3} row={2}>
                <Box paddingX={1}>
                  <Text color={t.dim}>14d 7h</Text>
                </Box>
              </GridItem>
              <GridItem col={1} row={3}>
                <Box paddingX={1}>
                  <Text color={t.dim}>Database</Text>
                </Box>
              </GridItem>
              <GridItem col={2} row={3}>
                <Box paddingX={1}>
                  <Text color={t.success}>● online</Text>
                </Box>
              </GridItem>
              <GridItem col={3} row={3}>
                <Box paddingX={1}>
                  <Text color={t.dim}>7d 3h</Text>
                </Box>
              </GridItem>
            </Grid>
          </Box>
          <Text color={t.muted}>{"  Shared borders — no doubling"}</Text>
        </Box>
        <Box direction="vertical" flexGrow={1}>
          <Section title="Column Spans" color={t.accent} />
          <Box paddingTop={1}>
            <Grid columns={["1fr", "1fr", "1fr"]} border="round" width="100%">
              <GridItem col={1} row={1} colSpan={2}>
                <Box paddingX={1}>
                  <Text color={t.pink} bold>
                    Spans 2 columns
                  </Text>
                </Box>
              </GridItem>
              <GridItem col={3} row={1}>
                <Box paddingX={1}>
                  <Text color={t.accent}>C1</Text>
                </Box>
              </GridItem>
              <GridItem col={1} row={2}>
                <Box paddingX={1}>
                  <Text color={t.dim}>A2</Text>
                </Box>
              </GridItem>
              <GridItem col={2} row={2}>
                <Box paddingX={1}>
                  <Text color={t.dim}>B2</Text>
                </Box>
              </GridItem>
              <GridItem col={3} row={2}>
                <Box paddingX={1}>
                  <Text color={t.dim}>C2</Text>
                </Box>
              </GridItem>
              <GridItem col={1} row={3} colSpan={3}>
                <Box paddingX={1}>
                  <Text color={t.success} bold>
                    Full-width footer (colSpan: 3)
                  </Text>
                </Box>
              </GridItem>
            </Grid>
          </Box>
          <Text color={t.muted}>
            {"  colSpan merges cells + adapts borders"}
          </Text>
        </Box>
      </Box>

      <Text>{""}</Text>

      {/* Border styles */}
      <Section title="Border Styles" color={t.warning} />
      <Box paddingX={5} paddingTop={1} direction="horizontal" gap={2}>
        {(["single", "double", "round", "bold"] as const).map((style) => (
          <Box direction="vertical" flexGrow={1}>
            <Grid columns={["1fr"]} border={style} width="100%">
              <GridItem col={1} row={1}>
                <Box paddingX={1}>
                  <Text color={t.accent} bold>
                    {style}
                  </Text>
                </Box>
              </GridItem>
              <GridItem col={1} row={2}>
                <Box paddingX={1}>
                  <Text color={t.dim}>cell</Text>
                </Box>
              </GridItem>
            </Grid>
          </Box>
        ))}
      </Box>

      <Text>{""}</Text>

      {/* Spacing modes */}
      <Section title="Spacing Modes" color={t.teal} />
      <Box paddingX={5} paddingTop={1} direction="horizontal" gap={3}>
        <Box direction="vertical">
          <Text color={t.dim} bold>
            merged
          </Text>
          <Grid columns={["1fr", "1fr"]} border="single" width={21}>
            <GridItem col={1} row={1}>
              <Box paddingX={1}>
                <Text color={t.accent}>A</Text>
              </Box>
            </GridItem>
            <GridItem col={2} row={1}>
              <Box paddingX={1}>
                <Text color={t.success}>B</Text>
              </Box>
            </GridItem>
            <GridItem col={1} row={2}>
              <Box paddingX={1}>
                <Text color={t.warning}>C</Text>
              </Box>
            </GridItem>
            <GridItem col={2} row={2}>
              <Box paddingX={1}>
                <Text color={t.pink}>D</Text>
              </Box>
            </GridItem>
          </Grid>
        </Box>
        <Box direction="vertical">
          <Text color={t.dim} bold>
            spacing=1
          </Text>
          <Grid columns={["1fr", "1fr"]} border="round" spacing={1} width={22}>
            <GridItem col={1} row={1}>
              <Box paddingX={1}>
                <Text color={t.accent}>A</Text>
              </Box>
            </GridItem>
            <GridItem col={2} row={1}>
              <Box paddingX={1}>
                <Text color={t.success}>B</Text>
              </Box>
            </GridItem>
            <GridItem col={1} row={2}>
              <Box paddingX={1}>
                <Text color={t.warning}>C</Text>
              </Box>
            </GridItem>
            <GridItem col={2} row={2}>
              <Box paddingX={1}>
                <Text color={t.pink}>D</Text>
              </Box>
            </GridItem>
          </Grid>
        </Box>
        <Box direction="vertical">
          <Text color={t.dim} bold>
            spacing=2
          </Text>
          <Grid columns={["1fr", "1fr"]} border="round" spacing={2} width={23}>
            <GridItem col={1} row={1}>
              <Box paddingX={1}>
                <Text color={t.accent}>A</Text>
              </Box>
            </GridItem>
            <GridItem col={2} row={1}>
              <Box paddingX={1}>
                <Text color={t.success}>B</Text>
              </Box>
            </GridItem>
            <GridItem col={1} row={2}>
              <Box paddingX={1}>
                <Text color={t.warning}>C</Text>
              </Box>
            </GridItem>
            <GridItem col={2} row={2}>
              <Box paddingX={1}>
                <Text color={t.pink}>D</Text>
              </Box>
            </GridItem>
          </Grid>
        </Box>
      </Box>

      <Text>{""}</Text>

      {/* Full-width mixed columns */}
      <Section title="Mixed Fixed + Fractional" color={t.lavender} />
      <Box paddingX={5} paddingTop={1}>
        <Grid columns={[12, "1fr", "2fr"]} border="double" width="100%">
          <GridItem col={1} row={1}>
            <Box paddingX={1}>
              <Text color={t.warning} bold>
                12 fixed
              </Text>
            </Box>
          </GridItem>
          <GridItem col={2} row={1}>
            <Box paddingX={1}>
              <Text color={t.accent} bold>
                1fr
              </Text>
            </Box>
          </GridItem>
          <GridItem col={3} row={1}>
            <Box paddingX={1}>
              <Text color={t.success} bold>
                2fr
              </Text>
            </Box>
          </GridItem>
          <GridItem col={1} row={2}>
            <Box paddingX={1}>
              <Text color={t.dim}>fixed col</Text>
            </Box>
          </GridItem>
          <GridItem col={2} row={2}>
            <Box paddingX={1}>
              <Text color={t.dim}>flexible</Text>
            </Box>
          </GridItem>
          <GridItem col={3} row={2}>
            <Box paddingX={1}>
              <Text color={t.dim}>grows 2× faster</Text>
            </Box>
          </GridItem>
        </Grid>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// 5. Animation
// ---------------------------------------------------------------------------

function AnimationPage() {
  const bounceAnim = animate(0, 1, {
    duration: 2000,
    easing: "ease-out-bounce",
    repeat: Infinity,
    yoyo: true,
  });
  const sineAnim = animate(0, 1, {
    duration: 3000,
    easing: "ease-in-out-sine",
    repeat: Infinity,
    yoyo: true,
  });
  const elasticAnim = animate(0, 1, {
    duration: 2500,
    easing: "ease-out-elastic",
    repeat: Infinity,
    yoyo: true,
  });
  const cubicAnim = animate(0, 1, {
    duration: 2000,
    easing: "ease-in-out-cubic",
    repeat: Infinity,
    yoyo: true,
  });

  const bezierEasing = cubicBezier(0.68, -0.55, 0.27, 1.55);
  const bezierAnim = animate(0, 1, {
    duration: 2000,
    easing: bezierEasing,
    repeat: Infinity,
    yoyo: true,
  });

  const springAnim = spring(0, { stiffness: 120, damping: 12 });

  onMount(() => {
    let target = 1;
    const timer = setInterval(() => {
      springAnim.setTarget(target);
      target = target === 1 ? 0 : 1;
    }, 2500);
    onCleanup(() => clearInterval(timer));
  });

  onCleanup(() => {
    bounceAnim.stop();
    sineAnim.stop();
    elasticAnim.stop();
    cubicAnim.stop();
    bezierAnim.stop();
    springAnim.stop();
  });

  function track(anim: { value: { value: number } }, marker: string) {
    return computed(() => {
      const w = Math.max(10, cols.value - 22);
      const v = Math.max(0, Math.min(1, anim.value.value));
      const pos = Math.round(v * w);
      return "─".repeat(pos) + marker + "─".repeat(w - pos);
    });
  }

  return (
    <Box direction="vertical">
      <Section title="Tween Animations" />
      <Box paddingLeft={5} paddingTop={1} direction="vertical">
        <Box direction="horizontal" gap={1}>
          <Text color={t.dim}>{"bounce  "}</Text>
          <Text color={t.accent}>{track(bounceAnim, "●")}</Text>
        </Box>
        <Box direction="horizontal" gap={1}>
          <Text color={t.dim}>{"sine    "}</Text>
          <Text color={t.success}>{track(sineAnim, "◆")}</Text>
        </Box>
        <Box direction="horizontal" gap={1}>
          <Text color={t.dim}>{"elastic "}</Text>
          <Text color={t.warning}>{track(elasticAnim, "★")}</Text>
        </Box>
        <Box direction="horizontal" gap={1}>
          <Text color={t.dim}>{"cubic   "}</Text>
          <Text color={t.pink}>{track(cubicAnim, "◉")}</Text>
        </Box>
      </Box>

      <Text>{""}</Text>
      <Section title="Spring Physics" color={t.teal} />
      <Box paddingLeft={5} paddingTop={1} direction="vertical">
        <Box direction="horizontal" gap={1}>
          <Text color={t.dim}>{"spring  "}</Text>
          <Text color={t.teal}>{track(springAnim, "⬤")}</Text>
        </Box>
        <Text color={t.muted}>
          {"          stiffness: 120 · damping: 12 — notice the overshoot!"}
        </Text>
      </Box>

      <Text>{""}</Text>
      <Section title="Custom Cubic Bezier" color={t.lavender} />
      <Box paddingLeft={5} paddingTop={1} direction="vertical">
        <Box direction="horizontal" gap={1}>
          <Text color={t.dim}>{"bezier  "}</Text>
          <Text color={t.lavender}>{track(bezierAnim, "◈")}</Text>
        </Box>
        <Text color={t.muted}>
          {"          cubicBezier(0.68, -0.55, 0.27, 1.55)"}
        </Text>
      </Box>

      <Text>{""}</Text>
      <Section title="25 Built-in Easings" color={t.orange} />
      <Box paddingLeft={5} paddingTop={1}>
        <Box direction="horizontal" gap={4}>
          <Box direction="vertical">
            <Text color={t.accent} bold>
              ease-in
            </Text>
            <Text color={t.dim}>quad · cubic · quart</Text>
            <Text color={t.dim}>sine · expo · back</Text>
            <Text color={t.dim}>elastic · bounce</Text>
          </Box>
          <Box direction="vertical">
            <Text color={t.success} bold>
              ease-out
            </Text>
            <Text color={t.dim}>quad · cubic · quart</Text>
            <Text color={t.dim}>sine · expo · back</Text>
            <Text color={t.dim}>elastic · bounce</Text>
          </Box>
          <Box direction="vertical">
            <Text color={t.warning} bold>
              ease-in-out
            </Text>
            <Text color={t.dim}>quad · cubic · quart</Text>
            <Text color={t.dim}>sine · expo · back</Text>
            <Text color={t.dim}>elastic · bounce</Text>
          </Box>
        </Box>
      </Box>

      <Text>{""}</Text>
      <Box paddingLeft={5}>
        <Text color={t.muted}>
          + linear · cubicBezier(x1, y1, x2, y2) for custom curves
        </Text>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// 5. Reactivity
// ---------------------------------------------------------------------------

const ThemeCtx = createContext({ label: "default", color: t.primary });

function ContextBadge() {
  const theme = useContext(ThemeCtx);
  return (
    <Box direction="horizontal" gap={1}>
      <Text color={theme.color} bold>
        {"●"}
      </Text>
      <Text color={t.dim}>{theme.label}</Text>
    </Box>
  );
}

function ReactivityPage() {
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
    <Box direction="vertical">
      {/* Row 1: Signal + Effect */}
      <Box direction="horizontal" gap={1} paddingX={4}>
        <Box border="round" padding={1} flexGrow={1} direction="vertical">
          <Text color={t.accent} bold>
            {"⚡ signal + computed"}
          </Text>
          <Text>{""}</Text>
          <Text color={t.text} bold>
            {computed(() => `  value  = ${counter.value}`)}
          </Text>
          <Text color={t.success}>
            {computed(() => `  × 2   = ${doubled.value}`)}
          </Text>
          <Text color={t.pink}>
            {computed(() => `  parity = ${parity.value}`)}
          </Text>
          <Text>{""}</Text>
          <Text color={t.muted}>{"↑↓ change · b batch(+10)"}</Text>
        </Box>
        <Box border="round" padding={1} flexGrow={1} direction="vertical">
          <Text color={t.warning} bold>
            {"⊙  effect() — live log"}
          </Text>
          <Text>{""}</Text>
          <Text color={t.dim}>
            {computed(() => {
              const logs = effectLog.value;
              return logs.length > 0
                ? logs.map((l) => `  ${l}`).join("\n")
                : "  (press ↑↓ to trigger)";
            })}
          </Text>
          <Text>{""}</Text>
          <Text color={t.muted}>
            {computed(() => `  effect runs: ${renderCount.value}`)}
          </Text>
        </Box>
      </Box>

      <Text>{""}</Text>

      {/* Row 2: Clock + Context + Control Flow */}
      <Box direction="horizontal" gap={1} paddingX={4}>
        <Box border="round" padding={1} flexGrow={1} direction="vertical">
          <Text color={t.teal} bold>
            {"⏱  Live Clock"}
          </Text>
          <Text color={t.dim}>signal + setInterval</Text>
          <Text>{""}</Text>
          <Text color={t.text} bold>
            {computed(() => `  ${clock.value}`)}
          </Text>
          <Text>{""}</Text>
          <Section title="Context" color={t.lavender} />
          <Box paddingLeft={2} direction="vertical">
            <ContextBadge />
            <ThemeCtx.Provider value={{ label: "custom", color: t.pink }}>
              <ContextBadge />
            </ThemeCtx.Provider>
          </Box>
        </Box>
        <Box border="round" padding={1} flexGrow={1} direction="vertical">
          <Text color={t.lavender} bold>
            {"◇  Control Flow"}
          </Text>
          <Text color={t.dim}>{"<Show> · <For> · <Switch>"}</Text>
          <Text>{""}</Text>
          <Show
            when={showList}
            fallback={
              <Text color={t.error} dim>
                {"  list hidden (t to show)"}
              </Text>
            }
          >
            <For each={items}>
              {(item: string, i: ReadSignal<number>) => (
                <Box direction="horizontal" gap={1}>
                  <Text color={t.primary}>{`  ${i.peek() + 1}.`}</Text>
                  <Text color={t.text}>{item}</Text>
                </Box>
              )}
            </For>
          </Show>
          <Text>{""}</Text>
          <Text color={t.muted}>t toggle · +/- list</Text>
        </Box>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// 6. Layout
// ---------------------------------------------------------------------------

const SPECTRUM = [
  "#FF0000",
  "#FF2200",
  "#FF4400",
  "#FF6600",
  "#FF8800",
  "#FFAA00",
  "#FFCC00",
  "#DDEE00",
  "#AAFF00",
  "#66FF00",
  "#00FF44",
  "#00FFAA",
  "#00FFEE",
  "#00CCFF",
  "#0088FF",
  "#0044FF",
  "#2200FF",
  "#6600FF",
  "#AA00FF",
  "#EE00FF",
  "#FF00CC",
  "#FF0088",
  "#FF0044",
];

function LayoutPage() {
  const spectrumWidth = computed(() => {
    const available = cols.value - 10;
    return Math.max(1, Math.floor(available / SPECTRUM.length));
  });

  return (
    <Box direction="vertical">
      <Section title="Border Styles" />
      <Box direction="horizontal" gap={1} paddingX={5} paddingTop={1}>
        <Box border="single" padding={1} flexGrow={1} align="center">
          <Text color={t.accent}>single</Text>
        </Box>
        <Box border="double" padding={1} flexGrow={1} align="center">
          <Text color={t.success}>double</Text>
        </Box>
        <Box border="round" padding={1} flexGrow={1} align="center">
          <Text color={t.pink}>round</Text>
        </Box>
        <Box border="bold" padding={1} flexGrow={1} align="center">
          <Text color={t.warning}>bold</Text>
        </Box>
      </Box>

      <Text>{""}</Text>
      <Section title="Flex Distribution" color={t.accent} />
      <Box paddingX={5} paddingTop={1}>
        <Box direction="horizontal" height={3}>
          <Box border="round" flexGrow={1} align="center" justify="center">
            <Text color={t.accent}>flex:1</Text>
          </Box>
          <Box border="round" flexGrow={3} align="center" justify="center">
            <Text color={t.success} bold>
              flex:3
            </Text>
          </Box>
          <Box border="round" flexGrow={1} align="center" justify="center">
            <Text color={t.accent}>flex:1</Text>
          </Box>
        </Box>
      </Box>

      <Text>{""}</Text>
      <Section title="Alignment" color={t.warning} />
      <Box paddingX={5} paddingTop={1} direction="horizontal" gap={1}>
        <Box
          border="round"
          flexGrow={1}
          height={5}
          align="start"
          justify="start"
          padding={1}
        >
          <Text color={t.dim}>start/start</Text>
        </Box>
        <Box
          border="round"
          flexGrow={1}
          height={5}
          align="center"
          justify="center"
          padding={1}
        >
          <Text color={t.accent} bold>
            center
          </Text>
        </Box>
        <Box
          border="round"
          flexGrow={1}
          height={5}
          align="end"
          justify="end"
          padding={1}
        >
          <Text color={t.dim}>end/end</Text>
        </Box>
      </Box>

      <Text>{""}</Text>
      <Section title="Text & Color" color={t.pink} />
      <Box direction="horizontal" gap={2} paddingLeft={5} paddingTop={1}>
        <Text bold color={t.text}>
          Bold
        </Text>
        <Text italic color={t.text}>
          Italic
        </Text>
        <Text underline color={t.accent}>
          Underline
        </Text>
        <Text strikethrough color={t.dim}>
          Strike
        </Text>
        <Text dim>Dim</Text>
        <Text inverse color={t.text}>
          {" Inverse "}
        </Text>
        <Text bold italic color={t.pink}>
          Bold+Italic
        </Text>
      </Box>
      <Box paddingLeft={5} paddingTop={1}>
        <Box direction="horizontal">
          {SPECTRUM.map((color) => (
            <Text color={color}>
              {computed(() => "█".repeat(spectrumWidth.value))}
            </Text>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// 7. Scroll & Unicode
// ---------------------------------------------------------------------------

function ScrollPage() {
  const scroll = createScrollState();

  const logItems = Array.from({ length: 40 }, (_, i) => {
    const level = i % 7 === 0 ? "ERR" : i % 3 === 0 ? "WRN" : "INF";
    const hour = String(9 + Math.floor(i / 6)).padStart(2, "0");
    const min = String((i * 7) % 60).padStart(2, "0");
    const sec = String((i * 13) % 60).padStart(2, "0");
    const time = `${hour}:${min}:${sec}`;
    const msgs = [
      "Connection established",
      "Processing batch #" + (1000 + i),
      "Cache miss for user:" + i * 7,
      "Completed in " + (10 + i * 3) + "ms",
      "Rate limit at 80%",
      "Worker thread spawned",
      "GC triggered",
      "SSL cert renewed",
      "Health check passed",
      "Metrics flushed to sink",
    ];
    return { level, time, msg: msgs[i % msgs.length] };
  });

  const scrollHeight = computed(() => Math.max(4, rows.value - 22));

  return (
    <Box direction="vertical">
      <Section title="Scrollable Log Viewer" />
      <Box paddingX={5} paddingTop={1} direction="vertical">
        <Text color={t.dim}>{"↑↓ PgUp/PgDn Home/End to scroll"}</Text>
        <Text>{""}</Text>
        <ScrollBox
          height={scrollHeight}
          width={computed(() => Math.max(30, cols.value - 10))}
          scrollState={scroll}
          tabIndex={0}
        >
          {logItems.map((item) => (
            <Text
              color={
                item.level === "ERR"
                  ? t.error
                  : item.level === "WRN"
                    ? t.warning
                    : t.success
              }
            >
              {` ${item.time} ${item.level} │ ${item.msg}`}
            </Text>
          ))}
        </ScrollBox>
        <Text color={t.dim}>
          {computed(() => {
            const off = scroll.offset.value;
            const max = scroll.maxOffset();
            const pct = max > 0 ? Math.round((off / max) * 100) : 0;
            const barW = Math.max(10, Math.min(40, cols.value - 20));
            const filled = Math.round(pct / (100 / barW));
            return (
              " " + "█".repeat(filled) + "░".repeat(barW - filled) + ` ${pct}%`
            );
          })}
        </Text>
      </Box>

      <Text>{""}</Text>
      <Section title="Unicode Width Support" color={t.teal} />
      <Box paddingLeft={5} paddingTop={1} direction="vertical">
        <Box direction="horizontal">
          <Text color={t.dim}>{"CJK    "}</Text>
          <Text color={t.accent}>{"漢字テスト 한국어"}</Text>
        </Box>
        <Box direction="horizontal">
          <Text color={t.dim}>{"Emoji  "}</Text>
          <Text color={t.success}>{"🎉 🚀 ⭐ 🌈 🎨"}</Text>
        </Box>
        <Box direction="horizontal">
          <Text color={t.dim}>{"ZWJ    "}</Text>
          <Text color={t.warning}>{"👨‍👩‍👧 👩‍💻 🏳️‍🌈"}</Text>
        </Box>
        <Box direction="horizontal">
          <Text color={t.dim}>{"Flags  "}</Text>
          <Text color={t.pink}>{"🇯🇵 🇺🇸 🇩🇪 🇧🇷"}</Text>
        </Box>
        <Box direction="horizontal">
          <Text color={t.dim}>{"Mixed  "}</Text>
          <Text color={t.lavender}>{"Hello世界! 🌍Earth"}</Text>
        </Box>
      </Box>

      <Text>{""}</Text>
      <Box paddingLeft={5}>
        <Text color={t.muted}>
          Intl.Segmenter · East Asian Width · grapheme-aware wrapping
        </Text>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Navigation Bar
// ---------------------------------------------------------------------------

function NavBar() {
  return (
    <Box paddingLeft={1} direction="horizontal">
      <Text bold color={t.primary}>
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
    // Delegate to active page's key handler
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
        <Text color={t.primary} bold>
          {"◈ TUILE"}
        </Text>
        <Text color={t.muted}>{" │ "}</Text>
        <Text color={t.dim}>
          {computed(
            () =>
              `${PAGES[currentPage.value].icon} ${PAGES[currentPage.value].name}`,
          )}
        </Text>
      </Box>

      {/* Nav */}
      <NavBar />

      {/* Separator */}
      <Text color={t.muted}>{hrText}</Text>

      {/* Content — fills remaining vertical space */}
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
        <Text color={t.muted}>{"← → navigate · 1-8 jump · q quit"}</Text>
        <Text color={t.muted}>
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
