// app/bridge/[id].js — read view of a generated brief.
//
// Renders the markdown in our design language (no third-party renderer needed
// — see utils/markdown.js). Bottom row: Share PDF (expo-sharing), Save (no-op
// confirm — already saved), Print (expo-print direct).
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

import theme from '../../theme';
import Screen from '../../components/Screen';
import MonoLabel from '../../components/MonoLabel';
import SerifText from '../../components/SerifText';
import AmberButton from '../../components/AmberButton';
import GhostButton from '../../components/GhostButton';
import Card from '../../components/Card';
import Reveal from '../../components/Reveal';
import * as haptics from '../../utils/haptics';
import { getDoctorBriefById } from '../../services/memory';
import { parseBlocks, parseInline, markdownToHtml } from '../../utils/markdown';

export default function BridgeView() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [brief, setBrief] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const b = await getDoctorBriefById(String(id));
        if (!cancelled) setBrief(b);
      })();
      return () => { cancelled = true; };
    }, [id])
  );

  if (!brief) {
    return (
      <Screen>
        <View style={styles.loading}><MonoLabel size={theme.fontSize.xs}>loading…</MonoLabel></View>
      </Screen>
    );
  }

  const blocks = parseBlocks(brief.summary);
  const dt = format(new Date(brief.timestamp), 'PPP').toLowerCase();

  const sharePdf = async () => {
    haptics.confirm();
    try {
      const ok = await Sharing.isAvailableAsync();
      if (!ok) return;
      await Sharing.shareAsync(brief.pdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share with your doctor',
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      console.warn('[bridge/view] share failed', err);
    }
  };

  const printDirect = async () => {
    haptics.tap();
    try {
      const html = markdownToHtml(brief.summary);
      await Print.printAsync({ html });
    } catch (err) {
      console.warn('[bridge/view] print failed', err);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Feather name="chevron-left" size={22} color={theme.colors.text.tertiary} />
          </Pressable>
          <MonoLabel size={theme.fontSize.xs} style={styles.crumb}>aria  /  doctor bridge  /  brief</MonoLabel>
          <View style={{ width: 22 }} />
        </View>

        <Reveal delay={100}>
          <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim, marginBottom: 4 }}>
            {brief.visitContext ? `visit · ${brief.visitContext.toLowerCase()}` : 'pre-visit brief'}
          </MonoLabel>
        </Reveal>
        <Reveal delay={180}>
          <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim, marginBottom: theme.spacing.xl }}>
            generated {dt}
          </MonoLabel>
        </Reveal>

        <Reveal delay={260}>
          <Card style={styles.briefCard}>
            {blocks.map((b, i) => <RenderBlock key={i} block={b} />)}
          </Card>
        </Reveal>

        <Reveal delay={420}>
          <View style={styles.footer}>
            <AmberButton label="Share with doctor" onPress={sharePdf} fullWidth />
            <View style={{ height: theme.spacing.md }} />
            <GhostButton label="Print" onPress={printDirect} fullWidth />
            <View style={{ height: theme.spacing.md }} />
            <GhostButton label="Done" onPress={() => router.replace('/(tabs)')} fullWidth />
          </View>
        </Reveal>
      </View>
    </Screen>
  );
}

function RenderBlock({ block }) {
  if (block.type === 'h1') {
    return (
      <SerifText size={theme.fontSize['2xl']} italic align="left" style={styles.h1}>
        {block.text}
      </SerifText>
    );
  }
  if (block.type === 'h2') {
    return <Text style={styles.h2}>{block.text}</Text>;
  }
  if (block.type === 'h3') {
    return <Text style={styles.h3}>{block.text}</Text>;
  }
  if (block.type === 'ul') {
    return (
      <View style={styles.ul}>
        {block.items.map((it, i) => (
          <View key={i} style={styles.li}>
            <Text style={styles.bullet}>·</Text>
            <Text style={styles.body}>{renderInline(it)}</Text>
          </View>
        ))}
      </View>
    );
  }
  // p
  return <Text style={styles.body}>{renderInline(block.text)}</Text>;
}

function renderInline(s) {
  return parseInline(s).map((p, i) =>
    p.bold ? (
      <Text key={i} style={{ fontFamily: theme.fonts.bodySemi, color: theme.colors.text.primary }}>
        {p.text}
      </Text>
    ) : (
      <Text key={i}>{p.text}</Text>
    )
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'],
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  back: { width: 22 },
  crumb: { color: theme.colors.text.tertiary },
  briefCard: {
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  h1: {
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  h2: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.fontSize.lg,
    color: theme.colors.amber.primary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xs,
    letterSpacing: 0.2,
  },
  h3: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
    marginTop: theme.spacing.md,
    marginBottom: 4,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    lineHeight: theme.fontSize.md * 1.6,
  },
  ul: { gap: 4 },
  li: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  bullet: {
    color: theme.colors.amber.primary,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    lineHeight: theme.fontSize.md * 1.6,
  },
  footer: { marginTop: theme.spacing['2xl'] },
});
