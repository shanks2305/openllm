import {
  Clipboard,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';
import { parseMarkdown, type MarkdownSpan } from '../../chat/markdown';

type MarkdownBodyProps = {
  content: string;
};

export function MarkdownBody({ content }: MarkdownBodyProps) {
  const blocks = parseMarkdown(content);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <View style={styles.stack}>
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          return (
            <View key={`code-${index}`} style={styles.codeBlock}>
              <View style={styles.codeHeader}>
                <Text style={styles.codeLanguage}>
                  {block.language || 'code'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Copy code"
                  onPress={() => {
                    Clipboard.setString(block.value);
                  }}
                >
                  <Text style={styles.copy}>Copy</Text>
                </Pressable>
              </View>
              <Text selectable style={styles.code}>
                {block.value}
              </Text>
            </View>
          );
        }

        if (block.type === 'list') {
          return (
            <View key={`list-${index}`} style={styles.list}>
              {block.items.map((item, itemIndex) => (
                <View key={itemIndex} style={styles.listRow}>
                  <Text style={styles.marker}>
                    {block.ordered ? `${itemIndex + 1}.` : '•'}
                  </Text>
                  <Text selectable style={styles.body}>
                    {renderSpans(item)}
                  </Text>
                </View>
              ))}
            </View>
          );
        }

        return (
          <Text key={`p-${index}`} selectable style={styles.body}>
            {renderSpans(block.spans)}
          </Text>
        );
      })}
    </View>
  );
}

function renderSpans(spans: MarkdownSpan[]) {
  return spans.map((span, index) => {
    if (span.type === 'bold') {
      return (
        <Text key={index} style={styles.bold}>
          {span.text}
        </Text>
      );
    }

    if (span.type === 'italic') {
      return (
        <Text key={index} style={styles.italic}>
          {span.text}
        </Text>
      );
    }

    if (span.type === 'code') {
      return (
        <Text key={index} style={styles.inlineCode}>
          {span.text}
        </Text>
      );
    }

    if (span.type === 'link') {
      return (
        <Text
          key={index}
          style={styles.link}
          onPress={() => {
            Linking.openURL(span.url).catch(() => undefined);
          }}
        >
          {span.text}
        </Text>
      );
    }

    return <Text key={index}>{span.text}</Text>;
  });
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.sm,
  },
  body: {
    ...typography.body,
    flex: 1,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  inlineCode: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
  },
  link: {
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  list: {
    gap: spacing.xs,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  marker: {
    ...typography.body,
    lineHeight: 22,
    color: colors.textSecondary,
    minWidth: 18,
  },
  codeBlock: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeLanguage: {
    ...typography.caption,
    color: colors.textMuted,
  },
  copy: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
});
