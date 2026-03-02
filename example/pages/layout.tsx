/** @jsxImportSource tuile */
// ---------------------------------------------------------------------------
// Page 7 — Layout
// ---------------------------------------------------------------------------

import { Box, Text, computed } from "../../src/index.js";
import { theme } from "../theme.js";
import { Section, cols } from "../shared.js";

const SPECTRUM = [
  "#FF0000", "#FF2200", "#FF4400", "#FF6600", "#FF8800", "#FFAA00",
  "#FFCC00", "#DDEE00", "#AAFF00", "#66FF00", "#00FF44", "#00FFAA",
  "#00FFEE", "#00CCFF", "#0088FF", "#0044FF", "#2200FF", "#6600FF",
  "#AA00FF", "#EE00FF", "#FF00CC", "#FF0088", "#FF0044",
];

export function LayoutPage() {
  const spectrumWidth = computed(() => {
    const available = cols.value - 10;
    return Math.max(1, Math.floor(available / SPECTRUM.length));
  });

  return (
    <Box direction="vertical" gap={1}>
      <Section title="Border Styles" />
      <Box direction="horizontal" gap={1} paddingX={5}>
        <Box border="single" padding={1} flexGrow={1} align="center">
          <Text color={theme.accent}>single</Text>
        </Box>
        <Box border="double" padding={1} flexGrow={1} align="center">
          <Text color={theme.success}>double</Text>
        </Box>
        <Box border="round" padding={1} flexGrow={1} align="center">
          <Text color={theme.pink}>round</Text>
        </Box>
        <Box border="bold" padding={1} flexGrow={1} align="center">
          <Text color={theme.warning}>bold</Text>
        </Box>
      </Box>

      <Section title="Flex Distribution" color={theme.accent} />
      <Box paddingX={5}>
        <Box direction="horizontal" height={3}>
          <Box border="round" flexGrow={1} align="center" justify="center">
            <Text color={theme.accent}>flex:1</Text>
          </Box>
          <Box border="round" flexGrow={3} align="center" justify="center">
            <Text color={theme.success} bold>flex:3</Text>
          </Box>
          <Box border="round" flexGrow={1} align="center" justify="center">
            <Text color={theme.accent}>flex:1</Text>
          </Box>
        </Box>
      </Box>

      <Section title="Alignment" color={theme.warning} />
      <Box paddingX={5} direction="horizontal" gap={1}>
        <Box border="round" flexGrow={1} height={5} align="start" justify="start" padding={1}>
          <Text color={theme.dim}>start/start</Text>
        </Box>
        <Box border="round" flexGrow={1} height={5} align="center" justify="center" padding={1}>
          <Text color={theme.accent} bold>center</Text>
        </Box>
        <Box border="round" flexGrow={1} height={5} align="end" justify="end" padding={1}>
          <Text color={theme.dim}>end/end</Text>
        </Box>
      </Box>

      <Section title="Text & Color" color={theme.pink} />
      <Box direction="horizontal" gap={2} paddingLeft={5}>
        <Text bold color={theme.text}>Bold</Text>
        <Text italic color={theme.text}>Italic</Text>
        <Text underline color={theme.accent}>Underline</Text>
        <Text strikethrough color={theme.dim}>Strike</Text>
        <Text dim>Dim</Text>
        <Text inverse color={theme.text}>{" Inverse "}</Text>
        <Text bold italic color={theme.pink}>Bold+Italic</Text>
      </Box>
      <Box paddingLeft={5}>
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
