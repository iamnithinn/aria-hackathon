// components/Sparkline.js — a tiny inline trend line.
//
// Used on home-screen vault cards to give a one-glance sense of where a marker
// has been heading. Pure SVG; no axes, no labels.
//
// On mount the line draws itself in over ~700ms (stroke-dashoffset reveal),
// and the trailing dot scales in once the line settles. The reveal restarts
// when `values` changes so re-rendering after a data refresh feels alive.
//
// Props:
//   values: number[]  — chronological, oldest to newest. 1 point = a flat line.
import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

import theme from '../theme';

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function Sparkline({
  values = [],
  width = 60,
  height = 22,
  color = theme.colors.amber.primary,
  strokeWidth = 1.5,
}) {
  // Reveal the line: progress 1 → 0 = strokeDashoffset full → 0.
  const progress = useSharedValue(1);
  // Trailing dot pops in once the line is mostly drawn.
  const dotScale = useSharedValue(0);

  // Compute geometry — always runs (must come before any conditional return
  // to keep hook order stable). Returns null fields when there's no data.
  const { points, lastX, lastY, length, hasData } = useMemo(() => {
    if (!values.length) {
      return { points: '', lastX: 0, lastY: 0, length: 1, hasData: false };
    }
    const series = values.length === 1 ? [values[0], values[0]] : values;
    const min = Math.min(...series);
    const max = Math.max(...series);
    const span = max - min || 1;
    const ix = 2;
    const iy = 2;
    const innerW = width - ix * 2;
    const innerH = height - iy * 2;
    const coords = series.map((v, i) => {
      const x = ix + (i / (series.length - 1)) * innerW;
      const y = iy + innerH - ((v - min) / span) * innerH;
      return { x, y };
    });
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
      const dx = coords[i].x - coords[i - 1].x;
      const dy = coords[i].y - coords[i - 1].y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return {
      points: coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '),
      lastX: coords[coords.length - 1].x,
      lastY: coords[coords.length - 1].y,
      length: Math.max(total, 1),
      hasData: true,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, width, height]);

  useEffect(() => {
    if (!hasData) return;
    progress.value = 1;
    dotScale.value = 0;
    progress.value = withTiming(0, {
      duration: 700,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
    dotScale.value = withDelay(
      550,
      withTiming(1, { duration: 320, easing: Easing.bezier(0.34, 1.56, 0.64, 1) })
    );
  }, [length, hasData, progress, dotScale]);

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: progress.value * length,
  }));
  const dotProps = useAnimatedProps(() => ({
    r: 2 * dotScale.value,
  }));

  if (!hasData) return <View style={{ width, height }} />;

  return (
    <Svg width={width} height={height}>
      <AnimatedPolyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${length} ${length}`}
        animatedProps={lineProps}
      />
      <AnimatedCircle cx={lastX} cy={lastY} fill={color} animatedProps={dotProps} />
    </Svg>
  );
}
