// components/Sparkline.js — a tiny inline trend line.
//
// Used on home-screen vault cards to give a one-glance sense of where a marker
// has been heading. Pure SVG; no axes, no labels.
//
// Props:
//   values: number[]  — chronological, oldest to newest. 1 point = a flat line.
import React from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';

import theme from '../theme';

export default function Sparkline({
  values = [],
  width = 60,
  height = 22,
  color = theme.colors.amber.primary,
  strokeWidth = 1.5,
}) {
  if (!values.length) {
    return <View style={{ width, height }} />;
  }
  // Pad single-point series so the line still renders.
  const series = values.length === 1 ? [values[0], values[0]] : values;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  // 2px inset so the dot at the right edge isn't clipped.
  const ix = 2;
  const iy = 2;
  const innerW = width - ix * 2;
  const innerH = height - iy * 2;

  const points = series
    .map((v, i) => {
      const x = ix + (i / (series.length - 1)) * innerW;
      const y = iy + innerH - ((v - min) / span) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Last point dot — emphasises "current".
  const last = series[series.length - 1];
  const lastX = ix + innerW;
  const lastY = iy + innerH - ((last - min) / span) * innerH;

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={lastX} cy={lastY} r={2} fill={color} />
    </Svg>
  );
}
