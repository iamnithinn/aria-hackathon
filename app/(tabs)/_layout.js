// app/(tabs)/_layout.js — bottom tab navigator with a custom floating bar.
// The bar lives at components/FloatingTabBar.js and animates the active
// indicator + icons. We hide the default bar and render ours in its place.
import { Tabs } from 'expo-router';

import FloatingTabBar from '../../components/FloatingTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'home' }} />
      <Tabs.Screen name="timeline" options={{ title: 'timeline' }} />
      <Tabs.Screen name="settings" options={{ title: 'settings' }} />
    </Tabs>
  );
}
