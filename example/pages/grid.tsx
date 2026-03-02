/** @jsxImportSource tuile */
// ---------------------------------------------------------------------------
// Page 4 — Grid showcase
// ---------------------------------------------------------------------------

import { Box, Text, Grid, GridItem } from "../../src/index.js";
import { theme } from "../theme.js";
import { Section } from "../shared.js";

export function GridPage() {
  return (
    <Box direction="vertical" gap={1}>
      {/* Top row: Merged borders + Column spans */}
      <Box direction="horizontal" gap={2} paddingX={4}>
        <Box direction="vertical" flexGrow={1} gap={1}>
          <Section title="Merged Borders" />
          <Grid columns={["1fr", "1fr", "1fr"]} border="single" width="100%">
            <GridItem col={1} row={1}>
              <Box paddingX={1}>
                <Text color={theme.accent} bold>Name</Text>
              </Box>
            </GridItem>
            <GridItem col={2} row={1}>
              <Box paddingX={1}>
                <Text color={theme.success} bold>Status</Text>
              </Box>
            </GridItem>
            <GridItem col={3} row={1}>
              <Box paddingX={1}>
                <Text color={theme.warning} bold>Uptime</Text>
              </Box>
            </GridItem>
            <GridItem col={1} row={2}>
              <Box paddingX={1}>
                <Text color={theme.dim}>API Server</Text>
              </Box>
            </GridItem>
            <GridItem col={2} row={2}>
              <Box paddingX={1}>
                <Text color={theme.success}>● online</Text>
              </Box>
            </GridItem>
            <GridItem col={3} row={2}>
              <Box paddingX={1}>
                <Text color={theme.dim}>14d 7h</Text>
              </Box>
            </GridItem>
            <GridItem col={1} row={3}>
              <Box paddingX={1}>
                <Text color={theme.dim}>Database</Text>
              </Box>
            </GridItem>
            <GridItem col={2} row={3}>
              <Box paddingX={1}>
                <Text color={theme.success}>● online</Text>
              </Box>
            </GridItem>
            <GridItem col={3} row={3}>
              <Box paddingX={1}>
                <Text color={theme.dim}>7d 3h</Text>
              </Box>
            </GridItem>
          </Grid>
          <Box paddingLeft={2}><Text color={theme.muted}>Shared borders — no doubling</Text></Box>
        </Box>

        <Box direction="vertical" flexGrow={1} gap={1}>
          <Section title="Column Spans" color={theme.accent} />
          <Grid columns={["1fr", "1fr", "1fr"]} border="round" width="100%">
            <GridItem col={1} row={1} colSpan={2}>
              <Box paddingX={1}>
                <Text color={theme.pink} bold>Spans 2 columns</Text>
              </Box>
            </GridItem>
            <GridItem col={3} row={1}>
              <Box paddingX={1}>
                <Text color={theme.accent}>C1</Text>
              </Box>
            </GridItem>
            <GridItem col={1} row={2}>
              <Box paddingX={1}>
                <Text color={theme.dim}>A2</Text>
              </Box>
            </GridItem>
            <GridItem col={2} row={2}>
              <Box paddingX={1}>
                <Text color={theme.dim}>B2</Text>
              </Box>
            </GridItem>
            <GridItem col={3} row={2}>
              <Box paddingX={1}>
                <Text color={theme.dim}>C2</Text>
              </Box>
            </GridItem>
            <GridItem col={1} row={3} colSpan={3}>
              <Box paddingX={1}>
                <Text color={theme.success} bold>Full-width footer (colSpan: 3)</Text>
              </Box>
            </GridItem>
          </Grid>
          <Box paddingLeft={2}><Text color={theme.muted}>colSpan merges cells + adapts borders</Text></Box>
        </Box>
      </Box>

      {/* Border styles */}
      <Section title="Border Styles" color={theme.warning} />
      <Box paddingX={5} direction="horizontal" gap={2}>
        {(["single", "double", "round", "bold"] as const).map((style) => (
          <Box direction="vertical" flexGrow={1}>
            <Grid columns={["1fr"]} border={style} width="100%">
              <GridItem col={1} row={1}>
                <Box paddingX={1}>
                  <Text color={theme.accent} bold>{style}</Text>
                </Box>
              </GridItem>
              <GridItem col={1} row={2}>
                <Box paddingX={1}>
                  <Text color={theme.dim}>cell</Text>
                </Box>
              </GridItem>
            </Grid>
          </Box>
        ))}
      </Box>

      {/* Spacing modes */}
      <Section title="Spacing Modes" color={theme.teal} />
      <Box paddingX={5} direction="horizontal" gap={3}>
        <Box direction="vertical">
          <Text color={theme.dim} bold>merged</Text>
          <Grid columns={["1fr", "1fr"]} border="single" width={21}>
            <GridItem col={1} row={1}><Box paddingX={1}><Text color={theme.accent}>A</Text></Box></GridItem>
            <GridItem col={2} row={1}><Box paddingX={1}><Text color={theme.success}>B</Text></Box></GridItem>
            <GridItem col={1} row={2}><Box paddingX={1}><Text color={theme.warning}>C</Text></Box></GridItem>
            <GridItem col={2} row={2}><Box paddingX={1}><Text color={theme.pink}>D</Text></Box></GridItem>
          </Grid>
        </Box>
        <Box direction="vertical">
          <Text color={theme.dim} bold>spacing=1</Text>
          <Grid columns={["1fr", "1fr"]} border="round" spacing={1} width={22}>
            <GridItem col={1} row={1}><Box paddingX={1}><Text color={theme.accent}>A</Text></Box></GridItem>
            <GridItem col={2} row={1}><Box paddingX={1}><Text color={theme.success}>B</Text></Box></GridItem>
            <GridItem col={1} row={2}><Box paddingX={1}><Text color={theme.warning}>C</Text></Box></GridItem>
            <GridItem col={2} row={2}><Box paddingX={1}><Text color={theme.pink}>D</Text></Box></GridItem>
          </Grid>
        </Box>
        <Box direction="vertical">
          <Text color={theme.dim} bold>spacing=2</Text>
          <Grid columns={["1fr", "1fr"]} border="round" spacing={2} width={23}>
            <GridItem col={1} row={1}><Box paddingX={1}><Text color={theme.accent}>A</Text></Box></GridItem>
            <GridItem col={2} row={1}><Box paddingX={1}><Text color={theme.success}>B</Text></Box></GridItem>
            <GridItem col={1} row={2}><Box paddingX={1}><Text color={theme.warning}>C</Text></Box></GridItem>
            <GridItem col={2} row={2}><Box paddingX={1}><Text color={theme.pink}>D</Text></Box></GridItem>
          </Grid>
        </Box>
      </Box>

      {/* Mixed columns */}
      <Section title="Mixed Fixed + Fractional" color={theme.lavender} />
      <Box paddingX={5}>
        <Grid columns={[12, "1fr", "2fr"]} border="double" width="100%">
          <GridItem col={1} row={1}>
            <Box paddingX={1}><Text color={theme.warning} bold>12 fixed</Text></Box>
          </GridItem>
          <GridItem col={2} row={1}>
            <Box paddingX={1}><Text color={theme.accent} bold>1fr</Text></Box>
          </GridItem>
          <GridItem col={3} row={1}>
            <Box paddingX={1}><Text color={theme.success} bold>2fr</Text></Box>
          </GridItem>
          <GridItem col={1} row={2}>
            <Box paddingX={1}><Text color={theme.dim}>fixed col</Text></Box>
          </GridItem>
          <GridItem col={2} row={2}>
            <Box paddingX={1}><Text color={theme.dim}>flexible</Text></Box>
          </GridItem>
          <GridItem col={3} row={2}>
            <Box paddingX={1}><Text color={theme.dim}>grows 2× faster</Text></Box>
          </GridItem>
        </Grid>
      </Box>
    </Box>
  );
}
