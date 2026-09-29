import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { INSTRUCTION_PRESETS } from '../../chat/instructions';
import { colors, radii, spacing, typography } from '../../theme';

type InstructionSheetProps = {
  visible: boolean;
  value: string;
  onClose: () => void;
  onSave: (prompt: string) => void;
};

export function InstructionSheet({
  visible,
  value,
  onClose,
  onSave,
}: InstructionSheetProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) {
      setDraft(value);
    }
  }, [value, visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Chat instructions</Text>
          <Text style={styles.hint}>
            These replace the Settings system prompt for this chat. Leave them
            empty to use Settings.
          </Text>
          <View style={styles.chips}>
            {INSTRUCTION_PRESETS.map(preset => {
              const selected = draft.trim() === preset.prompt;

              return (
                <Pressable
                  key={preset.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setDraft(preset.prompt)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={styles.chipLabel}>{preset.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="You are a helpful assistant."
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onSave(draft);
              onClose();
            }}
            style={({ pressed }) => [
              styles.save,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.saveLabel}>Save</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    gap: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  hint: {
    ...typography.caption,
    lineHeight: 18,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    ...typography.body,
    minHeight: 96,
    textAlignVertical: 'top',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  save: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    marginTop: spacing.xs,
  },
  saveLabel: {
    ...typography.body,
    fontWeight: '600',
  },
});
