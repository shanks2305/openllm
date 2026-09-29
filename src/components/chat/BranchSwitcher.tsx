import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import type { BranchInfo } from '../../chat/branches';

type BranchSwitcherProps = {
  branch: BranchInfo;
  disabled?: boolean;
  onSwitch: (target: number) => void;
};

export function BranchSwitcher({
  branch,
  disabled = false,
  onSwitch,
}: BranchSwitcherProps) {
  const canBack = !disabled && branch.active > 0;
  const canForward = !disabled && branch.active < branch.count - 1;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous version"
        accessibilityState={{ disabled: !canBack }}
        disabled={!canBack}
        hitSlop={8}
        onPress={() => onSwitch(branch.active - 1)}
        style={styles.arrow}
      >
        <Text style={[styles.arrowLabel, !canBack && styles.off]}>‹</Text>
      </Pressable>
      <Text
        style={styles.count}
        accessibilityLabel={`Version ${branch.active + 1} of ${branch.count}`}
      >
        {branch.active + 1}/{branch.count}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next version"
        accessibilityState={{ disabled: !canForward }}
        disabled={!canForward}
        hitSlop={8}
        onPress={() => onSwitch(branch.active + 1)}
        style={styles.arrow}
      >
        <Text style={[styles.arrowLabel, !canForward && styles.off]}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  arrow: {
    paddingHorizontal: spacing.xs,
  },
  arrowLabel: {
    ...typography.body,
    fontSize: 20,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  off: {
    color: colors.border,
  },
  count: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
