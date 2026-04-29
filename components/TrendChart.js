// components/TrendChart.js — the marker-detail chart.
//
// Custom SVG (no victory-native — keeps the look consistent and avoids the
// Skia dependency that breaks under Expo Go).
//
// On mount the chart animates in: the trend line draws itself from left to
// right (~900ms stroke-offset reveal), the points scale in staggered after
// the line passes them, and the reference band fades in.
//
// Renders:
//   • a sage-tinted reference range band (if we have ranges)
//   • a single accent line connecting the points
//   • accent dots at each measurement, optionally tappable
//   • lightweight axis grid lines + min/max labels
//
// Props:
//   data: [{ timestamp, value }] — oldest first
//   referenceLow / referenceHigh: numbers or null
//   unit: optional unit label
//   onPointPress: optional (point) => void — passes the original data point
import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { format } from 'date-fns';

import theme from '../theme';
import * as haptics from '../utils/haptics';

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const HEIGHT = 220;
const PAD_L = 36;
const PAD_R = 16;
const PAD_T = 18;
const PAD_B = 28;

const LINE_DRAW_MS = 900;
const POINT_DURATION_MS = 280;

export default function TrendChart({
  data = [],
  referenceLow = null,
  referenceHigh = null,
  unit = '',
  onPointPress,
  width = 320,
}) {
  // Hooks must run unconditionally — guard rendering at the bottom instead.
  const hasData = data.length > 0;

  const innerW = width - PAD_L - PAD_R;
  const innerH = HEIGHT - PAD_T - PAD_B;

  // Y axis range — include the reference range bounds if present.
  const valuesForRange = hasData ? data.map((d) => d.value) : [0, 1];
  if (typeof referenceLow === 'number') valuesForRange.push(referenceLow);
  if (typeof referenceHigh === 'number') valuesForRange.push(referenceHigh);
  let yMin = Math.min(...valuesForRange);
  let yMax = Math.max(...valuesForRange);
  if (yMin === yMax) {
    const pad = Math.max(1, Math.abs(yMin) * 0.1);
    yMin -= pad; yMax += pad;
  } else {
    const pad = (yMax - yMin) * 0.08;
    yMin -= pad; yMax += pad;
  }
  const ySpan = yMax - yMin || 1;

  const tsMs = hasData ? data.map((d) => new Date(d.timestamp).getTime()) : [0, 1];
  const xMin = Math.min(...tsMs);
  const xMax = Math.max(...tsMs);
  const xSpan = xMax - xMin || 1;

  const x = (ts) => {
    if (data.length === 1) return PAD_L + innerW / 2;
    return PAD_L + ((new Date(ts).getTime() - xMin) / xSpan) * innerW;
  };
  const y = (v) => PAD_T + innerH - ((v - yMin) / ySpan) * innerH;

  const hasRefRange = typeof referenceLow === 'number' && typeof referenceHigh === 'number';
  const bandTop = hasRefRange ? y(referenceHigh) : 0;
  const bandBottom = hasRefRange ? y(referenceLow) : 0;
  const bandY = Math.min(bandTop, bandBottom);
  const bandH = Math.abs(bandBottom - bandTop);

  // Compute polyline + path length so we can animate the stroke draw.
  const { polylineStr, pathLength, pointCoords } = useMemo(() => {
    if (!hasData) return { polylineStr: '', pathLength: 1, pointCoords: [] };
    const coords = data.map((d) => ({ x: x(d.timestamp), y: y(d.value) }));
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
      const dx = coords[i].x - coords[i - 1].x;
      const dy = coords[i].y - coords[i - 1].y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return {
      polylineStr: coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '),
      pathLength: Math.max(total, 1),
      pointCoords: coords,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, width, hasData]);

  // Animation drivers.
  const lineProgress = useSharedValue(1);   // 1 = hidden, 0 = drawn
  const bandOpacity = useSharedValue(0);    // 0 → 0.08

  useEffect(() => {
    if (!hasData) return;
    lineProgress.value = 1;
    bandOpacity.value = 0;
    lineProgress.value = withTiming(0, {
      duration: LINE_DRAW_MS,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
    bandOpacity.value = withDelay(
      120,
      withTiming(0.08, { duration: 700, easing: Easing.out(Easing.cubic) })
    );
  }, [data, hasData, lineProgress, bandOpacity]);

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: lineProgress.value * pathLength,
  }));
  const bandProps = useAnimatedProps(() => ({
    opacity: bandOpacity.value,
  }));

  if (!hasData) return null;

  const firstTs = data[0].timestamp;
  const lastTs = data[data.length - 1].timestamp;

  return (
    <View style={{ width, height: HEIGHT }}>
      <Svg width={width} height={HEIGHT}>
        {/* Y axis ticks */}
        <SvgText
          x={PAD_L - 6} y={y(yMax) + 3}
          fill={theme.colors.text.dim} fontSize="9"
          textAnchor="end" fontFamily={theme.fonts.mono}
        >
          {fmt(yMax)}
        </SvgText>
        <SvgText
          x={PAD_L - 6} y={y(yMin) + 3}
          fill={theme.colors.text.dim} fontSize="9"
          textAnchor="end" fontFamily={theme.fonts.mono}
        >
          {fmt(yMin)}
        </SvgText>

        {/* Hairline x-axis */}
        <Line
          x1={PAD_L} y1={PAD_T + innerH}
          x2={PAD_L + innerW} y2={PAD_T + innerH}
          stroke={theme.colors.border.subtle}
          strokeWidth={StyleSheet.hairlineWidth}
        />

        {/* Reference band — fades in */}
        {hasRefRange ? (
          <AnimatedRect
            x={PAD_L} y={bandY}
            width={innerW} height={bandH}
            fill={theme.colors.sage}
            animatedProps={bandProps}
          />
        ) : null}
        {/* Reference range edges */}
        {hasRefRange ? (
          <>
            <Line
              x1={PAD_L} y1={y(referenceHigh)}
              x2={PAD_L + innerW} y2={y(referenceHigh)}
              stroke={theme.colors.sage} strokeWidth={1} strokeOpacity={0.45} strokeDasharray="3 4"
            />
            <Line
              x1={PAD_L} y1={y(referenceLow)}
              x2={PAD_L + innerW} y2={y(referenceLow)}
              stroke={theme.colors.sage} strokeWidth={1} strokeOpacity={0.45} strokeDasharray="3 4"
            />
          </>
        ) : null}

        {/* Trend line — draws in left-to-right */}
        {data.length > 1 ? (
          <AnimatedPolyline
            points={polylineStr}
            fill="none"
            stroke={theme.colors.amber.primary}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${pathLength} ${pathLength}`}
            animatedProps={lineProps}
          />
        ) : null}

        {/* Points — scale in staggered after the line passes through them */}
        {data.map((d, i) => (
          <AnimatedDot
            key={i}
            cx={pointCoords[i]?.x ?? x(d.timestamp)}
            cy={pointCoords[i]?.y ?? y(d.value)}
            // Stagger across the same window the line uses, so each dot
            // appears just as the line "reaches" it.
            delay={(i / Math.max(1, data.length - 1)) * (LINE_DRAW_MS - 200) + 100}
          />
        ))}
      </Svg>

      {/* Tap layer for points — generous hit areas, separate from the SVG. */}
      {onPointPress ? (
        <View style={[StyleSheet.absoluteFill, { paddingLeft: 0 }]} pointerEvents="box-none">
          {data.map((d, i) => (
            <Pressable
              key={i}
              onPress={() => { haptics.select(); onPointPress(d); }}
              hitSlop={10}
              style={{
                position: 'absolute',
                left: x(d.timestamp) - 16,
                top: y(d.value) - 16,
                width: 32,
                height: 32,
              }}
            />
          ))}
        </View>
      ) : null}

      {/* Axis date labels */}
      <View style={styles.axisLabels}>
        <Text style={styles.axisLabel}>{format(new Date(firstTs), 'MMM d').toLowerCase()}</Text>
        {unit ? <Text style={styles.axisLabel}>{unit}</Text> : null}
        <Text style={styles.axisLabel}>{format(new Date(lastTs), 'MMM d').toLowerCase()}</Text>
      </View>
    </View>
  );
}

function AnimatedDot({ cx, cy, delay }) {
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = 0;
    scale.value = withDelay(
      delay,
      withTiming(1, { duration: POINT_DURATION_MS, easing: Easing.bezier(0.34, 1.56, 0.64, 1) })
    );
  }, [scale, delay, cx, cy]);
  const props = useAnimatedProps(() => ({
    r: 4 * scale.value,
  }));
  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      fill={theme.colors.amber.primary}
      animatedProps={props}
    />
  );
}

function fmt(v) {
  if (Number.isInteger(v)) return String(v);
  const r = Math.round(v * 10) / 10;
  return String(r);
}

const styles = StyleSheet.create({
  axisLabels: {
    position: 'absolute',
    left: PAD_L,
    right: PAD_R,
    bottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisLabel: {
    fontFamily: theme.fonts.mono,
    color: theme.colors.text.dim,
    fontSize: 9,
    letterSpacing: 1,
  },
});
