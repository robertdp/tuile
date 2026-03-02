/** @jsxImportSource tuile */
// ---------------------------------------------------------------------------
// Page 3 — Widget gallery
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
  Measure,
  Spinner,
  ProgressBar,
  Checkbox,
  Select,
  Table,
  TextInput,
} from "../../src/index.js";
import { theme } from "../theme.js";

export function WidgetsPage() {
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
                    <Text color={theme.accent} bold>
                      Spinners
                    </Text>
                    <Box direction="horizontal" gap={3}>
                      <Box direction="vertical">
                        <Spinner type="dots" label="dots" style={{ color: theme.accent }} />
                        <Spinner type="arc" label="arc" style={{ color: theme.success }} />
                        <Spinner type="arrow" label="arrow" style={{ color: theme.warning }} />
                        <Spinner type="line" label="line" style={{ color: theme.pink }} />
                      </Box>
                      <Box direction="vertical">
                        <Spinner type="circle" label="circle" style={{ color: theme.lavender }} />
                        <Spinner type="square" label="square" style={{ color: theme.teal }} />
                        <Spinner type="toggle" label="toggle" style={{ color: theme.orange }} />
                        <Spinner type="bouncingBar" label="" style={{ color: theme.error }} />
                      </Box>
                    </Box>
                  </Box>
                </GridItem>
                <GridItem col={2} row={1}>
                  <Box padding={1} direction="vertical" gap={1}>
                    <Text color={theme.success} bold>
                      ProgressBar
                    </Text>
                    <ProgressBar value={progress} width={barWidth} filledColor={theme.accent} emptyColor={theme.muted} />
                    <ProgressBar value={0.7} width={barWidth} filledColor={theme.success} emptyColor={theme.muted} filled="▓" empty="░" />
                    <ProgressBar value={0.45} width={barWidth} filledColor={theme.warning} emptyColor={theme.muted} />
                    <ProgressBar value={0.9} width={barWidth} filledColor={theme.pink} emptyColor={theme.muted} filled="●" empty="○" />
                  </Box>
                </GridItem>
                <GridItem col={1} row={2}>
                  <Box padding={1} direction="vertical" gap={1}>
                    <Text color={theme.warning} bold>
                      Checkbox
                    </Text>
                    <Checkbox label="Notifications" checked={checkNotify} />
                    <Checkbox label="Dark mode" checked={checkDark} />
                    <Checkbox label="Auto-save" checked={checkAuto} />
                  </Box>
                </GridItem>
                <GridItem col={2} row={2}>
                  <Box padding={1} direction="vertical" gap={1}>
                    <Text color={theme.pink} bold>
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
                      selectedColor={theme.accent}
                      visibleRows={4}
                    />
                  </Box>
                </GridItem>
                <GridItem col={1} row={3}>
                  <Box padding={1} direction="vertical" gap={1}>
                    <Text color={theme.lavender} bold>
                      TextInput
                    </Text>
                    <Box border="single" paddingX={1}>
                      <TextInput
                        value={inputValue}
                        placeholder="Type here..."
                        width={24}
                        placeholderColor={theme.muted}
                      />
                    </Box>
                  </Box>
                </GridItem>
                <GridItem col={2} row={3}>
                  <Box padding={1} direction="vertical" gap={1}>
                    <Text color={theme.teal} bold>
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
                      headerColor={theme.accent}
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
