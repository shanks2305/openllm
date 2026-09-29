import { useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Attachment } from '../../chat/types';
import { hapticTap } from '../../haptics';
import { mediaAvailable, startDictation } from '../../media/media';
import { colors, radii, spacing, typography } from '../../theme';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { AttachmentStrip } from './AttachmentStrip';

export type AttachSource = 'photos' | 'files';

type Toggle = {
  on: boolean;
  onToggle: () => void;
};

type ComposerProps = {
  value: string;
  onChangeText: (value: string) => void;
  generating: boolean;
  hasModel?: boolean;
  editing?: boolean;
  instructionLabel?: string;
  attachments?: Attachment[];
  attaching?: boolean;
  canAttachMore?: boolean;
  tools?: Toggle;
  thinking?: Toggle;
  onAttach?: (source: AttachSource) => void;
  onRemoveAttachment?: (id: string) => void;
  onOpenInstructions?: () => void;
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
  instructionLabel,
  attachments = [],
  attaching = false,
  canAttachMore = true,
  tools,
  thinking,
  onAttach,
  onRemoveAttachment,
  onOpenInstructions,
  onCancelEdit,
  onSend,
  onStop,
}: ComposerProps) {
  const insets = useSafeAreaInsets();
  const [listening, setListening] = useState(false);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const changeRef = useRef(onChangeText);
  changeRef.current = onChangeText;

  const canSend =
    (value.trim().length > 0 || attachments.length > 0) &&
    !generating &&
    !attaching &&
    hasModel;

  useEffect(() => () => stopListeningRef.current?.(), []);

  const stopListening = () => {
    stopListeningRef.current?.();
    stopListeningRef.current = null;
    setListening(false);
  };

  const submit = () => {
    if (!canSend) {
      return;
    }

    stopListening();
    hapticTap();
    onSend(value);
  };

  const toggleDictation = async () => {
    hapticTap();

    if (listening) {
      stopListening();
      return;
    }

    const base = value.trim() ? `${value.trimEnd()} ` : '';

    try {
      setListening(true);
      stopListeningRef.current = await startDictation({
        onText: text => changeRef.current(base + text),
        onEnd: error => {
          stopListeningRef.current = null;
          setListening(false);

          if (error) {
            Alert.alert('Dictation stopped', error);
          }
        },
      });
    } catch (error) {
      setListening(false);
      Alert.alert(
        'Dictation unavailable',
        error instanceof Error ? error.message : 'Could not start listening',
      );
    }
  };

  const openAttachMenu = () => {
    if (!onAttach) {
      return;
    }

    hapticTap();
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Photos', 'Files', 'Cancel'],
        cancelButtonIndex: 2,
        title: 'Attach',
        message: 'Images need a vision model. Files can be PDFs, text, code, or images.',
      },
      index => {
        if (index === 0) {
          onAttach('photos');
        } else if (index === 1) {
          onAttach('files');
        }
      },
    );
  };

  const inputDisabled = generating || !hasModel;

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
            Editing starts a new version. The old one stays in the 1/2 arrows.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel edit"
            hitSlop={8}
            onPress={onCancelEdit}
          >
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.card}>
        {attachments.length > 0 || attaching ? (
          <View style={styles.attachments}>
            <AttachmentStrip
              attachments={attachments}
              onRemove={generating ? undefined : onRemoveAttachment}
            />
            {attaching ? (
              <ActivityIndicator
                style={styles.attachingSpinner}
                color={colors.textSecondary}
              />
            ) : null}
          </View>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={
            listening
              ? 'Listening…'
              : hasModel
              ? 'Ask anything'
              : 'Choose a model to chat'
          }
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          editable={!inputDisabled}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={submit}
          selectionColor={colors.accent}
        />
        <View style={styles.toolbar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chips}
            style={styles.chipScroll}
          >
            {onAttach && !editing ? (
              <RoundButton
                icon="plus"
                label="Attach files or photos"
                disabled={inputDisabled || attaching || !canAttachMore}
                onPress={openAttachMenu}
              />
            ) : null}
            {onOpenInstructions ? (
              <Chip
                icon="settings"
                label={instructionLabel ?? 'General'}
                accessibilityLabel="Chat instructions"
                disabled={generating}
                onPress={onOpenInstructions}
              />
            ) : null}
            {tools ? (
              <Chip
                icon="tool"
                label="Tools"
                accessibilityLabel="Tools"
                active={tools.on}
                disabled={generating}
                onPress={tools.onToggle}
              />
            ) : null}
            {thinking ? (
              <Chip
                icon="bulb"
                label="Think"
                accessibilityLabel="Think before answering"
                active={thinking.on}
                disabled={generating}
                onPress={thinking.onToggle}
              />
            ) : null}
          </ScrollView>
          <View style={styles.actions}>
            {mediaAvailable && !generating ? (
              <RoundButton
                icon="mic"
                label={listening ? 'Stop dictation' : 'Dictate'}
                active={listening}
                disabled={inputDisabled}
                onPress={toggleDictation}
              />
            ) : null}
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
                  styles.actionEnabled,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="stop" size={20} color={colors.onPrimary} />
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send message"
                accessibilityState={{ disabled: !canSend }}
                disabled={!canSend}
                onPress={submit}
                style={({ pressed }) => [
                  styles.action,
                  canSend ? styles.actionEnabled : styles.actionDisabled,
                  pressed && canSend && styles.pressed,
                ]}
              >
                <Icon
                  name="arrowUp"
                  size={18}
                  color={canSend ? colors.onPrimary : colors.textMuted}
                />
              </Pressable>
            )}
          </View>
        </View>
      </View>
      <Text style={styles.footnote}>
        Runs privately on your device. Replies can be wrong.
      </Text>
    </View>
  );
}

function Chip({
  icon,
  label,
  accessibilityLabel,
  active,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  accessibilityLabel: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const color = active ? colors.accent : colors.textSecondary;

  return (
    <Pressable
      accessibilityRole={active == null ? 'button' : 'switch'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={active == null ? { disabled } : { checked: active, disabled }}
      disabled={disabled}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.chipPressed,
        disabled && styles.disabled,
      ]}
    >
      <Icon name={icon} size={14} color={color} />
      <Text style={[styles.chipLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function RoundButton({
  icon,
  label,
  active,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        active && styles.roundActive,
        pressed && styles.chipPressed,
        disabled && styles.disabled,
      ]}
    >
      <Icon
        name={icon}
        size={18}
        color={active ? colors.onPrimary : colors.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.sm + 4,
    paddingTop: spacing.xs,
    backgroundColor: colors.background,
  },
  editing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  editingLabel: {
    ...typography.caption,
    flex: 1,
    lineHeight: 18,
  },
  cancel: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 2,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  attachments: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  attachingSpinner: {
    marginLeft: spacing.sm,
  },
  input: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 160,
    minHeight: 28,
    paddingHorizontal: spacing.xs + 2,
    paddingTop: 4,
    paddingBottom: 4,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chipScroll: {
    flex: 1,
  },
  chips: {
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipPressed: {
    backgroundColor: colors.surfacePressed,
  },
  chipLabel: {
    ...typography.caption,
    fontWeight: '500',
    maxWidth: 140,
  },
  round: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  roundActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  disabled: {
    opacity: 0.5,
  },
  action: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionEnabled: {
    backgroundColor: colors.text,
  },
  actionDisabled: {
    backgroundColor: colors.surfacePressed,
  },
  pressed: {
    opacity: 0.8,
  },
  footnote: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
