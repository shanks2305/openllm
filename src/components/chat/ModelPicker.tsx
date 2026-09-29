import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../../theme';
import { formatBytes } from '../../model/modelStorage';
import type { InstalledModel } from '../../model/types';

type ModelPickerProps = {
  models: InstalledModel[];
  selectedId: string | null;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onManageModels: () => void;
};

export function ModelPicker({
  models,
  selectedId,
  disabled,
  onSelect,
  onManageModels,
}: ModelPickerProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selected = models.find(model => model.id === selectedId);
  const label = selected?.name ?? 'Choose a model';

  const close = () => setOpen(false);

  return (
    <>
      <View style={styles.wrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change model"
          disabled={disabled}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [
            styles.box,
            { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
          ]}>
          <View style={styles.boxText}>
            <Text style={styles.caption}>Model</Text>
            <Text style={styles.name} numberOfLines={1}>
              {label}
            </Text>
          </View>
          <Text style={styles.chevron}>▾</Text>
        </Pressable>
      </View>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={close}>
        <View style={styles.overlay}>
          <Pressable style={styles.dismiss} onPress={close} />
          <View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + spacing.md },
            ]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Downloaded models</Text>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetContent}>
              {models.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>No models downloaded</Text>
                  <Text style={styles.hint}>
                    Download or import a .gguf file first, then pick it here.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      close();
                      onManageModels();
                    }}
                    style={({ pressed }) => [
                      styles.manageButton,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}>
                    <Text style={styles.manageLabel}>Manage models</Text>
                  </Pressable>
                </View>
              ) : (
                models.map(model => {
                  const isSelected = model.id === selectedId;

                  return (
                    <Pressable
                      key={model.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        onSelect(model.id);
                        close();
                      }}
                      style={({ pressed }) => [
                        styles.row,
                        isSelected && styles.rowSelected,
                        { opacity: pressed ? 0.8 : 1 },
                      ]}>
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {model.name}
                        </Text>
                        <Text style={styles.hint}>{formatBytes(model.bytes)}</Text>
                      </View>
                      {isSelected ? (
                        <Text style={styles.check}>✓</Text>
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  boxText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  caption: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  name: {
    ...typography.body,
    fontWeight: '600',
    marginTop: 2,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 16,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  dismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    ...typography.body,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  sheetContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  empty: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  manageButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  manageLabel: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  rowSelected: {
    borderColor: colors.accent,
  },
  rowText: {
    flex: 1,
    marginRight: spacing.sm,
    gap: 2,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  check: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
});
