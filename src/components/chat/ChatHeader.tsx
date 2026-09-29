import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../theme';
import { IconButton } from '../ui/IconButton';

type ChatHeaderProps = {
  title?: string;
  onOpenSidebar: () => void;
  onOpenSettings: () => void;
};

export function ChatHeader({
  title = 'llmOS',
  onOpenSidebar,
  onOpenSettings,
}: ChatHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.side}>
        <IconButton
          label="☰"
          accessibilityLabel="Open sidebar"
          onPress={onOpenSidebar}
        />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.sideEnd]}>
        <IconButton
          label="⚙"
          accessibilityLabel="Open settings"
          onPress={onOpenSettings}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  side: {
    width: 40,
    alignItems: 'flex-start',
  },
  sideEnd: {
    alignItems: 'flex-end',
  },
  title: {
    ...typography.body,
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
});
