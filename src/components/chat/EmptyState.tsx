import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export function EmptyState({ onManageModels }: { onManageModels?: () => void }) {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.badgeLabel}>✦</Text>
      </View>
      <Text style={styles.title}>What can I help with?</Text>
      <Text style={styles.subtitle}>
        Ask anything. Replies run on-device once a model is loaded.
      </Text>
      {onManageModels ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Manage models"
          onPress={onManageModels}>
          <Text style={styles.link}>Manage models</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    marginBottom: spacing.lg,
  },
  badgeLabel: {
    color: colors.accent,
    fontSize: 22,
  },
  title: {
    ...typography.title,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.caption,
    textAlign: 'center',
    lineHeight: 18,
  },
  link: {
    ...typography.body,
    color: colors.accent,
    marginTop: spacing.lg,
    fontWeight: '600',
  },
});
