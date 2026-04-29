// app/vault/marker/[name].js — single lab marker history + trend chart.
//
// Header → "How your <marker> has changed."
// Big amber TrendChart with reference range band.
// Three stat cards: latest / change-from-first / days-since-last.
// Below: the data points as a list.
import React, { useCallback, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { differenceInCalendarDays, format } from 'date-fns';

import theme from '../../../theme';
import Screen from '../../../components/Screen';
import MonoLabel from '../../../components/MonoLabel';
import SerifText from '../../../components/SerifText';
import Card from '../../../components/Card';
import TrendChart from '../../../components/TrendChart';
import Reveal from '../../../components/Reveal';
import { getLabMarkerHistory } from '../../../services/memory';

export default function MarkerDetail() {
  const router = useRouter();
  const { name } = useLocalSearchParams();
  const marker = decodeURIComponent(String(name || ''));
  const [history, setHistory] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const list = await getLabMarkerHistory(marker);
        if (!cancelled) setHistory(list);
      })();
      return () => { cancelled = true; };
    }, [marker])
  );

  const latest = history[history.length - 1] || null;
  const first = history[0] || null;
  const delta = latest && first ? round(latest.value - first.value, 2) : null;
  const daysSince = latest ? differenceInCalendarDays(new Date(), new Date(latest.timestamp)) : null;

  // For the chart we need points; reference range comes from the most recent
  // entry that actually has one (ranges can change between labs).
  const refSource = [...history].reverse().find((h) => h.referenceRangeLow != null && h.referenceRangeHigh != null);
  const referenceLow = refSource?.referenceRangeLow ?? null;
  const referenceHigh = refSource?.referenceRangeHigh ?? null;
  const unit = latest?.unit || '';

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - theme.spacing.xl * 2;

  return (
    <Screen scroll>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Feather name="chevron-left" size={22} color={theme.colors.text.tertiary} />
          </Pressable>
          <MonoLabel size={theme.fontSize.xs} style={styles.crumb}>
            {`aria  /  trends  /  ${marker.toLowerCase()}`}
          </MonoLabel>
          <View style={{ width: 22 }} />
        </View>

        <Reveal delay={120}>
          <SerifText size={theme.fontSize['2xl']} italic align="left" style={styles.title}>
            {`How your ${marker} has changed.`}
          </SerifText>
        </Reveal>

        {history.length === 0 ? (
          <Reveal delay={250} style={styles.empty}>
            <SerifText size={theme.fontSize.lg} italic>
              No data for this marker yet.
            </SerifText>
          </Reveal>
        ) : history.length === 1 ? (
          <Reveal delay={250}>
            <Card style={styles.singleCard}>
              <Text style={styles.singleValue}>
                {latest.value} <Text style={styles.singleUnit}>{latest.unit}</Text>
              </Text>
              <SerifText size={theme.fontSize.lg} italic align="left" style={{ marginTop: theme.spacing.md }}>
                I{"'"}ll plot the trend when you have more data.
              </SerifText>
            </Card>
          </Reveal>
        ) : (
          <>
            <Reveal delay={250}>
              <View style={styles.chartWrap}>
                <TrendChart
                  data={history.map((h) => ({ timestamp: h.timestamp, value: h.value, source: h }))}
                  referenceLow={referenceLow}
                  referenceHigh={referenceHigh}
                  unit={unit}
                  width={chartWidth}
                  onPointPress={(p) => router.push(`/vault/document/${p.source.documentId}`)}
                />
              </View>
            </Reveal>

            <Reveal delay={400}>
              <View style={styles.statsRow}>
                <StatCard label="latest" value={latest.value} unit={latest.unit} flag={latest.flag} />
                <StatCard
                  label="vs. first"
                  value={delta != null ? (delta > 0 ? `+${delta}` : `${delta}`) : '—'}
                  unit={latest.unit}
                  arrow={delta == null ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : null}
                />
                <StatCard
                  label="last test"
                  value={daysSince != null ? `${daysSince}d` : '—'}
                  monoValue
                />
              </View>
            </Reveal>

            <Reveal delay={550}>
              <View style={styles.list}>
                <MonoLabel size={theme.fontSize.xs} style={styles.listLabel}>history</MonoLabel>
                {[...history].reverse().map((h) => (
                  <Pressable
                    key={h.id}
                    onPress={() => router.push(`/vault/document/${h.documentId}`)}
                    style={({ pressed }) => [styles.histRow, pressed && { opacity: 0.85 }]}
                  >
                    <MonoLabel size={theme.fontSize.xs} style={styles.histDate}>
                      {format(new Date(h.timestamp), 'MMM d, yyyy').toLowerCase()}
                    </MonoLabel>
                    <Text style={styles.histValue}>
                      {h.value} <Text style={styles.histUnit}>{h.unit}</Text>
                    </Text>
                    <Feather name="chevron-right" size={14} color={theme.colors.text.dim} />
                  </Pressable>
                ))}
              </View>
            </Reveal>
          </>
        )}
      </View>
    </Screen>
  );
}

function StatCard({ label, value, unit, arrow, monoValue, flag }) {
  const flagColor = flag === 'high' || flag === 'low' ? theme.colors.rose : theme.colors.text.primary;
  return (
    <View style={styles.statCard}>
      <MonoLabel size={9} style={styles.statLabel}>{label}</MonoLabel>
      <View style={styles.statValueRow}>
        {arrow === 'up' ? <Feather name="arrow-up" size={12} color={theme.colors.amber.primary} /> : null}
        {arrow === 'down' ? <Feather name="arrow-down" size={12} color={theme.colors.amber.primary} /> : null}
        <Text style={[
          monoValue ? styles.statValueMono : styles.statValue,
          flag ? { color: flagColor } : null,
        ]}>
          {value}
        </Text>
        {unit && !monoValue ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

function round(v, d) {
  if (!Number.isFinite(v)) return null;
  const m = Math.pow(10, d);
  return Math.round(v * m) / m;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  back: { width: 22 },
  crumb: { color: theme.colors.text.tertiary, flexShrink: 1, textAlign: 'center' },
  title: { marginBottom: theme.spacing.lg },
  empty: { alignItems: 'center', paddingVertical: theme.spacing['2xl'] },
  singleCard: {
    paddingVertical: theme.spacing.xl,
  },
  singleValue: {
    fontFamily: theme.fonts.display,
    fontSize: 48,
    color: theme.colors.amber.primary,
    letterSpacing: -0.5,
  },
  singleUnit: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.dim,
  },
  chartWrap: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
    padding: theme.spacing.md,
    gap: 4,
  },
  statLabel: { color: theme.colors.text.dim, letterSpacing: 2 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statValue: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize['2xl'],
    color: theme.colors.text.primary,
    letterSpacing: -0.5,
  },
  statValueMono: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.lg,
    color: theme.colors.text.primary,
  },
  statUnit: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.dim,
  },
  list: { marginTop: theme.spacing['2xl'] },
  listLabel: { color: theme.colors.text.dim, marginBottom: theme.spacing.sm },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.subtle,
    gap: theme.spacing.md,
  },
  histDate: { color: theme.colors.text.tertiary, flex: 1 },
  histValue: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.md,
    color: theme.colors.amber.primary,
  },
  histUnit: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.dim,
  },
});
