import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ToolCall } from '../../chat/types';
import { colors, radii, spacing, typography } from '../../theme';
import { Icon } from '../ui/Icon';

const LABELS: Record<string, string> = {
  calculator: 'Calculated',
  current_datetime: 'Checked the date',
  convert_units: 'Converted units',
  search_chats: 'Searched chats',
  remember: 'Saved to memory',
};

function summary(call: ToolCall) {
  const args = Object.values(call.arguments ?? {})
    .map(value => (typeof value === 'string' ? value : JSON.stringify(value)))
    .join(', ');
  return args ? `${args} → ${call.result}` : call.result;
}

export function ToolCallList({ calls }: { calls: ToolCall[] }) {
  const [open, setOpen] = useState<number | null>(null);

  if (calls.length === 0) {
    return null;
  }

  return (
    <View style={styles.list}>
      {calls.map((call, index) => {
        const expanded = open === index;
        const failed = call.result.startsWith('Error');

        return (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityLabel={`${LABELS[call.name] ?? call.name}. ${expanded ? 'Hide' : 'Show'} details`}
            onPress={() => setOpen(expanded ? null : index)}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <View style={styles.row}>
              <Icon
                name="tool"
                size={12}
                color={failed ? colors.danger : colors.textMuted}
              />
              <Text style={styles.label}>
                {LABELS[call.name] ?? `Used ${call.name}`}
              </Text>
              {!expanded ? (
                <Text style={styles.inline} numberOfLines={1}>
                  {summary(call)}
                </Text>
              ) : null}
            </View>
            {expanded ? (
              <Text selectable style={styles.detail}>
                {`${call.name}(${JSON.stringify(call.arguments)})\n→ ${call.result}`}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.xs,
    marginBottom: spacing.sm + 2,
    alignItems: 'flex-start',
  },
  chip: {
    maxWidth: '100%',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.surfacePressed,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  inline: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    flexShrink: 1,
  },
  detail: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'Menlo',
    marginTop: 4,
    lineHeight: 17,
  },
});
