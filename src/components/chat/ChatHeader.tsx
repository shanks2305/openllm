import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../../theme';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';

type ChatHeaderProps = {
  modelName?: string;
  modelDisabled?: boolean;
  onOpenSidebar: () => void;
  onOpenModelPicker: () => void;
  onNewChat: () => void;
  onShare?: () => void;
};

export function ChatHeader({
  modelName,
  modelDisabled = false,
  onOpenSidebar,
  onOpenModelPicker,
  onNewChat,
  onShare,
}: ChatHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xs }]}>
      <View style={styles.side}>
        <IconButton
          icon="menu"
          accessibilityLabel="Open sidebar"
          onPress={onOpenSidebar}
        />
      </View>
      <View style={styles.center}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change model"
          accessibilityState={{ disabled: modelDisabled }}
          disabled={modelDisabled}
          onPress={onOpenModelPicker}
          style={({ pressed }) => [
            styles.model,
            pressed && styles.modelPressed,
            modelDisabled && styles.modelDisabled,
          ]}
        >
          <Text style={styles.modelName} numberOfLines={1}>
            {modelName ?? 'Choose a model'}
          </Text>
          <Icon name="chevronDown" size={14} color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={[styles.side, styles.sideEnd]}>
        {onShare ? (
          <IconButton
            icon="share"
            iconSize={19}
            accessibilityLabel="Share this chat"
            onPress={onShare}
          />
        ) : null}
        <IconButton
          icon="compose"
          iconSize={21}
          accessibilityLabel="Start a new chat"
          onPress={onNewChat}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
  },
  side: {
    width: 88,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  sideEnd: {
    justifyContent: 'flex-end',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  model: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: spacing.md - 4,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  modelPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  modelDisabled: {
    opacity: 0.5,
  },
  modelName: {
    ...typography.body,
    fontSize: 17,
    fontWeight: '600',
    flexShrink: 1,
  },
});
