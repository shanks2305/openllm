import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Attachment } from '../../chat/types';
import { colors, radii, spacing, typography } from '../../theme';
import { Icon } from '../ui/Icon';

type AttachmentStripProps = {
  attachments: Attachment[];
  onRemove?: (id: string) => void;
  align?: 'start' | 'end';
};

function fileUri(path: string) {
  return path.startsWith('file://') ? path : `file://${path}`;
}

export function AttachmentStrip({
  attachments,
  onRemove,
  align = 'start',
}: AttachmentStripProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.row,
        align === 'end' && styles.rowEnd,
      ]}
      style={align === 'end' ? styles.scrollEnd : undefined}
    >
      {attachments.map(item => (
        <View key={item.id} style={styles.item}>
          {item.kind === 'image' ? (
            <Image
              source={{ uri: fileUri(item.path) }}
              style={styles.thumb}
              accessibilityLabel={item.name}
            />
          ) : (
            <View style={styles.doc}>
              <View style={styles.docIcon}>
                <Icon name="file" size={18} color={colors.textSecondary} />
              </View>
              <View style={styles.docText}>
                <Text style={styles.docName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.docMeta} numberOfLines={1}>
                  {documentMeta(item.text.length, item.truncated)}
                </Text>
              </View>
            </View>
          )}
          {onRemove ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.name}`}
              hitSlop={8}
              onPress={() => onRemove(item.id)}
              style={styles.remove}
            >
              <Icon name="close" size={10} color={colors.onPrimary} />
            </Pressable>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

function documentMeta(chars: number, truncated?: boolean) {
  const words = Math.round(chars / 6);
  const label =
    words >= 1000 ? `${(words / 1000).toFixed(1)}k words` : `${words} words`;
  return truncated ? `${label}, cut short` : label;
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingTop: 6,
    paddingRight: 6,
  },
  rowEnd: {
    justifyContent: 'flex-end',
    flexGrow: 1,
  },
  scrollEnd: {
    alignSelf: 'flex-end',
    maxWidth: '100%',
  },
  item: {
    position: 'relative',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.surfacePressed,
  },
  doc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 64,
    maxWidth: 220,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  docIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfacePressed,
  },
  docText: {
    flexShrink: 1,
  },
  docName: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  docMeta: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
  },
});
