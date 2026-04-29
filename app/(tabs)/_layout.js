// app/(tabs)/_layout.js — bottom tab navigator.
// Subtle: amber for the active tab, dim for the rest. Hairline top border.
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Platform, StyleSheet } from 'react-native';

import theme from '../../theme';
import * as haptics from '../../utils/haptics';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.amber.primary,
        tabBarInactiveTintColor: theme.colors.text.dim,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
      }}
      // Light haptic when the user changes tabs.
      screenListeners={{
        tabPress: () => { haptics.tap(); },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'home',
          tabBarIcon: ({ color, size }) => <Feather name="circle" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: 'timeline',
          tabBarIcon: ({ color, size }) => <Feather name="clock" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'settings',
          tabBarIcon: ({ color, size }) => <Feather name="sliders" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: theme.colors.background.primary,
    borderTopColor: theme.colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    // Pad up a bit on Android — system gestures eat into the bar otherwise.
    paddingTop: 6,
    height: Platform.OS === 'ios' ? 84 : 64,
  },
  label: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'lowercase',
    marginTop: 2,
  },
  item: {
    paddingVertical: 4,
  },
});
