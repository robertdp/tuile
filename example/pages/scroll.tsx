/** @jsxImportSource tuile */
// ---------------------------------------------------------------------------
// Page 8 — Scroll & Unicode
// ---------------------------------------------------------------------------

import {
  Box,
  Text,
  computed,
  ScrollBox,
  createScrollState,
} from "../../src/index.js";
import { theme } from "../theme.js";
import { Section, cols, rows } from "../shared.js";

export function ScrollPage() {
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
    <Box direction="vertical" gap={1}>
      <Section title="Scrollable Log Viewer" />
      <Box paddingX={5} direction="vertical">
        <Text color={theme.dim}>↑↓ PgUp/PgDn Home/End to scroll</Text>
        <Box height={1} />
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
                  ? theme.error
                  : item.level === "WRN"
                    ? theme.warning
                    : theme.success
              }
            >
              {` ${item.time} ${item.level} │ ${item.msg}`}
            </Text>
          ))}
        </ScrollBox>
        <Text color={theme.dim}>
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

      <Section title="Unicode Width Support" color={theme.teal} />
      <Box paddingLeft={5} direction="vertical">
        <Box direction="horizontal">
          <Text color={theme.dim}>{"CJK    "}</Text>
          <Text color={theme.accent}>漢字テスト 한국어</Text>
        </Box>
        <Box direction="horizontal">
          <Text color={theme.dim}>{"Emoji  "}</Text>
          <Text color={theme.success}>🎉 🚀 ⭐ 🌈 🎨</Text>
        </Box>
        <Box direction="horizontal">
          <Text color={theme.dim}>{"ZWJ    "}</Text>
          <Text color={theme.warning}>👨‍👩‍👧 👩‍💻 🏳️‍🌈</Text>
        </Box>
        <Box direction="horizontal">
          <Text color={theme.dim}>{"Flags  "}</Text>
          <Text color={theme.pink}>🇯🇵 🇺🇸 🇩🇪 🇧🇷</Text>
        </Box>
        <Box direction="horizontal">
          <Text color={theme.dim}>{"Mixed  "}</Text>
          <Text color={theme.lavender}>Hello世界! 🌍Earth</Text>
        </Box>
      </Box>

      <Box paddingLeft={5}>
        <Text color={theme.muted}>
          Intl.Segmenter · East Asian Width · grapheme-aware wrapping
        </Text>
      </Box>
    </Box>
  );
}
