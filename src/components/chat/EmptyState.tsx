import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';

const STARTER_PROMPTS = [
  {
    title: 'Explain a topic',
    subtitle: 'in plain, simple language',
    prompt: 'Explain a topic in plain language',
  },
  {
    title: 'Write a function',
    subtitle: 'short, clean and tested',
    prompt: 'Help me write a short function',
  },
  {
    title: 'Weigh the tradeoffs',
    subtitle: 'of an approach I am considering',
    prompt: 'List the tradeoffs of an approach',
  },
  {
    title: 'Brainstorm ideas',
    subtitle: 'for a weekend side project',
    prompt: 'Brainstorm ideas for a weekend side project',
  },
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
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>✳︎</Text>
        </View>
        <Text style={styles.title}>
          {hasModel ? 'What can I help with?' : 'Welcome to llmOS'}
        </Text>
        {!hasModel ? (
          <>
            <Text style={styles.subtitle}>
              Private AI that runs entirely on your device. Download a model to
              get started.
            </Text>
            {onManageModels ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Get a model"
                onPress={onManageModels}
                style={({ pressed }) => [
                  styles.cta,
                  pressed && styles.ctaPressed,
                ]}
              >
                <Text style={styles.ctaLabel}>Get a model</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>
      {hasModel && onPrompt ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.prompts}
          style={styles.promptScroll}
        >
          {STARTER_PROMPTS.map(item => (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              accessibilityLabel={item.prompt}
              onPress={() => onPrompt(item.prompt)}
              style={({ pressed }) => [
                styles.prompt,
                pressed && styles.promptPressed,
              ]}
            >
              <Text style={styles.promptTitle}>{item.title}</Text>
              <Text style={styles.promptSubtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    marginBottom: spacing.lg,
  },
  badgeLabel: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: '700',
  },
  title: {
    ...typography.display,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm + 4,
  },
  cta: {
    marginTop: spacing.lg,
    backgroundColor: colors.text,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaLabel: {
    ...typography.body,
    color: colors.onPrimary,
    fontWeight: '600',
  },
  promptScroll: {
    flexGrow: 0,
  },
  prompts: {
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + 4,
    paddingBottom: spacing.sm + 4,
  },
  prompt: {
    minWidth: 180,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  promptPressed: {
    backgroundColor: colors.surface,
  },
  promptTitle: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '600',
  },
  promptSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});
