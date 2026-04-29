// components/Reveal.js — fades + lifts a child into view on mount.
// Use it (with a small `delay`) to stagger word/line reveals — pair successive
// reveals 80ms apart per the motion spec.
import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

import theme from '../theme';

export default function Reveal({
  children,
  delay = 0,
  duration = theme.motion.durations.base,
  translateY = 6,
  style,
  // when `trigger` changes, the reveal restarts. Useful for re-running on page focus.
  trigger,
}) {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(translateY);

  useEffect(() => {
    opacity.value = 0;
    ty.value = translateY;
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration, easing: theme.motion.easing.out })
    );
    ty.value = withDelay(
      delay,
      withTiming(0, { duration, easing: theme.motion.easing.out })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  return <Animated.View style={[animStyle, style]}>{children}</Animated.View>;
}
