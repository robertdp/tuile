/** @jsxImportSource tuile */
// ---------------------------------------------------------------------------
// Page 2 — Dashboard (live system monitor)
// ---------------------------------------------------------------------------

import {
  Box,
  Text,
  signal,
  computed,
  onMount,
  onCleanup,
  For,
  Spinner,
  ProgressBar,
} from "../../src/index.js";
import { theme } from "../theme.js";
import { Section, sparkline, cols, rows } from "../shared.js";

// ---------------------------------------------------------------------------
// Mock data
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const cpu = signal(42);
  const mem = signal(61);
  const rps = signal(1247);
  const lat = signal(12);

  const cpuHist = signal(Array.from({ length: 24 }, () => 0.3 + Math.random() * 0.3));
  const memHist = signal(Array.from({ length: 24 }, () => 0.5 + Math.random() * 0.15));
  const rpsHist = signal(Array.from({ length: 24 }, () => 0.3 + Math.random() * 0.4));
  const latHist = signal(Array.from({ length: 24 }, () => 0.08 + Math.random() * 0.15));

  const diskUsage = signal(0.62);
  const logLines = signal<LogEntry[]>([]);
  let logPoolIdx = 0;

  onMount(() => {
    const mt = setInterval(() => {
      cpu.value = Math.max(5, Math.min(95, cpu.peek() + (Math.random() - 0.48) * 8));
      cpuHist.value = [...cpuHist.peek().slice(1), cpu.peek() / 100];

      const md = Math.random() < 0.1 ? -8 : (Math.random() - 0.3) * 3;
      mem.value = Math.max(30, Math.min(88, mem.peek() + md));
      memHist.value = [...memHist.peek().slice(1), mem.peek() / 100];

      rps.value = Math.max(200, Math.min(3000, rps.peek() + (Math.random() - 0.5) * 200));
      rpsHist.value = [...rpsHist.peek().slice(1), rps.peek() / 3000];

      const spike = Math.random() < 0.08;
      lat.value = spike
        ? 40 + Math.floor(Math.random() * 60)
        : 5 + Math.floor(Math.random() * 15);
      latHist.value = [...latHist.peek().slice(1), lat.peek() / 100];

      if (diskUsage.peek() < 0.84) diskUsage.value = diskUsage.peek() + 0.001;
    }, 800);

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

  const metrics = [
    { label: "CPU Usage", sig: cpu, unit: "%", color: theme.accent, hist: cpuHist },
    { label: "Memory", sig: mem, unit: "%", color: theme.success, hist: memHist },
    { label: "Requests", sig: rps, unit: "/s", color: theme.warning, hist: rpsHist },
    { label: "Latency", sig: lat, unit: "ms", color: theme.pink, hist: latHist },
  ];

  return (
    <Box direction="vertical" gap={1}>
      <Section title="System Monitor" color={theme.accent} />

      {/* Metric cards */}
      <Box direction="horizontal" gap={1} paddingX={4}>
        {metrics.map((m) => (
          <Box border="round" flexGrow={1} paddingX={1} direction="vertical">
            <Text color={theme.dim}>{m.label}</Text>
            <Box direction="horizontal" gap={1}>
              <Text color={m.color} bold>
                {computed(() => String(Math.round(m.sig.value)))}
              </Text>
              <Text color={theme.dim}>{m.unit}</Text>
            </Box>
            <Box height={1} overflow="hidden">
              <Text color={m.color}>
                {computed(() => sparkline(m.hist.value))}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Log stream + Services panel */}
      <Box direction="horizontal" gap={1} paddingX={4}>
        {/* Live log */}
        <Box border="round" flexGrow={2} paddingX={1} direction="vertical">
          <Box direction="horizontal" gap={1}>
            <Spinner type="dots" style={{ color: theme.success }} />
            <Text color={theme.text} bold>
              Live Log
            </Text>
          </Box>
          <Box height={1} />
          <For each={logLines}>
            {(line: LogEntry) => (
              <Box direction="horizontal">
                <Text color={theme.dim}>{` ${line.time} `}</Text>
                <Text
                  color={
                    line.level === "ERR"
                      ? theme.error
                      : line.level === "WRN"
                        ? theme.warning
                        : theme.success
                  }
                  bold={line.level !== "INF"}
                >
                  {line.level}
                </Text>
                <Text color={theme.dim}>{" │ "}</Text>
                <Text color={theme.text}>{line.text}</Text>
              </Box>
            )}
          </For>
        </Box>

        {/* Services */}
        <Box border="round" paddingX={1} direction="vertical" gap={1}>
          <Box direction="vertical">
            <Text color={theme.text} bold>
              Services
            </Text>
            <Box height={1} />
            <Box direction="horizontal" gap={1}>
              <Text color={theme.success}>●</Text>
              <Text color={theme.dim}>API Server 14d</Text>
            </Box>
            <Box direction="horizontal" gap={1}>
              <Text color={theme.success}>●</Text>
              <Text color={theme.dim}>Database 14d</Text>
            </Box>
            <Box direction="horizontal" gap={1}>
              <Text color={theme.success}>●</Text>
              <Text color={theme.dim}>Redis Cache 3d</Text>
            </Box>
            <Box direction="horizontal" gap={1}>
              <Text color={theme.warning}>●</Text>
              <Text color={theme.dim}>Worker Pool 4h</Text>
            </Box>
          </Box>

          <Box direction="vertical">
            <Text color={theme.dim} bold>
              Storage
            </Text>
            <Box direction="horizontal" gap={1}>
              <Text color={theme.dim}>/data</Text>
              <ProgressBar value={diskUsage} width={8} filledColor={theme.accent} emptyColor={theme.muted} showLabel={false} />
            </Box>
            <Box direction="horizontal" gap={1}>
              <Text color={theme.dim}>/logs</Text>
              <ProgressBar value={0.41} width={8} filledColor={theme.success} emptyColor={theme.muted} showLabel={false} />
            </Box>
            <Box direction="horizontal" gap={1}>
              <Text color={theme.dim}>/tmp </Text>
              <ProgressBar value={0.18} width={8} filledColor={theme.teal} emptyColor={theme.muted} showLabel={false} />
            </Box>
          </Box>
        </Box>
      </Box>

      <Box paddingX={5}>
        <Text color={theme.dim}>
          {computed(
            () =>
              `Uptime 14d 7h  ·  Node ${process.version}  ·  PID ${process.pid}  ·  ${cols.value}×${rows.value}`,
          )}
        </Text>
      </Box>
    </Box>
  );
}
