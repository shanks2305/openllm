import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticTap } from '../../haptics';
import { colors, radii, spacing, typography } from '../../theme';

type ComposerProps = {
  value: string;
  onChangeText: (value: string) => void;
  generating: boolean;
  hasModel?: boolean;
  editing?: boolean;
  onCancelEdit?: () => void;
  onSend: (text: string) => void;
  onStop: () => void;
};

export function Composer({
  value,
  onChangeText,
  generating,
  hasModel = true,
  editing = false,
  onCancelEdit,
  onSend,
  onStop,
}: ComposerProps) {
  const insets = useSafeAreaInsets();
  const canSend = value.trim().length > 0 && !generating && hasModel;

  const submit = () => {
    if (!canSend) {
      return;
    }

    hapticTap();
    onSend(value);
  };

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, spacing.sm) },
      ]}
    >
      {editing ? (
        <View style={styles.editing}>
          <Text style={styles.editingLabel}>
            Editing this message replaces the replies after it.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel edit"
            onPress={onCancelEdit}
          >
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.bar}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={hasModel ? 'Message' : 'Choose a model to chat'}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          editable={!generating && hasModel}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={submit}
        />
        {generating ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop generating"
            onPress={() => {
              hapticTap();
              onStop();
            }}
            style={({ pressed }) => [
              styles.action,
              styles.stop,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <View style={styles.stopIcon} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            disabled={!canSend}
            onPress={submit}
            style={({ pressed }) => [
              styles.action,
              canSend ? styles.sendEnabled : styles.sendDisabled,
              { opacity: pressed && canSend ? 0.75 : 1 },
            ]}
          >
            <Text style={styles.sendLabel}>↑</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  editing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  editingLabel: {
    ...typography.caption,
    flex: 1,
    lineHeight: 18,
  },
  cancel: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    ...typography.body,
    flex: 1,
    maxHeight: 120,
    paddingTop: 6,
    paddingBottom: 6,
  },
  action: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendEnabled: {
    backgroundColor: colors.text,
  },
  sendDisabled: {
    backgroundColor: colors.surfaceElevated,
  },
  sendLabel: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
    marginTop: -1,
  },
  stop: {
    backgroundColor: colors.text,
  },
  stopIcon: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.background,
  },
});
