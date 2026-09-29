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
import { Icon } from '../ui/Icon';

type ModelPickerProps = {
  visible: boolean;
  models: InstalledModel[];
  selectedId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onManageModels: () => void;
};

export function ModelPicker({
  visible,
  models,
  selectedId,
  onClose,
  onSelect,
  onManageModels,
}: ModelPickerProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close model picker"
          style={styles.dismiss}
          onPress={onClose}
        />
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}
        >
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Model</Text>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}
          >
            {models.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No models downloaded</Text>
                <Text style={styles.hint}>
                  Download or import a .gguf file first, then pick it here.
                </Text>
              </View>
            ) : (
              <View style={styles.group}>
                {models.map((model, index) => {
                  const isSelected = model.id === selectedId;

                  return (
                    <Pressable
                      key={model.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        onSelect(model.id);
                        onClose();
                      }}
                      style={({ pressed }) => [
                        styles.row,
                        index > 0 && styles.rowDivider,
                        pressed && styles.rowPressed,
                      ]}
                    >
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {model.name}
                        </Text>
                        <Text style={styles.hint}>
                          {formatBytes(model.bytes)} · on-device
                        </Text>
                      </View>
                      {isSelected ? (
                        <Icon name="check" size={18} color={colors.text} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onClose();
                onManageModels();
              }}
              style={({ pressed }) => [
                styles.manage,
                pressed && styles.rowPressed,
              ]}
            >
              <Icon name="models" size={18} color={colors.textSecondary} />
              <Text style={styles.manageLabel}>Manage models</Text>
              <Icon name="chevronRight" size={14} color={colors.textMuted} />
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.surfacePressed,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    ...typography.body,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  sheetContent: {
    gap: spacing.sm + 4,
    paddingBottom: spacing.sm,
  },
  group: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  empty: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  rowText: {
    flex: 1,
    marginRight: spacing.sm,
    gap: 2,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '500',
  },
  manage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 6,
  },
  manageLabel: {
    ...typography.body,
    flex: 1,
  },
});
