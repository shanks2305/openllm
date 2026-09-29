import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../theme';
import { IconButton } from './IconButton';

type ScreenHeaderProps = {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
};

export function ScreenHeader({ title, onBack, right }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.side}>
        {onBack ? (
          <IconButton
            icon="chevronRight"
            style={styles.back}
            accessibilityLabel="Go back"
            onPress={onBack}
          />
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.sideEnd]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  side: {
    width: 48,
    alignItems: 'flex-start',
  },
  back: {
    transform: [{ scaleX: -1 }],
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
