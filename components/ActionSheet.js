// components/ActionSheet.js — minimal cross-platform bottom action sheet.
//
// Renders a Modal that slides in from the bottom with a stack of pressable
// options. Supports an optional destructive (rose) row.
//
// Usage:
//   <ActionSheet
//     visible={open}
//     onClose={() => setOpen(false)}
//     title="Add Document"
//     options={[
//       { label: 'Photograph', onPress: takePhoto },
//       { label: 'Upload File', onPress: pickFile },
//     ]}
//   />
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import theme from '../theme';
import * as haptics from '../utils/haptics';

export default function ActionSheet({ visible, onClose, title, options = [] }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <SafeAreaView edges={['bottom']}>
            {title ? (
              <View style={styles.titleWrap}>
                <Text style={styles.title}>{title}</Text>
              </View>
            ) : null}

            {options.map((opt, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  haptics.tap();
                  onClose?.();
                  // Defer so the sheet has time to dismiss before we navigate / open camera.
                  setTimeout(() => opt.onPress?.(), 80);
                }}
                style={({ pressed }) => [
                  styles.row,
                  i < options.length - 1 && styles.rowDivider,
                  pressed && styles.rowPressed,
                ]}
              >
                <Text
                  style={[
                    styles.rowLabel,
                    opt.destructive && { color: theme.colors.rose },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}

            <Pressable
              onPress={() => { haptics.tap(); onClose?.(); }}
              style={({ pressed }) => [styles.cancel, pressed && styles.rowPressed]}
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: theme.colors.background.tertiary,
    borderTopLeftRadius: theme.radii['2xl'],
    borderTopRightRadius: theme.radii['2xl'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  titleWrap: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  title: {
    fontFamily: theme.fonts.mono,
    color: theme.colors.text.dim,
    letterSpacing: 4,
    fontSize: theme.fontSize.xs,
  },
  row: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.subtle,
  },
  rowPressed: {
    backgroundColor: theme.colors.background.glass,
  },
  rowLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
  },
  cancel: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.radii.lg,
  },
  cancelLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.md,
    color: theme.colors.amber.primary,
  },
});
