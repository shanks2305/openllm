import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';

const STARTER_PROMPTS = [
  'Explain a topic in plain language',
  'Help me write a short function',
  'List the tradeoffs of an approach',
];

export function EmptyState({
  hasModel = false,
  onPrompt,
  onManageModels,
}: {
  hasModel?: boolean;
  onPrompt?: (text: string) => void;
  onManageModels?: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.badgeLabel}>✦</Text>
      </View>
      <Text style={styles.title}>What can I help with?</Text>
      <Text style={styles.subtitle}>
        Ask anything. Replies run on-device once a model is loaded.
      </Text>
      {hasModel && onPrompt ? (
        <View style={styles.prompts}>
          {STARTER_PROMPTS.map(prompt => (
            <Pressable
              key={prompt}
              accessibilityRole="button"
              onPress={() => onPrompt(prompt)}
              style={({ pressed }) => [
                styles.prompt,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={styles.promptLabel}>{prompt}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {!hasModel && onManageModels ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Manage models"
          onPress={onManageModels}
        >
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
  prompts: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  prompt: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  promptLabel: {
    ...typography.body,
    textAlign: 'center',
  },
  link: {
    ...typography.body,
    color: colors.accent,
    marginTop: spacing.lg,
    fontWeight: '600',
  },
});
