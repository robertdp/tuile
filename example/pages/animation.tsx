/** @jsxImportSource tuile */
// ---------------------------------------------------------------------------
// Page 5 — Animation
// ---------------------------------------------------------------------------

import {
  Box,
  Text,
  computed,
  onMount,
  onCleanup,
  animate,
  spring,
  cubicBezier,
} from "../../src/index.js";
import { theme } from "../theme.js";
import { Section, cols } from "../shared.js";

function track(anim: { value: { value: number } }, marker: string) {
  return computed(() => {
    const w = Math.max(10, cols.value - 22);
    const v = Math.max(0, Math.min(1, anim.value.value));
    const pos = Math.round(v * w);
    return "─".repeat(pos) + marker + "─".repeat(w - pos);
  });
}

export function AnimationPage() {
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

  return (
    <Box direction="vertical" gap={1}>
      <Section title="Tween Animations" />
      <Box paddingLeft={5} direction="vertical">
        <Box direction="horizontal" gap={1}>
          <Text color={theme.dim}>{"bounce  "}</Text>
          <Text color={theme.accent}>{track(bounceAnim, "●")}</Text>
        </Box>
        <Box direction="horizontal" gap={1}>
          <Text color={theme.dim}>{"sine    "}</Text>
          <Text color={theme.success}>{track(sineAnim, "◆")}</Text>
        </Box>
        <Box direction="horizontal" gap={1}>
          <Text color={theme.dim}>{"elastic "}</Text>
          <Text color={theme.warning}>{track(elasticAnim, "★")}</Text>
        </Box>
        <Box direction="horizontal" gap={1}>
          <Text color={theme.dim}>{"cubic   "}</Text>
          <Text color={theme.pink}>{track(cubicAnim, "◉")}</Text>
        </Box>
      </Box>

      <Section title="Spring Physics" color={theme.teal} />
      <Box paddingLeft={5} direction="vertical">
        <Box direction="horizontal" gap={1}>
          <Text color={theme.dim}>{"spring  "}</Text>
          <Text color={theme.teal}>{track(springAnim, "⬤")}</Text>
        </Box>
        <Box paddingLeft={10}>
          <Text color={theme.muted}>
            stiffness: 120 · damping: 12 — notice the overshoot!
          </Text>
        </Box>
      </Box>

      <Section title="Custom Cubic Bezier" color={theme.lavender} />
      <Box paddingLeft={5} direction="vertical">
        <Box direction="horizontal" gap={1}>
          <Text color={theme.dim}>{"bezier  "}</Text>
          <Text color={theme.lavender}>{track(bezierAnim, "◈")}</Text>
        </Box>
        <Box paddingLeft={10}>
          <Text color={theme.muted}>
            cubicBezier(0.68, -0.55, 0.27, 1.55)
          </Text>
        </Box>
      </Box>

      <Section title="25 Built-in Easings" color={theme.orange} />
      <Box paddingLeft={5}>
        <Box direction="horizontal" gap={4}>
          <Box direction="vertical">
            <Text color={theme.accent} bold>ease-in</Text>
            <Text color={theme.dim}>quad · cubic · quart</Text>
            <Text color={theme.dim}>sine · expo · back</Text>
            <Text color={theme.dim}>elastic · bounce</Text>
          </Box>
          <Box direction="vertical">
            <Text color={theme.success} bold>ease-out</Text>
            <Text color={theme.dim}>quad · cubic · quart</Text>
            <Text color={theme.dim}>sine · expo · back</Text>
            <Text color={theme.dim}>elastic · bounce</Text>
          </Box>
          <Box direction="vertical">
            <Text color={theme.warning} bold>ease-in-out</Text>
            <Text color={theme.dim}>quad · cubic · quart</Text>
            <Text color={theme.dim}>sine · expo · back</Text>
            <Text color={theme.dim}>elastic · bounce</Text>
          </Box>
        </Box>
      </Box>

      <Box paddingLeft={5}>
        <Text color={theme.muted}>
          + linear · cubicBezier(x1, y1, x2, y2) for custom curves
        </Text>
      </Box>
    </Box>
  );
}
