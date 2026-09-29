import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, radii } from '../../theme';

type IconButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  style?: ViewStyle;
};

export function IconButton({
  label,
  onPress,
  accessibilityLabel,
  size = 36,
  style,
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size, borderRadius: size / 2, opacity: pressed ? 0.7 : 1 },
        style,
      ]}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  label: {
    color: colors.text,
    fontSize: 16,
  },
});
