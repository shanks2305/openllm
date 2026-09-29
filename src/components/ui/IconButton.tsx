import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors } from '../../theme';
import { Icon, type IconName } from './Icon';

type IconButtonProps = {
  label?: string;
  icon?: IconName;
  iconSize?: number;
  color?: string;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  filled?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function IconButton({
  label,
  icon,
  iconSize,
  color = colors.text,
  onPress,
  accessibilityLabel,
  size = 40,
  filled = false,
  disabled = false,
  style,
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: pressed
            ? colors.surfacePressed
            : filled
            ? colors.surfaceElevated
            : 'transparent',
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={iconSize ?? Math.round(size * 0.5)}
          color={color}
        />
      ) : (
        <Text style={[styles.label, { color }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 20,
  },
});
