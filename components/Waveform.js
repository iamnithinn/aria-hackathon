// components/Waveform.js — live mic-driven waveform.
//
// Shows BARS=60 vertical amber bars. Parent calls `ref.push(level)` from a
// metering callback (~30fps); the waveform shifts left and animates the new
// rightmost bar in over 80ms. Old bars snap to their left neighbour each push,
// which to the eye looks like the data scrolling smoothly to the left.
//
// Each bar owns its own SharedValue so we never re-render React when audio
// arrives — only Reanimated worklets touch the UI thread for animation.
//
// Usage:
//   const ref = useRef();
//   <Waveform ref={ref} height={120} />
//   ref.current.push(0.42);   // 0..1 amplitude
//   ref.current.reset();
import React, { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import theme from '../theme';

const BARS = 60;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const MIN_HEIGHT = 2;

const Waveform = forwardRef(function Waveform(
  { height = 120, color = theme.colors.amber.primary },
  ref
) {
  // Pre-create BARS SharedValues. The count is constant across renders, so the
  // hook order is stable — Rules of Hooks is satisfied even though we're
  // calling useSharedValue inside a fixed-length loop.
  const bars = [];
  for (let i = 0; i < BARS; i++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    bars.push(useSharedValue(0));
  }

  useImperativeHandle(
    ref,
    () => ({
      push(level) {
        const v = Math.max(0, Math.min(1, level || 0));
        // Scroll-left: each bar inherits its right neighbour's current value.
        for (let i = 0; i < BARS - 1; i++) {
          bars[i].value = bars[i + 1].value;
        }
        // The newest (rightmost) bar smoothly eases to the new sample.
        bars[BARS - 1].value = withTiming(v, { duration: 80 });
      },
      reset() {
        for (let i = 0; i < BARS; i++) {
          bars[i].value = withTiming(0, { duration: 240 });
        }
      },
    }),
    [bars]
  );

  return (
    <View style={[styles.row, { height }]}>
      {bars.map((b, i) => (
        <Bar key={i} value={b} maxHeight={height} color={color} />
      ))}
    </View>
  );
});

function Bar({ value, maxHeight, color }) {
  const style = useAnimatedStyle(() => ({
    height: Math.max(MIN_HEIGHT, value.value * maxHeight),
    opacity: 0.55 + value.value * 0.45,
  }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: BAR_GAP,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
  },
});

export default Waveform;
