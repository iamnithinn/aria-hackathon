// app/vault/index.js — Vault home.
//
// Header → filter chips → vertical list of document cards.
// Add button opens an action sheet to photograph or upload from library.
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';

import theme from '../../theme';
import Screen from '../../components/Screen';
import MonoLabel from '../../components/MonoLabel';
import SerifText from '../../components/SerifText';
import Card from '../../components/Card';
import Chip from '../../components/Chip';
import Sparkline from '../../components/Sparkline';
import ActionSheet from '../../components/ActionSheet';
import Reveal from '../../components/Reveal';
import * as haptics from '../../utils/haptics';
import { getDocuments, getLabMarkerHistory } from '../../services/memory';

const FILTERS = [
  { key: 'all', label: 'all', match: () => true },
  { key: 'lab_report', label: 'labs', match: (d) => d.type === 'lab_report' },
  { key: 'prescription', label: 'prescriptions', match: (d) => d.type === 'prescription' },
  { key: 'imaging', label: 'imaging', match: (d) => d.type === 'imaging' },
  { key: 'other', label: 'other', match: (d) => !['lab_report', 'prescription', 'imaging'].includes(d.type) },
];

export default function VaultHome() {
  const router = useRouter();
  const [docs, setDocs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [sheetOpen, setSheetOpen] = useState(false);

  // Load documents on focus so newly-added docs appear when we return.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const list = await getDocuments();
        if (!cancelled) setDocs(list);
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const visible = docs.filter(FILTERS.find((f) => f.key === filter)?.match || (() => true));

  const handlePhoto = async () => {
    const res = await ImagePicker.requestCameraPermissionsAsync();
    if (res.status !== 'granted') return;
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1, // we re-compress in the add flow
      exif: false,
    });
    if (!r.canceled && r.assets?.[0]?.uri) {
      router.push({ pathname: '/vault/add', params: { uri: r.assets[0].uri } });
    }
  };

  const handleUpload = async () => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (res.status !== 'granted') return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      exif: false,
    });
    if (!r.canceled && r.assets?.[0]?.uri) {
      router.push({ pathname: '/vault/add', params: { uri: r.assets[0].uri } });
    }
  };

  return (
    <Screen scroll>
      <View style={styles.container}>
        {/* Top */}
        <Reveal delay={80}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
              <Feather name="chevron-left" size={22} color={theme.colors.text.tertiary} />
            </Pressable>
            <MonoLabel size={theme.fontSize.sm} style={styles.crumb}>aria  /  vault</MonoLabel>
            <View style={{ width: 22 }} />
          </View>
        </Reveal>

        <Reveal delay={180}>
          <SerifText size={theme.fontSize['2xl']} italic align="left" style={styles.title}>
            Everything you{"'"}ve shown me.
          </SerifText>
        </Reveal>

        {/* Filter chips */}
        <Reveal delay={280}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {FILTERS.map((f) => (
              <Chip
                key={f.key}
                label={f.label}
                active={filter === f.key}
                onPress={() => { haptics.select(); setFilter(f.key); }}
                style={{ marginRight: theme.spacing.sm }}
              />
            ))}
          </ScrollView>
        </Reveal>

        {/* Add button (always visible) */}
        <Reveal delay={380}>
          <Pressable
            onPress={() => { haptics.tap(); setSheetOpen(true); }}
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          >
            <Feather name="plus" size={18} color={theme.colors.background.primary} />
            <Text style={styles.addBtnLabel}>Add Document</Text>
          </Pressable>
        </Reveal>

        {/* List */}
        {visible.length === 0 ? (
          <Reveal delay={500} style={styles.emptyBox}>
            <SerifText size={theme.fontSize.xl} italic>
              Nothing here yet. Show me something.
            </SerifText>
          </Reveal>
        ) : (
          <View style={styles.list}>
            {visible.map((doc, i) => (
              <Reveal key={doc.id} delay={500 + i * 60}>
                <DocumentCard doc={doc} onPress={() => router.push(`/vault/document/${doc.id}`)} />
              </Reveal>
            ))}
          </View>
        )}
      </View>

      <ActionSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="add document"
        options={[
          { label: 'Photograph', onPress: handlePhoto },
          { label: 'Upload File', onPress: handleUpload },
        ]}
      />
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────
function DocumentCard({ doc, onPress }) {
  const [sparkline, setSparkline] = useState(null);

  // For lab reports, fetch the most-changed marker's history for the sparkline.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (doc.type !== 'lab_report' || !doc.extractedData?.labValues?.length) return;
      // Take the first labValue's marker — good enough for an at-a-glance hint.
      const first = doc.extractedData.labValues[0];
      if (!first?.marker) return;
      const history = await getLabMarkerHistory(first.marker);
      if (!cancelled && history.length) {
        setSparkline({
          marker: first.marker,
          values: history.map((h) => h.value),
        });
      }
    })();
    return () => { cancelled = true; };
  }, [doc]);

  const dt = format(new Date(doc.timestamp), 'MMM d, yyyy').toLowerCase();
  const typeLabel = TYPE_LABEL[doc.type] || doc.type;
  const icon = TYPE_ICON[doc.type] || 'file';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      <Card style={styles.docCard}>
        <View style={styles.docTopRow}>
          <Feather name={icon} size={14} color={theme.colors.text.dim} />
          <MonoLabel size={theme.fontSize.xs} style={styles.docType}>{typeLabel}</MonoLabel>
          <View style={{ flex: 1 }} />
          {sparkline ? <Sparkline values={sparkline.values} width={56} height={20} /> : null}
        </View>
        <SerifText size={theme.fontSize.lg} italic align="left" style={styles.docTitle}>
          {doc.title}
        </SerifText>
        <MonoLabel size={theme.fontSize.xs} style={styles.docDate}>{dt}</MonoLabel>
        {doc.extractedData?.summary ? (
          <Text style={styles.docSummary} numberOfLines={2}>
            {doc.extractedData.summary}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

const TYPE_LABEL = {
  lab_report: 'lab report',
  prescription: 'prescription',
  imaging: 'imaging',
  discharge_summary: 'discharge',
  other: 'document',
};
const TYPE_ICON = {
  lab_report: 'activity',
  prescription: 'clipboard',
  imaging: 'image',
  discharge_summary: 'file-text',
  other: 'file',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing['2xl'],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { width: 22 },
  crumb: { color: theme.colors.text.tertiary },
  title: { marginTop: theme.spacing.lg, marginBottom: theme.spacing.lg },
  chipsRow: {
    paddingVertical: theme.spacing.xs,
  },
  addBtn: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.amber.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: theme.colors.amber.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  addBtnLabel: {
    fontFamily: theme.fonts.bodyMedium,
    color: theme.colors.background.primary,
    fontSize: theme.fontSize.md,
  },
  emptyBox: {
    marginTop: theme.spacing['3xl'],
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  list: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  docCard: { /* Card itself handles padding */ },
  docTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  docType: { color: theme.colors.text.dim },
  docTitle: { marginVertical: 4 },
  docDate: {
    color: theme.colors.text.dim,
    marginTop: 2,
  },
  docSummary: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.sm,
    lineHeight: theme.fontSize.sm * 1.55,
  },
});
