/* eslint-disable react-native/no-inline-styles -- icon geometry scales with the size prop */
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';

export type IconName =
  | 'menu'
  | 'compose'
  | 'plus'
  | 'arrowUp'
  | 'stop'
  | 'copy'
  | 'check'
  | 'refresh'
  | 'share'
  | 'chevronDown'
  | 'chevronRight'
  | 'settings'
  | 'models'
  | 'search'
  | 'close'
  | 'folder'
  | 'memory'
  | 'mic'
  | 'speaker'
  | 'image'
  | 'expand'
  | 'file'
  | 'tool'
  | 'bulb';

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 20, color = colors.text }: IconProps) {
  const stroke = Math.max(1.5, Math.round(size / 11));
  const box = { width: size, height: size };

  switch (name) {
    case 'menu':
      return (
        <View
          style={[
            box,
            {
              justifyContent: 'center',
              paddingHorizontal: size * 0.1,
              gap: size * 0.22,
            },
          ]}
        >
          <View
            style={{
              width: size * 0.8,
              height: stroke,
              borderRadius: stroke,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              width: size * 0.5,
              height: stroke,
              borderRadius: stroke,
              backgroundColor: color,
            }}
          />
        </View>
      );
    case 'compose':
      return (
        <View style={[box, styles.center]}>
          <View
            style={[
              styles.center,
              {
                width: size * 0.8,
                height: size * 0.8,
                borderRadius: size * 0.22,
                borderWidth: stroke,
                borderColor: color,
              },
            ]}
          >
            <Plus size={size * 0.4} stroke={stroke} color={color} />
          </View>
        </View>
      );
    case 'plus':
      return (
        <View style={[box, styles.center]}>
          <Plus size={size * 0.75} stroke={stroke} color={color} />
        </View>
      );
    case 'close':
      return (
        <View style={[box, styles.center, { transform: [{ rotate: '45deg' }] }]}>
          <Plus size={size * 0.8} stroke={stroke} color={color} />
        </View>
      );
    case 'arrowUp':
      return (
        <View style={[box, styles.center]}>
          <View
            style={{
              position: 'absolute',
              width: stroke + 0.5,
              height: size * 0.72,
              top: size * 0.16,
              borderRadius: stroke,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: size * 0.2,
              width: size * 0.42,
              height: size * 0.42,
              borderTopWidth: stroke + 0.5,
              borderLeftWidth: stroke + 0.5,
              borderColor: color,
              transform: [{ rotate: '45deg' }],
            }}
          />
        </View>
      );
    case 'stop':
      return (
        <View style={[box, styles.center]}>
          <View
            style={{
              width: size * 0.45,
              height: size * 0.45,
              borderRadius: size * 0.08,
              backgroundColor: color,
            }}
          />
        </View>
      );
    case 'copy':
      return (
        <View style={box}>
          <View
            style={{
              position: 'absolute',
              top: size * 0.08,
              left: size * 0.08,
              width: size * 0.58,
              height: size * 0.58,
              borderRadius: size * 0.14,
              borderWidth: stroke,
              borderColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: size * 0.08,
              right: size * 0.08,
              width: size * 0.58,
              height: size * 0.58,
              borderRadius: size * 0.14,
              borderWidth: stroke,
              borderColor: color,
              backgroundColor: colors.background,
            }}
          />
        </View>
      );
    case 'check':
      return (
        <View style={[box, styles.center]}>
          <View
            style={{
              width: size * 0.32,
              height: size * 0.6,
              marginTop: -size * 0.12,
              borderBottomWidth: stroke + 0.5,
              borderRightWidth: stroke + 0.5,
              borderColor: color,
              transform: [{ rotate: '45deg' }],
            }}
          />
        </View>
      );
    case 'chevronDown':
    case 'chevronRight':
      return (
        <View style={[box, styles.center]}>
          <View
            style={{
              width: size * 0.4,
              height: size * 0.4,
              borderBottomWidth: stroke,
              borderRightWidth: stroke,
              borderColor: color,
              transform:
                name === 'chevronDown'
                  ? [{ translateY: -size * 0.1 }, { rotate: '45deg' }]
                  : [{ translateX: -size * 0.1 }, { rotate: '-45deg' }],
            }}
          />
        </View>
      );
    case 'share':
      return (
        <View style={[box, styles.center]}>
          <View
            style={{
              position: 'absolute',
              bottom: size * 0.08,
              width: size * 0.7,
              height: size * 0.5,
              borderWidth: stroke,
              borderTopWidth: 0,
              borderBottomLeftRadius: size * 0.12,
              borderBottomRightRadius: size * 0.12,
              borderColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: size * 0.04,
              width: stroke,
              height: size * 0.62,
              borderRadius: stroke,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: size * 0.06,
              width: size * 0.3,
              height: size * 0.3,
              borderTopWidth: stroke,
              borderLeftWidth: stroke,
              borderColor: color,
              transform: [{ rotate: '45deg' }],
            }}
          />
        </View>
      );
    case 'settings':
      return (
        <View style={[box, styles.center]}>
          <View
            style={[
              styles.center,
              {
                width: size * 0.78,
                height: size * 0.78,
                borderRadius: size,
                borderWidth: stroke,
                borderColor: color,
                borderStyle: 'dashed',
              },
            ]}
          >
            <View
              style={{
                width: size * 0.28,
                height: size * 0.28,
                borderRadius: size,
                borderWidth: stroke,
                borderColor: color,
              }}
            />
          </View>
        </View>
      );
    case 'models':
      return (
        <View style={[box, styles.center]}>
          <View
            style={[
              styles.center,
              {
                width: size * 0.74,
                height: size * 0.74,
                borderRadius: size * 0.18,
                borderWidth: stroke,
                borderColor: color,
              },
            ]}
          >
            <View
              style={{
                width: size * 0.26,
                height: size * 0.26,
                borderRadius: size * 0.06,
                backgroundColor: color,
              }}
            />
          </View>
        </View>
      );
    case 'search':
      return (
        <View style={box}>
          <View
            style={{
              position: 'absolute',
              top: size * 0.1,
              left: size * 0.1,
              width: size * 0.58,
              height: size * 0.58,
              borderRadius: size,
              borderWidth: stroke,
              borderColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: size * 0.16,
              right: size * 0.04,
              width: size * 0.32,
              height: stroke,
              borderRadius: stroke,
              backgroundColor: color,
              transform: [{ rotate: '45deg' }],
            }}
          />
        </View>
      );
    case 'folder':
      return (
        <View style={[box, styles.center]}>
          <View
            style={{
              position: 'absolute',
              top: size * 0.2,
              left: size * 0.08,
              width: size * 0.36,
              height: size * 0.2,
              borderTopLeftRadius: size * 0.08,
              borderTopRightRadius: size * 0.08,
              borderWidth: stroke,
              borderBottomWidth: 0,
              borderColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: size * 0.32,
              width: size * 0.84,
              height: size * 0.52,
              borderRadius: size * 0.1,
              borderWidth: stroke,
              borderColor: color,
            }}
          />
        </View>
      );
    case 'memory':
      return (
        <View style={[box, styles.center]}>
          <View
            style={{
              width: size * 0.7,
              height: size * 0.82,
              borderRadius: size * 0.12,
              borderWidth: stroke,
              borderColor: color,
              justifyContent: 'center',
              alignItems: 'center',
              gap: size * 0.1,
            }}
          >
            {[0.36, 0.36, 0.22].map((width, index) => (
              <View
                key={index}
                style={{
                  width: size * width,
                  height: stroke,
                  borderRadius: stroke,
                  backgroundColor: color,
                  alignSelf: 'center',
                }}
              />
            ))}
          </View>
        </View>
      );
    case 'mic':
      return (
        <View style={[box, styles.center]}>
          <View
            style={{
              position: 'absolute',
              top: size * 0.06,
              width: size * 0.36,
              height: size * 0.54,
              borderRadius: size,
              borderWidth: stroke,
              borderColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: size * 0.3,
              width: size * 0.62,
              height: size * 0.44,
              borderBottomLeftRadius: size,
              borderBottomRightRadius: size,
              borderWidth: stroke,
              borderTopWidth: 0,
              borderColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: size * 0.04,
              width: stroke,
              height: size * 0.2,
              backgroundColor: color,
            }}
          />
        </View>
      );
    case 'speaker':
      return (
        <View style={[box, styles.center]}>
          <View
            style={{
              position: 'absolute',
              left: size * 0.08,
              width: size * 0.2,
              height: size * 0.34,
              borderRadius: size * 0.04,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: size * 0.16,
              width: 0,
              height: 0,
              borderTopWidth: size * 0.3,
              borderBottomWidth: size * 0.3,
              borderRightWidth: size * 0.3,
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
              borderRightColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: size * 0.06,
              width: size * 0.3,
              height: size * 0.6,
              borderTopRightRadius: size,
              borderBottomRightRadius: size,
              borderWidth: stroke,
              borderLeftWidth: 0,
              borderColor: color,
            }}
          />
        </View>
      );
    case 'image':
      return (
        <View style={[box, styles.center]}>
          <View
            style={{
              width: size * 0.84,
              height: size * 0.68,
              borderRadius: size * 0.12,
              borderWidth: stroke,
              borderColor: color,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: size * 0.08,
                right: size * 0.1,
                width: size * 0.16,
                height: size * 0.16,
                borderRadius: size,
                backgroundColor: color,
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: -size * 0.22,
                left: size * 0.06,
                width: size * 0.4,
                height: size * 0.4,
                backgroundColor: color,
                transform: [{ rotate: '45deg' }],
              }}
            />
          </View>
        </View>
      );
    case 'expand':
      return (
        <View style={box}>
          <View
            style={{
              position: 'absolute',
              top: size * 0.12,
              right: size * 0.12,
              width: size * 0.34,
              height: size * 0.34,
              borderTopWidth: stroke,
              borderRightWidth: stroke,
              borderColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: size * 0.12,
              left: size * 0.12,
              width: size * 0.34,
              height: size * 0.34,
              borderBottomWidth: stroke,
              borderLeftWidth: stroke,
              borderColor: color,
            }}
          />
        </View>
      );
    case 'file':
      return (
        <View style={[box, styles.center]}>
          <View
            style={{
              width: size * 0.64,
              height: size * 0.82,
              borderRadius: size * 0.1,
              borderTopRightRadius: size * 0.26,
              borderWidth: stroke,
              borderColor: color,
              justifyContent: 'center',
              paddingLeft: size * 0.12,
              gap: size * 0.1,
            }}
          >
            {[0.3, 0.3, 0.2].map((width, index) => (
              <View
                key={index}
                style={{
                  width: size * width,
                  height: stroke,
                  borderRadius: stroke,
                  backgroundColor: color,
                }}
              />
            ))}
          </View>
        </View>
      );
    case 'tool':
      return (
        <View style={[box, styles.center, { transform: [{ rotate: '45deg' }] }]}>
          <View
            style={{
              position: 'absolute',
              top: size * 0.04,
              width: size * 0.4,
              height: size * 0.34,
              borderRadius: size * 0.08,
              borderWidth: stroke,
              borderColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: size * 0.36,
              width: stroke + 1,
              height: size * 0.58,
              borderRadius: stroke,
              backgroundColor: color,
            }}
          />
        </View>
      );
    case 'bulb':
      return (
        <View style={[box, styles.center]}>
          <View
            style={{
              position: 'absolute',
              top: size * 0.06,
              width: size * 0.58,
              height: size * 0.58,
              borderRadius: size,
              borderWidth: stroke,
              borderColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: size * 0.16,
              width: size * 0.3,
              height: stroke,
              borderRadius: stroke,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: size * 0.04,
              width: size * 0.2,
              height: stroke,
              borderRadius: stroke,
              backgroundColor: color,
            }}
          />
        </View>
      );
    case 'refresh':
      return (
        <View style={[box, styles.center]}>
          <Text
            allowFontScaling={false}
            style={{
              color,
              fontSize: size * 0.95,
              lineHeight: size,
              fontWeight: '600',
            }}
          >
            {'\u21BB\uFE0E'}
          </Text>
        </View>
      );
  }
}

function Plus({
  size,
  stroke,
  color,
}: {
  size: number;
  stroke: number;
  color: string;
}) {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: stroke,
          borderRadius: stroke,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: stroke,
          height: size,
          borderRadius: stroke,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
