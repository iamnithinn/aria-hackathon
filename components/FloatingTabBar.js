// components/FloatingTabBar.js — custom floating tab bar for (tabs)/_layout.
//
// Renders an absolute-positioned pill at the bottom of the screen. Active
// tab gets an animated indicator that springs between positions. Icons
// scale up slightly when active. Subtle haptic on tap.
//
// Designed to float over screen content; the pill has a soft shadow and a
// hairline border so it reads against any background.
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import theme from '../theme';
import * as haptics from '../utils/haptics';

const ITEM_SIZE = 44;
const BAR_PADDING = 4;
const SPRING = { damping: 18, stiffness: 220, mass: 0.6 };

export default function FloatingTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const tabCount = state.routes.length;
  const activeIndex = state.index;

  // Indicator slides between tab slots.
  const indicator = useSharedValue(activeIndex);
  useEffect(() => {
    indicator.value = withSpring(activeIndex, SPRING);
  }, [activeIndex, indicator]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicator.value * ITEM_SIZE }],
  }));

  const onPress = (route, isFocused) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      // Soft selection-style haptic — quieter than a confirm.
      haptics.select();
      navigation.navigate(route.name, route.params);
    } else if (isFocused) {
      // Re-tapping the active tab: tiny ambient blip.
      haptics.soft();
    }
  };

  const onLongPress = (route) => {
    haptics.tap();
    navigation.emit({ type: 'tabLongPress', target: route.key });
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 14 }]}>
      <View style={styles.barShadow}>
        <View
          style={[
            styles.bar,
            {
              width: tabCount * ITEM_SIZE + BAR_PADDING * 2,
              padding: BAR_PADDING,
            },
          ]}
        >
          {/* Sliding active indicator */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              { width: ITEM_SIZE, height: ITEM_SIZE },
              indicatorStyle,
            ]}
          />

          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = activeIndex === index;
            const icon = iconForRoute(route.name);

            return (
              <TabItem
                key={route.key}
                icon={icon}
                focused={isFocused}
                onPress={() => onPress(route, isFocused)}
                onLongPress={() => onLongPress(route)}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? route.name}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

function TabItem({ icon, focused, onPress, onLongPress, accessibilityLabel }) {
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.08 : 1, SPRING);
    lift.value = withTiming(focused ? -2 : 0, { duration: 220 });
  }, [focused, scale, lift]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: lift.value },
    ],
  }));

  // Subtle press feedback.
  const press = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => { press.value = withTiming(0.92, { duration: 120 }); }}
      onPressOut={() => { press.value = withSpring(1, SPRING); }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
    >
      <Animated.View style={[styles.itemInner, pressStyle]}>
        <Animated.View style={animStyle}>
          <Feather
            name={icon}
            // Active icon uses a deep cherry-near-black for crisp contrast
            // against the rose indicator pill.
            size={focused ? 22 : 20}
            color={focused ? '#3A0E14' : theme.colors.text.secondary}
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

function iconForRoute(name) {
  switch (name) {
    case 'index':    return 'home';
    case 'timeline': return 'clock';
    case 'settings': return 'sliders';
    default:         return 'circle';
  }
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  barShadow: {
    borderRadius: theme.radii.full,
    // Soft glow under the bar so it visually floats.
    shadowColor: theme.colors.amber.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
  },
  bar: {
    flexDirection: 'row',
    borderRadius: theme.radii.full,
    overflow: 'hidden',
    // Solid translucent cherry — keeps icons crisp on every page.
    backgroundColor: 'rgba(58, 16, 24, 0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.amber.dim,
  },
  indicator: {
    position: 'absolute',
    top: BAR_PADDING,
    left: BAR_PADDING,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.amber.primary,
    shadowColor: theme.colors.amber.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 6,
  },
  item: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
  },
  itemInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
