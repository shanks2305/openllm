import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../../theme';
import { Icon } from '../ui/Icon';

type ThinkingBlockProps = {
  text: string;
  done: boolean;
};

// Collapsed by default, so the answer stays in focus. While streaming, the
// last line shows as a live preview.
export function ThinkingBlock({ text, done }: ThinkingBlockProps) {
  const [open, setOpen] = useState(false);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const preview = text.trim().split('\n').filter(Boolean).pop() ?? '';

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? 'Hide reasoning' : 'Show reasoning'}
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        onPress={() => setOpen(value => !value)}
        style={styles.header}
      >
        <Icon name="bulb" size={14} color={colors.textMuted} />
        <Text style={styles.title}>
          {done ? `Thought for ${words} words` : 'Thinking…'}
        </Text>
        <Icon
          name={open ? 'chevronDown' : 'chevronRight'}
          size={12}
          color={colors.textMuted}
        />
      </Pressable>
      {open ? (
        <Text selectable style={styles.body}>
          {text.trim()}
        </Text>
      ) : !done && preview ? (
        <Text style={styles.preview} numberOfLines={2}>
          {preview}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.sm + 2,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm + 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: radii.sm,
  },
  title: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '500',
  },
  body: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 19,
    marginTop: spacing.xs + 2,
  },
  preview: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: spacing.xs,
  },
});
