// app/(tabs)/timeline.js — your story, in order.
//
// Pulls every event in memory (check-ins, documents, medications, observations),
// merges + sorts newest-first, and renders a journal-style chronology.
//
// Vertical hairline at ~32px from edge is the spine; each entry has a
// kind-specific marker dot anchored to it. Day groups under sticky-style
// date headers.
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';

import theme from '../../theme';
import Screen from '../../components/Screen';
import MonoLabel from '../../components/MonoLabel';
import SerifText from '../../components/SerifText';
import Chip from '../../components/Chip';
import GhostButton from '../../components/GhostButton';
import Reveal from '../../components/Reveal';
import * as haptics from '../../utils/haptics';
import { getTimelineEntries } from '../../services/memory';

const SPINE_X = 32;

export default function Timeline() {
  const router = useRouter();
  const [entries, setEntries] = useState(null); // null = loading
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState(null); // entry shown in modal

  const load = useCallback(async () => {
    const list = await getTimelineEntries();
    setEntries(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const list = await getTimelineEntries();
        if (!cancelled) setEntries(list);
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.ambient();
    await load();
    setRefreshing(false);
  }, [load]);

  // Group entries by calendar day.
  const groups = groupByDay(entries || []);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.amber.primary}
          />
        }
      >
        <View style={styles.headerArea}>
          <Reveal delay={80}>
            <MonoLabel size={theme.fontSize.sm} style={styles.crumb}>aria  /  timeline</MonoLabel>
          </Reveal>
          <Reveal delay={180}>
            <SerifText size={theme.fontSize['2xl']} italic align="left" style={styles.title}>
              Your story, in order.
            </SerifText>
          </Reveal>
        </View>

        {entries === null ? (
          <View style={styles.loading}>
            <MonoLabel size={theme.fontSize.xs}>loading…</MonoLabel>
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.empty}>
            <SerifText size={theme.fontSize.lg} italic align="center">
              Nothing yet. Begin with a check-in.
            </SerifText>
            <View style={{ height: theme.spacing.lg }} />
            <GhostButton label="Go to Home" onPress={() => router.push('/(tabs)')} />
          </View>
        ) : (
          <View style={styles.timeline}>
            {/* Spine */}
            <View style={styles.spine} pointerEvents="none" />

            {groups.map((g) => (
              <View key={g.dateKey}>
                <DateHeader date={g.date} />
                {g.entries.map((entry) => (
                  <TimelineRow
                    key={entry.id}
                    entry={entry}
                    onPress={() => setDetail(entry)}
                  />
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <DetailModal entry={detail} onClose={() => setDetail(null)} />
    </Screen>
  );
}

// ─── Day grouping ─────────────────────────────────────────
function groupByDay(entries) {
  const out = [];
  for (const e of entries) {
    const d = new Date(e.timestamp);
    const key = format(d, 'yyyy-MM-dd');
    const last = out[out.length - 1];
    if (last && last.dateKey === key) {
      last.entries.push(e);
    } else {
      out.push({ dateKey: key, date: d, entries: [e] });
    }
  }
  return out;
}

function dateHeaderText(d) {
  if (isToday(d)) return 'today';
  if (isYesterday(d)) return 'yesterday';
  return format(d, 'EEEE, MMMM d').toLowerCase();
}

function DateHeader({ date }) {
  return (
    <View style={styles.dateHeader}>
      <MonoLabel size={theme.fontSize.xs} style={styles.dateHeaderText}>
        {dateHeaderText(date)}
      </MonoLabel>
    </View>
  );
}

// ─── Row ──────────────────────────────────────────────────
function TimelineRow({ entry, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.rowWrap, pressed && { opacity: 0.85 }]}>
      <Marker kind={entry.kind} />
      <View style={styles.rowContent}>
        {entry.kind === 'checkin' && <CheckinRow entry={entry} />}
        {entry.kind === 'document' && <DocumentRow entry={entry} />}
        {entry.kind === 'medication' && <MedicationRow entry={entry} />}
        {entry.kind === 'observation' && <ObservationRow entry={entry} />}
      </View>
    </Pressable>
  );
}

function Marker({ kind }) {
  // All marker glyphs sit centered on the spine (SPINE_X).
  const common = { left: SPINE_X - 5, top: 14 };
  if (kind === 'checkin') {
    return <View style={[styles.markerBase, styles.markerDot, common]} />;
  }
  if (kind === 'document') {
    return <View style={[styles.markerBase, styles.markerSquare, common]} />;
  }
  if (kind === 'medication') {
    return <View style={[styles.markerBase, styles.markerPill, common]} />;
  }
  // observation
  return <View style={[styles.markerBase, styles.markerHollow, common]} />;
}

function timeLine(ts) {
  return format(new Date(ts), 'p').toLowerCase();
}

function CheckinRow({ entry }) {
  const c = entry.payload;
  const sentiment = c.sentiment || 'unknown';
  const aria = c.ariaResponse;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <MonoLabel size={theme.fontSize.xs} style={styles.timeText}>{timeLine(c.timestamp)}</MonoLabel>
        <Chip label={sentiment} tone={toneForSentiment(sentiment)} />
      </View>
      {c.transcript ? (
        <Text style={styles.body} numberOfLines={3}>
          {truncate(c.transcript, 110)}
        </Text>
      ) : null}
      {aria?.message ? (
        <View style={styles.ariaQuote}>
          <SerifText size={theme.fontSize.md} italic align="left" color={theme.colors.amber.primary}>
            “{truncate(aria.message, 90)}”
          </SerifText>
        </View>
      ) : null}
    </View>
  );
}

function DocumentRow({ entry }) {
  const d = entry.payload;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <MonoLabel size={theme.fontSize.xs} style={styles.timeText}>
          {`${timeLine(d.timestamp)}  ·  ${TYPE_LABEL[d.type] || 'document'}`}
        </MonoLabel>
      </View>
      <SerifText size={theme.fontSize.lg} italic align="left" style={{ marginTop: 4 }}>
        {d.title}
      </SerifText>
      {d.extractedData?.summary ? (
        <Text style={styles.body} numberOfLines={3}>{d.extractedData.summary}</Text>
      ) : null}
    </View>
  );
}

function MedicationRow({ entry }) {
  const m = entry.payload;
  const verb = m._event === 'discontinued' ? 'Discontinued' : 'Started';
  const interactions = (m.interactionsChecked || []).length;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <MonoLabel size={theme.fontSize.xs} style={styles.timeText}>{timeLine(m.timestamp)}</MonoLabel>
        {interactions > 0 ? (
          <Chip label={`${interactions} interaction${interactions === 1 ? '' : 's'}`} tone="rose" />
        ) : null}
      </View>
      <SerifText size={theme.fontSize.lg} italic align="left" style={{ marginTop: 4 }}>
        {`${verb} ${m.name}`}
      </SerifText>
      <Text style={styles.body}>{[m.dose, m.frequency].filter(Boolean).join(' · ')}</Text>
    </View>
  );
}

function ObservationRow({ entry }) {
  const o = entry.payload;
  return (
    <View style={styles.card}>
      <MonoLabel size={theme.fontSize.xs} style={styles.timeText}>{timeLine(o.timestamp)}</MonoLabel>
      <SerifText size={theme.fontSize.md} italic align="left" style={{ marginTop: 4 }}>
        {o.observation}
      </SerifText>
    </View>
  );
}

// ─── Detail modal ─────────────────────────────────────────
function DetailModal({ entry, onClose }) {
  return (
    <Modal
      visible={!!entry}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.modalScrim} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          {entry ? <DetailBody entry={entry} /> : null}
          <View style={{ height: theme.spacing.lg }} />
          <GhostButton label="Close" onPress={onClose} fullWidth />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailBody({ entry }) {
  const ts = format(new Date(entry.timestamp), 'EEE, MMM d • p').toLowerCase();
  if (entry.kind === 'checkin') {
    const c = entry.payload;
    return (
      <View>
        <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim }}>{`check-in · ${ts}`}</MonoLabel>
        <Text style={[styles.body, { marginTop: theme.spacing.md }]}>{c.transcript || '(no transcript)'}</Text>
        {c.ariaResponse?.message ? (
          <SerifText size={theme.fontSize.lg} italic align="left" style={{ marginTop: theme.spacing.lg }}>
            {c.ariaResponse.message}
          </SerifText>
        ) : null}
        {c.ariaResponse?.reasoning ? (
          <View style={styles.modalSection}>
            <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim }}>aria's reasoning</MonoLabel>
            <Text style={[styles.body, { marginTop: 4 }]}>{c.ariaResponse.reasoning}</Text>
          </View>
        ) : null}
        {c.audioFeatures ? (
          <View style={styles.modalSection}>
            <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim }}>audio features</MonoLabel>
            <Text style={styles.mono}>
              {`vol ${(c.audioFeatures.avgVolume ?? 0).toFixed(2)} · var ${(c.audioFeatures.pitchVariance ?? 0).toFixed(2)} · rate ${(c.audioFeatures.speechRate ?? 0).toFixed(0)}wpm · pause ${(c.audioFeatures.pauseRatio ?? 0).toFixed(2)}`}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }
  if (entry.kind === 'document') {
    const d = entry.payload;
    return (
      <View>
        <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim }}>{`${TYPE_LABEL[d.type] || 'document'} · ${ts}`}</MonoLabel>
        <SerifText size={theme.fontSize.xl} italic align="left" style={{ marginTop: theme.spacing.sm }}>
          {d.title}
        </SerifText>
        {d.extractedData?.summary ? (
          <Text style={[styles.body, { marginTop: theme.spacing.md }]}>{d.extractedData.summary}</Text>
        ) : null}
      </View>
    );
  }
  if (entry.kind === 'medication') {
    const m = entry.payload;
    return (
      <View>
        <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim }}>{`medication · ${ts}`}</MonoLabel>
        <SerifText size={theme.fontSize.xl} italic align="left" style={{ marginTop: theme.spacing.sm }}>
          {`${m._event === 'discontinued' ? 'Discontinued' : 'Started'} ${m.name}`}
        </SerifText>
        <Text style={[styles.body, { marginTop: theme.spacing.sm }]}>{[m.dose, m.frequency].filter(Boolean).join(' · ')}</Text>
        {(m.interactionsChecked || []).length > 0 ? (
          <View style={styles.modalSection}>
            <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim }}>interactions noted</MonoLabel>
            {m.interactionsChecked.map((it, i) => (
              <Text key={i} style={[styles.body, { marginTop: 6 }]}>
                {`• [${it.severity}] ${it.withMedicationName}: ${it.description}`}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    );
  }
  // observation
  const o = entry.payload;
  return (
    <View>
      <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim }}>{`observation · ${ts}`}</MonoLabel>
      <SerifText size={theme.fontSize.xl} italic align="left" style={{ marginTop: theme.spacing.sm }}>
        {o.observation}
      </SerifText>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────
function toneForSentiment(s) {
  const v = String(s).toLowerCase();
  if (['calm', 'content', 'energetic', 'good', 'great'].includes(v)) return 'sage';
  if (['tired', 'off', 'low', 'anxious', 'flat'].includes(v)) return 'amber';
  return 'default';
}
function truncate(s, n) {
  if (!s) return '';
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + '…';
}

const TYPE_LABEL = {
  lab_report: 'lab report',
  prescription: 'prescription',
  imaging: 'imaging',
  discharge_summary: 'discharge',
  other: 'document',
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: theme.spacing['3xl'],
  },
  headerArea: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  crumb: { color: theme.colors.text.tertiary },
  title: { marginTop: theme.spacing.sm },
  loading: { alignItems: 'center', paddingVertical: theme.spacing['3xl'] },
  empty: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing['3xl'],
  },
  timeline: {
    position: 'relative',
    paddingHorizontal: 0,
  },
  spine: {
    position: 'absolute',
    left: SPINE_X,
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border.subtle,
  },
  dateHeader: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    paddingLeft: SPINE_X + theme.spacing.lg,
  },
  dateHeaderText: { color: theme.colors.text.dim },
  rowWrap: {
    position: 'relative',
    paddingLeft: SPINE_X + theme.spacing.lg,
    paddingRight: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },
  rowContent: {
    flex: 1,
  },
  card: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
    padding: theme.spacing.md,
    minHeight: 64,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  timeText: { color: theme.colors.text.dim, flex: 1 },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
    lineHeight: theme.fontSize.sm * 1.55,
  },
  ariaQuote: {
    marginTop: theme.spacing.sm,
    paddingLeft: theme.spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.amber.primary,
  },
  // Markers
  markerBase: {
    position: 'absolute',
    width: 10,
    height: 10,
  },
  markerDot: {
    backgroundColor: theme.colors.amber.primary,
    borderRadius: 5,
    shadowColor: theme.colors.amber.primary,
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  markerSquare: {
    backgroundColor: theme.colors.amber.primary,
    borderRadius: 2,
  },
  markerPill: {
    backgroundColor: theme.colors.amber.primary,
    width: 12,
    height: 7,
    borderRadius: 4,
    top: 16,
    left: SPINE_X - 6,
  },
  markerHollow: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: theme.colors.amber.primary,
    backgroundColor: 'transparent',
    left: SPINE_X - 5.5,
  },
  // Modal
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  modalCard: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 460,
  },
  modalSection: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.subtle,
  },
  mono: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.tertiary,
    marginTop: 4,
    letterSpacing: 0.5,
  },
});
