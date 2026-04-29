// app/index.js — entry redirect.
// On launch, peek at memory: if the user has a name stored, drop them on
// the home tab. Otherwise run them through onboarding.
//
// Why a screen and not a `<Redirect>` at the top level: AsyncStorage is async,
// so we need a brief loading frame while we read.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';

import theme from '../theme';
import { getUserName } from '../services/memory';

export default function Index() {
  const [target, setTarget] = useState(null); // null = still resolving

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const name = await getUserName();
        if (cancelled) return;
        setTarget(name && name.trim() ? '/(tabs)' : '/onboarding');
      } catch {
        if (!cancelled) setTarget('/onboarding');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!target) {
    // Brief blank charcoal frame while AsyncStorage resolves — avoids a flash.
    return <View style={{ flex: 1, backgroundColor: theme.colors.background.primary }} />;
  }
  return <Redirect href={target} />;
}
