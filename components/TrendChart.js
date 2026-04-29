// components/TrendChart.js — the marker-detail chart.
//
// Custom SVG (no victory-native — keeps the look consistent and avoids the
// Skia dependency that breaks under Expo Go).
//
// Renders:
//   • a sage-tinted reference range band (if we have ranges)
//   • a single amber line connecting the points
//   • amber dots at each measurement, optionally tappable
//   • lightweight axis grid lines + min/max labels
//
// Props:
//   data: [{ timestamp, value }] — oldest first
//   referenceLow / referenceHigh: numbers or null
//   unit: optional unit label
//   onPointPress: optional (point) => void — passes the original data point
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { format } from 'date-fns';

import theme from '../theme';

const HEIGHT = 220;
const PAD_L = 36;
const PAD_R = 16;
const PAD_T = 18;
const PAD_B = 28;

export default function TrendChart({
  data = [],
  referenceLow = null,
  referenceHigh = null,
  unit = '',
  onPointPress,
  width = 320,
}) {
  if (!data.length) return null;

  const innerW = width - PAD_L - PAD_R;
  const innerH = HEIGHT - PAD_T - PAD_B;

  // Y axis range — include the reference range bounds if present.
  const valuesForRange = data.map((d) => d.value);
  if (typeof referenceLow === 'number') valuesForRange.push(referenceLow);
  if (typeof referenceHigh === 'number') valuesForRange.push(referenceHigh);
  let yMin = Math.min(...valuesForRange);
  let yMax = Math.max(...valuesForRange);
  if (yMin === yMax) {
    // Avoid a zero-span axis on a single point.
    const pad = Math.max(1, Math.abs(yMin) * 0.1);
    yMin -= pad; yMax += pad;
  } else {
    // 8% breathing room top + bottom.
    const pad = (yMax - yMin) * 0.08;
    yMin -= pad; yMax += pad;
  }
  const ySpan = yMax - yMin || 1;

  // X axis range — by date.
  const tsMs = data.map((d) => new Date(d.timestamp).getTime());
  const xMin = Math.min(...tsMs);
  const xMax = Math.max(...tsMs);
  const xSpan = xMax - xMin || 1;

  const x = (ts) => {
    if (data.length === 1) return PAD_L + innerW / 2;
    return PAD_L + ((new Date(ts).getTime() - xMin) / xSpan) * innerW;
  };
  const y = (v) => PAD_T + innerH - ((v - yMin) / ySpan) * innerH;

  // Reference band rectangle.
  const hasRefRange = typeof referenceLow === 'number' && typeof referenceHigh === 'number';
  const bandTop = hasRefRange ? y(referenceHigh) : 0;
  const bandBottom = hasRefRange ? y(referenceLow) : 0;
  const bandY = Math.min(bandTop, bandBottom);
  const bandH = Math.abs(bandBottom - bandTop);

  const points = data.map((d) => `${x(d.timestamp).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');

  // First / last labels for the X axis.
  const firstTs = data[0].timestamp;
  const lastTs = data[data.length - 1].timestamp;

  return (
    <View style={{ width, height: HEIGHT }}>
      <Svg width={width} height={HEIGHT}>
        {/* Y axis ticks: yMin and yMax */}
        <SvgText
          x={PAD_L - 6}
          y={y(yMax) + 3}
          fill={theme.colors.text.dim}
          fontSize="9"
          textAnchor="end"
          fontFamily={theme.fonts.mono}
        >
          {fmt(yMax)}
        </SvgText>
        <SvgText
          x={PAD_L - 6}
          y={y(yMin) + 3}
          fill={theme.colors.text.dim}
          fontSize="9"
          textAnchor="end"
          fontFamily={theme.fonts.mono}
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

        {/* Reference band */}
        {hasRefRange ? (
          <Rect
            x={PAD_L}
            y={bandY}
            width={innerW}
            height={bandH}
            fill={theme.colors.sage}
            opacity={0.08}
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

        {/* Trend line */}
        {data.length > 1 ? (
          <Polyline
            points={points}
            fill="none"
            stroke={theme.colors.amber.primary}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* Points (rendered as plain SVG for the visual; tap layer is below) */}
        {data.map((d, i) => (
          <Circle
            key={i}
            cx={x(d.timestamp)}
            cy={y(d.value)}
            r={4}
            fill={theme.colors.amber.primary}
          />
        ))}
      </Svg>

      {/* Tap layer for points — generous hit areas, separate from the SVG. */}
      {onPointPress ? (
        <View style={[StyleSheet.absoluteFill, { paddingLeft: 0 }]} pointerEvents="box-none">
          {data.map((d, i) => (
            <Pressable
              key={i}
              onPress={() => onPointPress(d)}
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

function fmt(v) {
  if (Number.isInteger(v)) return String(v);
  // Trim noise to 1 decimal for typical lab ranges.
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
